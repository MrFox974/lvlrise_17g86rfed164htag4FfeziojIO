/**
 * Génère les icônes de la PWA à partir de public/favicon.png.
 * Usage : node generate-icons.cjs
 *
 * À relancer si le logo change. Les icônes générées sont commitées : Amplify
 * ne fait que `npm run build`, aucune étape de génération d'assets.
 *
 * - icon-192 / icon-512 : icônes classiques (purpose "any")
 * - icon-maskable-512   : marge de sécurité pour le rognage Android (purpose
 *   "maskable" : le système peut découper jusqu'à 20% sur chaque bord)
 * - apple-touch-icon    : iOS n'accepte pas la transparence, fond opaque
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.join(__dirname, 'public', 'favicon.png');
const OUTPUT_DIR = path.join(__dirname, 'public', 'icons');
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

/** ratio = part de la largeur occupée par le logo (le reste est de la marge). */
async function render(size, ratio, filename) {
  const inner = Math.round(size * ratio);
  const logo = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(OUTPUT_DIR, filename));

  console.log(`✓ ${filename} (${size}×${size})`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  await render(192, 0.76, 'icon-192.png');
  await render(512, 0.76, 'icon-512.png');
  // 0.56 garde le logo dans la zone sûre d'un masque circulaire.
  await render(512, 0.56, 'icon-maskable-512.png');
  await render(180, 0.78, 'apple-touch-icon.png');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
