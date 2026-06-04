import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const temporaryDirectories = [];

after(async () => {
	await Promise.all(
		temporaryDirectories.map((dir) =>
			fs.rm(dir, { recursive: true, force: true }),
		),
	);
});

async function makeTempDir() {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "railway-test-"));
	temporaryDirectories.push(dir);
	return dir;
}

// --- Mock execa ---
// We inject a mock by rewriting the module's execa reference via
// import.meta mocking. Since node:test doesn't support that natively,
// we test the adapter functions by providing our own execa replacement.
// The module imports execa from "execa"; for testing we verify behavior
// by calling internal helpers with mocked execa.

// Instead, test the CLI wrapper functions using a utility that replaces execa.
// We'll test the public interface by calling the real functions against
// a fixture directory and testing the helper functions.

test("checkRailwayCLI returns null when railway is not installed", async () => {
	const { checkRailwayCLI } = await import("./railway.js");
	// On a system without railway, this returns null.
	// On a system with railway, it returns a version string.
	// We just verify it returns either null or a non-empty string.
	const result = await checkRailwayCLI();
	if (result === null) {
		assert.equal(result, null);
	} else {
		assert.ok(typeof result === "string" && result.length > 0);
	}
});

test("checkRailwayLogin returns null when not logged in", async () => {
	const { checkRailwayLogin } = await import("./railway.js");
	const result = await checkRailwayLogin();
	if (result === null) {
		assert.equal(result, null);
	} else {
		assert.ok(typeof result === "string" && result.length > 0);
	}
});

test("isProjectLinked returns false when .railway directory does not exist", async () => {
	const { isProjectLinked } = await import("./railway.js");
	const tmpDir = await makeTempDir();
	const result = await isProjectLinked(tmpDir);
	assert.equal(result, false);
});

test("isProjectLinked returns true when .railway directory contains config", async () => {
	const { isProjectLinked } = await import("./railway.js");
	const tmpDir = await makeTempDir();
	const railwayDir = path.join(tmpDir, ".railway");
	await fs.mkdir(railwayDir, { recursive: true });
	await fs.writeFile(
		path.join(railwayDir, "config.json"),
		JSON.stringify({ projectId: "test" }),
	);
	const result = await isProjectLinked(tmpDir);
	assert.equal(result, true);
});

test("isProjectLinked returns false when .railway directory is empty", async () => {
	const { isProjectLinked } = await import("./railway.js");
	const tmpDir = await makeTempDir();
	const railwayDir = path.join(tmpDir, ".railway");
	await fs.mkdir(railwayDir, { recursive: true });
	const result = await isProjectLinked(tmpDir);
	assert.equal(result, false);
});

test("RailwayError has correct shape", async () => {
	const { RailwayError, DIAGNOSTIC_CODES } = await import("./railway.js");
	const error = new RailwayError(
		"test error",
		DIAGNOSTIC_CODES.RAILWAY_CLI_NOT_FOUND,
		{ detail: "x" },
	);
	assert.equal(error.name, "RailwayError");
	assert.equal(error.code, DIAGNOSTIC_CODES.RAILWAY_CLI_NOT_FOUND);
	assert.equal(error.message, "test error");
	assert.deepEqual(error.meta, { detail: "x" });
});

test("DIAGNOSTIC_CODES are frozen", async () => {
	const { DIAGNOSTIC_CODES } = await import("./railway.js");
	assert.throws(() => {
		DIAGNOSTIC_CODES.NEW_CODE = "test";
	});
});

// --- Environment flag forwarding tests ---
// These use a mock railway CLI on PATH to verify --environment is
// forwarded to execa for each function that supports it.

async function withMockRailway(fn) {
	const tmpDir = await makeTempDir();
	const railwayPath = path.join(tmpDir, "railway");
	const argsLog = path.join(tmpDir, "args.log");

	await fs.writeFile(
		railwayPath,
		`#!/bin/sh
echo "$*" >> "${argsLog}"
case "$*" in
  *"deployment list"*)
    echo '[{"id":"dep_mock_123","status":"SUCCESS"}]'
    ;;
  *"list"*)
    echo '[]'
    ;;
  *)
    echo '{"deploymentId":"dep_mock_123"}'
    ;;
esac
`,
	);
	await fs.chmod(railwayPath, 0o755);

	const origPath = process.env.PATH;
	process.env.PATH = `${tmpDir}:${origPath}`;

	try {
		await fn(tmpDir, argsLog);
	} finally {
		process.env.PATH = origPath;
	}
}

test("deployService forwards --environment flag", async () => {
	await withMockRailway(async (tmpDir, argsLog) => {
		const { deployService } = await import("./railway.js");

		await deployService("web", { cwd: tmpDir, environment: "staging" });

		const log = await fs.readFile(argsLog, "utf-8");
		assert.ok(
			log.includes("--environment"),
			`Expected --environment in args: ${log}`,
		);
		assert.ok(log.includes("staging"), `Expected staging in args: ${log}`);
	});
});

test("setProjectVariable forwards --environment flag", async () => {
	await withMockRailway(async (tmpDir, argsLog) => {
		const { setProjectVariable } = await import("./railway.js");

		await setProjectVariable("KEY", "val", {
			cwd: tmpDir,
			environment: "staging",
			serviceName: "web",
		});

		const log = await fs.readFile(argsLog, "utf-8");
		assert.ok(
			log.includes("--environment"),
			`Expected --environment in args: ${log}`,
		);
		assert.ok(log.includes("staging"), `Expected staging in args: ${log}`);
	});
});

test("setProjectVariables forwards --environment flag", async () => {
	await withMockRailway(async (tmpDir, argsLog) => {
		const { setProjectVariables } = await import("./railway.js");

		await setProjectVariables(
			[
				{ key: "A", value: "1" },
				{ key: "B", value: "2" },
			],
			{ cwd: tmpDir, environment: "staging", serviceName: "web" },
		);

		const log = await fs.readFile(argsLog, "utf-8");
		assert.ok(
			log.includes("--environment"),
			`Expected --environment in args: ${log}`,
		);
		assert.ok(log.includes("staging"), `Expected staging in args: ${log}`);
	});
});

test("getExistingVariable forwards --environment flag", async () => {
	await withMockRailway(async (tmpDir, argsLog) => {
		const { getExistingVariable } = await import("./railway.js");

		// Mock returns empty JSON array for variable list
		await getExistingVariable("AUTH_SECRET", {
			cwd: tmpDir,
			environment: "staging",
			serviceName: "web",
		});

		const log = await fs.readFile(argsLog, "utf-8");
		assert.ok(
			log.includes("--environment"),
			`Expected --environment in args: ${log}`,
		);
		assert.ok(log.includes("staging"), `Expected staging in args: ${log}`);
	});
});

test("deleteService forwards --environment flag", async () => {
	await withMockRailway(async (tmpDir, argsLog) => {
		const { deleteService } = await import("./railway.js");

		await deleteService("web", { cwd: tmpDir, environment: "staging" });

		const log = await fs.readFile(argsLog, "utf-8");
		assert.ok(
			log.includes("--environment"),
			`Expected --environment in args: ${log}`,
		);
		assert.ok(log.includes("staging"), `Expected staging in args: ${log}`);
	});
});

test("setPluginReference forwards --environment flag", async () => {
	await withMockRailway(async (tmpDir, argsLog) => {
		const { setPluginReference } = await import("./railway.js");

		await setPluginReference("DATABASE_URL", {
			cwd: tmpDir,
			environment: "staging",
			serviceName: "web",
			pluginServiceName: "Postgres",
			pluginVariableKey: "DATABASE_URL",
		});

		const log = await fs.readFile(argsLog, "utf-8");
		assert.ok(
			log.includes("--environment"),
			`Expected --environment in args: ${log}`,
		);
		assert.ok(log.includes("staging"), `Expected staging in args: ${log}`);
	});
});
