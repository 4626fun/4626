// Example Next.js metadata object for app/layout.tsx
export const metadata = {
  title: "4626.fun | Creator Vaults on Base",
  description: "Creator vaults on Base.",
  metadataBase: new URL("https://4626.fun/"),
  openGraph: {
    type: "website",
    url: "https://4626.fun/",
    siteName: "4626.fun",
    title: "4626.fun | Creator Vaults on Base",
    description: "Creator vaults on Base.",
    images: [
      {
        url: "/social/og-image-1200x630.png",
        width: 1200,
        height: 630,
        alt: "4626.fun logo and Creator Vaults on Base tagline",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "4626.fun | Creator Vaults on Base",
    description: "Creator vaults on Base.",
    images: ["/social/twitter-summary-large-image-1200x675.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/favicons/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  themeColor: "#DDA01C",
};
