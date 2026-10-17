/** Safe to import from the browser; credentials and command output never belong here. */
export type PagesProjectTarget = {
	directory: string;
	projectName: string;
	productionBranch: string;
	accountId: string;
	accountName: string;
	wranglerVersion: string;
	revision: string;
};
export type PagesProjectPlan = {
	id: string;
	action: 'create' | 'exists' | 'blocked';
	reason: string;
	target?: PagesProjectTarget;
};
export type PagesProjectResult = PagesProjectPlan & { ok: boolean; writes: boolean };
export function isMissingPagesProject(message: string): boolean {
	return /The Pages project ["'][a-z0-9-]+["'] does not exist\./i.test(message);
}
