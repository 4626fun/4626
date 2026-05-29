[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/brand/motion

# src/components/brand/motion

## Variables

### BASE\_EASE

> `const` **BASE\_EASE**: readonly \[`0.4`, `0`, `0.2`, `1`\]

Defined in: [src/components/brand/motion.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/components/brand/motion.ts#L14)

Base brand motion constants.

Canonical easing: cubic-bezier(0.4, 0, 0.2, 1)
"One curve adapts across sizes; extend duration rather than change timing."

Duration targets:
  Snap    — 120-180ms  (micro-feedback: hover, press, toggle)
  Standard — 180-240ms (element enter/exit, state change)
  Emphasis — 360-480ms (hero entrance, route transition)
  Sequence — ≤800ms    (full choreographed intro/outro)

***

### BASE\_EASE\_CSS

> `const` **BASE\_EASE\_CSS**: `"cubic-bezier(0.4, 0, 0.2, 1)"` = `'cubic-bezier(0.4, 0, 0.2, 1)'`

Defined in: [src/components/brand/motion.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/components/brand/motion.ts#L25)

***

### DURATION

> `const` **DURATION**: `object`

Defined in: [src/components/brand/motion.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/components/brand/motion.ts#L16)

#### Type Declaration

##### emphasis

> `readonly` **emphasis**: `0.4` = `0.4`

##### sequenceMax

> `readonly` **sequenceMax**: `0.8` = `0.8`

##### snap

> `readonly` **snap**: `0.15` = `0.15`

##### standard

> `readonly` **standard**: `0.22` = `0.22`

***

### STAGGER\_STEP

> `const` **STAGGER\_STEP**: `0.06` = `0.06`

Defined in: [src/components/brand/motion.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/brand/motion.ts#L23)
