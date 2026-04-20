"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { FluxThemeProvider } from "@/components/shared/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language";

export const Providers = ({ children }: { children: ReactNode }): ReactNode => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <FluxThemeProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </FluxThemeProvider>
    </QueryClientProvider>
  );
};
