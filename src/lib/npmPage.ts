/** Public package page. Scoped names stay in the path (`@scope/name`). */
export function npmPackageHref(name: string): string {
	return `https://www.npmjs.com/package/${name}`;
}

const SPEC =
	/(?:^|[\s(])(@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)@(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i;

/** Link the package name in `name@version` text. The version stays plain. */
export function findNpmPackageLink(
	text: string,
): { before: string; label: string; href: string; after: string } | null {
	const match = SPEC.exec(text);
	const name = match?.[1];
	if (!match || match.index == null || !name) return null;
	const lead = match[0].startsWith(name) ? 0 : match[0].indexOf(name);
	const at = match.index + lead;
	return {
		before: text.slice(0, at),
		label: name,
		href: npmPackageHref(name),
		after: text.slice(at + name.length),
	};
}
