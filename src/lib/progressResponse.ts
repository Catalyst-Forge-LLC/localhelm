/** Shared browser-safe reader for dashboard progress responses. */
export const INCOMPLETE_PROGRESS = 'The connection ended before the final result. Refresh status to check what completed before trying again.';

export async function readProgressResponse(
	response: Response,
	onEvent: (event: Record<string, unknown>) => void,
): Promise<unknown> {
	const httpError = `Dashboard request failed (${response.status} ${response.statusText}).`;
	if (!response.headers.get('content-type')?.includes('ndjson')) {
		let data: unknown;
		try { data = await response.json(); }
		catch { throw new Error(response.ok ? 'Dashboard returned a non-JSON response.' : httpError); }
		if (!response.ok) {
			const error = data && typeof data === 'object' && 'error' in data ? data.error : null;
			throw new Error(typeof error === 'string' ? error : httpError);
		}
		return data;
	}
	if (!response.ok) throw new Error(httpError);
	if (!response.body) throw new Error(INCOMPLETE_PROGRESS);
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	const take = (line: string): Record<string, unknown> | undefined => {
		if (!line.trim()) return;
		let event: unknown;
		try { event = JSON.parse(line); }
		catch { throw new Error(`Dashboard sent incomplete or invalid progress data. ${INCOMPLETE_PROGRESS}`); }
		if (!event || typeof event !== 'object' || Array.isArray(event) || !('type' in event)) {
			throw new Error(`Dashboard sent invalid progress data. ${INCOMPLETE_PROGRESS}`);
		}
		const value = event as Record<string, unknown>;
		if (value.type === 'error') throw new Error(String(value.error ?? 'Dashboard action failed.'));
		if (value.type === 'result') return value;
		onEvent(value);
	};
	try {
		while (true) {
			let chunk: Awaited<ReturnType<typeof reader.read>>;
			try { chunk = await reader.read(); }
			catch { throw new Error(INCOMPLETE_PROGRESS); }
			buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			if (chunk.done && buffer.trim()) lines.push(buffer);
			for (const line of lines) {
				const result = take(line);
				if (result) return result;
			}
			if (chunk.done) throw new Error(INCOMPLETE_PROGRESS);
		}
	} finally {
		// A terminal result is authoritative; do not wait forever for a proxy to close.
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
