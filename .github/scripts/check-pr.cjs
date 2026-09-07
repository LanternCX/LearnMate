const { readFileSync } = require('node:fs');

// Inspect template structure, excluding comments, quotations, and code examples.
function sections(markdown) {
  const result = new Map();
  let current;
  let fence;
  for (const line of markdown.replace(/<!--[^]*?(?:-->|$)/g, '').split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    if (/^(?: {4}|\t| {0,3}>)/.test(line)) continue;
    const heading = line.match(/^ {0,3}##[\t ]+(.+?)(?:[\t ]+#+)?[\t ]*$/);
    if (heading) {
      current = [];
      const name = heading[1].trim();
      result.set(name, [...(result.get(name) ?? []), current]);
    } else {
      current?.push(line);
    }
  }
  return result;
}

function validate(title, body, template) {
  const errors = [];
  if (typeof title !== 'string' || /[\r\n]/.test(title) || !/^[a-z][a-z0-9-]*(?:\([^()\s]+\))?!?: \S.*$/.test(title)) {
    errors.push('PR title must use Conventional Commits: type(scope): description (scope optional; ! supported).');
  }
  const actual = sections(body ?? '');
  for (const [heading, [lines]] of sections(template)) {
    const matches = actual.get(heading) ?? [];
    if (matches.length !== 1) {
      errors.push(`PR body must contain exactly one "## ${heading}" section.`);
      continue;
    }
    const content = matches[0];
    const required = lines.flatMap(line => {
      const item = line.match(/^ {0,3}[-*+] \[ \][\t ]+(.+?)\s*$/);
      return item ? [item[1]] : [];
    });
    if (!required.length && !content.join('\n').trim()) {
      errors.push(`Fill in "## ${heading}"; template instructions alone do not count.`);
    }
    for (const label of required) {
      const items = content.flatMap(line => {
        const item = line.match(/^ {0,3}[-*+] \[([ xX])\][\t ]+(.+?)\s*$/);
        return item && item[2] === label ? [item[1]] : [];
      });
      if (items.length !== 1 || items[0].toLowerCase() !== 'x') {
        errors.push(`Check the required item exactly once in "## ${heading}": ${label}`);
      }
    }
  }
  return errors;
}

module.exports = { validate };

if (require.main === module) {
  const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const template = readFileSync(`${__dirname}/../pull_request_template.md`, 'utf8');
  const errors = validate(pr.title, pr.body, template);
  for (const error of errors) console.error(error);
  process.exitCode = errors.length ? 1 : 0;
  if (!errors.length) console.log('PR template check passed.');
}
