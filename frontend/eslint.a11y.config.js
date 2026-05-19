import jsxA11y from 'eslint-plugin-jsx-a11y'

import baseConfig from './eslint.config.js'

function demoteRulesToWarn(rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([key, value]) => {
      if (value === 'error' || value === 2) return [key, 'warn']
      if (Array.isArray(value) && (value[0] === 'error' || value[0] === 2)) {
        return [key, ['warn', ...value.slice(1)]]
      }
      return [key, value]
    }),
  )
}

const a11yRecommended = {
  ...jsxA11y.flatConfigs.recommended,
  rules: demoteRulesToWarn(jsxA11y.flatConfigs.recommended.rules),
}

/** Extends the main ESLint config with jsx-a11y recommended rules at warn severity. */
export default [...baseConfig, a11yRecommended]
