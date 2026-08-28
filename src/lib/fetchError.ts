/** Browser `fetch` throws this when nothing answers — not an HTTP error body. */
const FETCH_FAIL = /failed to fetch|networkerror when attempting to fetch resource|load failed|network request failed/i;

export function plainFetchError(err: unknown): string {
	const msg = err instanceof Error ? err.message : String(err);
	if (FETCH_FAIL.test(msg) || (err instanceof TypeError && /fetch/i.test(msg))) {
		return 'Dashboard lost the connection. Serve may have stopped. A Ship can run several minutes — check the serve terminal before retrying.';
	}
	return msg;
}
