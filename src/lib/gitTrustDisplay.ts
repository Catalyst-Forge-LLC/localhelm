/** Git trust copy and detection. No Node imports; shared with the dashboard. */
export function isGitOwnershipError(error: string | undefined): boolean {
	return Boolean(error && /^fatal:\s+detected dubious ownership in repository at\s/im.test(error));
}

export const GIT_TRUST_HINT =
	'Adds only this directory to Git’s trusted-directory list for the account running LocalHelm. Git will then allow that account to read the repository and run its hooks. Trust it only if you control its contents. Cancel leaves the list unchanged.';

export function gitStatusBadge(error: string | undefined): { text: string; tone: 'bad'; title: string } | null {
	if (!error) return null;
	return {
		text: isGitOwnershipError(error) ? 'Git trust required' : 'Git status unavailable',
		tone: 'bad',
		title: error,
	};
}
