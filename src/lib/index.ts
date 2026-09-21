export { ACTIVITY_LIMIT, activityPath, appendActivity, clearActivity, readActivity } from './activity.js';
export type { ActivityEntry } from './activity.js';
export { fleetDeps } from './deps.js';
export { applyEnroll, applyUnenroll, enrollResolvePath, planEnroll, planUnenroll } from './enroll.js';
export { enrollFilepressFromFleet } from './filepressFromFleet.js';
export type { FilepressFromFleet } from './filepressFromFleet.js';
export { findManifest, requireManifest, validateManifest, writeManifest } from './manifest.js';
export type { LoadedManifest } from './manifest.js';
export { applyCascade, planCascade } from './cascade.js';
export type { CascadePlan, CascadeRow } from './cascade.js';
export { helmBumpMessage, helmRetargetMessage, isGitIgnored } from './commit.js';
export {
	applyDirtCommit,
	dirtFileLine,
	discoverOllanetServer,
	fallbackCommitMessage,
	isLocalOllanetServer,
	ollamaCommitMessage,
	ollanetMachineLabel,
	parseStatusPorcelain,
	pickOllanetServer,
	planDirtCommit,
	requireCommitIds,
	secretCommitSkip,
} from './dirtCommit.js';
export type { CommitDraftApi, DirtCommitPlan, DirtCommitRow, DirtFile } from './dirtCommit.js';
export {
	clearNpmCache,
	liftLatestIfVersionExists,
	mapPool,
	npmHasVersion,
	npmLatest,
	npmLatestMany,
	waitForNpmVersion,
	withPublishedLocal,
} from './npm.js';
export { retargetSpecifier } from './pinwrite.js';
export { fleetReady } from './ready.js';
export type { ReadyView } from './ready.js';
export { detectGithubPublish, githubRepoFromOrigin, githubWorkflowUrl } from './githubPublish.js';
export { applyPublish, extractNpmAuthUrl, NPM_PUBLISH_AUTH_HINT, npmWhoami, planPublish, planPublishFromInventory, publishAuthHintFor, publishStepLabel, requirePublishIds } from './publish.js';
export type { PublishRow, PublishStep, PublishStepEvent } from './publish.js';
export { applyScriptShip, isShippedReason, planScriptShip, requireShipIds } from './scriptShip.js';
export type { ScriptShipRow } from './scriptShip.js';
export {
	applyGlobalInstall,
	clearGlobalCache,
	isInstalledGlobalReason,
	parseGlobalVersions,
	planGlobalInstall,
	readGlobalVersions,
	requireGlobalIds,
} from './globalInstall.js';
export type { GlobalInstallRow } from './globalInstall.js';
export { applyConfirmStep, commitDraftProgressHint, emptyConfirmPhases, markConfirmKey } from './confirmProgress.js';
export type { ConfirmPhase } from './confirmProgress.js';
export {
	buildConfirmRoster,
	confirmApplyIds,
	confirmCountText,
	confirmGroupId,
	confirmGroupPhase,
	confirmRosterSelected,
	confirmStepLabel,
} from './confirmRoster.js';
export type { ConfirmRosterGroup, ConfirmRosterStep } from './confirmRoster.js';
export {
	applyLand,
	companionIdForSite,
	LAND_ENGINE_ID,
	LAND_PLUGIN_ID,
	landPluginApplyOk,
	landRequestSiteIds,
	landStepsFromPluginRow,
	landWouldPublish,
	planLand,
	planLandMany,
	requireLandSiteId,
	requireLandSiteIds,
} from './land.js';
export {
	landApplyTitle,
	landBatchSnap,
	landConfirmItems,
	landResultHint,
	landResultLine,
	landResultPhase,
	landResultTitle,
	landRowFromApply,
	orderLandResults,
} from './landDisplay.js';
export type { LandBatchRow } from './landDisplay.js';
export type { LandApplyResult, LandPlan, LandRole, LandStep, LandStepKind } from './land.js';
export {
	landShipsPath,
	markLandShipFailed,
	readLandPendingReasons,
	readLandPendingSiteIds,
	readLandShipFingerprint,
	readLandShipFingerprints,
	readLandShipRecord,
	readLandShips,
	recordLandShip,
	shipUnchanged,
} from './landShips.js';
export type { LandShipRecord, LandShipsFile } from './landShips.js';
export { asPluginBoards, boardsForPlugins, loadPluginDashboard, loadPlugins, pluginTab, requirePlugin } from './plugin.js';
export type { PluginListing } from './plugin.js';
export {
	isPluginEnabled,
	pluginPrefsPath,
	readPluginPrefs,
	setPluginEnabled,
} from './pluginPrefs.js';
export type { PluginPrefs } from './pluginPrefs.js';
export {
	canonicalizeTab,
	isCoreTab,
	isPortsPluginTab,
	parseDashboardTab,
	pluginTabCount,
	pluginTabIcon,
	pluginTabMetas,
} from './dashboardTabs.js';
export type { PluginTabMeta } from './dashboardTabs.js';
export { archiveHidesId, archiveIds, archivePath, isArchived, planArchive, readArchive, restoreIds } from './archive.js';
export type { ArchiveFile, ArchivePlanRow } from './archive.js';
export { clearLocalOnly, localOnlyCoversId, localOnlyPath, markLocalOnly, readLocalOnly } from './localOnly.js';
export type { LocalOnlyFile } from './localOnly.js';
export { fleetRoster } from './roster.js';
export type { FleetRosterRow } from './roster.js';
export { buildBrief, formatBrief } from './brief.js';
export type { BriefLease, BriefProject } from './brief.js';
export { familyMemberNames, familyRole, familyStem, groupIdsByFamily, hasExactOrSiteLease, siteLeaseName } from './family.js';
export { applyWritePatch, applyWritePatches, digestFromProjects, unpublishedAheadOf, writeReloadBusy } from './inventoryPatch.js';
export type { WritePatch, WriteReloadMode } from './inventoryPatch.js';
export { familyListenBits, groupPortLooks, lookJump, lookJumpsFor, portFamilies, portLooks } from './looks.js';
export type { FamilyMember, LeaseRowInput, LookJump, LookJumpId, PortFamily, PortLook, PortLookGroup, PortLookKind } from './looks.js';
export { activityLinkedIds } from './activityLinks.js';
export { crosswalkChips } from './crosswalk.js';
export type { CrossChip } from './crosswalk.js';
export { formatPluginPlanLines, pluginPlanLineKeys, pluginPlanWriteIds } from './pluginPlan.js';
export type { HelmPlugin, LoadedPlugin, PluginBoard, PluginLoadFault, PluginTab } from './plugin.js';
export { applyBump, planBump } from './bump.js';
export type { BumpPlan } from './bump.js';
export { listFactsFiles, rewriteFactsVersion } from './factsVersion.js';
export { applyExport, defaultExportPath, planExport } from './export.js';
export type { ExportPlan } from './export.js';
export {
	canCommit,
	canGlobal,
	canPublish,
	canShip,
	confirmNamedLine,
	globalInstallLine,
	globalWriteLabel,
	isNpmNotReadyReason,
	needsGlobal,
	npmNotReadyHint,
	npmNotReadyReason,
	npmNotReadyTitle,
	shipConfirmLine,
	commitCountLabel,
	fleetWriteIds,
	fleetWriteLabel,
	nextCutVersion,
	plainGitError,
	plainPluginError,
	plainCommitError,
	plainPublishError,
	publishApplyTitle,
	orderPublishResults,
	publishResultHint,
	publishResultLine,
	publishResultPhase,
	publishResultTitle,
	isGithubPublishReason,
	isPublishedReason,
	publishApplyHadFailure,
	behindPinPublisherIds,
	canSkipPublishResultsForGlobalInstall,
	whyNotPublish,
	whyNotPush,
	writableCascadeCount,
} from './writeGate.js';
export type { FleetWriteId, GateGit, PublishGateRow } from './writeGate.js';
export { bulkProgressLabel } from './bulkProgress.js';
export { plainFetchError } from './fetchError.js';
export {
	siteCellValue,
	siteEngineVersion,
	pluginCellHref,
	pluginCellLinks,
	pluginRowNote,
	pluginRowOpenHref,
	siteLiveHref,
	siteLocalHref,
	siteLandReason,
	siteNeedsEngineSync,
	siteNeedsLand,
	sitePluginJobVisible,
	siteSyncLabel,
	siteSyncTarget,
	siteTableColumns,
} from './siteDisplay.js';
export {
	activityDayGroups,
	activityDayKey,
	activityMonthGroups,
	activitySparkCaption,
	activitySparkSeries,
} from './activityDays.js';
export type { ActivityDay, ActivityMonth } from './activityDays.js';
export {
	bridgeGaugeFrac,
	bridgeIdleLine,
	fleetProjectMeta,
	fleetVersionLabel,
	fleetVersionNote,
	headerNeedChips,
} from './fleetDisplay.js';
export type { BridgeGauge, HeaderNeedChip, HeaderNeedCounts } from './fleetDisplay.js';
export { portCellValue, portRecipeLabel, portTableColumns } from './portDisplay.js';
export {
	bindIsLan,
	portFiltersActive,
	rowMatchesPortFilters,
} from './portFilters.js';
export type { PortBoardFilters, PortFirewallFilter } from './portFilters.js';
export {
	applyFetch,
	applyFetches,
	applyPull,
	applyPush,
	countCommitsSinceVersion,
	planFetch,
	planPull,
	planPush,
	requirePushIds,
} from './git.js';
export type { GitJobRow } from './git.js';
export { IGNORE_FILE_NAME, loadScanIgnore } from './ignorefile.js';
export { resolveUserPath } from './paths.js';
export { JobCancelledError, isJobCancelled, stoppedJobMessage } from './jobCancel.js';
export { joinBatchFailures, runNamedBatch } from './batchApply.js';
export type { NamedBatchFailure, NamedBatchHooks } from './batchApply.js';
export { acquireJobLock, clearStaleJobLock, isPidAlive } from './lock.js';
export { compareScanPath, scanFolders } from './scan.js';
export { isNestedSitePath } from './scanPaths.js';
export {
	isOperatorFace,
	isLoopbackClient,
	readClientAddress,
	visitorFaviconHost,
	visitorHttpUrl,
	visitorPageHost,
} from './loopback.js';
export { visitorSnapshotFromBoards } from './visitorMachine.js';
export { visitorTilesFromBoards } from './visitorTiles.js';
export type { VisitorSnapshot, VisitorTile } from './visitorTiles.js';
export {
	DEFAULT_DASHBOARD_HOST,
	DEFAULT_DASHBOARD_PORT,
	packageRoot,
	resolveDashboard,
	serveDashboard,
} from './serve.js';
export type { DashboardStart } from './serve.js';
export { npmBareImports } from './dashboardBundle.js';
export {
	parseLsofListeningPids,
	parseNetstatListeningPids,
	portBusyMessage,
} from './servePort.js';
export type { PortOccupant } from './servePort.js';
export { fleetStatus, statusPhaseLabel } from './status.js';
export type { StatusPhase, StatusProgress } from './status.js';
export { operatorCwd } from './workspace.js';
export {
	DEMO_HEADER,
	DEMO_MANIFEST_NAME,
	LIVE_MANIFEST_NAME,
	applyClearDemo,
	assertDemoAllowsRepoWrite,
	demoManifestPath,
	demoRepoWriteError,
	demoStateDir,
	envDemoOn,
	helmStateDir,
	isDemoMode,
	planClearDemo,
	requestWantsDemo,
	runWithDemo,
} from './demoMode.js';
export type { DemoClearFile, DemoClearPlan } from './demoMode.js';
export type { BumpKind } from './semver.js';
export type {
	EnrollPlan,
	FleetDigest,
	FleetInventory,
	FleetManifest,
	FleetProject,
	PinEdge,
	ProjectStatus,
	ScanCandidate,
} from './types.js';
export type {
	CascadeTarget,
	LogEntry,
	NeedFilter,
	PortPane,
	ScanListRow,
} from './dashboardTypes.js';
