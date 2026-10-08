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
		border-radius: var(--radius-pill);
		background: var(--material);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		backdrop-filter: saturate(180%) blur(20px);
		color: var(--label);
		font-weight: 600;
		font-size: var(--text-md);
		box-shadow: var(--shadow-float);
		animation: drop 0.5s var(--ease-ios) both;
	}
	.ic {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		color: white;
		background: var(--accent-fill);
		flex: none;
	}
	.success .ic {
		background: var(--success);
	}
	.reward .ic {
		background: var(--grad-gold);
		color: var(--on-gold);
	}
	.error .ic {
		background: var(--danger);
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
