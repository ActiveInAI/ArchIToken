// app/layout.tsx — InsomeOS Root Layout
// Next.js 16.2.4 · React Server Components
// License: Apache-2.0

import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'InsomeOS — AEC Harness for LLMs',
    template: '%s · InsomeOS',
  },
  description:
    'Architecture · Engineering · Construction OS. A Harness for Large Language Models in the AEC industry. 100% Open Source (Apache-2.0 / MIT / BSD).',
  applicationName: 'InsomeOS',
  authors: [{ name: 'ActiveInAI', url: 'https://github.com/ActiveInAI' }],
  keywords: ['AEC', 'BIM', 'IFC', 'AI', 'LLM', 'Harness', 'Architecture', 'Engineering'],
  openGraph: {
    title: 'InsomeOS',
    description: 'AEC Harness for LLMs',
    siteName: 'InsomeOS',
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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-paper text-ink font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
