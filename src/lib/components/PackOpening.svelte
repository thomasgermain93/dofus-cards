<script lang="ts">
	import { onMount } from 'svelte';
	import { RARITY, rarityColor } from '#lib/rarity';
	import type { CardView } from '#lib/types';
	import Card from './Card.svelte';
	import CardBack from './CardBack.svelte';
	import PackArt from './PackArt.svelte';
	import Icon from './Icon.svelte';
	import ConfirmSheet from './ConfirmSheet.svelte';
	import { sell, SELL_VALUES } from '#lib/sell';
	import { play, preloadSfx, vibrate, isMuted, setMuted } from '#lib/sfx';
	import { requestTilt, tilt } from '#lib/holo';

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

	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	let muted = $state(isMuted());

	/* ------------------------------------------------------------------
	 * Étapes : pack -> (déchirure) -> reveal (une carte par appui) -> summary
	 * ------------------------------------------------------------------ */
	type Phase = 'pack' | 'tearing' | 'reveal' | 'summary';
	let phase = $state<Phase>('pack');
	let index = $state(-1); // carte en cours de révélation
	let flipped = $state(false);
	let charging = $state(false); // anticipation avant une carte rare
	let flash = $state(false);
	let shake = $state(false);
	let teaser = $state<string | null>(null);
	let canvas = $state<HTMLCanvasElement>();
	const timers: ReturnType<typeof setTimeout>[] = [];
	const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, reduced ? Math.min(ms, 60) : ms));

	onMount(() => {
		preloadSfx();
		return () => timers.forEach(clearTimeout);
	});

	/* ---------------- Déchirure du booster ---------------- */
	let tear = $state(0); // 0..1 progression du geste
	let startX: number | null = null;
	let moved = 0;
	let packEl = $state<HTMLDivElement>();

	function down(e: PointerEvent) {
		if (phase !== 'pack') return;
		startX = e.clientX;
		moved = 0;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (startX === null || !packEl) return;
		moved = Math.max(moved, Math.abs(e.clientX - startX));
		tear = Math.min(1, Math.max(0, (e.clientX - startX) / (packEl.offsetWidth * 0.8)));
	}
	function up() {
		if (startX === null) return;
		startX = null;
		// glisser assez loin, ou simple clic / appui (ordinateur, accessibilité)
		if (tear > 0.45 || moved < 8) openPack();
		else tear = 0;
	}

	function openPack() {
		if (phase !== 'pack') return;
		requestTilt(); // iOS : autorisation de l'inclinaison pendant le geste
		tear = 1;
		phase = 'tearing';
		play('tear', 0.6);
		vibrate(25);
		later(() => {
			phase = 'reveal';
			next();
		}, 650);
	}

	/* ---------------- Révélation ---------------- */
	const current = $derived(index >= 0 && index < cards.length ? cards[index] : null);
	const remaining = $derived(Math.max(0, cards.length - index - 1));

	function next() {
		if (charging) return;
		if (index >= cards.length - 1) {
			finish();
			return;
		}
		index++;
		flipped = false;
		teaser = null;
		const c = cards[index].card;
		const last = index === cards.length - 1;
		// Anticipation : plus la carte est rare, plus on fait durer le suspense
		const suspense = c.rarity >= 5 ? 1500 : c.rarity >= 4 ? 1000 : c.rarity >= 3 ? 600 : last && c.rarity >= 2 ? 350 : 0;
		if (suspense) {
			charging = true;
			teaser = c.rarity >= 4 ? 'Quelque chose brille très fort…' : 'Ça scintille…';
			vibrate(c.rarity >= 4 ? [20, 80, 20, 80, 20] : 15);
		}
		later(() => reveal(c.rarity), 260 + suspense);
	}

	function reveal(rarity: number) {
		charging = false;
		teaser = null;
		flipped = true;
		play('flip', 0.45);
		if (rarity >= 5) {
			play('legendary', 0.7);
			vibrate([70, 40, 140]);
			if (!reduced) {
				flash = true;
				shake = true;
				later(() => (flash = false), 450);
				later(() => (shake = false), 520);
			}
		} else if (rarity >= 4) {
			play('epic', 0.6);
			vibrate(45);
		} else if (rarity >= 2) play('rare', 0.5);
		burst(rarity);
	}

	function finish() {
		timers.forEach(clearTimeout);
		charging = false;
		flash = false;
		shake = false;
		phase = 'summary';
		play('place', 0.4);
	}
	function skip() {
		finish();
	}

	/* ---------------- Particules (canvas léger) ---------------- */
	function burst(rarity: number) {
		if (reduced || !canvas || rarity < 1) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = Math.min(2, devicePixelRatio || 1);
		const w = (canvas.width = innerWidth * dpr);
		const h = (canvas.height = innerHeight * dpr);
		const color = getComputedStyle(document.documentElement).getPropertyValue(RARITY[rarity].var).trim() || '#ffd60a';
		const palette = rarity >= 5 ? ['#ffe680', '#ffb020', '#ffffff', '#ff7a3a'] : [color, '#ffffff', color];
		const n = [0, 18, 36, 60, 90, 140][rarity];
		const cx = w / 2;
		const cy = h * 0.45;
		const parts = Array.from({ length: n }, () => {
			const a = Math.random() * Math.PI * 2;
			const s = (2 + Math.random() * (4 + rarity * 1.6)) * dpr;
			return { x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2 * dpr, r: (1.5 + Math.random() * 3.5) * dpr, life: 1, c: palette[(Math.random() * palette.length) | 0] };
		});
		let frame = 0;
		const step = () => {
			ctx.clearRect(0, 0, w, h);
			let alive = 0;
			for (const p of parts) {
				if (p.life <= 0) continue;
				alive++;
				p.x += p.vx;
				p.y += p.vy;
				p.vy += 0.12 * dpr;
				p.vx *= 0.985;
				p.life -= 0.012;
				ctx.globalAlpha = Math.max(0, p.life);
				ctx.fillStyle = p.c;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
				ctx.fill();
			}
			if (alive && frame++ < 180) requestAnimationFrame(step);
			else ctx.clearRect(0, 0, w, h);
		};
		requestAnimationFrame(step);
	}

	function onkey(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
		if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
			e.preventDefault();
			if (phase === 'pack') openPack();
			else if (phase === 'reveal') next();
		}
	}

	/* ---------------- Vente rapide (récapitulatif) ---------------- */
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

<div class="overlay" class:shake role="dialog" aria-modal="true" aria-label="Ouverture du paquet">
	<canvas bind:this={canvas} class="fx" aria-hidden="true"></canvas>
	{#if flash}<div class="flash" aria-hidden="true"></div>{/if}

	<div class="topbar">
		{#if phase === 'reveal'}
			<button class="pill" onclick={skip} data-testid="skip">Passer<Icon name="chevron-right" size={16} /></button>
		{:else}<span></span>{/if}
		<div class="flex gap-2">
			<button
				class="round"
				onclick={() => {
					muted = !muted;
					setMuted(muted);
				}}
				aria-label={muted ? 'Activer le son' : 'Couper le son'}
				aria-pressed={muted}
			>
				{#if muted}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
				{:else}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
				{/if}
			</button>
			<button class="round" onclick={onclose} aria-label="Fermer"><Icon name="x" size={20} /></button>
		</div>
	</div>

	{#if phase === 'pack' || phase === 'tearing'}
		<div class="stage">
			<div
				class="pack-wrap"
				class:tearing={phase === 'tearing'}
				bind:this={packEl}
				role="button"
				tabindex="0"
				aria-label="Ouvrir le paquet"
				data-testid="pack"
				onpointerdown={down}
				onpointermove={move}
				onpointerup={up}
				onpointercancel={() => {
					startX = null;
					tear = 0;
				}}
				style="--tear: {tear}"
			>
				<div class="pack-top"><PackArt width={210} glow /></div>
				<div class="pack-body"><PackArt width={210} glow /></div>
				<div class="cut" style="width: {tear * 100}%"></div>
			</div>
			<p class="hint">
				<span class="touch-only">Glisse ton doigt le long du haut du paquet</span><span class="mouse-only">Clique ou glisse sur le paquet pour l'ouvrir</span>
			</p>
		</div>
	{:else if phase === 'reveal' && current}
		<button class="stage" onclick={next} aria-label="Carte suivante" data-testid="reveal-stage">
			<div class="halo-wrap r{current.card.rarity}" class:charging class:shown={flipped} style="--rc: {rarityColor(current.card.rarity)}">
				{#if current.card.rarity >= 2}<div class="halo"></div>{/if}
				{#if current.card.rarity >= 4}<div class="rays"></div>{/if}
				{#key index}
					<div class="flipper" class:flipped>
						<div class="face back"><CardBack /></div>
						<div class="face front"><div use:tilt style="--holo-k: 1.7"><Card card={current.card} size="lg" /></div></div>
					</div>
				{/key}
			</div>
			<div class="caption">
				{#if teaser}
					<span class="teaser">{teaser}</span>
				{:else if flipped}
					<span class="rname" style="color: {rarityColor(current.card.rarity)}">{RARITY[current.card.rarity].name}</span>
					{#if current.isNew}<span class="new">Nouvelle carte</span>{/if}
				{/if}
			</div>
			<div class="stack" aria-label="{remaining} carte(s) restante(s)">
				{#each Array(remaining) as _, i (i)}<span class="mini" style="--i:{i}"></span>{/each}
			</div>
			<p class="hint">{index + 1} / {cards.length}, touche pour continuer</p>
		</button>
	{:else if phase === 'summary'}
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
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: radial-gradient(circle at 50% 40%, rgba(46, 32, 92, 0.94), rgba(6, 4, 14, 0.97));
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
		display: flex;
		align-items: center;
		align-items: safe center;
		justify-content: center;
		overflow-y: auto;
		overflow-x: hidden;
		color: white;
		animation: fade var(--dur) var(--ease-ios);
		padding: calc(env(safe-area-inset-top) + 60px) 16px calc(env(safe-area-inset-bottom) + 20px);
	}
	.overlay.shake {
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}
	.fx {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 3;
	}
	.flash {
		position: fixed;
		inset: 0;
		background: radial-gradient(circle at 50% 45%, #fff, rgba(255, 230, 140, 0.85) 40%, rgba(255, 255, 255, 0) 75%);
		z-index: 4;
		pointer-events: none;
		animation: flash 0.45s ease-out forwards;
	}
	.topbar {
		position: fixed;
		z-index: 5;
		top: calc(env(safe-area-inset-top) + 12px);
		left: 16px;
		right: 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.round {
		width: 38px;
		height: 38px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.14);
		color: white;
		display: grid;
		place-items: center;
		border: 0;
		cursor: pointer;
	}
	.pill {
		height: 36px;
		padding: 0 10px 0 16px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.14);
		color: white;
		border: 0;
		font-weight: 600;
		font-size: 15px;
		display: inline-flex;
		align-items: center;
		gap: 2px;
		cursor: pointer;
	}
	.stage {
		position: relative;
		z-index: 2;
		background: none;
		border: 0;
		color: inherit;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		cursor: pointer;
		font: inherit;
		width: 100%;
	}
	.hint {
		font-size: 14px;
		opacity: 0.7;
		margin: 0;
		text-align: center;
	}
	.mouse-only {
		display: none;
	}
	@media (hover: hover) and (pointer: fine) {
		.mouse-only {
			display: inline;
		}
		.touch-only {
			display: none;
		}
	}

	/* --- Booster --- */
	.pack-wrap {
		position: relative;
		width: 210px;
		touch-action: none;
		cursor: grab;
		animation: float 2.6s ease-in-out infinite;
		outline: none;
	}
	.pack-top,
	.pack-body {
		position: relative;
	}
	.pack-top {
		position: absolute;
		inset: 0;
		clip-path: inset(0 0 86% 0);
		transform-origin: 0% 14%;
		transform: rotate(calc(var(--tear) * -8deg)) translateY(calc(var(--tear) * -6px));
		z-index: 2;
		transition: transform 0.1s;
	}
	.pack-body {
		clip-path: inset(14% 0 0 0);
	}
	.cut {
		position: absolute;
		left: 0;
		top: 14%;
		height: 3px;
		background: linear-gradient(90deg, #fff, #ffe680);
		box-shadow: 0 0 12px #ffe680;
		z-index: 3;
		border-radius: 2px;
	}
	.tearing {
		animation: none;
	}
	.tearing .pack-top {
		transition: transform 0.55s var(--ease-ios), opacity 0.55s;
		transform: translate(120px, -160px) rotate(35deg);
		opacity: 0;
	}
	.tearing .pack-body {
		animation: drop 0.6s 0.15s var(--ease-ios) forwards;
	}

	/* --- Révélation --- */
	.halo-wrap {
		position: relative;
		width: min(300px, 74vw, calc((100dvh - 260px) * 0.714));
		perspective: 1200px;
	}
	.halo {
		position: absolute;
		inset: -30%;
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in srgb, var(--rc) 75%, transparent) 0%, transparent 62%);
		opacity: 0;
		transform: scale(0.6);
		transition:
			opacity 0.5s,
			transform 0.8s var(--ease-ios);
		pointer-events: none;
	}
	.charging .halo {
		opacity: 0.7;
		transform: scale(0.9);
		animation: pulse 0.5s ease-in-out infinite alternate;
	}
	.shown .halo {
		opacity: 1;
		transform: scale(1.05);
	}
	.rays {
		position: absolute;
		inset: -45%;
		border-radius: 50%;
		background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--rc) 55%, transparent) 0deg 8deg, transparent 8deg 22deg);
		mask: radial-gradient(circle, black 20%, transparent 65%);
		-webkit-mask: radial-gradient(circle, black 20%, transparent 65%);
		opacity: 0;
		transition: opacity 0.6s;
		animation: rays 14s linear infinite;
		pointer-events: none;
	}
	.shown .rays {
		opacity: 0.9;
	}
	.r5 .rays {
		background: repeating-conic-gradient(from 0deg, rgba(255, 214, 90, 0.55) 0deg 7deg, transparent 7deg 18deg);
	}
	.flipper {
		position: relative;
		z-index: 1;
		aspect-ratio: 5 / 7;
		transform-style: preserve-3d;
		transition: transform 0.7s var(--ease-ios);
		animation: enter 0.35s var(--ease-ios);
	}
	.charging .flipper {
		animation: wobble 0.18s ease-in-out infinite alternate;
	}
	.flipper.flipped {
		transform: rotateY(180deg);
	}
	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.front {
		transform: rotateY(180deg);
	}
	.caption {
		min-height: 30px;
		display: flex;
		gap: 10px;
		align-items: center;
		animation: rise 0.5s var(--ease-ios) both;
	}
	.teaser {
		font-weight: 700;
		font-size: 17px;
		color: #ffe680;
		animation: pulse 0.6s ease-in-out infinite alternate;
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
	.stack {
		position: relative;
		height: 34px;
		width: 120px;
	}
	.mini {
		position: absolute;
		left: calc(50% - 12px + var(--i) * 7px - 14px);
		top: 0;
		width: 24px;
		height: 34px;
		border-radius: 4px;
		background: linear-gradient(160deg, #4c2a9a, #1e3a8a);
		box-shadow:
			0 0 0 1.5px #c9a45c,
			0 2px 6px rgba(0, 0, 0, 0.4);
		transform: rotate(calc((var(--i) - 1.5) * 6deg));
	}

	/* --- Récapitulatif --- */
	.summary {
		position: relative;
		z-index: 2;
		width: 100%;
		max-width: 760px;
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
	.new.small,
	.dup {
		position: absolute;
		top: -8px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 10px;
		padding: 1px 7px;
		z-index: 2;
		border-radius: 999px;
		font-weight: 700;
	}
	.dup {
		background: #8e8e93;
		color: white;
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
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
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
	@keyframes drop {
		to {
			transform: translateY(140px) scale(0.9);
			opacity: 0;
		}
	}
	@keyframes enter {
		from {
			transform: translateY(60px) scale(0.85);
			opacity: 0;
		}
	}
	@keyframes wobble {
		from {
			transform: rotate(-1.6deg) scale(1.01);
		}
		to {
			transform: rotate(1.6deg) scale(1.03);
		}
	}
	@keyframes pulse {
		from {
			opacity: 0.55;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes rays {
		to {
			rotate: 360deg;
		}
	}
	@keyframes flash {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}
	@keyframes shake {
		10%,
		90% {
			transform: translate(-2px, 1px);
		}
		20%,
		80% {
			transform: translate(4px, -2px);
		}
		30%,
		50%,
		70% {
			transform: translate(-6px, 2px);
		}
		40%,
		60% {
			transform: translate(6px, -1px);
		}
	}
	@keyframes rise {
		from {
			transform: translateY(14px);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pack-wrap,
		.rays,
		.charging .flipper,
		.charging .halo,
		.teaser {
			animation: none;
		}
		.flipper {
			transition-duration: 0.15s;
		}
	}
</style>
