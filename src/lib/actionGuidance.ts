/** Visible recovery copy; disabled controls alone cannot teach the next step. */
export const ACTION_HELP = 'Commit saves changes in Git. Push sends commits to origin. Publish releases an npm package. Ship deploys an app or site. Land updates and deploys a FilePress site.';

export function pushRecoveryHint(reason: string | undefined): string {
	if (!reason || reason === 'not ahead') return '';
	if (reason === 'diverged') return 'Bring this branch up to date with origin and resolve conflicts before pushing.';
	if (reason === 'no upstream') return 'Set this branch’s upstream, then refresh this project.';
	if (reason === 'no origin' || reason === 'backup only') return 'Add an origin remote to push this branch. The backup remote is managed by IngotVault.';
	if (reason === 'detached') return 'Switch to a branch before pushing.';
	if (['merge', 'rebase', 'cherry-pick', 'revert', 'bisect'].includes(reason)) return `Finish or abort the current ${reason}, then refresh this project.`;
	return `Resolve the push blocker (${reason}), then refresh this project.`;
}

export function publishRecoveryHint(reason: string | undefined): string {
	if (!reason) return '';
	if (reason === 'dirty') return 'Commit or stash the remaining changes before publishing.';
	if (reason.startsWith('mid-')) return `Finish or abort the current ${reason.slice(4)}, then refresh this project.`;
	if (reason === 'diverged') return 'Bring this branch up to date with origin, resolve any conflicts, then refresh this project.';
	if (reason === 'no upstream') return 'Set this branch’s upstream, then refresh this project.';
	if (reason === 'no origin' || reason === 'backup only') return 'Add an origin remote for this checkout, then refresh this project.';
	if (reason === 'detached') return 'Switch to the branch you want to release, then refresh this project.';
	if (reason === 'local is behind npm') return 'Update this checkout to the published version before preparing another release.';
	if (reason === 'private') return 'The package.json private flag disables npm publishing. Remove it in Fleet if this package should be published.';
	if (reason === 'folder missing') return 'Restore the project folder or correct its Fleet enrollment.';
	return `Resolve the publish blocker (${reason}), then refresh this project.`;
}
