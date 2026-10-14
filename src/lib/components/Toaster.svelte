<script lang="ts">
	import { toasts } from '#lib/toast.svelte';
	import Icon from './Icon.svelte';
	const ICON: Record<string, string> = { success: 'check', reward: 'gift', info: 'info', error: 'x' };
</script>

<div class="toaster" aria-live="polite">
	{#each toasts.list as t (t.id)}
		<div class="toast {t.kind}" role="status" data-testid="toast-global">
			<span class="ic"><Icon name={t.icon ?? ICON[t.kind]} size={16} stroke={2.6} /></span>
			<span>{t.text}</span>
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		z-index: calc(var(--z-sheet) + 10);
		top: calc(env(safe-area-inset-top) + 60px);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		pointer-events: none;
		width: min(92vw, 440px);
	}
	.toast {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 10px 16px 10px 10px;
		border-radius: var(--radius-md);
		background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 88%, var(--gold)), var(--surface) 36px), var(--surface);
		border: 1px solid var(--panel-edge);
		outline: 1px solid color-mix(in srgb, var(--gold-deep) 60%, transparent);
		outline-offset: -4px;
		color: var(--label);
		font-weight: 700;
		font-size: var(--text-md);
		box-shadow: var(--shadow-float);
		animation: drop 0.5s var(--ease-ios) both;
	}
	.ic {
		width: 30px;
		height: 30px;
		border-radius: var(--radius-sm);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		display: grid;
		place-items: center;
		color: var(--accent-contrast);
		background: var(--accent-fill);
		flex: none;
	}
	.ic {
		background: var(--emblem-green);
		color: var(--emblem-ink);
	}
	.reward .ic {
		background: var(--emblem-gold);
		color: var(--on-gold);
	}
	.error .ic {
		background: var(--emblem-red);
	}
	@keyframes drop {
		0% {
			transform: translateY(-24px) scale(0.9);
			opacity: 0;
		}
		60% {
			transform: translateY(3px) scale(1.02);
			opacity: 1;
		}
		100% {
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}
	}
</style>
