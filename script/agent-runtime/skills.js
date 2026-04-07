const fs = require('fs');
const path = require('path');

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
const REQUIRED_SKILL_FIELDS = ['name', 'description', 'triggers', 'scope', 'verification'];
const BUNDLED_SKILLS_DIR = path.resolve(__dirname, 'skills');

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function splitInlineList(value) {
  const inner = value.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const parts = [];
  let current = '';
  let quote = null;

  for (const char of inner) {
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote === char ? null : char;
      current += char;
      continue;
    }

    if (char === ',' && !quote) {
      parts.push(stripQuotes(current.trim()));
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(stripQuotes(current.trim()));
  }

  return parts.filter(Boolean);
}

function parseYamlValue(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return splitInlineList(trimmed);
  }

  return stripQuotes(trimmed);
}

function parseYamlFrontmatter(frontmatter) {
  const data = {};
  const lines = frontmatter.split(/\r?\n/);
  let currentListKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      if (currentListKey && trimmed.startsWith('- ')) {
        data[currentListKey].push(parseYamlValue(trimmed.slice(2)));
      }
      continue;
    }

    const key = match[1];
    const value = match[2].trim();

    if (!value) {
      data[key] = [];
      currentListKey = key;
      continue;
    }

    data[key] = parseYamlValue(value);
    currentListKey = Array.isArray(data[key]) ? key : null;
  }

  return data;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  return normalized.length ? normalized : null;
}

function validateSkillMetadata(metadata, filePath) {
  const missingFields = [];

  for (const field of REQUIRED_SKILL_FIELDS) {
    const value = metadata[field];

    if (field === 'name' || field === 'description') {
      if (typeof value !== 'string' || !value.trim()) {
        missingFields.push(field);
      }
      continue;
    }

    if (!Array.isArray(value) || value.length === 0) {
      missingFields.push(field);
    }
  }

  if (missingFields.length) {
    throw new Error(
      `Invalid skill frontmatter in ${filePath}: missing required field(s): ${missingFields.join(', ')}`
    );
  }
}

function parseSkillFrontmatter(content, filePath) {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const yamlData = parseYamlFrontmatter(match[1]);
  const skillDir = path.resolve(path.dirname(filePath));
  const metadata = {
    name: typeof yamlData.name === 'string' ? yamlData.name.trim() : '',
    description: typeof yamlData.description === 'string' ? yamlData.description.trim() : '',
    triggers: normalizeStringArray(yamlData.triggers),
    scope: normalizeStringArray(yamlData.scope),
    verification: normalizeStringArray(yamlData.verification),
    path: skillDir,
  };

  validateSkillMetadata(metadata, filePath);
  return metadata;
}

function walkForSkills(dir, skills) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkForSkills(fullPath, skills);
      continue;
    }

    if (entry.isFile() && entry.name === 'SKILL.md') {
      const content = fs.readFileSync(fullPath, 'utf8');
      const skill = parseSkillFrontmatter(content, fullPath);
      if (skill) {
        skills.push(skill);
      }
    }
  }
}

function discoverSkills(directories) {
  const skills = [];
  const uniqueDirs = Array.from(new Set(directories.map((dir) => path.resolve(dir))));

  for (const dir of uniqueDirs) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      continue;
    }

    walkForSkills(dir, skills);
  }

  skills.sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.path.localeCompare(right.path);
  });

  const seenNames = new Map();
  for (const skill of skills) {
    const duplicatePath = seenNames.get(skill.name);
    if (duplicatePath) {
      throw new Error(
        `Duplicate skill name "${skill.name}" found in ${duplicatePath} and ${skill.path}`
      );
    }

    seenNames.set(skill.name, skill.path);
  }

  return skills;
}

function getConfiguredSkillDirectories() {
  const configured = process.env.SKILL_DIRECTORIES || process.env.SKILL_DIRS;
  if (!configured) {
    return [];
  }

  return configured
    .split(',')
    .map((dir) => dir.trim())
    .filter(Boolean);
}

function getDefaultSkillDirectories() {
  return [BUNDLED_SKILLS_DIR, ...getConfiguredSkillDirectories()];
}

module.exports = {
  BUNDLED_SKILLS_DIR,
  discoverSkills,
  getDefaultSkillDirectories,
  getConfiguredSkillDirectories,
  parseSkillFrontmatter,
  parseYamlFrontmatter,
};
