<script lang="ts">
	import AddProjectsModal from './AddProjectsModal.svelte';
	import type { DurableJob } from '../../../src/lib/jobJournal.js';

	function jobTally(job: DurableJob): string {
		const counts = new Map<string, number>();
		for (const subject of job.subjects) counts.set(subject.state, (counts.get(subject.state) ?? 0) + 1);
		const labels: Record<string, string> = {
			succeeded: 'succeeded',
			failed: 'failed',
			unknown: 'unknown',
			running: 'running',
			pending: 'not started',
		};
		return (['succeeded', 'failed', 'unknown', 'running', 'pending'] as const)
			.flatMap((state) => {
				const count = counts.get(state) ?? 0;
				return count ? [`${count} ${labels[state]}`] : [];
			})
			.join(' · ');
	}
	let { open = $bindable(false), jobs, busy, error = '', onrefresh, onplan, onreview, onstorage, sessionResult = false, onsession }: {
		open: boolean; jobs: DurableJob[]; busy: boolean; error?: string;
		onrefresh: (job: DurableJob) => void; onplan: (job: DurableJob) => void;
		onreview: (job: DurableJob) => void; onstorage: () => void;
		sessionResult?: boolean; onsession?: () => void;
	} = $props();
</script>
<AddProjectsModal bind:open {busy} title="Action results" titleId="action-history-title" hint="Results stay in this browser for this workspace and board. Unknown means the connection ended before acknowledgement; the action may have completed. Refresh current status before opening a new plan.">
	{#if error}<p role="alert">{error}</p><button class="btn" onclick={onstorage} disabled={busy}>Retry saving history</button>{/if}
	{#if !jobs.length}<p class="dim">No saved actions for this board yet.</p>{/if}
	{#if sessionResult}<p class="dim small">A prior session also has a Publish or Land result. Older session records may not identify the board.</p><button class="btn btn-sm" disabled={busy} onclick={onsession}>Review prior session result</button>{/if}
	{#each jobs as job (job.id)}
		<details open={job.subjects.some((s) => s.state !== 'succeeded') && !job.reviewedAt}>
			<summary>{job.title} <span class="dim small">{jobTally(job)} · {new Date(job.startedAt).toLocaleString()}{job.reviewedAt ? ' · reviewed' : ''}</span></summary>
			<div class="group-buttons">
				<button class="btn btn-sm" disabled={busy} onclick={() => onrefresh(job)}>Refresh current status</button>
				{#if job.subjects.some((s) => s.state !== 'succeeded') && !job.reviewedAt}
					<button class="btn btn-sm" disabled={busy || !job.reconciledAt} onclick={() => onplan(job)}>Open a fresh plan</button>
					<button class="btn btn-sm" disabled={busy || !job.reconciledAt} onclick={() => onreview(job)}>Mark reviewed</button>
				{/if}
			</div>
			{#if job.reconciledAt}<p class="dim small">Status read at {new Date(job.reconciledAt).toLocaleTimeString()}. Review the board; this does not prove an unknown action failed.</p>{/if}
			{#if job.subjects.length > 3}
				<details class="subjects">
					<summary>{job.subjects.length} repos</summary>
					<ul>{#each job.subjects as subject (subject.id)}<li><strong>{subject.id}</strong> · {subject.state}<p class="dim small">{subject.detail ?? (subject.state === 'pending' ? 'Not started.' : '')}</p></li>{/each}</ul>
				</details>
			{:else}
				<ul>{#each job.subjects as subject (subject.id)}<li><strong>{subject.id}</strong> · {subject.state}<p class="dim small">{subject.detail ?? (subject.state === 'pending' ? 'Not started.' : '')}</p></li>{/each}</ul>
			{/if}
		</details>
	{/each}
</AddProjectsModal>
<style>details { border-top: 1px solid var(--steel); padding: .8rem 0; } details.subjects { border-top: 0; padding-top: .2rem; } summary { cursor: pointer; overflow-wrap: anywhere; } .group-buttons { margin: .6rem 0; } li { overflow-wrap: anywhere; } li p { margin: .2rem 0 .5rem; }</style>
