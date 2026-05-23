/**
 * Single fixed app canvas — mounted once at the App router root.
 * Color comes from shared/site-config.json via generated canvas-tokens.css.
 */
export function AppCanvas() {
  return <div aria-hidden="true" className="app-canvas-bg" />
}
