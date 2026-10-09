<script lang="ts">
	import { GAME_NAME } from '#lib/config';
	import Logo from './Logo.svelte';
	let { width = 170, glow = false, kind = 'free' }: { width?: number; glow?: boolean; kind?: string } = $props();
	const LABEL: Record<string, string> = { bronze: 'Booster Bronze', silver: 'Booster Argent', gold: 'Booster Or', welcome: 'Bienvenue !' };
</script>

<div class="pack k-{kind}" class:glow style="width:{width}px; font-size:{Math.round(width * 0.09)}px">
	<div class="foil"></div>
	<div class="crimp top"></div>
	<div class="body">
		<span class="seal"><Logo size={width * 0.3} text={false} /></span>
		<span class="title">{GAME_NAME}</span>
		<span class="sub">{LABEL[kind] ?? '5 cartes'}</span>
	</div>
	<div class="crimp bottom"></div>
</div>

<style>
	/* Paquet : sachet de cuir cousu au fil d'or, scellé à la cire */
	.pack {
		position: relative;
		aspect-ratio: 5 / 8;
		border-radius: 8px;
		background: var(--pack-free);
		border: 1px solid #0d0a07;
		box-shadow:
			0 10px 26px rgba(30, 18, 6, 0.45),
			inset 0 0 0 3px rgba(0, 0, 0, 0.18),
			inset 0 0 18px rgba(0, 0, 0, 0.35);
		overflow: hidden;
		color: #fff6dc;
		display: flex;
		flex-direction: column;
	}
	/* couture dorée en pointillés */
	.pack::after {
		content: '';
		position: absolute;
		inset: 6px;
		border: 1.5px dashed rgba(240, 210, 85, 0.7);
		border-radius: 5px;
		pointer-events: none;
	}
	.k-bronze {
		background: var(--pack-bronze);
	}
	.k-silver {
		background: var(--pack-silver);
		color: #1c1712;
	}
	.k-welcome {
		background: var(--pack-welcome);
	}
	.k-gold {
		background: var(--pack-gold);
		color: #2a1c00;
	}
	.glow {
		box-shadow:
			0 0 0 2px rgba(240, 210, 85, 0.7),
			0 0 50px rgba(240, 190, 60, 0.55);
	}
	.foil {
		position: absolute;
		inset: 0;
		background: linear-gradient(115deg, transparent 20%, rgba(255, 240, 200, 0.28) 40%, transparent 55%);
		background-size: 300% 100%;
		animation: foil 3.5s var(--ease-ios) infinite;
	}
	.crimp {
		height: 7%;
		background: repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.28) 0 2px, transparent 2px 6px);
		box-shadow: inset 0 -1px 0 rgba(255, 240, 200, 0.25);
	}
	.crimp.bottom {
		box-shadow: inset 0 1px 0 rgba(255, 240, 200, 0.25);
	}
	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		position: relative;
	}
	/* sceau de cire rouge */
	.seal {
		display: grid;
		place-items: center;
		padding: 0.45em;
		border-radius: 999px;
		background: radial-gradient(circle at 40% 35%, #d4525a, #8a2229 70%, #5e1016);
		box-shadow:
			0 0 0 0.18em rgba(94, 16, 22, 0.6),
			0 3px 6px rgba(0, 0, 0, 0.4),
			inset 0 1px 2px rgba(255, 200, 200, 0.4);
	}
	.title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.55em;
		line-height: 1;
		white-space: nowrap;
		text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
	}
	.k-silver .title,
	.k-gold .title {
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.sub {
		font-size: 1em;
		opacity: 0.9;
		font-weight: 700;
	}
	@keyframes foil {
		0% {
			background-position: 120% 0;
		}
		100% {
			background-position: -60% 0;
		}
	}
</style>
