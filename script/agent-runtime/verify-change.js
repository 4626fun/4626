const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { getSkillMetadata } = require('./skills-cache');

const FRONTEND_TEST_FILE_REGEX = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
const FRONTEND_TARGETED_TEST_SUFFIXES = [
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.test.js',
  '.test.jsx',
  '.spec.js',
  '.spec.jsx',
];
const FRONTEND_PREFIXES = [
  'frontend/src/',
  'frontend/api/',
  'frontend/server/',
  'frontend/package.json',
  'frontend/vite.config.',
  'frontend/tsconfig.',
  'frontend/eslint.config.',
];
const FRONTEND_SHARED_PREFIXES = [
  'frontend/api/',
  'frontend/server/',
  'frontend/src/lib/',
  'frontend/src/hooks/',
  'frontend/src/context/',
  'frontend/src/providers/',
  'frontend/src/state/',
  'frontend/src/utils/',
  'frontend/src/components/',
  'frontend/src/layout',
  'frontend/src/App.',
  'frontend/src/main.',
  'frontend/package.json',
  'frontend/vite.config.',
  'frontend/tsconfig.',
  'frontend/eslint.config.',
];
const CONTRACT_PREFIXES = ['contracts/', 'script/', 'test/'];
const SECURITY_PREFIXES = ['frontend/api/', 'frontend/server/_lib/'];

function normalizeRepoPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function matchesPrefix(filePath, prefixes) {
  return prefixes.some((prefix) => filePath === prefix || filePath.startsWith(prefix));
}

function hasFrontendChange(changedPaths) {
  return changedPaths.some((filePath) => matchesPrefix(filePath, FRONTEND_PREFIXES));
}

function hasContractChange(changedPaths) {
  return changedPaths.some((filePath) => matchesPrefix(filePath, CONTRACT_PREFIXES));
}

function hasSecuritySensitiveChange(changedPaths) {
  return changedPaths.some((filePath) => matchesPrefix(filePath, SECURITY_PREFIXES));
}

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

function isFrontendSharedChange(filePath) {
  return matchesPrefix(filePath, FRONTEND_SHARED_PREFIXES);
}

function findSiblingFrontendTest(repoRoot, changedPath) {
  if (!changedPath.startsWith('frontend/')) {
    return null;
  }

  const absolutePath = path.resolve(repoRoot, changedPath);
  const directory = path.dirname(absolutePath);
  const extension = path.extname(absolutePath);
  const basename = path.basename(absolutePath, extension);

  for (const suffix of FRONTEND_TARGETED_TEST_SUFFIXES) {
    const candidate = path.join(directory, `${basename}${suffix}`);
    if (fileExists(candidate)) {
      return normalizeRepoPath(path.relative(repoRoot, candidate));
    }
  }

  return null;
}

function findTargetedFrontendTests(changedPaths, repoRoot) {
  const tests = new Set();

  for (const changedPath of changedPaths) {
    if (!changedPath.startsWith('frontend/')) {
      continue;
    }

    if (FRONTEND_TEST_FILE_REGEX.test(changedPath)) {
      tests.add(changedPath);
      continue;
    }

    const siblingTest = findSiblingFrontendTest(repoRoot, changedPath);
    if (siblingTest) {
      tests.add(siblingTest);
    }
  }

  return Array.from(tests).sort((left, right) => left.localeCompare(right));
}

function getMatchedSkills(changedPaths) {
  const skills = getSkillMetadata();

  return skills
    .filter((skill) =>
      changedPaths.some((filePath) => skill.scope.some((scopePrefix) => filePath.startsWith(scopePrefix)))
    )
    .map((skill) => skill.name);
}

function addCommand(plan, command) {
  if (plan.commands.some((entry) => entry.id === command.id)) {
    return;
  }

  plan.commands.push(command);
}

function addManualReview(plan, review) {
  if (plan.manualReview.some((entry) => entry.id === review.id)) {
    return;
  }

  plan.manualReview.push(review);
}

function isDockerAvailable() {
  const result = spawnSync('docker', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function selectVerificationPlan(changedFiles, options = {}) {
  const repoRoot = path.resolve(options.repoRoot || path.resolve(__dirname, '..', '..'));
  const dockerAvailable =
    typeof options.dockerAvailable === 'boolean' ? options.dockerAvailable : isDockerAvailable();
  const changedPaths = Array.from(
    new Set(
      changedFiles
        .map((filePath) => normalizeRepoPath(filePath))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  const plan = {
    changedPaths,
    matchedSkills: getMatchedSkills(changedPaths),
    commands: [],
    manualReview: [],
    notes: [],
  };

  if (!changedPaths.length) {
    plan.notes.push('No changed paths were provided. Pass repo-relative paths to build a verification plan.');
    return plan;
  }

  if (hasFrontendChange(changedPaths)) {
    addCommand(plan, {
      id: 'frontend-lint',
      command: 'pnpm -C frontend lint',
      reason: 'Frontend source, API, or server paths changed.',
    });
    addCommand(plan, {
      id: 'frontend-typecheck',
      command: 'pnpm -C frontend typecheck',
      reason: 'Frontend runtime and build-time types must stay clean.',
    });

    const needsFullFrontendTest =
      changedPaths.some((filePath) => filePath.startsWith('frontend/api/')) ||
      changedPaths.some((filePath) => filePath.startsWith('frontend/server/')) ||
      changedPaths.some((filePath) => isFrontendSharedChange(filePath));
    const targetedTests = findTargetedFrontendTests(changedPaths, repoRoot);

    if (!needsFullFrontendTest && targetedTests.length > 0 && targetedTests.length <= 3) {
      addCommand(plan, {
        id: 'frontend-tests-targeted',
        command: `pnpm -C frontend test -- ${targetedTests
          .map((testPath) => testPath.replace(/^frontend\//, ''))
          .join(' ')}`,
        reason: 'Leaf frontend files changed and sibling tests are available.',
      });
    } else {
      addCommand(plan, {
        id: 'frontend-tests-full',
        command: 'pnpm -C frontend test',
        reason: needsFullFrontendTest
          ? 'Shared frontend or API/server paths changed.'
          : 'No targeted frontend tests were found for the changed files.',
      });
    }
  }

  if (hasContractChange(changedPaths)) {
    addCommand(plan, {
      id: 'forge-build',
      command: 'forge build',
      reason: 'Contracts or Foundry scripts changed.',
    });
    addCommand(plan, {
      id: 'forge-test',
      command: 'forge test',
      reason: 'Contracts or Foundry tests changed.',
    });
  }

  if (hasSecuritySensitiveChange(changedPaths)) {
    if (dockerAvailable) {
      addCommand(plan, {
        id: 'security-local',
        command: 'pnpm security:local',
        reason: 'Security-sensitive API or server trust-boundary code changed.',
      });
    } else {
      plan.notes.push(
        'Docker is unavailable, so `pnpm security:local` cannot run the Semgrep portion. Record that Semgrep/Docker was not run.'
      );
    }

    addManualReview(plan, {
      id: 'security-boundary-review',
      severity: 'high',
      reason:
        'Reconfirm deny-by-default trust boundaries, machine-auth requirements for mutations, and allow/deny test coverage.',
    });
  }

  if (
    plan.matchedSkills.includes('telegram-linking')
  ) {
    addManualReview(plan, {
      id: 'telegram-linking-review',
      severity: 'high',
      reason:
        'Preserve inline OTP, explicit Privy sync wait states, Telegram proof verification, and no popup/modal auth inside Telegram WebView.',
    });
  }

  if (plan.matchedSkills.includes('solana-provisioner')) {
    addManualReview(plan, {
      id: 'solana-provisioner-review',
      severity: 'high',
      reason:
        'Keep deploy preflight/status paths read-only and require machine auth for Solana mutation paths.',
    });
  }

  if (plan.matchedSkills.includes('docs-and-rules')) {
    addManualReview(plan, {
      id: 'rules-precedence-review',
      severity: 'medium',
      reason:
        'Confirm docs and rules keep `AGENTS.md` and path-scoped `.cursor/rules/*.mdc` as the authority.',
    });
  }

  return plan;
}

function formatVerificationPlan(plan) {
  const lines = [];

  lines.push('Changed paths:');
  for (const filePath of plan.changedPaths) {
    lines.push(`- ${filePath}`);
  }

  lines.push('');
  lines.push('Matched skills:');
  if (plan.matchedSkills.length) {
    for (const skill of plan.matchedSkills) {
      lines.push(`- ${skill}`);
    }
  } else {
    lines.push('- none');
  }

  lines.push('');
  lines.push('Commands:');
  if (plan.commands.length) {
    for (const command of plan.commands) {
      lines.push(`- ${command.command}`);
      lines.push(`  reason: ${command.reason}`);
    }
  } else {
    lines.push('- none');
  }

  lines.push('');
  lines.push('Manual review:');
  if (plan.manualReview.length) {
    for (const review of plan.manualReview) {
      lines.push(`- [${review.severity}] ${review.reason}`);
    }
  } else {
    lines.push('- none');
  }

  if (plan.notes.length) {
    lines.push('');
    lines.push('Notes:');
    for (const note of plan.notes) {
      lines.push(`- ${note}`);
    }
  }

  return lines.join('\n');
}

function runCli(argv = process.argv.slice(2)) {
  const jsonMode = argv.includes('--json');
  const changedPaths = argv.filter((arg) => arg !== '--json' && arg !== '--');
  const plan = selectVerificationPlan(changedPaths);

  if (jsonMode) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatVerificationPlan(plan)}\n`);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  findTargetedFrontendTests,
  formatVerificationPlan,
  normalizeRepoPath,
  selectVerificationPlan,
};
