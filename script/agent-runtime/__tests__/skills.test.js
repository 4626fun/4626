const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  BUNDLED_SKILLS_DIR,
  discoverSkills,
  getDefaultSkillDirectories,
  parseSkillFrontmatter,
  parseYamlFrontmatter,
} = require('../skills');
const { initializeSkillCache, resetSkillCache } = require('../skills-cache');
const { buildSystemPrompt } = require('../system-prompt');
const { selectVerificationPlan } = require('../verify-change');

test('parseYamlFrontmatter extracts name and description', () => {
  const yaml = [
    'name: "Chain Data"',
    'description: Fetches onchain data',
    'triggers:',
    '  - frontend',
    '  - react',
    'scope: [frontend/src/, frontend/api/]',
    'verification: [pnpm -C frontend lint, pnpm -C frontend typecheck]',
  ].join('\n');

  const parsed = parseYamlFrontmatter(yaml);

  assert.deepStrictEqual(parsed, {
    name: 'Chain Data',
    description: 'Fetches onchain data',
    triggers: ['frontend', 'react'],
    scope: ['frontend/src/', 'frontend/api/'],
    verification: ['pnpm -C frontend lint', 'pnpm -C frontend typecheck'],
  });
});

test('parseSkillFrontmatter returns skill metadata with absolute path and required arrays', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-parse-'));
  const skillFile = path.join(tempDir, 'SKILL.md');
  const content = [
    '---',
    'name: "Wallet Insights"',
    'description: Tracks wallet activity',
    'triggers: [wallet, analytics]',
    'scope:',
    '  - frontend/src/',
    'verification:',
    '  - pnpm -C frontend lint',
    '---',
    '\n',
    '# Body',
  ].join('\n');

  fs.writeFileSync(skillFile, content, 'utf8');

  const parsed = parseSkillFrontmatter(content, skillFile);

  assert.ok(parsed);
  assert.strictEqual(parsed.name, 'Wallet Insights');
  assert.strictEqual(parsed.description, 'Tracks wallet activity');
  assert.deepStrictEqual(parsed.triggers, ['wallet', 'analytics']);
  assert.deepStrictEqual(parsed.scope, ['frontend/src/']);
  assert.deepStrictEqual(parsed.verification, ['pnpm -C frontend lint']);
  assert.ok(path.isAbsolute(parsed.path));
  assert.strictEqual(parsed.path, tempDir);
});

test('parseSkillFrontmatter rejects missing required metadata', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-invalid-'));
  const skillFile = path.join(tempDir, 'SKILL.md');
  const content = ['---', 'name: Incomplete Skill', 'description: Missing arrays', '---'].join('\n');

  fs.writeFileSync(skillFile, content, 'utf8');

  assert.throws(
    () => parseSkillFrontmatter(content, skillFile),
    /missing required field\(s\): triggers, scope, verification/
  );
});

test('discoverSkills finds SKILL.md files with frontmatter', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-discover-'));
  const nestedDir = path.join(baseDir, 'agents', 'analytics');
  fs.mkdirSync(nestedDir, { recursive: true });

  fs.writeFileSync(
    path.join(baseDir, 'SKILL.md'),
    [
      '---',
      'name: Root Skill',
      'description: Root',
      'triggers: [root]',
      'scope: [frontend/src/]',
      'verification: [pnpm -C frontend lint]',
      '---',
    ].join('\n'),
    'utf8'
  );

  fs.writeFileSync(
    path.join(nestedDir, 'SKILL.md'),
    [
      '---',
      'name: Nested Skill',
      'description: Nested',
      'triggers: [nested]',
      'scope: [contracts/]',
      'verification: [forge test]',
      '---',
    ].join('\n'),
    'utf8'
  );

  fs.writeFileSync(
    path.join(baseDir, 'README.md'),
    '# Not a skill',
    'utf8'
  );

  const skills = discoverSkills([baseDir]);

  assert.strictEqual(skills.length, 2);
  for (const skill of skills) {
    assert.ok(path.isAbsolute(skill.path));
  }
  assert.deepStrictEqual(
    skills.map((skill) => skill.name),
    ['Nested Skill', 'Root Skill']
  );
});

test('discoverSkills rejects duplicate skill names', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-duplicate-'));
  const firstDir = path.join(baseDir, 'first');
  const secondDir = path.join(baseDir, 'second');
  fs.mkdirSync(firstDir, { recursive: true });
  fs.mkdirSync(secondDir, { recursive: true });

  const duplicateContent = [
    '---',
    'name: Duplicate Skill',
    'description: Same name',
    'triggers: [dup]',
    'scope: [docs/]',
    'verification: [pnpm docs:check]',
    '---',
  ].join('\n');

  fs.writeFileSync(path.join(firstDir, 'SKILL.md'), duplicateContent, 'utf8');
  fs.writeFileSync(path.join(secondDir, 'SKILL.md'), duplicateContent, 'utf8');

  assert.throws(
    () => discoverSkills([baseDir]),
    /Duplicate skill name "Duplicate Skill"/
  );
});

test('default skill directories include bundled skills without env vars', () => {
  const previousSkillDirectories = process.env.SKILL_DIRECTORIES;
  const previousSkillDirs = process.env.SKILL_DIRS;
  delete process.env.SKILL_DIRECTORIES;
  delete process.env.SKILL_DIRS;

  try {
    const directories = getDefaultSkillDirectories();
    assert.ok(directories.includes(BUNDLED_SKILLS_DIR));

    resetSkillCache();
    const skills = initializeSkillCache();

    assert.ok(skills.length >= 6);
    assert.ok(skills.some((skill) => skill.name === 'telegram-linking'));
  } finally {
    process.env.SKILL_DIRECTORIES = previousSkillDirectories;
    process.env.SKILL_DIRS = previousSkillDirs;
    resetSkillCache();
  }
});

test('buildSystemPrompt uses stable alphabetical skill ordering', () => {
  const prompt = buildSystemPrompt('Base prompt', [
    {
      name: 'z-skill',
      description: 'Last skill',
      triggers: ['z'],
      scope: ['docs/'],
      verification: ['pnpm docs:check'],
      path: '/tmp/z-skill',
    },
    {
      name: 'a-skill',
      description: 'First skill',
      triggers: ['a'],
      scope: ['frontend/'],
      verification: ['pnpm -C frontend lint'],
      path: '/tmp/a-skill',
    },
  ].sort((left, right) => left.name.localeCompare(right.name)));

  assert.match(prompt, /Available Skills:\n- a-skill - First skill \(\/tmp\/a-skill\)\n- z-skill - Last skill \(\/tmp\/z-skill\)$/);
});

test('selectVerificationPlan uses targeted frontend tests for leaf changes', () => {
  const plan = selectVerificationPlan(['frontend/src/pages/AppContinue.test.ts'], {
    repoRoot: path.resolve(__dirname, '..', '..', '..'),
    dockerAvailable: false,
  });

  assert.deepStrictEqual(plan.matchedSkills, ['frontend-change']);
  assert.ok(plan.commands.some((command) => command.id === 'frontend-lint'));
  assert.ok(plan.commands.some((command) => command.id === 'frontend-typecheck'));
  assert.ok(plan.commands.some((command) => command.id === 'frontend-tests-targeted'));
  assert.ok(!plan.commands.some((command) => command.id === 'frontend-tests-full'));
});

test('selectVerificationPlan uses forge checks for contract-only changes', () => {
  const plan = selectVerificationPlan(['contracts/vault/CreatorOVault.sol'], {
    repoRoot: path.resolve(__dirname, '..', '..', '..'),
    dockerAvailable: false,
  });

  assert.deepStrictEqual(plan.matchedSkills, ['contracts-change']);
  assert.deepStrictEqual(
    plan.commands.map((command) => command.id),
    ['forge-build', 'forge-test']
  );
});

test('selectVerificationPlan combines frontend and forge checks for mixed changes', () => {
  const plan = selectVerificationPlan(
    ['frontend/src/pages/TelegramMenu.tsx', 'contracts/vault/CreatorOVault.sol'],
    {
      repoRoot: path.resolve(__dirname, '..', '..', '..'),
      dockerAvailable: false,
    }
  );

  assert.ok(plan.matchedSkills.includes('frontend-change'));
  assert.ok(plan.matchedSkills.includes('contracts-change'));
  assert.ok(plan.commands.some((command) => command.id === 'frontend-lint'));
  assert.ok(plan.commands.some((command) => command.id === 'forge-build'));
});

test('selectVerificationPlan flags telegram auth flow changes', () => {
  const plan = selectVerificationPlan(['frontend/src/pages/telegram/TelegramLink.tsx'], {
    repoRoot: path.resolve(__dirname, '..', '..', '..'),
    dockerAvailable: false,
  });

  assert.ok(plan.matchedSkills.includes('telegram-linking'));
  assert.ok(plan.commands.some((command) => command.id === 'frontend-lint'));
  assert.ok(plan.manualReview.some((review) => review.id === 'telegram-linking-review'));
});

test('selectVerificationPlan flags security-sensitive API changes', () => {
  const plan = selectVerificationPlan(['frontend/server/_lib/auth/admin.ts'], {
    repoRoot: path.resolve(__dirname, '..', '..', '..'),
    dockerAvailable: false,
  });

  assert.ok(plan.matchedSkills.includes('security-sensitive-api'));
  assert.ok(plan.commands.some((command) => command.id === 'frontend-lint'));
  assert.ok(plan.manualReview.some((review) => review.id === 'security-boundary-review'));
  assert.ok(plan.notes.some((note) => note.includes('Semgrep')));
});

test('selectVerificationPlan flags solana provisioner mutation boundaries', () => {
  const plan = selectVerificationPlan(['frontend/server/solana-provisioner/index.ts'], {
    repoRoot: path.resolve(__dirname, '..', '..', '..'),
    dockerAvailable: false,
  });

  assert.ok(plan.matchedSkills.includes('solana-provisioner'));
  assert.ok(plan.manualReview.some((review) => review.id === 'solana-provisioner-review'));
});
