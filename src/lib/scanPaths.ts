/** FilePress `site/` lives under the package. Do not propose it as its own fleet row. */
export function isNestedSitePath(relPosix: string): boolean {
	const parts = relPosix
		.replace(/\\/g, '/')
		.split('/')
		.filter((part) => part && part !== '.');
	if (parts.length < 2) return false;
	return parts.includes('site');
}
