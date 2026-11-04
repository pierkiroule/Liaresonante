import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../dist/', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');
const html = readFileSync(new URL('index.html', root), 'utf8');
const urls = [...sw.matchAll(/\{"revision":(?:null|"[^"]+"),"url":"([^"]+)"\}/gu)].map(
  (match) => match[1],
);
assert(urls.length > 0, 'Service worker precache manifest missing');
assert.equal(new Set(urls).size, urls.length, 'Duplicate precache entries');
assert(
  urls.some((url) => /assets\/worker-.+\.js$/u.test(url)),
  'WebLLM worker is not precached',
);
assert(urls.includes('index.html'), 'Application shell is not precached');
assert(urls.includes('manifest.webmanifest'), 'PWA manifest is not precached');
assert(html.includes('Content-Security-Policy'), 'Production CSP missing');
assert(html.includes("'wasm-unsafe-eval'"), 'WASM execution must be permitted');
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
assert.equal(manifest.display, 'standalone');
for (const icon of manifest.icons)
  assert(urls.includes(icon.src), `Icon not precached: ${icon.src}`);
function files(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name),
      relative = prefix + name;
    return statSync(path).isDirectory() ? files(path, relative + '/') : [relative];
  });
}
for (const path of files(fileURLToPath(root))) {
  if (path === 'sw.js') continue;
  assert(urls.includes(path), `Production asset not precached: ${path}`);
}
console.log(
  `Build verified: ${urls.length} unique precached assets, WebLLM worker, icons and CSP.`,
);
