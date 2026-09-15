/** Dashboard start/apply factory. ConfirmModal, URL state, and loadStatus stay on the page. */

import type { DashboardJobHost } from './dashboardJob.js';
import { createFleetWrites } from './fleetWriteActions.js';
import { createSiteWrites } from './siteWriteActions.js';

export function createDashboardWrites(host: DashboardJobHost) {
	return {
		...createFleetWrites(host),
		...createSiteWrites(host),
	};
}

export type { DashboardJobHost } from './dashboardJob.js';
export type { ConfirmOffer, JobRunOpts } from './writeConfirm.js';
