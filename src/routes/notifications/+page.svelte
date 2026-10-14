<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { ago } from '#lib/format';
	let { data } = $props();
</script>

<svelte:head><title>Notifications</title></svelte:head>

<h1 class="large-title mb-4">Notifications</h1>
<div class="group">
	{#each data.list as n (n.id)}
		<a class="cell text-inherit no-underline" href={n.link ?? '/'}>
			{#if !n.read_at}<span class="dot"></span>{/if}
			<span class="flex-1 min-w-0"><span class="block">{n.body}</span><span class="footnote text-label-2">{ago(n.created_at)}</span></span>
			<Icon name="chevron-right" size={16} class="text-label-3" />
		</a>
	{:else}
		<p class="cell text-label-2">Aucune notification.</p>
	{/each}
</div>

<style>
	.dot {
		width: 9px;
		height: 9px;
		transform: rotate(45deg);
		border-radius: 2px;
		background: var(--gold);
		box-shadow: 0 0 0 1px var(--panel-edge);
		flex: none;
	}
	.no-underline {
		text-decoration: none;
	}
	.text-inherit {
		color: inherit;
	}
</style>
