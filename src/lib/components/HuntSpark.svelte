<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from '#lib/toast.svelte';
	import { play, vibrate } from '#lib/sfx';
	import Icon from './Icon.svelte';

	/** Chasse aux cartes : une carte mystère cachée sur une page différente chaque jour. */
	let { path }: { path: string } = $props();
	let gone = $state(false);
	// position stable dans la page (côté droit, à mi-hauteur variable selon le jour)
	const top = $derived(30 + ([...path].reduce((a, c) => a + c.charCodeAt(0), 0) % 40));

	async function grab() {
		gone = true;
		play('rare', 0.5);
		vibrate(30);
		const res = await fetch('/api/hunt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: page.url.pathname }) });
		const r = await res.json().catch(() => ({}));
		if (res.ok) toast(`Carte mystère trouvée ! +${r.kamas} kamas, +${r.fragments} fragments${r.card ? `, et ${r.card.name} !` : ''}`, 'reward', 'sparkles', 5000);
		else toast(r.error ?? 'Raté !', 'error');
		await invalidateAll();
	}
</script>

{#if !gone && page.url.pathname === path}
	<button class="spark" style="top: {top}%" onclick={grab} aria-label="Carte mystère cachée : touche-la !" data-testid="hunt">
		<Icon name="sparkles" size={22} fill />
	</button>
{/if}

<style>
	.spark {
		position: fixed;
		right: var(--space-2);
		z-index: var(--z-bar);
		width: var(--tap);
		height: var(--tap);
		border-radius: 12px;
		border: 0;
		display: grid;
		place-items: center;
		color: var(--on-gold);
		background: var(--grad-gold);
		box-shadow: 0 6px 20px color-mix(in srgb, var(--gold) 50%, transparent);
		transform: rotate(8deg);
		animation: wiggle 2.4s ease-in-out infinite;
		cursor: pointer;
	}
	@keyframes wiggle {
		0%,
		70%,
		100% {
			transform: rotate(8deg) scale(1);
		}
		80% {
			transform: rotate(-10deg) scale(1.12);
		}
		90% {
			transform: rotate(12deg) scale(1.05);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spark {
			animation: none;
		}
	}
</style>
