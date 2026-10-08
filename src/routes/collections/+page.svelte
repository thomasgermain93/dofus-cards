<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { fmt } from '#lib/format';
	let { data, form } = $props();
	let shown = $state(40);
</script>

<svelte:head><title>Collections</title></svelte:head>

<div class="flex items-end justify-between gap-3 mb-1">
	<h1 class="large-title">Collections</h1>
	<a class="btn btn-secondary btn-sm mb-1" href="/album">Album</a>
</div>
<p class="text-label-2 mb-4">Complète une région, un donjon ou une panoplie pour gagner des kamas, des fragments, une carte brillante et parfois un titre.</p>

{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}
{#if form?.claimed}
	<p class="alert alert-ok mb-3">Collection récupérée : +{fmt(form.claimed.kamas)} kamas, +{form.claimed.fragments} fragments, une carte brillante{form.claimed.title ? `, titre « ${form.claimed.title} »` : ''} !</p>
{/if}

<nav class="segmented mb-4">
	{#each data.stats as s (s.kind)}
		<a href="?kind={s.kind}" aria-current={data.kind === s.kind ? 'page' : undefined} data-sveltekit-noscroll>
			{s.label}s{#if s.toClaim}&nbsp;<span class="badge">{s.toClaim}</span>{/if}
		</a>
	{/each}
</nav>
{#each data.stats.filter((s) => s.kind === data.kind) as s}
	<p class="footnote text-label-2 mb-3">{s.complete} / {s.total} complétées</p>
{/each}

<div class="list">
	{#each data.list.slice(0, shown) as c (c.key)}
		<div class="coll" class:done={c.claimed} data-testid="collection">
			<a class="flex-1 min-w-0 text-inherit no-underline" href="/collections/{encodeURIComponent(c.key)}">
				<span class="flex items-center gap-2"><span class="font-semibold truncate">{c.name}</span>{#if c.claimed}<Icon name="check" size={16} class="text-success" stroke={3} />{/if}</span>
				<span class="footnote text-label-2">{c.have} / {c.total} cartes, récompense : {fmt(c.reward.kamas)} kamas{c.reward.title ? `, titre` : ''}</span>
				<span class="bar"><span style="width: {(c.have / c.total) * 100}%" class:full={c.complete}></span></span>
			</a>
			{#if c.complete && !c.claimed}
				<form method="POST" action="?/claim" use:enhance>
					<input type="hidden" name="key" value={c.key} />
					<button class="btn btn-sm" data-testid="claim-collection">Récupérer</button>
				</form>
			{:else}
				<Icon name="chevron-right" size={16} class="text-label-3" />
			{/if}
		</div>
	{/each}
</div>
{#if data.list.length > shown}
	<button class="btn btn-secondary btn-block mt-4" onclick={() => (shown += 60)}>Afficher plus ({data.list.length - shown})</button>
{/if}

<style>
	.list {
		display: grid;
		gap: 8px;
	}
	@media (min-width: 900px) {
		.list {
			grid-template-columns: 1fr 1fr;
		}
	}
	.coll {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 12px 14px;
	}
	.coll.done {
		background: var(--surface-2);
	}
	.bar {
		display: block;
		height: 5px;
		border-radius: 999px;
		background: var(--surface-3);
		margin-top: 6px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent-fill);
		border-radius: inherit;
	}
	.bar span.full {
		background: linear-gradient(90deg, var(--green), var(--gold));
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
