---
title: Security & audits
sidebar_label: Overview
sidebar_position: 1
hide_table_of_contents: true
last_updated: '2026-06-29'
audience:
  - developers
  - protocols
  - operators
stage: use
owner: docs-team
last_reviewed: '2026-06-29'
status: current
---

<div class="audit-hub">

<section class="audit-hero">
  <span class="audit-hero__eyebrow"><span class="audit-hero__dot"></span>Security disclosure</span>
  <h1 class="audit-hero__title">Security &amp; audits</h1>
  <p class="audit-hero__subtitle">Published security review materials for integrators, auditors, and token holders: scope and methodology, executive findings, the full technical report, and supplementary session records.</p>
  <div class="home-hero__actions">
    <a class="home-btn home-btn--primary" href="/audits/fable/findings-summary">Executive summary<span class="home-btn__arrow" aria-hidden="true">→</span></a>
    <a class="home-btn home-btn--ghost" href="/audits/fable">Scope &amp; methodology</a>
  </div>
</section>

<nav class="audit-path" aria-label="Report sections">
  <a class="audit-path__step audit-path__step--current" href="/audits">Overview</a>
  <a class="audit-path__step" href="/audits/fable">Scope</a>
  <a class="audit-path__step" href="/audits/fable/findings-summary">Executive summary</a>
  <a class="audit-path__step" href="/audits/fable/full-repo-review-2026-06">Full report</a>
  <a class="audit-path__step" href="/audits/fable/key-sessions">Source sessions</a>
  <a class="audit-path__step" href="/audits/fable/sessions-index">Session chronology</a>
  <a class="audit-path__step" href="/audits/fable/transcripts">Transcript archive</a>
</nav>

## Report structure

Recommended reading order for Report **4626-FABLE-2026-06**:

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontFamily': 'Inter, system-ui, sans-serif',
    'fontSize': '13px',
    'primaryColor': '#eef3ff',
    'primaryTextColor': '#1c1e21',
    'primaryBorderColor': '#0052FF',
    'secondaryColor': '#fafafa',
    'secondaryTextColor': '#525860',
    'secondaryBorderColor': '#e3e3e3',
    'tertiaryColor': '#fff9eb',
    'tertiaryTextColor': '#1c1e21',
    'tertiaryBorderColor': '#E8B964',
    'lineColor': '#9ca3af',
    'clusterBkg': '#fafafa',
    'clusterBorder': '#e3e3e3',
    'titleColor': '#1c1e21'
  }
}}%%
flowchart LR
  O["Overview"] --> S["Scope"]
  S --> E["Executive<br/>summary"]
  E --> R["Full report"]
  R --> A["Source<br/>sessions"]
  A --> B["Session<br/>chronology"]
  B --> C["Transcript<br/>archive"]

  classDef start fill:#eef3ff,stroke:#0052FF,stroke-width:2px,color:#1c1e21
  classDef featured fill:#fff9eb,stroke:#E8B964,stroke-width:2px,color:#1c1e21
  classDef appendix fill:#fafafa,stroke:#d1d5db,stroke-width:1px,color:#525860

  class O start
  class E featured
  class A,B,C appendix
```

<div class="audit-doc-control">
  <div class="audit-doc-control__title">Published review</div>
  <table>
    <tbody>
      <tr><th>Report</th><td>4626 Technical Security Review — June 2026</td></tr>
      <tr><th>Repository</th><td><a href="https://github.com/wenakita/4626">wenakita/4626</a></td></tr>
      <tr><th>Review period</th><td>9–13 June 2026</td></tr>
      <tr><th>Primary deliverable</th><td><a href="/audits/fable/full-repo-review-2026-06">Full technical report</a></td></tr>
    </tbody>
  </table>
</div>

<div class="audit-stat-row">
  <div class="audit-stat">
    <span class="audit-stat__value">8</span>
    <span class="audit-stat__label">Parallel workstreams</span>
  </div>
  <div class="audit-stat">
    <span class="audit-stat__value">47</span>
    <span class="audit-stat__label">Lead review sessions</span>
  </div>
  <div class="audit-stat">
    <span class="audit-stat__value">97</span>
    <span class="audit-stat__label">Published session records</span>
  </div>
  <div class="audit-stat">
    <span class="audit-stat__value">3 + 6</span>
    <span class="audit-stat__label">Critical + high findings</span>
  </div>
</div>

## June 2026 security review

<div class="home-cards">
  <a class="home-card audit-card audit-card--featured" href="/audits/fable/findings-summary">
    <span class="home-card__tag">Recommended first read</span>
    <span class="home-card__title">Executive summary</span>
    <span class="home-card__desc">Critical and high-severity findings with severity definitions and primary evidence references.</span>
  </a>
  <a class="home-card audit-card" href="/audits/fable">
    <span class="home-card__tag">Scope</span>
    <span class="home-card__title">Scope &amp; methodology</span>
    <span class="home-card__desc">Systems in scope, validation approach, evidence grading, and release-readiness conclusion at review date.</span>
  </a>
  <a class="home-card audit-card" href="/audits/fable/full-repo-review-2026-06">
    <span class="home-card__tag">Full report</span>
    <span class="home-card__title">Full technical report</span>
    <span class="home-card__desc">Architecture map, complete finding register (C/H/M/L), baseline validation, test gaps, and remediation guidance.</span>
  </a>
  <a class="home-card audit-card" href="/audits/fable/key-sessions">
    <span class="home-card__tag">Appendix A</span>
    <span class="home-card__title">Source sessions</span>
    <span class="home-card__desc">Curated session register linking to supplementary engagement records.</span>
  </a>
</div>

<div class="audit-limitations">
  <div class="audit-limitations__title">Limitations &amp; disclaimer</div>
  <p>This publication documents a <strong>read-only technical security review</strong> of the 4626 monorepo conducted in June 2026. It is <strong>not</strong> a formal smart-contract audit certificate from an independent security firm and does not constitute legal or investment advice. Findings reflect repository state at review time; verify remediation status against current code and public disclosures before launch or integration decisions. Appendices contain supplementary session records — authoritative written conclusions are in the executive summary and full report.</p>
</div>

<div class="home-links">
  <a class="home-links__item" href="/audits/fable/transcripts">Transcript archive</a>
  <span class="home-links__sep" aria-hidden="true">·</span>
  <a class="home-links__item" href="/audits/fable/sessions-index">Session chronology</a>
  <span class="home-links__sep" aria-hidden="true">·</span>
  <a class="home-links__item" href="/audits/fable-chats-4626-2026-06.zip">Machine-readable logs (JSONL)</a>
  <span class="home-links__sep" aria-hidden="true">·</span>
  <a class="home-links__item" href="/reference/impairment-v1-disclosures">Impairment disclosures</a>
</div>

<nav class="audit-flow-nav" aria-label="Continue reading">
  <span class="audit-flow-nav__spacer"></span>
  <a class="audit-flow-nav__link audit-flow-nav__link--next" href="/audits/fable/findings-summary">Executive summary →</a>
</nav>

</div>
