const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'interfaces', 'routes', 'index.js');
const src = fs.readFileSync(file, 'utf8');
// Remove import lines and convert export default function to plain function for parsing
const stripped = src
  .split('\n')
  .filter(line => !line.trim().startsWith('import ') && !line.trim().startsWith("export default "))
  .join('\n')
  .replace(/export default /g, '');
try {
  new Function(stripped);
  console.log('No syntax errors found by new Function (note: ES module syntax removed)');
} catch (e) {
  console.error('Syntax error detected:');
  console.error(e && e.stack ? e.stack : e);
}
