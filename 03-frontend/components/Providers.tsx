// components/Providers.tsx
// License: Apache-2.0
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { CustomizationApplier } from '@/components/customization-applier';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { ThemeProvider } from '@/components/ThemeProvider';
import { LeadProviderScope } from '@/lib/lead/context';
import zhMessages from '@/lib/insome/i18n/messages/zh.json';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="zh" messages={zhMessages} timeZone="Australia/Perth">
        <ThemeProvider>
          <CustomizationApplier />
          <LeadProviderScope>
            <ErrorBoundary scope="app">{children}</ErrorBoundary>
          </LeadProviderScope>
        </ThemeProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
