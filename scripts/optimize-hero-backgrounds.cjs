const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');

const files = [
  ["LE CIEL PLEURE DE l'OR.png", 'le-ciel'],
  ['LAISSE ALLER.png', 'laisse-aller'],
  ['Sormoi2moi.png', 'sormoi'],
  ['LA NUIT EST PROCHE.png', 'la-nuit'],
];

async function run() {
  const source = process.argv[2];
  if (!source) throw new Error('Provide the directory containing the four original PNGs.');
  for (const [file, name] of files) {
    const input = path.join(source, file);
    const original = await fs.stat(input);
    for (const width of [960, 1920, 2560]) {
      const suffix = width === 1920 ? '' : `-${width}`;
      const output = path.join(__dirname, '../public/bess', `${name}-background${suffix}.webp`);
      const result = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 86, effort: 6 }).toFile(output);
      console.log(`${name} ${width}px: ${Math.round(result.size / 1024)} KB (${Math.round((1 - result.size / original.size) * 100)}% smaller)`);
    }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
