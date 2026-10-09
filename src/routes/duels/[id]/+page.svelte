<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Card from '#lib/components/Card.svelte';
	import CardThumb from '#lib/components/CardThumb.svelte';
	import CardPicker from '#lib/components/CardPicker.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { fmt } from '#lib/format';
	import Avatar from '#lib/components/Avatar.svelte';
	import ShowcaseStrip from '#lib/components/ShowcaseStrip.svelte';
	import { onMount } from 'svelte';
	import { play, vibrate } from '#lib/sfx';
	import type { CardView } from '#lib/types';

	let { data, form } = $props();

	// Quiz : réponse envoyée au serveur, retour visuel, puis question suivante
	let picked = $state<number | null>(null);
	let feedback = $state<{ correct: boolean; correctIndex: number } | null>(null);
	let busy = $state(false);
	let quizError = $state<string | null>(null);
	// Chrono par question (heure du serveur) : à zéro, la réponse est envoyée comme « temps écoulé »
	let clock = $state(Date.now());
	const offset = $derived(data.serverNow - Date.now());
	onMount(() => {
		const t = setInterval(() => (clock = Date.now()), 200);
		return () => clearInterval(t);
	});
	const left = $derived(data.question ? Math.max(0, data.question.deadline - (clock + offset)) : 0);
	let timedOut = $state(false);
	$effect(() => {
		if (data.question && left <= 0 && !busy && !feedback) {
			timedOut = true;
			answer(-1);
		}
	});

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
			if (feedback.correct) play('rare', 0.4);
			else vibrate(30);
			setTimeout(async () => {
				await invalidateAll();
				feedback = null;
				picked = null;
				busy = false;
				timedOut = false;
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

<a href="/duels" class="back-link"><Icon name="chevron-left" size={20} />Duels</a>

<div class="versus">
	<div class="side-p">
		<Avatar name={data.me.name} image={data.me.brief?.avatar} x={data.me.brief?.avatarX} y={data.me.brief?.avatarY} size={52} />
		<span class="who">{data.me.name}</span>
		{#if data.me.brief?.title}<span class="ttl">{data.me.brief.title}</span>{/if}
		<ShowcaseStrip cards={data.me.brief?.showcase ?? []} size={24} />
	</div>
	<span class="vs">VS</span>
	<div class="side-p">
		{#if data.duel.vs_bot}<span class="botav"><Icon name="bot" size={26} /></span>{:else}<Avatar name={data.other.name} image={data.other.brief?.avatar} x={data.other.brief?.avatarX} y={data.other.brief?.avatarY} size={52} />{/if}
		<span class="who">{data.other.name}</span>
		{#if data.other.brief?.title}<span class="ttl">{data.other.brief.title}</span>{/if}
		<ShowcaseStrip cards={data.other.brief?.showcase ?? []} size={24} />
	</div>
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
			<span class="flex justify-between">
				<span class="footnote text-label-2">Question {q.position + 1} / {q.total}</span>
				<span class="footnote font-bold tabular-nums {left < 6000 ? 'text-danger' : 'text-label-2'}" data-testid="duel-timer">{timedOut ? 'Temps écoulé !' : `${Math.ceil(left / 1000)} s`}</span>
			</span>
			<span class="qtimer"><span style="width: {(left / data.answerMs) * 100}%" class:hurry={left < 6000}></span></span>
			<div class="dots">{#each Array(q.total) as _, i}<span class:done={i < q.position} class:now={i === q.position}></span>{/each}</div>
		</div>
		<div class="attacker">
			<div class="w-28 flex-none"><Card card={data.attacker as CardView} size="sm" quiz /></div>
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
					{#each s.side.attacks as a, k (a.card.id)}
						<div class="flex items-center gap-3 hit" style="--d: {0.4 + k * 0.45}s">
							<span class="thumb-wrap">
								<CardThumb card={a.card} size={48} />
								{#if a.damage}<span class="dmg">-{fmt(a.damage)}</span>{/if}
							</span>
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
	<div class="flex gap-3 mt-5 flex-wrap">
		<form method="POST" action="?/rematch" use:enhance class="flex-1"><button class="btn btn-block" data-testid="rematch"><Icon name="repeat" size={18} />Revanche</button></form>
		<a class="btn btn-secondary flex-1" href={data.duel.vs_bot ? '/duels/new?vs=bot' : '/duels/new'}><Icon name="swords" size={18} />Autres cartes</a>
		<a class="btn btn-plain" href="/duels">Historique</a>
	</div>
{:else}
	<p class="text-label-2 text-center py-10">Ce duel a été {data.phase === 'declined' ? 'refusé' : 'annulé'}.</p>
{/if}

<style>
	.versus {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 12px;
		margin-bottom: 16px;
		font-weight: 700;
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.vs {
		align-self: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 16px;
		color: var(--emblem-ink);
		background: var(--emblem-red);
		border: 1.5px solid var(--emblem-edge);
		box-shadow: var(--emblem-shadow);
		border-radius: var(--radius-sm);
		padding: 1px 9px;
	}
	.side-p {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}
	.botav {
		width: 52px;
		height: 52px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: var(--surface-3);
	}
	.ttl {
		font-size: 11px;
		font-weight: 700;
		color: var(--title-ink);
		background: var(--title-bg);
		border-radius: 999px;
		padding: 1px 8px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.qtimer {
		display: block;
		height: 5px;
		border-radius: 999px;
		background: var(--slot);
		box-shadow: var(--slot-inset);
		overflow: hidden;
	}
	.qtimer span {
		display: block;
		height: 100%;
		background: var(--gauge-fill);
		transition: width 0.2s linear;
	}
	.qtimer span.hurry {
		background: var(--danger);
	}
	.thumb-wrap {
		position: relative;
		flex: none;
	}
	.hit .thumb-wrap {
		animation: hit 0.45s var(--d) both;
	}
	.dmg {
		position: absolute;
		left: 50%;
		top: -6px;
		transform: translateX(-50%);
		font-weight: 900;
		font-size: 15px;
		color: var(--danger);
		text-shadow: 0 1px 0 white, 0 2px 6px rgba(0, 0, 0, 0.25);
		white-space: nowrap;
		opacity: 0;
		animation: dmg 1.4s var(--d) var(--ease-ios) forwards;
		pointer-events: none;
	}
	@keyframes hit {
		0% {
			transform: none;
		}
		25% {
			transform: translateX(-5px) rotate(-4deg);
			filter: brightness(1.6) saturate(0.4);
		}
		50% {
			transform: translateX(5px) rotate(3deg);
		}
		100% {
			transform: none;
		}
	}
	@keyframes dmg {
		0% {
			opacity: 0;
			transform: translate(-50%, 6px) scale(0.6);
		}
		20% {
			opacity: 1;
			transform: translate(-50%, -6px) scale(1.25);
		}
		70% {
			opacity: 1;
			transform: translate(-50%, -14px) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -26px);
		}
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
		background: var(--accent-fill);
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
		border-radius: var(--radius-md);
		background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 90%, var(--gold)), var(--surface));
		border: 1px solid var(--panel-edge);
		box-shadow: var(--shadow-card);
		font-size: 17px;
		font-weight: 600;
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
		border-radius: var(--radius-sm);
		background: var(--slot);
		border: 1px solid var(--slot-edge);
		box-shadow: var(--slot-inset);
		color: var(--accent);
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 16px;
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
		color: #fff6dc;
		border: 1px solid #0d0a07;
		outline: 1px solid rgba(240, 210, 85, 0.55);
		outline-offset: -5px;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.45);
		box-shadow: var(--shadow-card);
		animation: pop 0.5s var(--ease-ios);
	}
	.banner.win {
		background: radial-gradient(circle at 50% 0%, #8fb637, #3f5614 80%);
	}
	.banner.loss {
		background: radial-gradient(circle at 50% 0%, #6a5a44, #2e251a 80%);
	}
	.banner.draw {
		background: radial-gradient(circle at 50% 0%, #c99a1c, #6e4a00 80%);
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
		background: var(--slot);
		box-shadow: var(--slot-inset);
		overflow: hidden;
	}
	.hpbar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--gauge-fill);
		transition: width 1.2s var(--ease-ios);
	}
	.hpbar span.low {
		background: linear-gradient(180deg, #f08a90, #c8323b 50%, #8a2229);
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
