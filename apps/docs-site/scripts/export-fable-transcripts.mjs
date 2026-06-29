#!/usr/bin/env node
/**
 * Export Fable agent-transcript JSONL (4626 project only) to readable Markdown
 * for docs/audits/fable/transcripts/.
 *
 * Source: docs/_internal/audits-workpapers/fable-chats-2026-06.zip (4626/ tree)
 * or an extracted directory passed via FABLE_EXTRACT_DIR.
 */

import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const ZIP_PATH = path.join(
  REPO_ROOT,
  'docs/_internal/audits-workpapers/fable-chats-2026-06.zip',
);
const OUT_DIR = path.join(REPO_ROOT, 'docs/audits/fable/transcripts');
const STATIC_ZIP = path.join(
  REPO_ROOT,
  'apps/docs-site/static/audits/fable-chats-4626-2026-06.zip',
);

const AUDIT_PATH_STEPS = [
  { href: '/audits', label: 'Overview' },
  { href: '/audits/fable', label: 'Scope' },
  { href: '/audits/fable/findings-summary', label: 'Executive summary' },
  { href: '/audits/fable/full-repo-review-2026-06', label: 'Full report' },
  { href: '/audits/fable/key-sessions', label: 'Source sessions' },
  { href: '/audits/fable/sessions-index', label: 'Session chronology' },
  { href: '/audits/fable/transcripts', label: 'Transcript archive' },
];

function auditPathNav(currentHref) {
  const steps = AUDIT_PATH_STEPS.map((step) => {
    const current = step.href === currentHref ? ' audit-path__step--current' : '';
    return `<a class="audit-path__step${current}" href="${step.href}">${step.label}</a>`;
  });
  return `<nav class="audit-path" aria-label="Report sections">\n  ${steps.join('\n  ')}\n</nav>`;
}

function linkUuidInLine(line, slugByUuid) {
  return line.replace(/\[([0-9a-f-]{36})\]\(([0-9a-f-]{36})\)/g, (_match, _label, uuid) => {
    const slug = slugByUuid.get(uuid);
    if (!slug) return `\`${uuid.slice(0, 8)}…\``;
    return `[${uuid.slice(0, 8)}…](/audits/fable/transcripts/${slug})`;
  });
}

function buildPublicSessionsIndex(sourceBody, slugByUuid, stats) {
  const skipSectionHeadings = new Set([
    'Summary',
    'How to open these sessions (read this first)',
    'Top Fable spend (by billing cluster)',
    'Post-suspension (errored, $0)',
    'Methodology notes',
    'Quick reference — copy-paste paths (top sessions)',
  ]);

  const out = [
    '# Appendix B — Session chronology',
    '',
    '**Archive:** [Transcript archive](/audits/fable/transcripts) · [JSONL download](/audits/fable-chats-4626-2026-06.zip)',
    '',
    '---',
    '',
    '## Engagement overview',
    '',
    '| Period | Review activity |',
    '| --- | --- |',
    '| 9–13 June 2026 | ' +
      `${stats.parents} primary sessions · ${stats.subagents} subagent lanes · ${stats.total} published transcripts |`,
    '',
    '---',
    '',
  ];

  let skippingSection = false;

  for (const rawLine of sourceBody.split('\n')) {
    const line = rawLine.trimEnd();

    if (
      /^\*\*(Model billed|Source of truth|Generated|Transcript storage|Published transcripts):/.test(line) ||
      /^Subagents in the same sessions/.test(line) ||
      /^\*\*Related deliverable:/.test(line) ||
      /^\*\*WSL note:/.test(line) ||
      /^Path: `~\/\.cursor/.test(line) ||
      /^\*\*Transcript paths/.test(line) ||
      /^Few new transcripts started this day/.test(line) ||
      /^Largest Fable day/.test(line) ||
      /^Base: `\/home\//.test(line) ||
      /^AveryRX repo review/.test(line)
    ) {
      continue;
    }

    if (/^# Cursor Fable 5 Sessions/.test(line) || /^# Fable session index/.test(line)) {
      continue;
    }

    const sectionMatch = line.match(/^## (.+)$/);
    if (sectionMatch) {
      const title = sectionMatch[1];
      if (skipSectionHeadings.has(title)) {
        skippingSection = true;
        continue;
      }
      skippingSection = false;
      if (/^\d{4}-\d{2}-\d{2}/.test(title)) {
        out.push(`## ${title.replace(/ — \$[\d,.]+.*$/, '')}`, '');
        continue;
      }
      continue;
    }

    if (skippingSection) continue;
    if (/^### Other project/.test(line)) {
      skippingSection = true;
      continue;
    }
    if (/^### AveryRXTerminal/.test(line)) {
      skippingSection = true;
      continue;
    }
    if (skippingSection && /^### /.test(line)) {
      skippingSection = false;
    }

    if (line === '---') {
      if (out[out.length - 1] !== '---' && out[out.length - 1] !== '') {
        out.push('---', '');
      }
      continue;
    }

    if (!line) {
      if (out[out.length - 1] !== '') out.push('');
      continue;
    }

    out.push(linkUuidInLine(line, slugByUuid));
  }

  while (out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

function auditFlowNav({ prev, next, step }) {
  const prevLink = prev
    ? `<a class="audit-flow-nav__link audit-flow-nav__link--prev" href="${prev.href}">← ${prev.label}</a>`
    : '<span class="audit-flow-nav__spacer"></span>';
  const nextLink = next
    ? `<a class="audit-flow-nav__link audit-flow-nav__link--next" href="${next.href}">${next.label} →</a>`
    : '<span class="audit-flow-nav__spacer"></span>';
  return `<nav class="audit-flow-nav" aria-label="Continue reading">\n  ${prevLink}\n  <span class="audit-flow-nav__step">${step}</span>\n  ${nextLink}\n</nav>`;
}

const SESSION_LABELS = {
  '0a513245-3ae2-4076-a9b0-bc1de524c38f': 'Full-codebase review (primary audit)',
  'c603521c-f1d2-4f66-8665-0c4bc63607ba': 'Security pass on full-codebase review',
  '6318a55b-12e4-4cd3-8b37-fd29f819e9a3': 'Production readiness planning',
  '059adbec-9820-45a8-9c18-399e4a7f9870': 'Full-repo review follow-up',
  'ab4dea2d-3ce4-4e5d-8677-5b117b6c7a67': 'ERC-4337 UserOp / swap routing debug',
  '7afad2db-7619-414d-a931-4b24a86e022f': 'Privy CSP / frame-ancestors',
  '683bffa0-91b1-44b8-88c6-4ec1e5ba1b9a': 'Counter-trading bot',
  'd6b4e576-1fc1-496b-bbb9-ab75f9e0af0d': 'Deploy Vault page redesign',
  'bf2f96cc-cfde-471a-9d61-23d702ff689d': 'Solana explorer verified build',
  '93c08966-7401-49c9-ae16-bba95fbfa440': 'Supabase Ethos tables',
  '5596f8da-a287-460b-bebb-11a92c627832': 'Swap failures investigation',
  '2f3a0cb7-adbc-43d2-8e13-85fb0072fbf3': 'Static scan / deeper review',
  'db706ee8-94fe-40d7-bace-430a85abc8b8': 'security.txt program',
  '4adf41a3-989c-4464-b1aa-aafa6e26477e': 'Premium waitlist page',
  'b8ddd1b3-72ff-4e86-a662-31bbc98fa14f': 'Architecture analysis lane',
  'c1a231e1-de11-411d-9fae-9dd6981163e4': 'CI/CD analysis lane',
  '6c9354f7-23f9-4069-8ad6-106b0e138461': 'Frontend analysis lane',
  '5a3eda06-c544-4d15-b56a-16f6c832cc10': 'Data layer analysis lane',
  '071ad150-5d45-4752-a7e4-bb06af78f8b8': 'Contracts analysis lane',
  'a056e98e-f779-4ede-ba23-0c5ce06b8636': 'Creator coin payout recipient',
  '93b5758d-201f-4f3a-976a-c6613d50dd6b': 'Vault production readiness',
  'ea7889ac-d835-4a3d-b5a7-a8afa0dde164': 'Hermit4626 triplicated messages',
  '393f4908-393d-4e1c-9c1b-22df9552cdc9': 'Raw digest signing failure',
  '8eaaa66b-7a56-4236-9907-febd642048c5': 'Solana side deploy readiness',
  '044bb5cf-385e-416c-9adc-388f83a4fce9': 'ElizaOS for Virtuals agent',
  '1eb64ae7-ef02-4611-8348-168dc505c6de': '8004scan agents confusion',
  'ef797429-1688-48e3-95cd-ebe632980585': 'Zora auth failed',
  '9199b051-0b20-44b2-b326-9900e239a68c': 'Privy setup struggles',
  '28561396-9d5f-4896-aabd-a3facc865cc4': 'CSW raw digest signing',
  '6d75f403-a5b4-4f45-b928-bf2116a7196a': 'Injected is not defined',
  'c16ed264-3756-401a-b489-7e5cd345462c': 'Chrome-error / swap page',
  '1ca6caf1-3578-4a79-b3b5-2168fc4fa255': 'Git error',
  'ca7317af-9c86-4fde-a453-5b3c220ff600': 'Zora auth (short)',
  'f2b45214-e1b0-4d22-85f9-8a7f49492e69': 'App loading overlay',
  '0490d6d1-461b-4d8a-b26a-91164453ab90': 'Vite / wallet session',
  '44ac1198-bead-406a-8f55-e75560150a12': 'Raw digest signing',
  '146c9c1a-96c0-43f3-bdc2-8c0e369cfd8d': 'Waitlist chat fix',
  '7936fbaa-22e7-4755-ae6c-63fe1065b057': 'Reset local XMTP state',
  '15788875-3f6f-4ac9-9576-997ef749f267': 'Watch GitHub Actions CI',
  '293bb214-a298-4283-93d8-5c856c433a01': 'Zora auth failed (Jun 10)',
  'a137354e-3778-4401-9e5e-2bd4be691a10': 'requestProvider.js ethereum error',
  '8c6a3f58-f844-434f-9504-951aefd5fb85': 'Hyperliquid markets research',
  'c7859baf-dfb7-44b0-9a35-3fb692519584': 'Vanity WASM TypeScript fixes',
  'd9895cc0-8426-4918-9b67-7c504afa28f5': 'Describe project 4626',
  'f00a1d5f-d667-4034-96c7-ee2e5af55776': 'Re-order chats (Agents on top)',
  '7f95ea30-f317-4459-9504-501a8c8da595': 'AlfaClub key-safety UX',
  '511645df-9bc6-46ac-9f16-a6efa81fbf1e': 'XMTP agent identity',
  '82bd7373-ea4c-4292-9cf5-d62cb96b2cb4': 'Deploy session wallet setup',
  'aeb2f393-3789-475e-b274-775e6746ee79': 'AlfaClub room economics',
  'af8b98af-4d55-40da-a68a-4e11a707065f': 'Continual-learning memory update',
  'f83f9e53-e4c5-481d-801c-a16939d00efa': 'Swap page refresh loop',
  'fb86041c-25d5-4cd0-a318-e815df1c39b7': 'Continual-learning memory update',
  '11502b9b-3fec-4e23-b352-9f81c31f7aa5': 'Full-codebase review subagent',
  'fba285d6-1444-4d1a-a56c-0a74fb4deeaf': 'Full-codebase review subagent',
};

function stripNoise(text) {
  if (!text) return '';
  return text
    .replace(/<user_query>\s*/gi, '')
    .replace(/<\/user_query>\s*/gi, '')
    .replace(/<plugin_info[\s\S]*?<\/plugin_info>\s*/gi, '')
    .replace(/<attached_files>[\s\S]*?<\/attached_files>\s*/gi, '')
    .replace(/<agent_skills>[\s\S]*?<\/agent_skills>\s*/gi, '')
    .replace(/<agent_transcripts>[\s\S]*?<\/agent_transcripts>\s*/gi, '')
    .replace(/<rules>[\s\S]*?<\/rules>\s*/gi, '')
    .replace(/<system_reminder>[\s\S]*?<\/system_reminder>\s*/gi, '')
    .replace(/<open_and_recently_viewed_files>[\s\S]*?<\/open_and_recently_viewed_files>\s*/gi, '')
    .replace(/<git_status>[\s\S]*?<\/git_status>\s*/gi, '')
    .replace(/<mcp_file_system>[\s\S]*?<\/mcp_file_system>\s*/gi, '')
    .replace(/<hooks_context>[\s\S]*?<\/hooks_context>\s*/gi, '')
    .trim();
}

function sanitizeForPublish(text) {
  if (!text) return '';
  return text
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, (match, alt, url) => {
      const trimmed = url.trim();
      if (/^https?:\/\//i.test(trimmed)) return match;
      if (/^\/(?!\/)/.test(trimmed) && !/^\/(?:c:|tmp|home|Users|var|private)/i.test(trimmed)) {
        return match;
      }
      return `*(image omitted: ${alt || 'screenshot'} — see raw JSONL archive)*`;
    })
    .trim();
}

function extractTextBlocks(content) {
  if (!Array.isArray(content)) return { text: '', tools: [] };
  const texts = [];
  const tools = [];
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      const cleaned = stripNoise(block.text);
      if (cleaned) texts.push(cleaned);
    } else if (block.type === 'tool_use' && block.name) {
      tools.push(block.name);
    } else if (block.type === 'tool_result') {
      // omit bulky tool output from public transcript
    }
  }
  return { text: sanitizeForPublish(texts.join('\n\n')), tools };
}

async function parseJsonl(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const turns = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      const role = obj.role ?? 'unknown';
      const content = obj.message?.content ?? obj.content;
      const { text, tools } = extractTextBlocks(content);
      if (text || tools.length) {
        turns.push({ role, text, tools });
      }
    } catch {
      // skip malformed lines
    }
  }
  return turns;
}

function slugForUuid(uuid) {
  const label = SESSION_LABELS[uuid];
  if (!label) return uuid;
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${slug}-${uuid.slice(0, 8)}`;
}

async function writeTranscriptMd({ uuid, relPath, turns, isSubagent, parentUuid }) {
  const label = SESSION_LABELS[uuid] ?? (isSubagent ? 'Analysis subagent' : 'Review session');
  const slug = slugForUuid(uuid);
  const outPath = path.join(OUT_DIR, `${slug}.md`);
  const lines = [
    '---',
    `title: ${label}`,
    `sidebar_label: ${uuid.slice(0, 8)}…`,
    'sidebar_position: 99',
    'hide_table_of_contents: true',
    'last_updated: \'2026-06-28\'',
    'audience:',
    '  - developers',
    '  - protocols',
    'stage: use',
    'owner: docs-team',
    'last_reviewed: \'2026-06-28\'',
    'status: current',
    '---',
    '',
    '<div class="audit-transcript-meta">',
    '',
    `[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)`,
    '',
    '</div>',
    '',
    `# ${label}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Session ID | \`${uuid}\` |`,
    isSubagent ? `| Parent session | \`${parentUuid}\` |` : '',
    '| Review model | Cursor Fable 5 (`claude-fable-5-thinking-high`) |',
    '',
    ':::note Appendix record',
    'Readable export of an agent-assisted review session. Tool outputs and system context blocks are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.',
    ':::',
    '',
  ].filter(Boolean);

  for (const turn of turns) {
    const heading = turn.role === 'user' ? '## User' : '## Assistant';
    lines.push(heading, '');
    if (turn.text) {
      lines.push(turn.text, '');
    }
    if (turn.tools.length) {
      lines.push(`*Tools invoked:* ${turn.tools.join(', ')}`, '');
    }
  }

  await fs.writeFile(outPath, `${lines.join('\n')}\n`, 'utf8');
  return { uuid, slug, label, outPath: path.relative(OUT_DIR, outPath) };
}

async function ensureExtractDir() {
  if (process.env.FABLE_EXTRACT_DIR && existsSync(process.env.FABLE_EXTRACT_DIR)) {
    return process.env.FABLE_EXTRACT_DIR;
  }
  const tmp = path.join(REPO_ROOT, '.tmp/fable-extract');
  await fs.mkdir(tmp, { recursive: true });
  if (!existsSync(ZIP_PATH)) {
    throw new Error(`Missing archive: ${ZIP_PATH}`);
  }
  execFileSync('unzip', ['-qo', ZIP_PATH, '-d', tmp], { stdio: 'inherit' });
  return tmp;
}

async function build4626Zip(extractDir) {
  await fs.mkdir(path.dirname(STATIC_ZIP), { recursive: true });
  const staging = path.join(extractDir, '_4626-public-zip');
  await fs.rm(staging, { recursive: true, force: true });
  await fs.mkdir(staging, { recursive: true });
  await fs.cp(path.join(extractDir, '4626'), path.join(staging, '4626'), { recursive: true });
  await fs.copyFile(
    path.join(extractDir, 'fable-sessions-2026-06-index.md'),
    path.join(staging, 'fable-sessions-2026-06-index.md'),
  );
  await fs.copyFile(path.join(extractDir, 'MANIFEST.txt'), path.join(staging, 'MANIFEST.txt'));
  execFileSync('zip', ['-qr', STATIC_ZIP, '.'], { cwd: staging, stdio: 'inherit' });
}

async function main() {
  const extractDir = await ensureExtractDir();
  const srcRoot = path.join(extractDir, '4626');
  if (!existsSync(srcRoot)) {
    throw new Error(`Missing 4626/ tree in extract dir: ${srcRoot}`);
  }

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const entries = [];
  async function walk(dir, rel = '') {
    const names = await fs.readdir(dir);
    for (const name of names) {
      const abs = path.join(dir, name);
      const stat = await fs.stat(abs);
      if (stat.isDirectory()) {
        await walk(abs, rel ? `${rel}/${name}` : name);
      } else if (name.endsWith('.jsonl')) {
        const uuid = name.replace(/\.jsonl$/, '');
        const isSubagent = rel.includes('subagents');
        const parentMatch = rel.match(/^([^/]+)\/subagents$/);
        const parentUuid = parentMatch?.[1] ?? null;
        const turns = await parseJsonl(abs);
        const meta = await writeTranscriptMd({
          uuid,
          relPath: `4626/${rel}/${name}`.replace(/^\//, ''),
          turns,
          isSubagent,
          parentUuid,
        });
        entries.push({ ...meta, isSubagent, parentUuid });
      }
    }
  }

  await walk(srcRoot);
  await build4626Zip(extractDir);

  entries.sort((a, b) => a.label.localeCompare(b.label));

  const uniqueEntries = [];
  const seenUuids = new Set();
  for (const entry of [...entries].sort((a, b) => Number(a.isSubagent) - Number(b.isSubagent))) {
    if (seenUuids.has(entry.uuid)) continue;
    seenUuids.add(entry.uuid);
    uniqueEntries.push(entry);
  }
  uniqueEntries.sort((a, b) => a.label.localeCompare(b.label));

  const transcriptStats = {
    total: uniqueEntries.length,
    parents: uniqueEntries.filter((e) => !e.isSubagent).length,
    subagents: uniqueEntries.filter((e) => e.isSubagent).length,
  };

  const indexLines = [
    '---',
    'title: Transcript archive',
    'sidebar_label: Transcript archive',
    'sidebar_position: 6',
    'hide_table_of_contents: true',
    'last_updated: \'2026-06-28\'',
    'audience:',
    '  - developers',
    'stage: use',
    'owner: docs-team',
    'last_reviewed: \'2026-06-28\'',
    'status: current',
    '---',
    '',
    auditPathNav('/audits/fable/transcripts'),
    '',
    '# Appendix C — Transcript archive',
    '',
    'Complete readable exports of every **4626** Fable review session (9–13 June 2026). Start with the [executive summary](/audits/fable/findings-summary) and [source sessions](/audits/fable/key-sessions) appendix.',
    '',
    '**Machine-readable logs:** [fable-chats-4626-2026-06.zip](/audits/fable-chats-4626-2026-06.zip)',
    '',
    `**${transcriptStats.total} sessions** (${transcriptStats.parents} parent · ${transcriptStats.subagents} subagent)`,
    '',
    '## Featured',
    '',
    '| Session | Link |',
    '| --- | --- |',
    '| Full-codebase review | [View transcript](/audits/fable/transcripts/full-codebase-review-primary-audit-0a513245) |',
    '| Security pass | [View transcript](/audits/fable/transcripts/security-pass-on-full-codebase-review-c603521c) |',
    '| Production readiness | [View transcript](/audits/fable/transcripts/production-readiness-planning-6318a55b) |',
    '| Review follow-up | [View transcript](/audits/fable/transcripts/full-repo-review-follow-up-059adbec) |',
    '',
    '## All sessions',
    '',
    '| Session | ID | Type |',
    '| --- | --- | --- |',
  ];

  for (const e of uniqueEntries) {
    const type = e.isSubagent ? 'Subagent' : 'Parent';
    indexLines.push(`| [${e.label}](./${e.outPath.replace(/\.md$/, '')}) | \`${e.uuid.slice(0, 8)}…\` | ${type} |`);
  }

  indexLines.push(
    '',
    auditFlowNav({
      prev: { href: '/audits/fable/sessions-index', label: 'Session chronology' },
      next: null,
      step: 'Appendix C',
    }),
  );

  await fs.writeFile(path.join(OUT_DIR, 'index.md'), `${indexLines.join('\n')}\n`, 'utf8');

  const slugByUuid = new Map(uniqueEntries.map((e) => [e.uuid, e.outPath.replace(/\.md$/, '')]));
  const sessionsIndexSrc = path.join(extractDir, 'fable-sessions-2026-06-index.md');
  const sessionsBody = buildPublicSessionsIndex(
    await fs.readFile(sessionsIndexSrc, 'utf8'),
    slugByUuid,
    transcriptStats,
  );

  const sessionsOut = [
    '---',
    'title: Session chronology',
    'sidebar_label: Session chronology',
    'sidebar_position: 5',
    'hide_table_of_contents: true',
    'last_updated: \'2026-06-28\'',
    'audience:',
    '  - developers',
    'stage: use',
    'owner: docs-team',
    'last_reviewed: \'2026-06-28\'',
    'status: current',
    '---',
    '',
    auditPathNav('/audits/fable/sessions-index'),
    '',
    '<div class="docs-at-a-glance">',
    '',
    '**Appendix B.** Day-by-day register of review sessions (9–13 June 2026). For curated starting points, see [Appendix A — Source sessions](/audits/fable/key-sessions); for searchable exports, see [Appendix C — Transcript archive](/audits/fable/transcripts).',
    '',
    '</div>',
    '',
    sessionsBody,
    '',
    auditFlowNav({
      prev: { href: '/audits/fable/key-sessions', label: 'Source sessions' },
      next: { href: '/audits/fable/transcripts', label: 'Transcript archive' },
      step: 'Appendix B',
    }),
    '',
  ].join('\n');

  await fs.writeFile(
    path.join(REPO_ROOT, 'docs/audits/fable/sessions-index.md'),
    sessionsOut,
  );

  console.log(`Exported ${uniqueEntries.length} transcripts → ${OUT_DIR}`);
  console.log(`Wrote static zip → ${STATIC_ZIP}`);
  console.log(`Wrote sessions index → docs/audits/fable/sessions-index.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
