[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/theme/cds-theme

# src/theme/cds-theme

## Variables

### theme4626

> `const` **theme4626**: `object`

Defined in: [src/theme/cds-theme.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/theme/cds-theme.ts#L17)

Custom 4626 dark theme extending the CDS default theme.

The project uses an ultra-dark aesthetic with #0052FF accent,
which maps to CDS blue60 ("0,82,255"). The default CDS dark
spectrum already includes this as blue60, so we only need to
push backgrounds deeper (true black instead of CDS's gray0 = "10,11,13")
and adjust elevation surfaces to match the vault aesthetic.

framer-motion compatibility note:
  - Project uses framer-motion v12; CDS peer-requires ^10.
  - Installed with --legacy-peer-deps. CDS animation features
    that rely on framer-motion v10 internals may need testing.

#### Type Declaration

##### darkColor

> `readonly` **darkColor**: `object`

###### darkColor.bg

> `readonly` **bg**: `"rgb(5,5,7)"`

###### darkColor.bgAlternate

> `readonly` **bgAlternate**: `"rgb(12,12,16)"`

###### darkColor.bgElevation1

> `readonly` **bgElevation1**: `"rgb(12,12,16)"`

###### darkColor.bgElevation2

> `readonly` **bgElevation2**: `"rgb(18,18,24)"`

###### darkColor.bgOverlay

> `readonly` **bgOverlay**: `"rgba(0,0,0,0.7)"`

###### darkColor.bgPrimary

> `readonly` **bgPrimary**: `"rgb(0,82,255)"`

###### darkColor.bgPrimaryWash

> `readonly` **bgPrimaryWash**: `"rgb(0,12,40)"`

###### darkColor.bgSecondary

> `readonly` **bgSecondary**: `"rgb(22,22,28)"`

###### darkColor.bgSecondaryWash

> `readonly` **bgSecondaryWash**: `"rgb(12,12,16)"`

###### darkColor.bgTertiary

> `readonly` **bgTertiary**: `"rgb(32,34,40)"`

###### darkColor.fgPrimary

> `readonly` **fgPrimary**: `"rgb(55,115,245)"`

##### darkSpectrum

> `readonly` **darkSpectrum**: `object`

###### darkSpectrum.gray0

> `readonly` **gray0**: `"5,5,7"`

###### darkSpectrum.gray10

> `readonly` **gray10**: `"18,18,24"`

###### darkSpectrum.gray15

> `readonly` **gray15**: `"26,28,34"`

###### darkSpectrum.gray5

> `readonly` **gray5**: `"12,12,16"`

##### id

> `readonly` **id**: `"4626-dark"`
