interface QueueItem {
	id: string;
	method: string;
	path: string;
	body: string | null;
	timestamp: number;
}

const STORAGE_KEY = "offline_queue";
let queue: QueueItem[] = [];
let loaded = false;

async function loadQueue(): Promise<void> {
	if (loaded) return;
	try {
		const AsyncStorage = (
			await import("@react-native-async-storage/async-storage")
		).default;
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		if (raw) {
			queue = JSON.parse(raw);
		}
	} catch {
		queue = [];
	}
	loaded = true;
}

async function saveQueue(): Promise<void> {
	try {
		const AsyncStorage = (
			await import("@react-native-async-storage/async-storage")
		).default;
		await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
	} catch {}
}

/**
 * Enqueue a mutation to replay later.
 */
export async function enqueueMutation(
	method: string,
	path: string,
	body: string | null,
): Promise<void> {
	await loadQueue();
	const item: QueueItem = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
		method: method.toUpperCase(),
		path,
		body,
		timestamp: Date.now(),
	};
	queue.push(item);
	await saveQueue();
}

/**
 * Get all pending mutations.
 */
export async function getPendingMutations(): Promise<QueueItem[]> {
	await loadQueue();
	return [...queue];
}

/**
 * Remove a mutation from the queue after successful replay.
 */
export async function removeMutation(id: string): Promise<void> {
	await loadQueue();
	queue = queue.filter((item) => item.id !== id);
	await saveQueue();
}

/**
 * Clear all pending mutations.
 */
export async function clearQueue(): Promise<void> {
	queue = [];
	await saveQueue();
}

/**
 * Replay all pending mutations in order.
 * Returns array of { id, success, error } results.
 */
export async function replayQueue(
	fetchFn: (method: string, path: string, body: string | null) => Promise<Response>,
): Promise<Array<{ id: string; success: boolean; error?: string }>> {
	await loadQueue();
	const results: Array<{ id: string; success: boolean; error?: string }> = [];

	for (const item of queue) {
		try {
			const response = await fetchFn(item.method, item.path, item.body);
			if (response.ok) {
				await removeMutation(item.id);
				results.push({ id: item.id, success: true });
			} else {
				results.push({
					id: item.id,
					success: false,
					error: `HTTP ${response.status}`,
				});
			}
		} catch (error) {
			results.push({
				id: item.id,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return results;
}
