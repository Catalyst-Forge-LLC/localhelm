import { slipOpenPage } from './slipDoorPage.js';

export const LOCALSLIP_DASHBOARD_PORT = 54321;

export function slipUpstreamUrl(pathname: string, search: string): string {
	return `http://127.0.0.1:${LOCALSLIP_DASHBOARD_PORT}${pathname}${search}`;
}

export function slipDoorDownPage(): string {
	return slipOpenPage({
		title: 'LocalSlip is not up',
		heading: 'LocalSlip is not up',
		detail: 'The slip list lives on :54321.',
		hint: 'Start localslip serve, then open this address again.'
	});
}

/** Ask LocalSlip for `/s/<name>`. The browser host is forwarded so the redirect stays on it. */
export async function proxySlipOpen(
	request: { pathname: string; search: string; host: string | null; method: string },
	fetchImpl: typeof fetch = fetch
): Promise<Response> {
	try {
		const upstream = await fetchImpl(slipUpstreamUrl(request.pathname, request.search), {
			method: request.method || 'GET',
			redirect: 'manual',
			headers: { host: request.host ?? '' },
			signal: AbortSignal.timeout(4000)
		});
		const headers = new Headers();
		const location = upstream.headers.get('location');
		if (location) headers.set('location', location);
		const type = upstream.headers.get('content-type');
		if (type) headers.set('content-type', type);
		headers.set('cache-control', 'no-store');
		const body = request.method === 'HEAD' ? null : await upstream.text();
		return new Response(body, { status: upstream.status, headers });
	} catch {
		return new Response(slipDoorDownPage(), {
			status: 503,
			headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
		});
	}
}
