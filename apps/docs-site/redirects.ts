export type ClientRedirect = {
  from: string | string[];
  to: string;
};

/**
 * Legacy route redirects for docs.4626.fun.
 *
 * We intentionally keep this as an explicit map (vs pattern-based) so changes
 * are reviewable and predictable.
 *
 * Notes:
 * - We include both with and without trailing slash, since the site serves
 *   directory-style routes (e.g. `/overview/`).
 * - Redirect targets should be canonical narrative-first routes.
 */
export const redirects: ClientRedirect[] = [
  // Intentionally empty for now.
  //
  // We keep legacy `/overview/*` and `/concepts/*` as real docs pages so we can:
  // - avoid breaking internal doc IDs abruptly
  // - avoid the redirect plugin trying to override existing output paths
  //
  // Once those legacy pages are removed from the docs build entirely, add explicit
  // redirects here to preserve the old URLs.
];

