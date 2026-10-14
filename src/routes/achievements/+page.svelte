<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import Kamas from '#lib/components/Kamas.svelte';
	let { data } = $props();
	const count = $derived(data.list.filter((a) => a.unlockedAt).length);
</script>

<svelte:head><title>Succès</title></svelte:head>

<h1 class="large-title mb-1">Succès</h1>
<p class="text-label-2 mb-4">{count} / {data.list.length} débloqués</p>

<div class="grid gap-3 sm:grid-cols-2">
	{#each data.list as a (a.code)}
		<div class="ach" class:done={a.unlockedAt}>
			<span class="medal"><Icon name={a.unlockedAt ? 'award' : 'award'} size={24} /></span>
			<div class="flex-1 min-w-0">
				<p class="headline">{a.name}</p>
				<p class="footnote text-label-2">{a.description}</p>
				{#if a.progress && !a.unlockedAt}
					<div class="bar mt-2"><span style="width:{Math.min(100, (a.progress[0] / a.progress[1]) * 100)}%"></span></div>
					<p class="footnote text-label-3 mt-1">{Math.min(a.progress[0], a.progress[1])} / {a.progress[1]}</p>
				{/if}
			</div>
			<div class="flex flex-col items-end gap-1">
				<Kamas value={a.reward} size="sm" />
				{#if a.unlockedAt}<Icon name="check" size={18} class="text-success" stroke={3} />{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.ach {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 14px;
	}
	.medal {
		width: 44px;
		height: 44px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		flex: none;
		background: var(--surface-3);
		color: var(--label-3);
	}
	.done .medal {
		background: var(--emblem-gold);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		color: var(--on-gold);
	}
	.bar {
		height: 6px;
		border-radius: 999px;
		background: var(--slot);
		box-shadow: var(--slot-inset);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--gauge-fill);
		border-radius: inherit;
	}
</style>
