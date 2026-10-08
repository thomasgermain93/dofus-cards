<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Card from '#lib/components/Card.svelte';
	import CardThumb from '#lib/components/CardThumb.svelte';
	import CardPicker from '#lib/components/CardPicker.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { fmt } from '#lib/format';
	import type { CardView } from '#lib/types';

	let { data, form } = $props();

	// Quiz : réponse envoyée au serveur, retour visuel, puis question suivante
	let picked = $state<number | null>(null);
	let feedback = $state<{ correct: boolean; correctIndex: number } | null>(null);
	let busy = $state(false);
	let quizError = $state<string | null>(null);
	async function answer(i: number) {
		if (busy || !data.question) return;
		busy = true;
		picked = i;
		const body = new FormData();
		body.set('question', String(data.question.id));
		body.set('choice', String(i));
		const res = await fetch('?/answer', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		const result = deserialize(await res.text());
		if (result.type === 'success') {
			feedback = result.data as { correct: boolean; correctIndex: number };
			setTimeout(async () => {
				await invalidateAll();
				feedback = null;
				picked = null;
				busy = false;
			}, 1100);
		} else {
			quizError = result.type === 'failure' ? String(result.data?.error) : 'Erreur';
			busy = false;
			picked = null;
		}
	}

	let deck = $state<number[]>([]);
	const pct = (hp: number, max: number) => (max ? Math.round((hp / max) * 100) : 0);
	const outcome = $derived(
		data.phase === 'done' ? (data.duel.result === 'draw' ? 'draw' : (data.duel.result === 'challenger') === data.me.challenger ? 'win' : 'loss') : null
	);
	let animate = $state(false);
	$effect(() => {
		if (data.phase === 'done') setTimeout(() => (animate = true), 150);
	});
</script>

<svelte:head><title>Duel contre {data.other.name}</title></svelte:head>

<a href="/duels" class="back"><Icon name="chevron-left" size={20} />Duels</a>

<div class="versus">
	<span class="who">{data.me.name}</span>
	<span class="vs">VS</span>
	<span class="who">{#if data.duel.vs_bot}<Icon name="bot" size={18} />{/if}{data.other.name}</span>
</div>

{#if form?.error}<p class="alert alert-error mb-3">{form.error}</p>{/if}

{#if data.phase === 'accept'}
	<h1 class="title-2 mb-1">{data.other.name} te défie !</h1>
	<p class="text-label-2 mb-3">Voici ses cartes : tu devras répondre à des questions sur elles. Choisis tes 3 cartes pour accepter.</p>
	<div class="trio mb-5">{#each data.theirCards as c (c.id)}<Card card={c} size="sm" />{/each}</div>
	<form method="POST" action="?/accept" use:enhance class="flex flex-col gap-4">
		<input type="hidden" name="cards" value={JSON.stringify(deck)} />
		<CardPicker cards={data.mine ?? []} bind:selected={deck} max={3} />
		<div class="flex gap-3">
			<button class="btn flex-1" disabled={deck.length !== 3} data-testid="accept-duel"><Icon name="swords" size={18} />Accepter le duel</button>
			<button class="btn btn-danger" formaction="?/decline" formnovalidate>Refuser</button>
		</div>
	</form>
{:else if data.phase === 'waiting-accept'}
	<div class="wait">
		<Icon name="clock" size={40} />
		<h1 class="title-2">En attente de {data.other.name}</h1>
		<p class="text-label-2">Ton défi a été envoyé. Tu pourras répondre dès qu'il aura choisi ses cartes.</p>
		<div class="trio">{#each data.myCards as c (c.id)}<Card card={c} size="sm" />{/each}</div>
		<form method="POST" action="?/decline" use:enhance><button class="btn btn-danger btn-sm">Annuler le défi</button></form>
	</div>
{:else if data.phase === 'quiz' && data.question}
	{@const q = data.question}
	<div class="quiz">
		<div class="qhead">
			<span class="footnote text-label-2">Question {q.position + 1} / {q.total}</span>
			<div class="dots">{#each Array(q.total) as _, i}<span class:done={i < q.position} class:now={i === q.position}></span>{/each}</div>
		</div>
		<div class="attacker">
			<div class="w-28 flex-none"><Card card={data.attacker as CardView} size="sm" /></div>
			<div class="min-w-0">
				<p class="footnote text-label-2">Carte de {data.other.name}</p>
				<p class="headline">{data.attacker?.name}</p>
				<p class="footnote text-label-2 flex items-center gap-1 mt-1"><Icon name="sword" size={13} />Attaque {fmt(data.attacker?.attack)} : chaque erreur te coûte des PV</p>
			</div>
		</div>
		<h1 class="question">{q.prompt}</h1>
		{#if quizError}<p class="alert alert-error">{quizError}</p>{/if}
		<div class="choices">
			{#each q.choices as choice, i}
				<button
					class="choice"
					class:right={feedback && i === feedback.correctIndex}
					class:wrong={feedback && picked === i && !feedback.correct}
					class:dim={feedback && i !== feedback.correctIndex && picked !== i}
					disabled={busy}
					onclick={() => answer(i)}
					data-testid="choice"
				>
					<span class="letter">{'ABCD'[i]}</span><span class="flex-1 text-left">{choice}</span>
					{#if feedback && i === feedback.correctIndex}<Icon name="check" size={18} stroke={3} />{/if}
					{#if feedback && picked === i && !feedback.correct}<Icon name="x" size={18} stroke={3} />{/if}
				</button>
			{/each}
		</div>
	</div>
{:else if data.phase === 'waiting-answers'}
	<div class="wait">
		<Icon name="clock" size={40} />
		<h1 class="title-2">Bien joué !</h1>
		<p class="text-label-2">Tu as répondu à toutes tes questions. Le résultat sera calculé dès que {data.other.name} aura fini.</p>
	</div>
{:else if data.phase === 'done' && data.mineSide && data.theirSide}
	<div class="banner {outcome}">
		<p class="large-title">{outcome === 'win' ? 'Victoire !' : outcome === 'loss' ? 'Défaite' : 'Match nul'}</p>
	</div>
	<div class="sides">
		{#each [{ label: data.me.name, side: data.mineSide, cards: data.myCards }, { label: data.other.name, side: data.theirSide, cards: data.theirCards }] as s}
			<section class="group p-4">
				<div class="flex justify-between items-baseline mb-1"><h2 class="headline">{s.label}</h2><span class="footnote tabular-nums">{fmt(s.side.hp)} / {fmt(s.side.maxHp)} PV</span></div>
				<div class="hpbar"><span style="width: {animate ? pct(s.side.hp, s.side.maxHp) : 100}%" class:low={pct(s.side.hp, s.side.maxHp) < 30}></span></div>
				<div class="flex flex-col gap-2 mt-3">
					{#each s.side.attacks as a (a.card.id)}
						<div class="flex items-center gap-3">
							<CardThumb card={a.card} size={48} />
							<div class="flex-1 min-w-0">
								<p class="footnote font-semibold truncate">{a.card.name}</p>
								<p class="footnote text-label-2">{a.wrong} erreur{a.wrong > 1 ? 's' : ''} sur {a.total} : {fmt(a.damage)} dégâts infligés</p>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
	<h2 class="section-label mt-5">Tes réponses</h2>
	<div class="group">
		{#each data.review ?? [] as r, i (i)}
			<div class="cell items-start">
				<Icon name={r.answer === r.correct ? 'check' : 'x'} size={18} class={r.answer === r.correct ? 'text-success mt-0.5' : 'text-danger mt-0.5'} />
				<div class="flex-1 min-w-0">
					<p class="footnote">{r.prompt}</p>
					<p class="footnote text-label-2">Bonne réponse : <strong>{r.choices[r.correct]}</strong>{#if r.answer !== r.correct && r.answer != null}, ta réponse : {r.choices[r.answer]}{/if}</p>
				</div>
			</div>
		{/each}
	</div>
	<div class="flex gap-3 mt-5">
		<a class="btn flex-1" href={data.duel.vs_bot ? '/duels/new?vs=bot' : '/duels/new'}><Icon name="swords" size={18} />Rejouer</a>
		<a class="btn btn-secondary flex-1" href="/duels">Mes duels</a>
	</div>
{:else}
	<p class="text-label-2 text-center py-10">Ce duel a été {data.phase === 'declined' ? 'refusé' : 'annulé'}.</p>
{/if}

<style>
	.back {
		display: inline-flex;
		align-items: center;
		color: var(--accent);
		text-decoration: none;
		margin: 0 0 8px -6px;
		font-size: 17px;
	}
	.versus {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 16px;
		font-weight: 700;
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		max-width: 40%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.vs {
		font-family: var(--font-rounded);
		font-weight: 900;
		font-size: 13px;
		color: white;
		background: linear-gradient(135deg, #ff375f, #ff9f0a);
		border-radius: 8px;
		padding: 2px 8px;
	}
	.trio {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		max-width: 420px;
	}
	.wait {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
		padding: 32px 0;
		color: var(--label);
	}
	.quiz {
		max-width: 620px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.qhead {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.dots {
		display: flex;
		gap: 4px;
	}
	.dots span {
		flex: 1;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-3);
	}
	.dots .done {
		background: var(--accent);
	}
	.dots .now {
		background: color-mix(in srgb, var(--accent) 45%, var(--surface-3));
	}
	.attacker {
		display: flex;
		gap: 14px;
		align-items: center;
		background: var(--surface);
		border-radius: var(--radius-lg);
		padding: 12px;
	}
	.question {
		font-size: 24px;
		line-height: 30px;
		font-weight: 700;
		margin: 4px 0;
	}
	.choices {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 12px 16px;
		border-radius: var(--radius-lg);
		background: var(--surface);
		border: 1.5px solid transparent;
		font-size: 17px;
		color: var(--label);
		cursor: pointer;
		transition:
			transform var(--dur-fast) var(--ease-ios),
			background var(--dur-fast),
			opacity var(--dur);
	}
	.choice:active {
		transform: scale(0.98);
	}
	.letter {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: var(--surface-3);
		display: grid;
		place-items: center;
		font-weight: 700;
		font-size: 14px;
		flex: none;
	}
	.choice.right {
		background: var(--success-soft);
		border-color: var(--success);
		color: var(--success);
	}
	.choice.wrong {
		background: var(--danger-soft);
		border-color: var(--danger);
		color: var(--danger);
		animation: shake 0.35s;
	}
	.choice.dim {
		opacity: 0.45;
	}
	.banner {
		text-align: center;
		border-radius: var(--radius-lg);
		padding: 18px;
		margin-bottom: 16px;
		color: white;
		animation: pop 0.5s var(--ease-ios);
	}
	.banner.win {
		background: linear-gradient(135deg, #30d158, #0a84ff);
	}
	.banner.loss {
		background: linear-gradient(135deg, #8e8e93, #48484a);
	}
	.banner.draw {
		background: linear-gradient(135deg, #ff9f0a, #bf5af2);
	}
	.sides {
		display: grid;
		gap: 12px;
	}
	@media (min-width: 768px) {
		.sides {
			grid-template-columns: 1fr 1fr;
		}
	}
	.hpbar {
		height: 10px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.hpbar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #30d158, #34c759);
		transition: width 1.2s var(--ease-ios);
	}
	.hpbar span.low {
		background: linear-gradient(90deg, #ff453a, #ff9f0a);
	}
	@keyframes shake {
		25% {
			transform: translateX(-6px);
		}
		75% {
			transform: translateX(6px);
		}
	}
	@keyframes pop {
		from {
			transform: scale(0.9);
			opacity: 0;
		}
	}
</style>
