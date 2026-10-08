<script lang="ts">
	import { RARITY, rarityColor } from '#lib/rarity';
	import type { CardView } from '#lib/types';
	import Card from './Card.svelte';
	import PackArt from './PackArt.svelte';
	import Icon from './Icon.svelte';

	let {
		cards,
		packsLeft = 0,
		onclose,
		onagain
	}: {
		cards: { card: CardView; isNew: boolean }[];
		packsLeft?: number;
		onclose: () => void;
		onagain?: () => void;
	} = $props();

	// -1 = paquet fermé, 0..4 = carte révélée, 5 = récapitulatif
	let step = $state(-1);
	let tearing = $state(false);

	function next() {
		if (step === -1) {
			tearing = true;
			setTimeout(() => {
				tearing = false;
				step = 0;
			}, 550);
			return;
		}
		if (step < cards.length) step++;
	}
	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
			e.preventDefault();
			if (step < cards.length) next();
		}
	}
	const current = $derived(step >= 0 && step < cards.length ? cards[step] : null);
</script>

<svelte:window onkeydown={onkey} />

<div class="overlay" role="dialog" aria-modal="true" aria-label="Ouverture du paquet">
	<button class="close" onclick={onclose} aria-label="Fermer"><Icon name="x" size={22} /></button>

	{#if step === -1}
		<button class="stage" onclick={next} aria-label="Ouvrir le paquet">
			<div class="pack-wrap" class:tearing>
				<PackArt width={200} glow />
			</div>
			<p class="hint">Touche le paquet pour l'ouvrir</p>
		</button>
	{:else if current}
		{#key step}
			<button class="stage" onclick={next} aria-label="Carte suivante">
				<div class="reveal r{current.card.rarity}" style="--rc: {rarityColor(current.card.rarity)}">
					{#if current.card.rarity >= 3}<div class="burst"></div>{/if}
					<div class="card-wrap">
						<Card card={current.card} size="lg" />
					</div>
				</div>
				<div class="caption">
					<span class="rname" style="color: {rarityColor(current.card.rarity)}">{RARITY[current.card.rarity].name}</span>
					{#if current.isNew}<span class="new">Nouvelle carte</span>{/if}
				</div>
				<p class="hint">{step + 1} / {cards.length}, touche pour continuer</p>
			</button>
		{/key}
	{:else}
		<div class="summary">
			<h2 class="title-2 text-center">Ton paquet</h2>
			<div class="grid">
				{#each cards as c, i (i)}
					<div class="sum-item" style="animation-delay: {i * 60}ms">
						<Card card={c.card} size="sm" />
						{#if c.isNew}<span class="new small">Nouvelle</span>{/if}
					</div>
				{/each}
			</div>
			<div class="actions">
				{#if packsLeft > 0 && onagain}
					<button class="btn" onclick={onagain}><Icon name="package" size={18} />Ouvrir un autre ({packsLeft})</button>
				{/if}
				<a class="btn btn-secondary" href="/album" onclick={onclose}>Voir l'album</a>
				<button class="btn btn-plain" onclick={onclose}>Fermer</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: radial-gradient(circle at 50% 40%, rgba(40, 30, 80, 0.92), rgba(0, 0, 0, 0.96));
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		animation: fade var(--dur) var(--ease-ios);
		padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom);
	}
	.close {
		position: absolute;
		top: calc(env(safe-area-inset-top) + 12px);
		right: 16px;
		width: 36px;
		height: 36px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.14);
		color: white;
		display: grid;
		place-items: center;
		border: 0;
		cursor: pointer;
		z-index: 2;
	}
	.stage {
		background: none;
		border: 0;
		color: inherit;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		cursor: pointer;
		font: inherit;
	}
	.pack-wrap {
		animation: float 2.4s ease-in-out infinite;
	}
	.pack-wrap.tearing {
		animation: tear 0.55s var(--ease-ios) forwards;
	}
	.hint {
		font-size: 14px;
		opacity: 0.7;
		margin: 0;
	}
	.reveal {
		position: relative;
		width: min(290px, 74vw);
		animation: flip 0.6s var(--ease-ios);
	}
	.card-wrap {
		position: relative;
		z-index: 1;
	}
	.burst {
		position: absolute;
		inset: -40%;
		background: radial-gradient(circle, color-mix(in srgb, var(--rc) 70%, transparent) 0%, transparent 60%);
		animation: burst 1.4s var(--ease-ios) forwards;
		pointer-events: none;
	}
	.r5 .burst {
		background: conic-gradient(from 0deg, transparent, rgba(255, 210, 60, 0.55), transparent 25%, rgba(255, 120, 60, 0.5), transparent 50%, rgba(255, 210, 60, 0.55), transparent 75%);
		border-radius: 50%;
		animation:
			burst 1.4s var(--ease-ios) forwards,
			rays 6s linear infinite;
	}
	.caption {
		display: flex;
		gap: 10px;
		align-items: center;
		animation: rise 0.5s 0.25s var(--ease-ios) both;
	}
	.rname {
		font-weight: 800;
		font-size: 20px;
		filter: brightness(1.3);
	}
	.new {
		background: #30d158;
		color: #00330f;
		font-weight: 700;
		font-size: 13px;
		padding: 3px 10px;
		border-radius: 999px;
	}
	.new.small {
		position: absolute;
		top: -8px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 10px;
		padding: 1px 7px;
		z-index: 2;
	}
	.summary {
		width: 100%;
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(5, 1fr);
		}
	}
	.sum-item {
		position: relative;
		animation: rise 0.45s var(--ease-ios) both;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
	}
	@keyframes float {
		50% {
			transform: translateY(-8px) rotate(-1deg);
		}
	}
	@keyframes tear {
		30% {
			transform: scale(1.06) rotate(-3deg);
		}
		60% {
			transform: scale(1.08) rotate(3deg);
			filter: brightness(1.6);
		}
		100% {
			transform: scale(0.6) translateY(-40px);
			opacity: 0;
			filter: brightness(3);
		}
	}
	@keyframes flip {
		0% {
			transform: perspective(900px) rotateY(90deg) scale(0.85);
			opacity: 0;
		}
		100% {
			transform: perspective(900px) rotateY(0) scale(1);
			opacity: 1;
		}
	}
	@keyframes burst {
		0% {
			transform: scale(0.3);
			opacity: 0;
		}
		40% {
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 0.85;
		}
	}
	@keyframes rays {
		to {
			rotate: 360deg;
		}
	}
	@keyframes rise {
		from {
			transform: translateY(14px);
			opacity: 0;
		}
	}
</style>
