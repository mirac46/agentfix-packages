const { mkdirSync, copyFileSync, readdirSync, statSync, existsSync } = require('node:fs');
const path = require('node:path');

const SRC_DIRS = ['nodes', 'credentials'];
const ROOT = path.resolve(__dirname, '..');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.svg') || entry.endsWith('.png')) out.push(full);
  }
  return out;
}

let copied = 0;
for (const rel of SRC_DIRS) {
  const src = path.join(ROOT, rel);
  if (!existsSync(src)) continue;
  for (const file of walk(src)) {
    const dest = file.replace(`${path.sep}${rel}${path.sep}`, `${path.sep}dist${path.sep}${rel}${path.sep}`);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(file, dest);
    copied += 1;
  }
}
console.log(`[copy-icons] ${copied} icon(s) copied to dist/`);
