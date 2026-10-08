<script lang="ts">
	import { fmt } from '#lib/format';
	import Icon from './Icon.svelte';
	let { value, size = 'md' }: { value: number; size?: 'sm' | 'md' } = $props();
</script>

<span class="k" class:sm={size === 'sm'}><Icon name="coins" size={size === 'sm' ? 13 : 16} />{fmt(value)}<span class="sr-only"> kamas</span></span>

<style>
	.k {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--kamas);
	}
	.sm {
		font-size: 13px;
	}
</style>
