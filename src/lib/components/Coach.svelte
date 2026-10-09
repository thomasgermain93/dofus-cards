<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from '#lib/toast.svelte';
	import Icon from './Icon.svelte';

	type Step = { key: string; title: string; text: string; href: string; cta: string; done: boolean };
	let { info }: { info: { steps: Step[]; current: number; finished: boolean; reward: { kamas: number; fragments: number } } } = $props();
	let collapsed = $state(false);
	let busy = $state(false);
	const step = $derived(info.current >= 0 ? info.steps[info.current] : null);

	async function call(action: string) {
		busy = true;
		const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
		const r = await res.json().catch(() => ({}));
		busy = false;
		if (action === 'finish' && r.reward) toast(`Bienvenue ! +${r.reward.kamas} kamas et +${r.reward.fragments} fragments`, 'reward', 'gift', 4500);
		await invalidateAll();
	}
</script>

<aside class="coach" class:collapsed aria-label="Tutoriel" data-testid="coach">
	<button class="head" onclick={() => (collapsed = !collapsed)} aria-expanded={!collapsed}>
		<span class="dots" aria-label="{info.steps.filter((s) => s.done).length} étapes sur {info.steps.length}">
			{#each info.steps as s (s.key)}<span class:done={s.done} class:now={step?.key === s.key}></span>{/each}
		</span>
		<span class="footnote font-semibold">Premiers pas</span>
		<Icon name={collapsed ? 'chevron-right' : 'x'} size={16} />
	</button>
	{#if !collapsed}
		{#if info.finished}
			<p class="title">Tout est fait, bravo !</p>
			<p class="text">Ta récompense de bienvenue t'attend : {info.reward.kamas} kamas et {info.reward.fragments} fragments.</p>
			<button class="btn btn-sm btn-block" disabled={busy} onclick={() => call('finish')} data-testid="coach-finish"><Icon name="gift" size={16} />Récupérer</button>
		{:else if step}
			<p class="title">{step.title}</p>
			<p class="text">{step.text}</p>
			<div class="actions">
				<a class="btn btn-sm" href={step.href} data-testid="coach-cta">{step.cta}</a>
				<button class="btn btn-plain btn-sm" disabled={busy} onclick={() => call('skip')} data-testid="coach-skip">Passer le tutoriel</button>
			</div>
		{/if}
	{/if}
</aside>

<style>
	.coach {
		position: fixed;
		z-index: var(--z-bar);
		left: var(--gutter);
		right: var(--gutter);
		bottom: calc(var(--tabbar-h) + var(--space-3) + env(safe-area-inset-bottom));
		max-width: 400px;
		margin: 0 auto;
		padding: var(--space-3) var(--space-4) var(--space-4);
		border-radius: var(--radius-lg);
		background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 88%, var(--gold)), var(--surface) 36px), var(--surface);
		border: 1px solid var(--panel-edge);
		outline: 1px solid color-mix(in srgb, var(--gold-deep) 60%, transparent);
		outline-offset: -4px;
		box-shadow: var(--shadow-float);
		animation: rise 0.5s var(--ease-ios) both;
	}
	.coach.collapsed {
		padding-bottom: var(--space-1);
		max-width: 220px;
	}
	@media (min-width: 1024px) {
		.coach {
			left: auto;
			right: var(--space-8);
			bottom: var(--space-8);
			width: 360px;
		}
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: 32px;
		border: 0;
		background: transparent;
		color: var(--label-2);
		cursor: pointer;
		padding: 0;
	}
	.head > :last-child {
		margin-left: auto;
	}
	.dots {
		display: flex;
		gap: 4px;
	}
	.dots span {
		width: 9px;
		height: 9px;
		transform: rotate(45deg);
		border-radius: 2px;
		background: var(--slot);
		box-shadow: var(--slot-inset);
	}
	.dots .done {
		background: var(--accent-fill);
		box-shadow: 0 0 0 1px var(--panel-edge);
	}
	.dots .now {
		background: var(--gold);
		box-shadow: 0 0 0 1px var(--panel-edge), 0 0 8px var(--gold);
	}
	.title {
		margin: var(--space-2) 0 2px;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--text-lg);
		color: var(--title);
	}
	.text {
		margin: 0 0 var(--space-3);
		font-size: var(--text-sm);
		color: var(--label-2);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	@keyframes rise {
		from {
			transform: translateY(30px);
			opacity: 0;
		}
	}
</style>
