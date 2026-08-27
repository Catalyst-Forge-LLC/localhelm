<script lang="ts">
	import { portFiltersActive, type PortBoardFilters, type PortFirewallFilter } from '$lib/portFilters';

	let {
		filters = $bindable(),
		variant,
		shown,
		total,
	}: {
		filters: PortBoardFilters;
		variant: 'leases' | 'observed';
		shown: number;
		total: number;
	} = $props();

	function setListening(yes: boolean): void {
		filters = { ...filters, listening: filters.listening === yes ? undefined : yes };
	}

	function setLan(yes: boolean): void {
		filters = { ...filters, lan: filters.lan === yes ? undefined : yes };
	}

	function setFirewall(status: PortFirewallFilter): void {
		filters = { ...filters, firewall: filters.firewall === status ? undefined : status };
	}

	function toggleConflict(): void {
		filters = { ...filters, conflict: filters.conflict ? undefined : true };
	}

	function toggleEphemeral(): void {
		filters = { ...filters, ephemeral: filters.ephemeral ? undefined : true };
	}
</script>

<div class="port-filters" aria-label="Filters">
	{#if variant === 'leases'}
		<div class="fg" role="group" aria-label="Listen">
			<span class="fl">Listen</span>
			<div class="fc">
				<button type="button" class="chip" class:on={filters.listening === true} aria-pressed={filters.listening === true} onclick={() => setListening(true)}>
					Listening
				</button>
				<button type="button" class="chip" class:on={filters.listening === false} aria-pressed={filters.listening === false} onclick={() => setListening(false)}>
					Quiet
				</button>
			</div>
		</div>
	{/if}
	<div class="fg" role="group" aria-label="Bind">
		<span class="fl">Bind</span>
		<div class="fc">
			<button type="button" class="chip" class:on={filters.lan === true} aria-pressed={filters.lan === true} onclick={() => setLan(true)}>
				LAN
			</button>
			<button type="button" class="chip" class:on={filters.lan === false} aria-pressed={filters.lan === false} onclick={() => setLan(false)}>
				Loopback
			</button>
		</div>
	</div>
	{#if variant === 'leases'}
		<div class="fg" role="group" aria-label="Lease">
			<span class="fl">Lease</span>
			<div class="fc">
				<button type="button" class="chip" class:on={Boolean(filters.conflict)} aria-pressed={Boolean(filters.conflict)} onclick={toggleConflict}>
					Conflict
				</button>
				<button type="button" class="chip" class:on={Boolean(filters.ephemeral)} aria-pressed={Boolean(filters.ephemeral)} onclick={toggleEphemeral}>
					Ephemeral
				</button>
			</div>
		</div>
		<div class="fg" role="group" aria-label="Firewall">
			<span class="fl">Firewall</span>
			<div class="fc">
				<button type="button" class="chip" class:on={filters.firewall === 'applied'} aria-pressed={filters.firewall === 'applied'} onclick={() => setFirewall('applied')}>
					Applied
				</button>
				<button
					type="button"
					class="chip"
					class:on={filters.firewall === 'needs-elevation'}
					aria-pressed={filters.firewall === 'needs-elevation'}
					onclick={() => setFirewall('needs-elevation')}
				>
					Needs elevation
				</button>
				<button type="button" class="chip" class:on={filters.firewall === 'skipped'} aria-pressed={filters.firewall === 'skipped'} onclick={() => setFirewall('skipped')}>
					Skipped
				</button>
				<button type="button" class="chip" class:on={filters.firewall === 'wanted'} aria-pressed={filters.firewall === 'wanted'} onclick={() => setFirewall('wanted')}>
					Wanted
				</button>
			</div>
		</div>
	{/if}
	{#if portFiltersActive(filters)}
		<span class="shown">{shown} of {total}</span>
	{/if}
</div>

<style>
	.port-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.65rem 1.15rem;
		margin: 0 0 0.75rem;
	}

	.fg {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.fl {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #8b8b93;
	}

	.fc {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		margin: 0;
		border: 1px solid #4c4c54;
		background: none;
		border-radius: 999px;
		padding: 0.15rem 0.65rem;
		font: inherit;
		font-size: 0.75rem;
		color: #8b8b93;
		cursor: pointer;
	}

	.chip:hover {
		color: #f4f4f5;
	}

	.chip.on {
		border-color: #c9a227;
		background: #4a3a12;
		color: #fde68a;
	}

	.shown {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: #8b8b93;
		padding-bottom: 0.15rem;
	}
</style>
