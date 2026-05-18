// app/layout.tsx — ArchIToken Root Layout
// Next.js 16.2.4 · React Server Components
// License: Apache-2.0

import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import 'antd/dist/reset.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ArchIToken — AEC AI Business Chain',
    template: '%s · ArchIToken',
  },
  description:
    'ArchIToken connects AEC projects, drawings, BIM models, costing, logistics, construction, digital twins, and archives through an AI Harness.',
  applicationName: 'ArchIToken',
  authors: [{ name: 'ActiveInAI', url: 'https://github.com/ActiveInAI' }],
  keywords: ['AEC', 'BIM', 'IFC', 'AI', 'LLM', 'Harness', 'ArchIToken', 'Digital Twin'],
  openGraph: {
    title: 'ArchIToken',
    description: 'AEC AI Business Chain',
    siteName: 'ArchIToken',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1ea' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
