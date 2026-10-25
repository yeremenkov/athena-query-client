// Helpers for reading sections of CHANGELOG.md (Keep a Changelog format)
const fs = require('fs');
const path = require('path');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

/**
 * Find a "## [name]" section and return its heading position and body
 * @param {String} text Changelog content
 * @param {String} name Section name, e.g. "Unreleased" or "1.2.0"
 * @return {Object|null} { start, bodyStart, end, body } or null when missing
 */
function findSection(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^## \\[${escaped}\\].*$`, 'm').exec(text);
  if (!heading) {
    return null;
  }

  const bodyStart = heading.index + heading[0].length;
  const next = text.slice(bodyStart).search(/^## \[/m);
  const end = next === -1 ? text.length : bodyStart + next;

  return {
    start: heading.index,
    bodyStart,
    end,
    body: text.slice(bodyStart, end).trim(),
  };
}

module.exports = { changelogPath, findSection };
