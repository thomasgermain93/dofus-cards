/**
 * Audit UI mesuré : débordement horizontal, zones tactiles < 44 px, contrastes et accessibilité (axe-core),
 * textes tronqués sans infobulle, contenu masqué par la barre d'onglets, en clair et en sombre,
 * à 360 / 390 / 768 / 1440 px. Écrit un JSON récapitulatif.
 *   BASE=... OUT=... node tests/e2e/ui-audit.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:5180';
const OUT = process.env.OUT ?? './test-results';
const A = { user: process.env.A_USER ?? 'testeur1', pass: process.env.A_PASS ?? 'TestLocal123' };
mkdirSync(OUT, { recursive: true });

const ROUTES = ['/', '/album', '/album?own=owned', '/collections', '/quests', '/market', '/trades', '/trades/new', '/duels', '/duels/new', '/battle', '/social', '/guilds?all', '/leaderboard', '/achievements', '/notifications', '/wishlist', `/u/${A.user}`, '/profile/edit', '/mentions', 'CARD'];
const WIDTHS = [360, 390, 768, 1440];

const browser = await chromium.launch();
const results = {};
for (const scheme of ['light', 'dark']) {
	for (const w of WIDTHS) {
		if (scheme === 'dark' && w !== 390) continue;
		const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, colorScheme: scheme, hasTouch: w < 1024, isMobile: w < 768 });
		const p = await ctx.newPage();
		await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
		await p.fill('input[name=username]', A.user);
		await p.fill('input[name=password]', A.pass);
		await p.click('button:has-text("Se connecter")');
		await p.waitForURL(BASE + '/');
		let cardUrl = '/';
		for (const r of ROUTES) {
			let url = r;
			if (r === 'CARD') {
				await p.goto(BASE + '/album?own=owned', { waitUntil: 'networkidle' });
				cardUrl = (await p.locator('.grid-cards a.card-link').first().getAttribute('href')) ?? '/';
				url = cardUrl;
			}
			await p.goto(BASE + url, { waitUntil: 'networkidle' });
			await p.waitForTimeout(250);
			await p.addScriptTag({ content: axeSource });
			const m = await p.evaluate(async () => {
				const doc = document.documentElement;
				const overflow = doc.scrollWidth - doc.clientWidth;
				const vis = (el) => {
					const r = el.getBoundingClientRect();
					const st = getComputedStyle(el);
					return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
				};
				const small = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, [role=button]')]
					.filter((el) => vis(el) && !el.closest('.grid-cards, .picker .grid, .vgrid, .showcase, .mini-grid, .strip, .disclaimer'))
					.map((el) => ({ el, r: el.getBoundingClientRect() }))
					// 44 px pour les actions ; 40 px admis pour les commandes compactes (onglets segmentés, pastilles de filtre)
					.filter(({ el, r }) => { const compact = el.closest('.segmented') || el.classList.contains('chip'); const min = compact ? 40 : 44; return r.height < min || r.width < min; })
					.filter(({ el, r }) => true && !(el.tagName === 'INPUT' && ['checkbox', 'radio', 'range'].includes(el.type)) && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'))
					.map(({ el, r }) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
				const truncated = [...document.querySelectorAll('*')]
					.filter((el) => el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === 'ellipsis' && !el.title && !el.closest('[title]'))
					.map((el) => el.textContent?.trim().slice(0, 30));
				const tab = document.querySelector('.tabbar');
				window.scrollTo(0, doc.scrollHeight);
				await new Promise((r) => setTimeout(r, 120));
				const lastContent = [...document.querySelectorAll('main.page > *')].filter(vis).pop();
				const covered = tab && vis(tab) && lastContent ? Math.max(0, lastContent.getBoundingClientRect().bottom - tab.getBoundingClientRect().top) : 0;
				const axeRes = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] });
				const axe = axeRes.violations.map((v) => ({ id: v.id, n: v.nodes.length, sample: v.nodes.slice(0, 2).map((x) => x.target.join(' ')).join(' | ') }));
				return { overflow, small: small.slice(0, 30), smallCount: small.length, truncated: truncated.slice(0, 10), truncatedCount: truncated.length, covered: Math.round(covered), axe };
			});
			const key = `${scheme}:${w}:${r === 'CARD' ? '/card' : r}`;
			results[key] = m;
			const issues = (m.overflow > 0 ? 1 : 0) + m.smallCount + m.truncatedCount + (m.covered > 0 ? 1 : 0) + m.axe.reduce((s, v) => s + v.n, 0);
			console.log(`${key.padEnd(34)} problèmes=${issues} débord=${m.overflow} tactile=${m.smallCount} tronqués=${m.truncatedCount} masqué=${m.covered} axe=${m.axe.map((v) => `${v.id}:${v.n}`).join(',')}`);
		}
		await ctx.close();
	}
}
writeFileSync(`${OUT}/ui-audit-${process.env.PREFIX ?? 'run'}.json`, JSON.stringify(results, null, 1));
await browser.close();
