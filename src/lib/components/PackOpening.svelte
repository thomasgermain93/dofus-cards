<script lang="ts">
	import { RARITY, rarityColor } from '#lib/rarity';
	import type { CardView } from '#lib/types';
	import Card from './Card.svelte';
	import PackArt from './PackArt.svelte';
	import Icon from './Icon.svelte';
	import ConfirmSheet from './ConfirmSheet.svelte';
	import { sell, SELL_VALUES } from '#lib/sell';

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

	// Vente rapide après la révélation
	let status = $state<('idle' | 'kept' | 'sold')[]>([]);
	$effect.pre(() => {
		status = cards.map(() => 'idle');
	});
	let busy = $state(false);
	let sellError = $state<string | null>(null);
	let ask = $state<number | null>(null);
	const value = (i: number) => SELL_VALUES[cards[i].card.rarity];
	const dupIdx = $derived(cards.map((c, i) => i).filter((i) => !cards[i].isNew && status[i] === 'idle'));
	const dupTotal = $derived(dupIdx.reduce((s, i) => s + value(i), 0));
	const soldTotal = $derived(cards.reduce((s, c, i) => s + (status[i] === 'sold' ? value(i) : 0), 0));

	async function sellIdx(idx: number[]) {
		if (busy || !idx.length) return;
		busy = true;
		sellError = null;
		const counts = new Map<number, number>();
		for (const i of idx) counts.set(cards[i].card.id, (counts.get(cards[i].card.id) ?? 0) + 1);
		const r = await sell({ items: [...counts].map(([cardId, count]) => ({ cardId, count })) });
		busy = false;
		if (r.error) sellError = r.error;
		else status = status.map((st, i) => (idx.includes(i) ? 'sold' : st));
	}
	function sellOne(i: number) {
		if (cards[i].isNew || cards[i].card.rarity === 5) ask = i;
		else sellIdx([i]);
	}
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
					<div class="sum-item" class:sold={status[i] === 'sold'} style="animation-delay: {i * 60}ms" data-testid="pack-item">
						<div class="sum-card">
							<Card card={c.card} size="sm" />
							{#if c.isNew}<span class="new small">Nouvelle</span>{:else}<span class="dup small">Doublon</span>{/if}
							{#if status[i] === 'sold'}<span class="sold-tag">+{SELL_VALUES[c.card.rarity]} kamas</span>{/if}
						</div>
						{#if status[i] === 'idle'}
							<div class="quick">
								<button class="q sell" disabled={busy} onclick={() => sellOne(i)} data-testid="pack-sell">Vendre +{SELL_VALUES[c.card.rarity]}</button>
								<button class="q keep" onclick={() => (status[i] = 'kept')} data-testid="pack-keep">Garder</button>
							</div>
						{:else if status[i] === 'kept'}
							<p class="kept"><Icon name="check" size={13} stroke={3} />Gardée</p>
						{/if}
					</div>
				{/each}
			</div>
			{#if sellError}<p class="err">{sellError}</p>{/if}
			{#if soldTotal}<p class="total">Gagné avec ce paquet : +{soldTotal} kamas</p>{/if}
			<div class="actions">
				{#if dupIdx.length}
					<button class="btn btn-sell" disabled={busy} onclick={() => sellIdx(dupIdx)} data-testid="pack-sell-dupes"><Icon name="coins" size={18} />Vendre les doublons de ce paquet (+{dupTotal} kamas)</button>
				{/if}
				{#if packsLeft > 0 && onagain}
					<button class="btn" onclick={onagain}><Icon name="package" size={18} />Ouvrir un autre ({packsLeft})</button>
				{/if}
				<a class="btn btn-secondary" href="/album" onclick={onclose}>Voir l'album</a>
				<button class="btn btn-plain" onclick={onclose}>Fermer</button>
			</div>
		</div>
	{/if}
</div>

{#if ask !== null}
	<ConfirmSheet
		title="Vendre {cards[ask].card.name} pour {value(ask)} kamas ?"
		message={[cards[ask].isNew ? 'C’est une nouvelle carte : ce sera ton seul exemplaire vendu.' : '', cards[ask].card.rarity === 5 ? 'C’est une carte Légendaire.' : ''].filter(Boolean).join(' ')}
		confirmLabel="Vendre"
		destructive
		onconfirm={() => {
			const i = ask!;
			ask = null;
			sellIdx([i]);
		}}
		oncancel={() => (ask = null)}
	/>
{/if}

<style>
	.sum-card {
		position: relative;
		transition:
			opacity var(--dur),
			transform var(--dur) var(--ease-ios);
	}
	.sold .sum-card {
		opacity: 0.4;
		transform: scale(0.94);
	}
	.dup {
		position: absolute;
		top: -8px;
		left: 50%;
		transform: translateX(-50%);
		background: #8e8e93;
		color: white;
		font-weight: 700;
		font-size: 10px;
		padding: 1px 7px;
		border-radius: 999px;
		z-index: 2;
	}
	.sold-tag {
		position: absolute;
		inset: auto 0 40% 0;
		text-align: center;
		font-weight: 800;
		color: #30d158;
		font-size: 15px;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
		animation: rise 0.4s var(--ease-ios);
	}
	.quick {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 6px;
	}
	@media (min-width: 640px) {
		.quick {
			flex-direction: row;
		}
	}
	.q {
		flex: 1;
		border: 0;
		border-radius: 999px;
		font-size: 11.5px;
		font-weight: 700;
		padding: 6px 2px;
		cursor: pointer;
		white-space: nowrap;
	}
	.q.sell {
		background: rgba(255, 214, 10, 0.2);
		color: #ffd60a;
	}
	.q.keep {
		background: rgba(255, 255, 255, 0.14);
		color: white;
	}
	.kept {
		margin: 6px 0 0;
		font-size: 12px;
		text-align: center;
		color: rgba(255, 255, 255, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
	.btn-sell {
		background: #ffd60a;
		color: #3d2e00;
	}
	.err {
		color: #ff6961;
		text-align: center;
		margin: 0;
	}
	.total {
		color: #ffd60a;
		text-align: center;
		margin: 0;
		font-weight: 700;
	}
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: radial-gradient(circle at 50% 40%, rgba(40, 30, 80, 0.92), rgba(0, 0, 0, 0.96));
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		align-items: safe center;
		justify-content: center;
		overflow-y: auto;
		color: white;
		animation: fade var(--dur) var(--ease-ios);
		padding: calc(env(safe-area-inset-top) + 56px) 16px calc(env(safe-area-inset-bottom) + 20px);
	}
	.close {
		position: fixed;
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
		gap: 16px;
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
