const { discoverSkills, getDefaultSkillDirectories } = require('./skills');

let cachedSkills = null;

function initializeSkillCache() {
  const directories = getDefaultSkillDirectories();
  cachedSkills = discoverSkills(directories);
  return cachedSkills;
}

function getSkillMetadata() {
  if (!cachedSkills) {
    return initializeSkillCache();
  }

  return cachedSkills;
}

function resetSkillCache() {
  cachedSkills = null;
}

module.exports = {
  getSkillMetadata,
  initializeSkillCache,
  resetSkillCache,
};
