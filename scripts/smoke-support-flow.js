const fs = require('fs');
function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}
const files = collect('app').concat(collect('src'));
let joined = '';
for (const file of files) joined += `\n// ${file}\n` + fs.readFileSync(file, 'utf8');
if (joined.includes('/v1/admin')) {
  console.error('Support smoke failed: mobile source contains /v1/admin endpoint');
  process.exit(1);
}
for (const term of ['support', 'ticket', 'courier', 'internal']) {
  if (!joined.toLowerCase().includes(term)) {
    console.error(`Support smoke failed: missing ${term}`);
    process.exit(1);
  }
}
console.log('Support smoke PASS');
