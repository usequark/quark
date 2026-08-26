function isPublishedResultEmpty(result) {
	return result == null || (Array.isArray(result) && result.length === 0);
}

export async function loadPublishedResultWithFallback(
	key,
	{ loadCached, loadDirect },
) {
	const cachedResult = await loadCached(key);
	if (!isPublishedResultEmpty(cachedResult)) {
		return cachedResult;
	}

	const directResult = await loadDirect(key);
	return isPublishedResultEmpty(directResult) ? cachedResult : directResult;
}
