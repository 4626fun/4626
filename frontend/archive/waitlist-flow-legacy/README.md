## Legacy waitlist flow archive

This folder contains the pre-reset waitlist flow that previously powered `/waitlist`.

Archived on: `2026-06-21`

Why:
- The waitlist UX was reset to a simpler model.
- New flow keeps only:
  - email signup for new users
  - EOA wallet sign-in for returning users

Notes:
- Shared waitlist utilities that are still consumed outside `/waitlist` remain in `../`.
- Files here are intentionally not part of the active route path anymore.
