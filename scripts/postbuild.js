// Mark each build folder with its module type so Node loads
// dist/cjs as CommonJS and dist/esm as ES modules
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');

fs.writeFileSync(
  path.join(dist, 'cjs', 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(dist, 'esm', 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);
