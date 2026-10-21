// Run by `npm version`: turns the Unreleased section of CHANGELOG.md into
// a section for the new package.json version and adds a fresh Unreleased one
const fs = require('fs');
const { changelogPath, findSection } = require('./changelog');

const { version } = require('../package.json');
const text = fs.readFileSync(changelogPath, 'utf8');
const unreleased = findSection(text, 'Unreleased');

if (!unreleased) {
  console.error('CHANGELOG.md has no "## [Unreleased]" section');
  process.exit(1);
}
if (!unreleased.body) {
  console.error('CHANGELOG.md "Unreleased" section is empty');
  process.exit(1);
}
if (findSection(text, version)) {
  console.error(`CHANGELOG.md already has a section for ${version}`);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const updated =
  text.slice(0, unreleased.start) +
  `## [Unreleased]\n\n## [${version}] - ${date}` +
  text.slice(unreleased.bodyStart);

fs.writeFileSync(changelogPath, updated);
console.log(`CHANGELOG.md: Unreleased -> ${version} (${date})`);
