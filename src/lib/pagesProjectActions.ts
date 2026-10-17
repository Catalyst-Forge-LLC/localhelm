import type { DashboardJobHost } from './dashboardJob.js';
import type { PagesProjectPlan, PagesProjectResult } from './pagesProjectTypes.js';
import { planOpts } from './writeConfirm.js';

export function createPagesProjectActions(host: DashboardJobHost, startShip: (ids: string[]) => Promise<void>) {
	function offerPagesProject(plan: PagesProjectPlan, shipIds = [plan.id]): void {
		const target = plan.target;
		const create = plan.action === 'create' && Boolean(target);
		const exists = plan.action === 'exists';
		host.offerConfirm({
			recovery: { route: '/api/pages-project' },
			title: create ? `Create Pages project for ${plan.id}?` : exists ? 'Pages project is ready' : 'Pages setup needs attention',
			hint: create ? 'Creates an empty Cloudflare Pages project in the account below. The production branch comes from your Ship script. Deployment requires a separate Ship confirmation.' : plan.reason,
			items: target ? [`Account: ${target.accountName}`, `Account ID: ${target.accountId}`, `Pages project: ${target.projectName}`, `Production branch: ${target.productionBranch}`, `Site: ${target.directory}`] : [plan.reason],
			itemKeys: target ? Array.from({ length: 5 }, (_, i) => `${plan.id}:${i}`) : [plan.id],
			applyIds: create || exists ? [plan.id] : [],
			confirmLabel: create ? 'Create Pages project' : 'Open Ship plan', canApply: create || exists,
			run: (included) => {
				if (!included.includes(plan.id)) return;
				if (create && target) void apply(plan.id, target.revision, shipIds);
				else if (exists) void startShip(shipIds);
			},
		});
	}
	async function startPagesProject(id: string): Promise<void> {
		if (!host.readyNamed([id]).length) return;
		await host.run(`checking Pages setup for ${id}`, async () => {
			const plan = await host.call('/api/pages-project', { method: 'POST', body: JSON.stringify({ id, apply: false }) }) as PagesProjectPlan;
			host.note(`Pages setup plan ${id}, nothing deployed`, plan);
			offerPagesProject(plan);
		}, planOpts('Set up Pages project', [id]));
	}
	async function apply(id: string, revision: string, shipIds: string[]): Promise<void> {
		let succeeded: PagesProjectResult | undefined;
		await host.run(`creating Pages project for ${id}`, async () => {
			const result = await host.call('/api/pages-project', { method: 'POST', body: JSON.stringify({ id, revision, apply: true }) }) as PagesProjectResult;
			host.note(`Pages setup ${id}: ${result.reason}`, result);
			if (!result.ok) throw new Error(result.reason);
			succeeded = result;
		}, { closeConfirm: false });
		if (succeeded) offerPagesProject(succeeded, shipIds);
		else host.offerConfirm({
			title: 'Pages setup needs attention',
			hint: 'Review the result. Open a fresh setup plan to check whether Cloudflare created the project before trying again.',
			items: [host.error() || 'Creation could not be verified.'], itemKeys: [id], applyIds: [id],
			confirmLabel: 'Review Pages setup', canApply: true,
			run: (included) => { if (included.includes(id)) void startPagesProject(id); },
		});
	}
	return { startPagesProject, offerPagesProject };
}
