const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'interfaces', 'routes', 'index.js');
const src = fs.readFileSync(file, 'utf8');
// Remove import lines and the leading 'export default' to allow parsing as a function body
const rawLines = src.split('\n');
const lines = rawLines.map(line => {
  if (line.trim().startsWith('import ')) return '';
  if (line.trim().startsWith('export default async function registerRoutes')) return line.replace('export default ', '');
  return line;
});
function tryCompile(text) {
  try {
    new Function(text);
    return null;
  } catch (e) {
    return e;
  }
}
for (let i = 0; i < lines.length; i++) {
  const chunk = lines.slice(0, i + 1).join('\n');
  const err = tryCompile(chunk);
  if (err) {
    console.error('Error at line', i + 1);
    const start = Math.max(0, i - 5);
    const end = Math.min(lines.length, i + 5);
    console.error('--- Context ---');
    for (let j = start; j < end; j++) {
      const mark = (j === i) ? '>>' : '  ';
      console.error(mark, (j+1).toString().padStart(4), lines[j]);
    }
    console.error('--- Chunk ---');
    console.error(lines.slice(0, i+1).join('\n'));
    console.error('Error message:', err.message);
    process.exit(1);
  }
}
console.log('No syntax error detected in incremental scan (ESM lines removed)');
