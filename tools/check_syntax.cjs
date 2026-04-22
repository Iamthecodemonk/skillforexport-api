const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'interfaces', 'routes', 'index.js');
const src = fs.readFileSync(file, 'utf8');
const lines = src.split('\n');
// Remove import lines and export default for parsing
const strippedLines = lines.map(line => {
  if (line.trim().startsWith('import ')) return '';
  if (line.trim().startsWith('export default async function registerRoutes')) return line.replace('export default ', '');
  return line;
});
const stripped = strippedLines.join('\n');
try {
  new Function(stripped);
  console.log('No syntax errors found by new Function (ES module syntax removed)');
} catch (e) {
  console.error('Syntax error detected:');
  console.error(e && e.stack ? e.stack : e);
}
