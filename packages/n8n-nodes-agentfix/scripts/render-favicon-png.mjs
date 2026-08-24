import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'nodes/AgentFix/agentfix.svg'));
const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: 120 },
  background: 'rgba(0,0,0,0)',
}).render().asPng();

writeFileSync(path.join(root, 'nodes/AgentFix/agentfix.png'), png);
writeFileSync(path.join(root, 'nodes/AgentFix/agentfix.dark.png'), png);
console.log(`wrote ${png.length} byte PNG`);
