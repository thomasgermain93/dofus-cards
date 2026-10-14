/**
 * Convertit les images des cartes en WebP (max 320 px, qualité 82) à côté des PNG.
 *   node scripts/images-webp.ts        (DATA_DIR/images)
 * La route /img sert automatiquement la version WebP quand elle existe.
 */
import sharp from 'sharp';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.env.DATA_DIR ?? './data', 'images');
let done = 0;
let saved = 0;
for (const sub of readdirSync(dir)) {
	const d = join(dir, sub);
	if (!statSync(d).isDirectory()) continue;
	const files = readdirSync(d).filter((f) => f.endsWith('.png'));
	for (let i = 0; i < files.length; i += 8) {
		await Promise.all(
			files.slice(i, i + 8).map(async (f) => {
				const src = join(d, f);
				const out = src.replace(/\.png$/, '.webp');
				if (existsSync(out)) return;
				const info = await sharp(src).resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, alphaQuality: 90 }).toFile(out);
				saved += statSync(src).size - info.size;
				done++;
			})
		);
	}
}
console.log(`${done} images converties, ${Math.round(saved / 1024)} Ko économisés`);
