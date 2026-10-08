<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { fmt } from '#lib/format';
	import Icon from './Icon.svelte';

	/** Compteur de kamas du header : les gains s'ajoutent en douceur avec un « +X » qui monte. */
	let { value }: { value: number } = $props();
	const shown = new Tween(0, { duration: 700, easing: cubicOut });
	let prev: number | null = null;
	let gains = $state<{ id: number; amount: number }[]>([]);
	let pulse = $state(false);
	let seq = 0;
	let el: HTMLSpanElement;
	// Les kamas gagnés « volent » vers le compteur depuis le dernier endroit touché
	let lastX = 0;
	let lastY = 0;
	if (typeof window !== 'undefined')
		window.addEventListener('pointerdown', (e) => ((lastX = e.clientX), (lastY = e.clientY)), { passive: true, capture: true });
	function fly(n: number) {
		if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || !lastX) return;
		const r = el.getBoundingClientRect();
		for (let i = 0; i < Math.min(8, 3 + Math.floor(Math.log10(n + 1) * 2)); i++) {
			const c = document.createElement('span');
			c.className = 'coin-fly';
			c.style.left = `${lastX - 9}px`;
			c.style.top = `${lastY - 9}px`;
			document.body.appendChild(c);
			const dx = r.left + 10 - lastX;
			const dy = r.top + 6 - lastY;
			const a = c.animate(
				[
					{ transform: 'translate(0,0) scale(0.6)', opacity: 0 },
					{ transform: `translate(${dx * 0.3 + (i - 3) * 14}px, ${dy * 0.3 - 40}px) scale(1.1)`, opacity: 1, offset: 0.35 },
					{ transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.4 }
				],
				{ duration: 700 + i * 60, easing: 'cubic-bezier(0.32,0.72,0,1)' }
			);
			a.onfinish = () => c.remove();
		}
	}

	$effect(() => {
		const v = value;
		if (prev === null) shown.set(v, { duration: 0 });
		else if (v !== prev) {
			shown.set(v);
			if (v > prev) {
				fly(v - prev);
				const id = ++seq;
				gains = [...gains, { id, amount: v - prev }];
				pulse = true;
				setTimeout(() => (pulse = false), 450);
				setTimeout(() => (gains = gains.filter((g) => g.id !== id)), 1300);
			}
		}
		prev = v;
	});
</script>

<span class="k" class:pulse data-testid="kamas-counter" data-value={value} bind:this={el}>
	<Icon name="coins" size={13} />{fmt(Math.round(shown.current))}<span class="sr-only"> kamas</span>
	{#each gains as g (g.id)}<span class="gain">+{fmt(g.amount)}</span>{/each}
</span>

<style>
	.k {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-weight: 700;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--kamas);
		transition: transform 0.45s var(--ease-ios);
	}
	:global(.coin-fly) {
		position: fixed;
		z-index: 9999;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		pointer-events: none;
		background: radial-gradient(circle at 35% 30%, var(--glow-gold), var(--gold) 55%, var(--kamas));
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
	}
	.pulse {
		transform: scale(1.15);
	}
	.gain {
		position: absolute;
		right: -6px;
		top: calc(100% + 8px);
		font-size: 12px;
		font-weight: 800;
		color: var(--success);
		background: var(--surface);
		border-radius: 999px;
		padding: 1px 7px;
		box-shadow: var(--shadow-card);
		white-space: nowrap;
		pointer-events: none;
		animation: rise 1.3s var(--ease-ios) forwards;
	}
	@keyframes rise {
		0% {
			opacity: 0;
			transform: translateY(6px);
		}
		20% {
			opacity: 1;
			transform: translateY(2px);
		}
		75% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translateY(-14px);
		}
	}
</style>
