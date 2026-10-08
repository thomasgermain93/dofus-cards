<script lang="ts">
	import { GAME_NAME } from '#lib/config';
	import Logo from './Logo.svelte';
	let { width = 170, glow = false, kind = 'free' }: { width?: number; glow?: boolean; kind?: string } = $props();
	const LABEL: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or' };
</script>

<div class="pack k-{kind}" class:glow style="width:{width}px; font-size:{Math.round(width * 0.09)}px">
	<div class="foil"></div>
	<div class="crimp top"></div>
	<div class="body">
		<Logo size={width * 0.32} text={false} />
		<span class="title">{GAME_NAME}</span>
		<span class="sub">{LABEL[kind] ? `Booster ${LABEL[kind]}` : '5 cartes'}</span>
	</div>
	<div class="crimp bottom"></div>
</div>

<style>
	.pack {
		position: relative;
		aspect-ratio: 5 / 8;
		border-radius: 14px;
		background: var(--pack-free);
		box-shadow:
			0 10px 30px rgba(76, 29, 149, 0.35),
			inset 0 0 0 1px rgba(255, 255, 255, 0.18);
		overflow: hidden;
		color: white;
		display: flex;
		flex-direction: column;
	}
	.k-bronze {
		background: var(--pack-bronze);
	}
	.k-silver {
		background: var(--pack-silver);
	}
	.k-gold {
		background: var(--pack-gold);
	}
	.glow {
		box-shadow:
			0 0 0 2px rgba(255, 255, 255, 0.5),
			0 0 50px rgba(219, 39, 119, 0.6);
	}
	.foil {
		position: absolute;
		inset: 0;
		background: linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, 0.35) 40%, transparent 55%);
		background-size: 300% 100%;
		animation: foil 3.5s var(--ease-ios) infinite;
	}
	.crimp {
		height: 7%;
		background: repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.25) 0 3px, transparent 3px 7px);
		opacity: 0.8;
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
	.title {
		font-family: var(--font-rounded);
		font-weight: 800;
		font-size: 1.5em;
		white-space: nowrap;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}
	.sub {
		font-size: 1em;
		opacity: 0.85;
		font-weight: 600;
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
