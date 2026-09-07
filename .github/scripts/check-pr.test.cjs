const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { validate } = require('./check-pr.cjs');

const template = readFileSync(`${__dirname}/../pull_request_template.md`, 'utf8');
const body = template
  .replace('> 人类撰写', 'Add a check for pull request metadata.')
  .replace('> AI 生成，必须核对', 'Validate the title, required sections, and checklist.')
  .replaceAll('- [ ]', '- [x]');
const check = (text, title = 'ci: validate pull requests') => validate(title, text, template);

test('accepts completed PRs, optional links, scopes, and breaking changes', () => {
  for (const title of ['ci: check PRs', 'fix(api): reject invalid input', 'feat!: change behavior', 'chore(ci)!: update checks']) {
    assert.deepEqual(check(`${body}\n## 相关链接\nRef #13`, title), []);
  }
  assert.deepEqual(check(body.replaceAll('[x]', '[X]').replaceAll('\n', '\r\n')), []);
});

test('rejects titles without Conventional Commits structure', () => {
  for (const title of ['Add checks', '[Feature] Add checks', 'feat: ', 'feat:no space', 'feat(): empty scope', 'fix: valid\ninvalid']) {
    assert.ok(check(body, title).some(error => error.includes('title')), title);
  }
});

test('rejects missing or duplicate required sections and placeholder-only descriptions', () => {
  assert.ok(check(null).length);
  assert.ok(check(template.replaceAll('[ ]', '[x]')).length);
  for (const heading of ['说明', '概要', '检查清单']) {
    assert.ok(check(body.replace(`## ${heading}`, `## Other`)).length, heading);
    assert.ok(check(`${body}\n## ${heading}\nDuplicate`).length, heading);
  }
  assert.ok(check(body.replace('Add a check for pull request metadata.', '<!-- explanation -->')).length);
});

test('rejects every missing, unchecked, duplicated, or misplaced required item', () => {
  for (const label of ['已人工审核 PR 内容', '已人工核对概要', '相关文档已更新']) {
    const item = `- [x] ${label}`;
    assert.ok(check(body.replace(item, '')).length, label);
    assert.ok(check(body.replace(item, `- [ ] ${label}`)).length, label);
    assert.ok(check(`${body}\n${item}`).length, label);
    assert.ok(check(body.replace(item, '') + `\n## Other\n${item}`).length, label);
  }
});

test('comments, quoted text, and code examples cannot satisfy the template', () => {
  for (const text of [`<!--\n${body}\n-->`, `\`\`\`markdown\n${body}\n\`\`\``, `~~~~\n${body}\n~~~~`, body.split('\n').map(line => `> ${line}`).join('\n')]) {
    assert.ok(check(text).length);
  }
  const item = '- [x] 已人工审核 PR 内容';
  assert.ok(check(body.replace(item, `<!-- ${item} -->`)).length);
  assert.ok(check(body.replace(item, `\`\`\`\n${item}\n\`\`\``)).length);
  assert.ok(check(body.replace(item, `    ${item}`)).length);
});

test('reads required headings and checklist items from the template', () => {
  const extended = `${template}\n- [ ] 已验证部署\n`;
  assert.ok(validate('ci: check PRs', body, extended).some(error => error.includes('已验证部署')));
  assert.deepEqual(validate('ci: check PRs', `${body}\n- [x] 已验证部署`, extended), []);
});

test('the workflow entry point returns success or failure for a GitHub event', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zhiya-pr-check-'));
  const eventPath = join(directory, 'event.json');
  try {
    for (const [text, status] of [[body, 0], [template, 1], [null, 1]]) {
      writeFileSync(eventPath, JSON.stringify({ pull_request: { title: 'ci: validate PRs', body: text } }));
      const result = spawnSync(process.execPath, [`${__dirname}/check-pr.cjs`], {
        env: { ...process.env, GITHUB_EVENT_PATH: eventPath }, encoding: 'utf8',
      });
      assert.equal(result.status, status, result.stderr);
      if (status) assert.ok(result.stderr.trim());
      else assert.match(result.stdout, /PR template check passed/);
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});
