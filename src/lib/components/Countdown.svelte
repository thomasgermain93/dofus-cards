<script lang="ts">
	import { onMount } from 'svelte';
	import { duration } from '#lib/format';

	/** `target` et `serverNow` viennent du serveur : on corrige le décalage d'horloge du client. */
	let { target, serverNow, ondone }: { target: number; serverNow: number; ondone?: () => void } = $props();
	const offset = $derived(serverNow - Date.now());
	let now = $state(Date.now());
	let fired = false;

	onMount(() => {
		const t = setInterval(() => {
			now = Date.now();
			if (!fired && target - (now + offset) <= 0) {
				fired = true;
				ondone?.();
			}
		}, 1000);
		return () => clearInterval(t);
	});
</script>

<span class="tabular-nums">{duration(target - (now + offset))}</span>
