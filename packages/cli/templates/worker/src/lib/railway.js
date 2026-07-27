/**
 * Railway API Client
 * Fetches estimated usage and deployment data from Railway's GraphQL API.
 */

import { createLogger } from "@techstream/quark-core";
import { AppError } from "@techstream/quark-core/errors";

const log = createLogger("lib:railway");

const RAILWAY_GRAPHQL_URL = "https://backboard.railway.com/graphql/v2";

/**
 * Execute a GraphQL query against Railway's API.
 */
async function graphql(query, variables = {}) {
	const token = process.env.RAILWAY_API_TOKEN;
	if (!token) {
		throw new AppError(
			"RAILWAY_API_TOKEN is not configured",
			500,
			"RAILWAY_API_TOKEN_MISSING",
		);
	}

	const response = await fetch(RAILWAY_GRAPHQL_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		throw new AppError(
			`Railway API error: ${response.status} ${response.statusText}`,
			response.status,
			"RAILWAY_API_ERROR",
		);
	}

	const json = await response.json();

	if (json.errors) {
		throw new AppError(
			`Railway GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`,
			502,
			"RAILWAY_GRAPHQL_ERROR",
		);
	}

	return json.data;
}

/**
 * Fetch deployments for a specific Railway project/environment.
 *
 * @param {string} railwayProjectId - Railway project ID
 * @param {string} [environmentId] - Optional environment ID
 * @returns {Promise<Array>} Deployment records
 */
export async function fetchProjectDeployments(railwayProjectId, environmentId) {
	log.info("Fetching Railway deployments", { railwayProjectId, environmentId });

	const query = `
    query GetProjectDeployments($input: DeploymentListInput!) {
      deployments(input: $input) {
        edges {
          node {
            id
            status
            createdAt
            meta
            serviceId
            service {
              id
              name
            }
          }
        }
      }
    }
  `;

	try {
		const data = await graphql(query, {
			input: {
				projectId: railwayProjectId,
				...(environmentId ? { environmentId } : {}),
			},
		});
		const edges = data?.deployments?.edges || [];
		return edges.map((e) => e.node);
	} catch (error) {
		log.error("Failed to fetch Railway deployments", {
			railwayProjectId,
			error: error.message,
		});
		return [];
	}
}

/**
 * Fetch workspace-level billing data.
 * Returns the total dollar cost for the current billing period.
 *
 * @param {string} workspaceId - Railway workspace ID
 * @returns {Promise<object|null>} Billing data with currentUsage, billingPeriod, state
 */
export async function fetchWorkspaceBilling(workspaceId) {
	log.info("Fetching workspace billing", { workspaceId });

	const query = `
    query GetWorkspaceBilling($workspaceId: String!) {
      workspace(workspaceId: $workspaceId) {
        id
        name
        plan
        customer {
          currentUsage
          creditBalance
          appliedCredits
          billingPeriod {
            start
            end
          }
          state
          isTrialing
          isUsageSubscriber
        }
      }
    }
  `;

	try {
		const data = await graphql(query, { workspaceId });
		const workspace = data?.workspace;
		if (!workspace?.customer) {
			log.warn("No customer billing data found", { workspaceId });
			return null;
		}
		return {
			workspaceId: workspace.id,
			workspaceName: workspace.name,
			plan: workspace.plan,
			currentUsage: workspace.customer.currentUsage,
			creditBalance: workspace.customer.creditBalance,
			appliedCredits: workspace.customer.appliedCredits,
			billingPeriodStart: workspace.customer.billingPeriod.start,
			billingPeriodEnd: workspace.customer.billingPeriod.end,
			state: workspace.customer.state,
			isTrialing: workspace.customer.isTrialing,
			isUsageSubscriber: workspace.customer.isUsageSubscriber,
		};
	} catch (error) {
		log.error("Failed to fetch workspace billing", {
			workspaceId,
			error: error.message,
		});
		return null;
	}
}

/**
 * Normalize a Railway deployment record to our Deployment format.
 *
 * @param {object} deploy - Raw deployment node from Railway API
 * @param {string} projectId - Our managed project ID
 * @returns {object} Normalized deployment data
 */
export function normalizeDeployment(deploy, projectId) {
	const statusMap = {
		SUCCESS: "SUCCESS",
		FAILED: "FAILED",
		BUILDING: "BUILDING",
		DEPLOYING: "DEPLOYING",
		CANCELLED: "CANCELLED",
		REMOVED: "CANCELLED",
		SKIPPED: "CANCELLED",
	};

	const meta = deploy.meta || {};

	return {
		projectId,
		service: deploy.service?.name || deploy.serviceId || "unknown",
		railwayId: deploy.id,
		status: statusMap[deploy.status] || "SUCCESS",
		commitMessage: meta.commitMessage || null,
		commitSha: meta.commitHash || null,
		branch: meta.branch || null,
		source: "railway",
		deployedAt: new Date(deploy.createdAt),
	};
}

/**
 * Fetch services for a Railway project with their latest deployment state.
 * Railway's API uses Relay-style connections.
 *
 * @param {string} railwayProjectId - Railway project ID
 * @returns {Promise<Array>} Services with their latest deployment info
 */
export async function fetchProjectServices(railwayProjectId) {
	log.info("Fetching project services", { railwayProjectId });

	const query = `
    query GetProjectServices($projectId: String!) {
      project(id: $projectId) {
        services {
          edges {
            node {
              id
              name
              deployments(first: 1) {
                edges {
                  node {
                    id
                    status
                    createdAt
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

	try {
		const data = await graphql(query, {
			projectId: railwayProjectId,
		});
		const edges = data?.project?.services?.edges || [];
		return edges.map((e) => {
			const service = e.node;
			const deployEdges = service.deployments?.edges || [];
			const latestDeployment = deployEdges[0]?.node || null;
			return {
				id: service.id,
				name: service.name,
				currentDeployment: latestDeployment,
			};
		});
	} catch (error) {
		log.error("Failed to fetch project services", {
			railwayProjectId,
			error: error.message,
		});
		return [];
	}
}

/**
 * Fetch the most recent deployments for a specific service within a project.
 *
 * @param {string} railwayProjectId - Railway project ID
 * @param {object} options
 * @param {string} options.serviceId - The service ID to filter deployments by
 * @param {number} [options.limit=5] - Maximum number of deployments to return
 * @returns {Promise<Array>} Array of deployment nodes
 */
export async function fetchLatestDeployments(
	railwayProjectId,
	{ serviceId, limit = 5 },
) {
	log.info("Fetching latest Railway deployments", {
		railwayProjectId,
		serviceId,
		limit,
	});

	const query = `
    query GetLatestDeployments($input: DeploymentListInput!) {
      deployments(input: $input) {
        edges {
          node {
            id
            status
            createdAt
            meta
            serviceId
            service {
              id
              name
            }
          }
        }
      }
    }
  `;

	try {
		const data = await graphql(query, {
			input: {
				projectId: railwayProjectId,
				serviceId,
				first: limit,
			},
		});
		const edges = data?.deployments?.edges || [];
		return edges.map((e) => e.node);
	} catch (error) {
		log.error("Failed to fetch latest Railway deployments", {
			railwayProjectId,
			serviceId,
			error: error.message,
		});
		return [];
	}
}

/**
 * Railway usage pricing rates (from Railway dashboard).
 * Rates are in USD per unit per minute unless otherwise noted.
 */
const USAGE_RATES = {
	CPU: 0.000463, // $ per vCPU / minute
	MEMORY: 0.000231, // $ per GB / minute
	EGRESS: 0.05, // $ per GB (total, not per minute)
	VOLUME: 0.00000347, // $ per GB / minute
	BACKUP: 0.00000347, // $ per GB / minute
};

/**
 * Fetch actual resource usage for a Railway project.
 * Returns metered usage data (not estimated) that matches Railway's dashboard.
 * The values are in minutely-accumulated units (vCPU-minutes, GB-minutes).
 *
 * @param {string} railwayProjectId - Railway project ID
 * @param {object} [options]
 * @param {string} [options.startDate] - ISO date string for period start
 * @param {string} [options.endDate] - ISO date string for period end
 * @returns {Promise<{metrics: object, costs: object, totalCost: number}>}
 */
export async function fetchProjectUsage(railwayProjectId, options = {}) {
	log.info("Fetching project usage", { railwayProjectId, ...options });

	const measurements = [
		"CPU_USAGE",
		"MEMORY_USAGE_GB",
		"NETWORK_TX_GB",
		"NETWORK_RX_GB",
		"DISK_USAGE_GB",
		"BACKUP_USAGE_GB",
	];

	const query = `
    query GetProjectUsage($projectId: String!, $measurements: [MetricMeasurement!]!) {
      usage(projectId: $projectId, measurements: $measurements) {
        measurement
        value
      }
    }
  `;

	const variables = { projectId: railwayProjectId, measurements };

	// Add date range if provided
	let finalQuery = query;
	let finalVars = variables;
	if (options.startDate && options.endDate) {
		finalQuery = `
      query GetProjectUsage($projectId: String!, $measurements: [MetricMeasurement!]!, $startDate: DateTime!, $endDate: DateTime!) {
        usage(projectId: $projectId, measurements: $measurements, startDate: $startDate, endDate: $endDate) {
          measurement
          value
        }
      }
    `;
		finalVars = {
			...variables,
			startDate: options.startDate,
			endDate: options.endDate,
		};
	}

	try {
		const data = await graphql(finalQuery, finalVars);
		const usage = data?.usage || [];

		// Build metrics map
		const metrics = {};
		for (const u of usage) {
			metrics[u.measurement] = u.value;
		}

		// Calculate costs
		const cpuValue = metrics.CPU_USAGE || 0;
		const memValue = metrics.MEMORY_USAGE_GB || 0;
		const netTx = metrics.NETWORK_TX_GB || 0;
		const netRx = metrics.NETWORK_RX_GB || 0;
		const diskValue = metrics.DISK_USAGE_GB || 0;
		const backupValue = metrics.BACKUP_USAGE_GB || 0;

		const costs = {
			cpu: cpuValue * USAGE_RATES.CPU,
			memory: memValue * USAGE_RATES.MEMORY,
			egress: netTx * USAGE_RATES.EGRESS,
			volume: diskValue * USAGE_RATES.VOLUME,
			backup: backupValue * USAGE_RATES.BACKUP,
		};

		const totalCost = Object.values(costs).reduce((sum, c) => sum + c, 0);

		return {
			metrics: {
				cpu: cpuValue,
				memory: memValue,
				networkTx: netTx,
				networkRx: netRx,
				disk: diskValue,
				backup: backupValue,
			},
			costs,
			totalCost,
		};
	} catch (error) {
		log.error("Failed to fetch project usage", {
			railwayProjectId,
			error: error.message,
		});
		return {
			metrics: {
				cpu: 0,
				memory: 0,
				networkTx: 0,
				networkRx: 0,
				disk: 0,
				backup: 0,
			},
			costs: { cpu: 0, memory: 0, egress: 0, volume: 0, backup: 0 },
			totalCost: 0,
		};
	}
}
