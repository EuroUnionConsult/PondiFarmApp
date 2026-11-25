// Depois do `expo export --platform web`: acrescenta ao dist/index.html um
// <link rel="preload"> para cada fonte Inter que a app usa (App.web.tsx).
// Os nomes têm um hash do conteúdo, por isso não podem ir à mão em public/index.html.
// Sem o preload, o browser só descobria as fontes depois de correr o bundle
// (~350 KB cada), e a primeira pintura esperava por elas.
//
// Uso: node scripts/preload-fonts.mjs [dist]
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const WEIGHTS = ['Inter_400Regular', 'Inter_600SemiBold', 'Inter_700Bold', 'Inter_800ExtraBold'];
const dist = process.argv[2] ?? 'dist';
const html = join(dist, 'index.html');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(join(dist, 'assets'));
const links = WEIGHTS.map((w) => {
  const f = files.find((p) => new RegExp(`[\\\\/]${w}\\.[0-9a-f]+\\.ttf$`).test(p));
  if (!f) throw new Error(`preload-fonts: ${w} not found in ${dist}/assets`);
  const href = '/' + relative(dist, f).split(sep).join('/');
  return `<link rel="preload" href="${href}" as="font" type="font/ttf" crossorigin />`;
});

let page = readFileSync(html, 'utf8');
page = page.replace(/<link rel="preload" href="[^"]+" as="font"[^>]*>\s*/g, '');
page = page.replace('</head>', `${links.join('')}</head>`);
writeFileSync(html, page);
console.log(`preload-fonts: ${links.length} fonts preloaded in ${html}`);
