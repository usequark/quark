import { apiClient } from "./api-client";

/**
 * Typed API client functions.
 * JSDoc types used; replace with generated types when OpenAPI spec is available.
 */

/**
 * Get the current user's profile.
 * @returns {Promise<{ id: string, email: string, name: string | null, role: string }>}
 */
export async function getProfile() {
	const { data } = await apiClient("/api/users/me");
	return data;
}

/**
 * Update the current user's profile.
 * @param {object} updates - Fields to update
 */
export async function updateProfile(updates: Record<string, unknown>) {
	const { data } = await apiClient("/api/users/me", {
		method: "PATCH",
		body: JSON.stringify(updates),
	});
	return data;
}

/**
 * List items with pagination.
 * @param {object} params - Query parameters
 */
export async function listItems(params = {}) {
	const query = new URLSearchParams(params).toString();
	const path = query ? `/api/items?${query}` : "/api/items";
	const { data } = await apiClient(path);
	return data;
}

/**
 * Get a single item by ID.
 * @param {string} id
 */
export async function getItem(id: string) {
	const { data } = await apiClient(`/api/items/${id}`);
	return data;
}

/**
 * Create a new item.
 * @param {object} itemData
 */
export async function createItem(itemData: Record<string, unknown>) {
	const { data } = await apiClient("/api/items", {
		method: "POST",
		body: JSON.stringify(itemData),
	});
	return data;
}

/**
 * Update an item.
 * @param {string} id
 * @param {object} updates
 */
export async function updateItem(id: string, updates: Record<string, unknown>) {
	const { data } = await apiClient(`/api/items/${id}`, {
		method: "PATCH",
		body: JSON.stringify(updates),
	});
	return data;
}

/**
 * Delete an item.
 * @param {string} id
 */
export async function deleteItem(id: string) {
	const { data } = await apiClient(`/api/items/${id}`, {
		method: "DELETE",
	});
	return data;
}
