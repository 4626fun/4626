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
  const label = SESSION_LABELS[uuid] ?? (isSubagent ? 'Subagent session' : 'Fable session');
  const slug = slugForUuid(uuid);
  const outPath = path.join(OUT_DIR, `${slug}.md`);
  const lines = [
    '---',
    `title: ${label}`,
    `sidebar_label: ${uuid.slice(0, 8)}…`,
    'sidebar_position: 99',
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
    `# ${label}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Session ID | \`${uuid}\` |`,
    `| Source file | \`${relPath}\` |`,
    isSubagent ? `| Parent session | \`${parentUuid}\` |` : '',
    '| Model | `claude-fable-5-thinking-high` (Cursor on-demand) |',
    '',
    ':::note',
    'This page is an auto-export of the original Fable agent transcript. Tool outputs and system context blocks are omitted for readability; download the [raw JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.',
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
  const indexLines = [
    '---',
    'title: Fable transcript archive',
    'sidebar_label: Transcripts',
    'sidebar_position: 4',
    'last_updated: \'2026-06-28\'',
    'audience:',
    '  - developers',
    'stage: use',
    'owner: docs-team',
    'last_reviewed: \'2026-06-28\'',
    'status: current',
    '---',
    '',
    '# Fable transcript archive',
    '',
    'Readable exports of every **4626** Fable agent session in the June 2026 audit window.',
    '',
    'Download the complete raw JSONL archive (parents + subagents):',
    '',
    '- [fable-chats-4626-2026-06.zip](/audits/fable-chats-4626-2026-06.zip)',
    '',
    `**${entries.length} sessions exported** (${entries.filter((e) => !e.isSubagent).length} parent, ${entries.filter((e) => e.isSubagent).length} subagent).`,
    '',
    '| Session | ID | Type |',
    '| --- | --- | --- |',
  ];

  for (const e of entries) {
    const type = e.isSubagent ? 'Subagent' : 'Parent';
    indexLines.push(`| [${e.label}](./${e.outPath.replace(/\.md$/, '')}) | \`${e.uuid.slice(0, 8)}…\` | ${type} |`);
  }

  await fs.writeFile(path.join(OUT_DIR, 'index.md'), `${indexLines.join('\n')}\n`, 'utf8');

  const slugByUuid = new Map(entries.map((e) => [e.uuid, e.slug.replace(/\.md$/, '')]));
  const sessionsIndexSrc = path.join(extractDir, 'fable-sessions-2026-06-index.md');
  let sessionsBody = await fs.readFile(sessionsIndexSrc, 'utf8');
  sessionsBody = sessionsBody
    .replace(
      /^# Cursor Fable 5 Sessions — June 2026 Index\n/m,
      '# Fable session index — June 2026\n',
    )
    .replace(
      /\*\*Transcript storage:\*\*[^\n]+\n/,
      '**Published transcripts:** [Readable archive](/audits/fable/transcripts) · [Raw JSONL ZIP](/audits/fable-chats-4626-2026-06.zip)\n',
    )
    .replace(
      /\*\*Related deliverable:\*\* \[Full-Codebase Review[^\]]+\]\(\.\/full-repo-review-2026-06\.md\)[^\n]+\n/,
      '**Related deliverable:** [Full-codebase review](/audits/fable/full-repo-review-2026-06) (session `0a513245…`).\n',
    );

  sessionsBody = sessionsBody.replace(
    /\[([0-9a-f-]{36})\]\(([0-9a-f-]{36})\)/g,
    (_match, label, uuid) => {
      const slug = slugByUuid.get(uuid);
      if (!slug) return `\`${label.slice(0, 8)}…\``;
      return `[${label.slice(0, 8)}…](/audits/fable/transcripts/${slug})`;
    },
  );

  sessionsBody = sessionsBody.replace(
    /## How to open these sessions[\s\S]*?---\n\n## Top Fable spend/,
    `## Reading sessions\n\nEach session ID links to a **readable transcript page**. For machine-readable logs, download [fable-chats-4626-2026-06.zip](/audits/fable-chats-4626-2026-06.zip). The full table of all 99 sessions is on the [transcript archive](/audits/fable/transcripts) page.\n\n---\n\n## Top Fable spend`,
  );

  sessionsBody = sessionsBody.replace(
    /## Quick reference — copy-paste paths[\s\S]*$/,
    `## Key sessions\n\n| Topic | Transcript |\n| --- | --- |\n| Full repo review | [0a513245…](/audits/fable/transcripts/${slugByUuid.get('0a513245-3ae2-4076-a9b0-bc1de524c38f')}) |\n| Production readiness | [6318a55b…](/audits/fable/transcripts/${slugByUuid.get('6318a55b-12e4-4cd3-8b37-fd29f819e9a3')}) |\n| Review follow-up | [059adbec…](/audits/fable/transcripts/${slugByUuid.get('059adbec-9820-45a8-9c18-399e4a7f9870')}) |\n| ERC-4337 / swap debug | [ab4dea2d…](/audits/fable/transcripts/${slugByUuid.get('ab4dea2d-3ce4-4e5d-8677-5b117b6c7a67')}) |\n| Privy CSP | [7afad2db…](/audits/fable/transcripts/${slugByUuid.get('7afad2db-7619-414d-a931-4b24a86e022f') ?? 'fable-session-7afad2db'}) |\n| Counter-trading bot | [683bffa0…](/audits/fable/transcripts/${slugByUuid.get('683bffa0-91b1-44b8-88c6-4ec1e5ba1b9a')}) |\n`,
  );

  const sessionsOut = [
    '---',
    'title: Fable session index',
    'sidebar_label: Session index',
    'sidebar_position: 3',
    'last_updated: \'2026-06-28\'',
    'audience:',
    '  - developers',
    'stage: use',
    'owner: docs-team',
    'last_reviewed: \'2026-06-28\'',
    'status: current',
    '---',
    '',
    sessionsBody.trim(),
    '',
  ].join('\n');

  await fs.writeFile(
    path.join(REPO_ROOT, 'docs/audits/fable/sessions-index.md'),
    sessionsOut,
  );

  console.log(`Exported ${entries.length} transcripts → ${OUT_DIR}`);
  console.log(`Wrote static zip → ${STATIC_ZIP}`);
  console.log(`Wrote sessions index → docs/audits/fable/sessions-index.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
