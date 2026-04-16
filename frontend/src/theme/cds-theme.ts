import { defaultTheme } from '@coinbase/cds-web/themes/defaultTheme'

/**
 * Custom 4626 dark theme extending the CDS default theme.
 *
 * The project uses an ultra-dark aesthetic with #0052FF accent,
 * which maps to CDS blue60 ("0,82,255"). The default CDS dark
 * spectrum already includes this as blue60, so we only need to
 * push backgrounds deeper (true black instead of CDS's gray0 = "10,11,13")
 * and adjust elevation surfaces to match the vault aesthetic.
 *
 * framer-motion compatibility note:
 *   - Project uses framer-motion v12; CDS peer-requires ^10.
 *   - Installed with --legacy-peer-deps. CDS animation features
 *     that rely on framer-motion v10 internals may need testing.
 */
export const theme4626 = {
  ...defaultTheme,
  id: '4626-dark' as const,
  darkColor: {
    ...defaultTheme.darkColor,
    // Push backgrounds to true black for ultra-dark vault aesthetic
    bg: 'rgb(5,5,7)' as const,
    bgAlternate: 'rgb(12,12,16)' as const,
    bgSecondary: 'rgb(22,22,28)' as const,
    bgTertiary: 'rgb(32,34,40)' as const,
    bgSecondaryWash: 'rgb(12,12,16)' as const,
    bgElevation1: 'rgb(12,12,16)' as const,
    bgElevation2: 'rgb(18,18,24)' as const,
    bgOverlay: 'rgba(0,0,0,0.7)' as const,
    // Keep CDS primary blue but punch up foreground primary for contrast on dark bg
    fgPrimary: 'rgb(55,115,245)' as const,
    bgPrimary: 'rgb(0,82,255)' as const,
    bgPrimaryWash: 'rgb(0,12,40)' as const,
  },
  darkSpectrum: {
    ...defaultTheme.darkSpectrum,
    // Deepen gray base for ultra-dark surfaces
    gray0: '5,5,7' as const,
    gray5: '12,12,16' as const,
    gray10: '18,18,24' as const,
    gray15: '26,28,34' as const,
  },
} as const
