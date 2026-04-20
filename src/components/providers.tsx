"use client";

import type { ReactNode } from "react";
import { FluxThemeProvider } from "@/components/shared/theme-provider";
import { LanguageProvider } from "@/lib/i18n/language";

/**
 * Root-level providers: theme + language. Both are tiny (localStorage reads
 * on mount, small context) and needed app-wide so theme preference persists
 * across marketing/auth/app boundaries.
 *
 * QueryClient lives in <AppProviders> and only mounts under (app) routes.
 */
export const Providers = ({ children }: { children: ReactNode }): ReactNode => {
  return (
    <FluxThemeProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </FluxThemeProvider>
  );
};
