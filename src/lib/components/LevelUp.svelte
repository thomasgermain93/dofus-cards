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
	// Pluie de kamas et de feuilles aux couleurs du jeu
	const COLORS = ['#f0d255', '#c99a1c', '#8fb637', '#fff1a8'];
	const bits = Array.from({ length: 28 }, (_, i) => ({ x: (i * 37) % 100, d: (i % 7) * 0.08, c: COLORS[i % 4], coin: i % 4 !== 2 }));
</script>

{#if visible}
<button class="lvl" onclick={ondone} aria-label="Fermer" data-testid="levelup">
	{#each bits as b, i (i)}<span class="bit" class:coin={b.coin} style="left:{b.x}%; animation-delay:{b.d}s; background: {b.c}"></span>{/each}
	<span class="badge-lvl">
		<span class="ribbon">Niveau supérieur</span>
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
		border-radius: var(--radius-lg);
		background:
			var(--corner-tl) top 5px left 5px / 18px no-repeat,
			var(--corner-tr) top 5px right 5px / 18px no-repeat,
			var(--corner-bl) bottom 5px left 5px / 18px no-repeat,
			var(--corner-br) bottom 5px right 5px / 18px no-repeat,
			radial-gradient(circle at 50% 30%, #4a3c2a, #1c1712 80%);
		border: 2px solid var(--emblem-edge);
		color: var(--gold);
		box-shadow: 0 0 0 1px #0d0a07, 0 0 60px -10px var(--gold), var(--shadow-float);
		animation: pop 0.6s var(--ease-ios) both;
	}
	.num {
		font-family: var(--font-display);
		font-size: 84px;
		font-weight: 700;
		line-height: 1;
		color: var(--gold);
		text-shadow: 0 3px 0 #6e4a00, 0 0 24px rgba(240, 210, 85, 0.5);
	}
	.small {
		font-weight: 700;
		font-size: var(--text-md);
		color: #f1e6cc;
	}
	.bit {
		position: absolute;
		top: -10px;
		width: 8px;
		height: 14px;
		border-radius: 2px;
		animation: fall 2.2s ease-in forwards;
	}
	.bit.coin {
		width: 11px;
		height: 11px;
		border-radius: 999px;
		box-shadow: inset -2px -2px 0 rgba(110, 74, 0, 0.6);
	}
	.badge-lvl .ribbon {
		margin: -38px 0 8px;
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
