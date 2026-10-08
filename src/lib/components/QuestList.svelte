<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from './Icon.svelte';

	type Quest = {
		id: number;
		label: string;
		progress: number;
		target: number;
		done: boolean;
		claimed_at: number | null;
		reward_kamas: number;
		reward_fragments: number;
		reward_booster: string | null;
	};
	let { quests }: { quests: Quest[] } = $props();
	let err = $state<string | null>(null);
	const BOOSTER: Record<string, string> = { bronze: 'Booster Bronze', silver: 'Booster Argent', gold: 'Booster Or' };
	const reward = (q: Quest) =>
		[q.reward_kamas ? `${q.reward_kamas} kamas` : '', q.reward_fragments ? `${q.reward_fragments} fragments` : '', q.reward_booster ? BOOSTER[q.reward_booster] : '']
			.filter(Boolean)
			.join(', ');
</script>

{#if err}<p class="alert alert-error mb-2">{err}</p>{/if}
<div class="group">
	{#each quests as q (q.id)}
		<div class="cell quest" class:claimed={q.claimed_at} data-testid="quest">
			<span class="ring" style="--p: {Math.min(1, q.progress / q.target)}">
				{#if q.claimed_at}<Icon name="check" size={14} stroke={3} />{:else}<b>{q.progress}</b>{/if}
			</span>
			<span class="flex-1 min-w-0">
				<span class="block font-semibold">{q.label}</span>
				<span class="footnote text-label-2">{q.progress} / {q.target}, récompense : {reward(q)}</span>
				<span class="bar"><span style="width: {Math.min(100, (q.progress / q.target) * 100)}%"></span></span>
			</span>
			{#if q.done && !q.claimed_at}
				<form
					method="POST"
					action="/?/quest"
					use:enhance={() => async ({ result, update }) => {
						err = result.type === 'failure' ? String(result.data?.error ?? 'Erreur') : null;
						await update();
					}}
				>
					<input type="hidden" name="id" value={q.id} />
					<button class="btn btn-sm" data-testid="claim-quest">Récupérer</button>
				</form>
			{/if}
		</div>
	{/each}
</div>

<style>
	.quest {
		align-items: center;
	}
	.claimed {
		opacity: 0.55;
	}
	.ring {
		width: 36px;
		height: 36px;
		border-radius: 999px;
		flex: none;
		display: grid;
		place-items: center;
		font-size: 13px;
		background:
			radial-gradient(circle, var(--surface) 58%, transparent 60%),
			conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--surface-3) 0);
		color: var(--accent);
	}
	.bar {
		display: block;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-3);
		margin-top: 5px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: inherit;
		transition: width var(--dur) var(--ease-ios);
	}
</style>
