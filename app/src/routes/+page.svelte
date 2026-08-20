<script lang="ts">
	import { onMount } from 'svelte';

	type Pin = { name: string; kind: string; onLatest?: boolean };
	type Project = {
		id: string;
		path: string;
		localVersion: string | null;
		missing: boolean;
		unpublishedAhead: boolean;
		error?: string;
		npm: { status: string; latest?: string; error?: string };
		git: {
			repo: boolean;
			dirty: boolean;
			branch?: string;
			ahead: number | null;
			behind: number | null;
			origin?: string;
			error?: string;
		};
		pins: Pin[];
	};
	type Inventory = {
		manifestPath: string;
		digest: {
			projects: number;
			dirty: number;
			unpublishedAhead: number;
			cascadeBehind: number;
			missing: number;
			npmErrors: number;
		};
		projects: Project[];
	};
	type Candidate = {
		path: string;
		absPath: string;
		id: string;
		npmName?: string;
		version?: string;
		git: boolean;
		private?: boolean;
	};

	let inventory = $state<Inventory | null>(null);
	let scanRoot = $state('..');
	let cwd = $state('');
	let candidates = $state<Candidate[]>([]);
	let selectedScan = $state<Record<string, boolean>>({});
	let selectedIds = $state<Record<string, boolean>>({});
	let bumpKind = $state<Record<string, 'patch' | 'minor' | 'major'>>({});
	let log = $state('');
	let busy = $state('');
	let error = $state('');

	const enrolled = $derived(new Set((inventory?.projects ?? []).map((p) => p.id)));

	async function call(url: string, init?: RequestInit): Promise<unknown> {
		const res = await fetch(url, {
			...init,
			headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
		});
		const data = (await res.json()) as { error?: string };
		if (!res.ok) throw new Error(data.error ?? res.statusText);
		return data;
	}

	function note(title: string, data: unknown): void {
		log = `${title}\n${JSON.stringify(data, null, 2)}\n\n${log}`.trim();
	}

	async function run(label: string, fn: () => Promise<void>): Promise<void> {
		busy = label;
		error = '';
		try {
			await fn();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = '';
		}
	}

	async function refresh(fetchRemotes = false): Promise<void> {
		await run('status', async () => {
			const data = (await call(`/api/status${fetchRemotes ? '?fetch=1' : ''}`)) as {
				inventory: Inventory | null;
				scanRoot: string;
				cwd: string;
			};
			inventory = data.inventory;
			cwd = data.cwd;
			if (!candidates.length) scanRoot = data.scanRoot;
			const kinds = { ...bumpKind };
			for (const row of data.inventory?.projects ?? []) {
				if (!kinds[row.id]) kinds[row.id] = 'patch';
			}
			bumpKind = kinds;
		});
	}

	async function scan(): Promise<void> {
		await run('scan', async () => {
			const data = (await call('/api/scan', {
				method: 'POST',
				body: JSON.stringify({ roots: [scanRoot] }),
			})) as { candidates: Candidate[] };
			candidates = data.candidates;
			const next: Record<string, boolean> = {};
			for (const row of data.candidates) {
				if (selectedScan[row.absPath] && !enrolled.has(row.id)) next[row.absPath] = true;
			}
			selectedScan = next;
			note('scan', data);
		});
	}

	async function enroll(apply: boolean): Promise<void> {
		const paths = Object.entries(selectedScan)
			.filter(([, on]) => on)
			.map(([p]) => p);
		if (!paths.length) {
			error = 'check at least one scan row';
			return;
		}
		await run(apply ? 'enroll apply' : 'enroll plan', async () => {
			const plan = await call('/api/enroll', { method: 'POST', body: JSON.stringify({ paths, apply }) });
			note(apply ? 'enroll apply' : 'enroll plan', plan);
			if (apply) {
				selectedScan = {};
				await refresh();
			}
		});
	}

	async function unenroll(apply: boolean): Promise<void> {
		const ids = Object.entries(selectedIds)
			.filter(([, on]) => on)
			.map(([id]) => id);
		if (!ids.length) {
			error = 'check at least one enrolled row';
			return;
		}
		await run(apply ? 'unenroll apply' : 'unenroll plan', async () => {
			const plan = await call('/api/unenroll', { method: 'POST', body: JSON.stringify({ ids, apply }) });
			note(apply ? 'unenroll apply' : 'unenroll plan', plan);
			if (apply) {
				selectedIds = {};
				await refresh();
			}
		});
	}

	async function bump(id: string, apply: boolean): Promise<void> {
		await run(apply ? `bump ${id}` : `bump plan ${id}`, async () => {
			const plan = await call('/api/bump', {
				method: 'POST',
				body: JSON.stringify({ id, kind: bumpKind[id] ?? 'patch', apply }),
			});
			note(apply ? `bump ${id}` : `bump plan ${id}`, plan);
			if (apply) await refresh();
		});
	}

	async function fetchOrigins(): Promise<void> {
		await run('fetch', async () => {
			note('fetch', await call('/api/fetch', { method: 'POST' }));
			await refresh();
		});
	}

	async function pull(apply: boolean): Promise<void> {
		await run(apply ? 'pull apply' : 'pull plan', async () => {
			note(apply ? 'pull apply' : 'pull plan', await call('/api/pull', { method: 'POST', body: JSON.stringify({ apply }) }));
			if (apply) await refresh();
		});
	}

	async function exportFile(apply: boolean): Promise<void> {
		await run(apply ? 'export apply' : 'export plan', async () => {
			note(apply ? 'export apply' : 'export plan', await call('/api/export', { method: 'POST', body: JSON.stringify({ apply }) }));
		});
	}

	function gitLabel(row: Project): string {
		if (!row.git.repo) return 'no-git';
		if (row.git.error) return `error:${row.git.error}`;
		return [
			row.git.dirty ? 'dirty' : 'clean',
			row.git.branch,
			row.git.ahead != null ? `ahead ${row.git.ahead}` : '',
			row.git.behind != null ? `behind ${row.git.behind}` : '',
			row.git.origin ? '' : 'no-origin',
		]
			.filter(Boolean)
			.join(' ');
	}

	function npmLabel(row: Project): string {
		if (row.npm.status === 'ok') return row.npm.latest ?? 'ok';
		if (row.npm.status === 'error') return `error:${row.npm.error ?? ''}`;
		return row.npm.status;
	}

	onMount(() => {
		void refresh();
	});
</script>

<svelte:head>
	<title>LocalHelm</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<header class="border-b border-zinc-800 px-6 py-4">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="text-xs tracking-[0.2em] text-zinc-500 uppercase">LocalHelm</p>
				<h1 class="text-2xl font-semibold">Status for the products you ship</h1>
				<p class="mt-1 text-sm text-zinc-400">
					{inventory ? inventory.manifestPath : 'No fleet enrolled yet.'}
					{#if cwd}
						<span class="text-zinc-600"> · cwd {cwd}</span>
					{/if}
				</p>
			</div>
			<div class="flex flex-wrap gap-2 text-sm">
				<button class="btn" disabled={Boolean(busy)} onclick={() => refresh()}>Refresh</button>
				<button class="btn" disabled={Boolean(busy)} onclick={() => refresh(true)}>Status --fetch</button>
				<button class="btn" disabled={Boolean(busy)} onclick={() => fetchOrigins()}>Fetch</button>
				<button class="btn" disabled={Boolean(busy)} onclick={() => pull(false)}>Pull plan</button>
				<button class="btn-apply" disabled={Boolean(busy)} onclick={() => pull(true)}>Pull --apply</button>
				<button class="btn" disabled={Boolean(busy)} onclick={() => exportFile(false)}>Export plan</button>
				<button class="btn-apply" disabled={Boolean(busy)} onclick={() => exportFile(true)}>Export --apply</button>
			</div>
		</div>
		{#if inventory}
			<dl class="mt-4 flex flex-wrap gap-3 text-xs text-zinc-400">
				<div class="chip">projects {inventory.digest.projects}</div>
				<div class="chip">dirty {inventory.digest.dirty}</div>
				<div class="chip">unpublished-ahead {inventory.digest.unpublishedAhead}</div>
				<div class="chip">cascade-behind {inventory.digest.cascadeBehind}</div>
				<div class="chip">missing {inventory.digest.missing}</div>
				<div class="chip">npm-errors {inventory.digest.npmErrors}</div>
			</dl>
		{/if}
		{#if busy}<p class="mt-3 text-sm text-amber-300">{busy}…</p>{/if}
		{#if error}<p class="mt-3 text-sm text-red-400">{error}</p>{/if}
	</header>

	<main class="grid gap-8 px-6 py-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
		<section>
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-lg font-medium">Fleet</h2>
				<div class="flex gap-2">
					<button class="btn" disabled={Boolean(busy)} onclick={() => unenroll(false)}>Unenroll plan</button>
					<button class="btn-apply" disabled={Boolean(busy)} onclick={() => unenroll(true)}>Unenroll --apply</button>
				</div>
			</div>
			<div class="overflow-x-auto rounded-lg border border-zinc-800">
				<table class="min-w-full text-left text-sm">
					<thead class="bg-zinc-900 text-zinc-400">
						<tr>
							<th class="px-3 py-2 font-normal"></th>
							<th class="px-3 py-2 font-normal">id</th>
							<th class="px-3 py-2 font-normal">local</th>
							<th class="px-3 py-2 font-normal">npm</th>
							<th class="px-3 py-2 font-normal">git</th>
							<th class="px-3 py-2 font-normal">pins</th>
							<th class="px-3 py-2 font-normal">bump</th>
						</tr>
					</thead>
					<tbody>
						{#each inventory?.projects ?? [] as row (row.id)}
							<tr class="border-t border-zinc-800">
								<td class="px-3 py-2">
									<input type="checkbox" bind:checked={selectedIds[row.id]} />
								</td>
								<td class="px-3 py-2 font-medium">{row.id}</td>
								<td class="px-3 py-2">{row.localVersion ?? 'n/a'}</td>
								<td class="px-3 py-2">{npmLabel(row)}</td>
								<td class="px-3 py-2 text-zinc-300">{gitLabel(row)}</td>
								<td class="px-3 py-2 text-zinc-400">
									{row.pins
										.map((pin) =>
											pin.kind === 'link' || pin.kind === 'file'
												? `${pin.name}:${pin.kind}`
												: pin.onLatest === false
													? `${pin.name}:behind`
													: `${pin.name}:ok`,
										)
										.join(', ') || '—'}
								</td>
								<td class="px-3 py-2">
									<div class="flex flex-wrap items-center gap-1">
										<select class="bg-zinc-900 text-xs" bind:value={bumpKind[row.id]}>
											<option value="patch">patch</option>
											<option value="minor">minor</option>
											<option value="major">major</option>
										</select>
										<button class="btn-xs" disabled={Boolean(busy)} onclick={() => bump(row.id, false)}>plan</button>
										<button class="btn-xs-apply" disabled={Boolean(busy)} onclick={() => bump(row.id, true)}>apply</button>
									</div>
								</td>
							</tr>
						{/each}
						{#if !inventory?.projects.length}
							<tr>
								<td class="px-3 py-6 text-zinc-500" colspan="7">Scan a folder, check rows, then enroll --apply.</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</section>

		<aside class="space-y-6">
			<section>
				<h2 class="mb-3 text-lg font-medium">Scan / enroll</h2>
				<label class="block text-xs text-zinc-500" for="scan-root">Folder</label>
				<div class="mt-1 flex gap-2">
					<input id="scan-root" class="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm" bind:value={scanRoot} />
					<button class="btn" disabled={Boolean(busy)} onclick={() => scan()}>Scan</button>
				</div>
				<p class="mt-2 text-xs text-zinc-500">Nothing is written until you check rows and apply.</p>
				<ul class="mt-3 max-h-80 space-y-1 overflow-auto text-sm">
					{#each candidates as row (row.absPath)}
						<li class="flex items-start gap-2 rounded border border-zinc-800 px-2 py-1">
							<input
								class="mt-1"
								type="checkbox"
								disabled={enrolled.has(row.id)}
								bind:checked={selectedScan[row.absPath]}
							/>
							<div>
								<div class="font-medium">{row.id}</div>
								<div class="text-xs text-zinc-400">
									{row.npmName ?? '—'} {row.version ?? ''} {row.git ? 'git' : ''}
									{enrolled.has(row.id) ? ' · enrolled' : ''}
								</div>
							</div>
						</li>
					{/each}
				</ul>
				<div class="mt-3 flex gap-2">
					<button class="btn" disabled={Boolean(busy)} onclick={() => enroll(false)}>Enroll plan</button>
					<button class="btn-apply" disabled={Boolean(busy)} onclick={() => enroll(true)}>Enroll --apply</button>
				</div>
			</section>

			<section>
				<h2 class="mb-3 text-lg font-medium">Plan log</h2>
				<pre class="max-h-96 overflow-auto rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300 whitespace-pre-wrap">{log || 'Plans and apply results land here.'}</pre>
			</section>
		</aside>
	</main>
</div>

<style>
	:global(.btn),
	:global(.btn-apply),
	:global(.btn-xs),
	:global(.btn-xs-apply) {
		border-radius: 0.375rem;
		border: 1px solid rgb(63 63 70);
		background: rgb(24 24 27);
		padding: 0.25rem 0.6rem;
		font-size: 0.8rem;
	}
	:global(.btn-apply),
	:global(.btn-xs-apply) {
		border-color: rgb(180 83 9);
		color: rgb(253 230 138);
	}
	:global(.btn:disabled),
	:global(.btn-apply:disabled),
	:global(.btn-xs:disabled),
	:global(.btn-xs-apply:disabled) {
		opacity: 0.5;
	}
	:global(.chip) {
		border-radius: 999px;
		border: 1px solid rgb(63 63 70);
		padding: 0.15rem 0.6rem;
	}
</style>
