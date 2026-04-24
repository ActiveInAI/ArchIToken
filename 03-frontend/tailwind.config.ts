/* tailwind.config.ts — ArchIToken
 * Tailwind CSS v4.2.4 · Using new @theme block syntax (v4 native)
 * License: Apache-2.0
 */
import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './lib/**/*.{ts,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ArchIToken Design Tokens
        ink: '#0a0a0b',
        paper: '#f4f1ea',
        accent: { DEFAULT: '#c8332a', dark: '#9a2620' },
        accent2: { DEFAULT: '#1f3a5f', dark: '#152742' },
        gold: { DEFAULT: '#b8956a', dark: '#8e714d' },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', '"Noto Serif SC"', 'Georgia', 'serif'],
        sans: ['"Inter Tight"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
