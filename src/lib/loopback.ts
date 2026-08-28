/** Bind / peer helpers. Safe for the dashboard client — do not put this under $lib/server. */

export function normalizeBind(bind: string): string {
	const raw = bind.trim();
	if (!raw) return raw;
	const unbracket = raw.replace(/^\[|\]$/g, '');
	const mapped = ipv4FromMapped(unbracket);
	if (mapped) return mapped;
	if (unbracket === '*') return '0.0.0.0';
	return unbracket;
}

function ipv4FromMapped(bind: string): string | null {
	const dotted = bind.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
	if (dotted) return dotted[1] ?? null;
	const hex = bind.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
	if (!hex) return null;
	const hi = parseInt(hex[1] ?? '', 16);
	const lo = parseInt(hex[2] ?? '', 16);
	if (!Number.isInteger(hi) || !Number.isInteger(lo)) return null;
	return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

export function isLoopbackBind(bind: string): boolean {
	const b = normalizeBind(bind).toLowerCase();
	return b === '127.0.0.1' || b === '::1' || b === 'localhost';
}

/** TCP peer only — do not pass X-Forwarded-For. */
export function isLoopbackClient(addr: string | null | undefined): boolean {
	if (!addr) return false;
	const noZone = addr.trim().replace(/^\[|\]$/g, '').split('%')[0] ?? '';
	const b = normalizeBind(noZone).toLowerCase();
	if (b === '::1' || b === 'localhost') return true;
	const parts = b.split('.');
	if (parts.length !== 4 || parts[0] !== '127') return false;
	return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

export function visitorPageHost(hostHeader: string | null | undefined): string | null {
	if (!hostHeader) return null;
	const raw = hostHeader.trim();
	if (!raw || /[\s/@\\]/.test(raw)) return null;
	try {
		const url = new URL(`http://${raw}/`);
		let host = url.hostname.replace(/^\[|\]$/g, '');
		if (!host) return null;
		if (host.includes(':')) host = `[${host}]`;
		return host;
	} catch {
		return null;
	}
}

export function isLoopbackPageHost(hostHeader: string | null | undefined): boolean {
	const host = visitorPageHost(hostHeader);
	return Boolean(host && isLoopbackBind(host));
}

/** Operator board only when the TCP peer is loopback and Host is too (or omitted). */
export function isOperatorFace(
	peer: string | null | undefined,
	hostHeader: string | null | undefined,
): boolean {
	if (!isLoopbackClient(peer)) return false;
	if (!hostHeader?.trim()) return true;
	return isLoopbackPageHost(hostHeader);
}

export function visitorHttpUrl(pageHost: string, port: number): string | null {
	if (!pageHost || !Number.isInteger(port) || port < 1 || port > 65535) return null;
	return `http://${pageHost}:${port}/`;
}

export const VISITOR_FAVICON_FILES = ['favicon.png', 'favicon.svg', 'favicon.ico'] as const;

export function visitorFaviconCandidates(href: string): string[] {
	try {
		const base = new URL(href);
		return VISITOR_FAVICON_FILES.map((name) => new URL(name, base).href);
	} catch {
		return [];
	}
}

export function visitorTileLetter(name: string): string {
	const ch = [...name.trim()][0];
	return ch ? ch.toUpperCase() : '?';
}
