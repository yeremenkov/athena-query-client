// Print the CHANGELOG.md section for a version, e.g. `node scripts/changelog-section.js 1.2.0`.
// Exits with an error when the section is missing or empty.
const fs = require('fs');
const { changelogPath, findSection } = require('./changelog');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/changelog-section.js <version>');
  process.exit(1);
}

const section = findSection(fs.readFileSync(changelogPath, 'utf8'), version);
if (!section || !section.body) {
  console.error(`CHANGELOG.md has no entries for ${version}`);
  process.exit(1);
}

console.log(section.body);
