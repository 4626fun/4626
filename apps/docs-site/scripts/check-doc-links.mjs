#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

function listTrackedMarkdownDocs() {
  const out = execSync("git ls-files -- docs", { encoding: "utf8", cwd: repoRoot });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => existsSync(path.join(repoRoot, file)))
    .filter((file) => !file.startsWith("docs/_generated/"))
    .filter((file) => !file.startsWith("docs/_archive/"));
}

function normalizeTarget(rawHref) {
  const href = rawHref.trim();
  if (!href) return null;
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#") ||
    href.startsWith("/")
  ) {
    return null;
  }

  // Strip optional title section and query/anchor.
  const withoutTitle = href.replace(/\s+["'].*$/, "");
  const withoutQuery = withoutTitle.split("?")[0] ?? "";
  const withoutAnchor = withoutQuery.split("#")[0] ?? "";
  return withoutAnchor.trim() || null;
}

function checkRelativeLink(file, relTarget) {
  const baseDir = path.dirname(file);
  const target = path.resolve(repoRoot, baseDir, relTarget);
  return (
    existsSync(target) ||
    existsSync(`${target}.md`) ||
    existsSync(path.join(target, "index.md"))
  );
}

const files = listTrackedMarkdownDocs();
const markdownLinkRe = /\[[^\]]*]\(([^)]+)\)/g;
const issues = [];

// Replace fenced code blocks (```...```) and inline code (`...`) with
// equivalent-length whitespace so byte offsets remain stable but their
// contents do not match the markdown-link regex (e.g. Solidity `new T[](n)`).
function stripCodeSpans(text) {
  let out = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, " "));
  out = out.replace(/`[^`\n]*`/g, (block) => " ".repeat(block.length));
  return out;
}

for (const file of files) {
  const rawText = readFileSync(path.join(repoRoot, file), "utf8");
  const text = stripCodeSpans(rawText);
  for (const match of text.matchAll(markdownLinkRe)) {
    const href = match[1] ?? "";
    const relTarget = normalizeTarget(href);
    if (!relTarget) continue;
    if (checkRelativeLink(file, relTarget)) continue;

    const offset = match.index ?? 0;
    const line = text.slice(0, offset).split("\n").length;
    issues.push(`${file}:${line} -> ${href}`);
  }
}

if (issues.length === 0) {
  console.log(`OK: checked ${files.length} docs files, no broken relative links.`);
  process.exit(0);
}

console.error(`Found ${issues.length} broken relative docs link(s):`);
for (const issue of issues) {
  console.error(`- ${issue}`);
}
process.exit(1);
