<script lang="ts">
	/** Célébration de montée de niveau (confettis CSS légers). */
	let { level, ondone }: { level: number; ondone: () => void } = $props();
	// On attend la fin d'une ouverture de paquet (ou d'une feuille) pour ne pas la recouvrir
	let visible = $state(false);
	$effect(() => {
		let t: ReturnType<typeof setTimeout>;
		const wait = setInterval(() => {
			if (document.querySelector('.overlay[role=dialog], [role=alertdialog]')) return;
			clearInterval(wait);
			visible = true;
			t = setTimeout(ondone, 2600);
		}, 400);
		return () => {
			clearInterval(wait);
			clearTimeout(t);
		};
	});
	const bits = Array.from({ length: 28 }, (_, i) => ({ x: (i * 37) % 100, d: (i % 7) * 0.08, h: (i * 47) % 360 }));
</script>

{#if visible}
<button class="lvl" onclick={ondone} aria-label="Fermer" data-testid="levelup">
	{#each bits as b, i (i)}<span class="bit" style="left:{b.x}%; animation-delay:{b.d}s; background: hsl({b.h} 90% 60%)"></span>{/each}
	<span class="badge-lvl">
		<span class="small">Niveau</span>
		<span class="num">{level}</span>
		<span class="small">Bravo !</span>
	</span>
</button>
{/if}

<style>
	.lvl {
		position: fixed;
		inset: 0;
		z-index: var(--z-overlay);
		display: grid;
		place-items: center;
		background: var(--scrim);
		border: 0;
		overflow: hidden;
		animation: fade 0.3s;
		cursor: pointer;
	}
	.badge-lvl {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-6) var(--space-10);
		border-radius: 28px;
		background: var(--grad-gold);
		color: var(--on-gold);
		box-shadow: var(--shadow-float);
		animation: pop 0.6s var(--ease-ios) both;
	}
	.num {
		font-size: 72px;
		font-weight: 900;
		line-height: 1;
	}
	.small {
		font-weight: 700;
		font-size: var(--text-md);
	}
	.bit {
		position: absolute;
		top: -10px;
		width: 8px;
		height: 14px;
		border-radius: 2px;
		animation: fall 2.2s ease-in forwards;
	}
	@keyframes pop {
		0% {
			transform: scale(0.4) rotate(-8deg);
			opacity: 0;
		}
		60% {
			transform: scale(1.08) rotate(2deg);
			opacity: 1;
		}
		100% {
			transform: none;
		}
	}
	@keyframes fall {
		to {
			transform: translateY(110vh) rotate(720deg);
		}
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bit {
			display: none;
		}
		.badge-lvl {
			animation: none;
		}
	}
</style>
