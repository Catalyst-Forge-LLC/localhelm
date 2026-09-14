/**
 * Fleet write gates and dashboard copy. Implementation lives in:
 * `plainError.ts`, `publishResults.ts`, `fleetWrites.ts`.
 * None of those import `node:*` — safe for the Svelte bundle.
 */
export {
	landPluginApplyOk,
	plainCommitError,
	plainGitError,
	plainPluginError,
	plainPublishError,
} from './plainError.js';
export {
	canSkipPublishResultsForGlobalInstall,
	isGithubPublishReason,
	isPublishedReason,
	orderPublishResults,
	publishApplyHadFailure,
	publishApplyTitle,
	publishResultHint,
	publishResultLine,
	publishResultPhase,
	publishResultTitle,
} from './publishResults.js';
export {
	FLEET_WRITE_ORDER,
	NPM_NOT_READY_HINT,
	behindPinPublisherIds,
	canCommit,
	canGlobal,
	canPublish,
	canShip,
	commitCountLabel,
	confirmNamedLine,
	fleetWriteIds,
	fleetWriteLabel,
	globalInstallLine,
	globalTargetVersion,
	globalWriteLabel,
	isNpmNotReadyReason,
	needsGlobal,
	nextCutVersion,
	npmNotReadyHint,
	npmNotReadyReason,
	npmNotReadyTitle,
	shipConfirmLine,
	whyNotPublish,
	whyNotPush,
	writableCascadeCount,
} from './fleetWrites.js';
export type { FleetWriteId, GateGit, GlobalGateRow, GlobalInstallLineRow, PublishGateRow } from './fleetWrites.js';
