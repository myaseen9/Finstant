import { Inter, IBM_Plex_Mono } from 'next/font/google';

/**
 * Prose and UI — headings, body, buttons, nav.
 *
 * Inter is a versatile, modern typeface designed for computer screens
 * with exceptional readability, crisp letterforms, and clean metric density.
 */
export const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
  adjustFontFallback: true,
});

/**
 * Data and labels — figures, table cells, eyebrow labels, SQL strings and source tags.
 */
export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const fontVariables = `${inter.variable} ${plexMono.variable}`;

