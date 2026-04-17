"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { FluxThemeProvider } from "@/components/shared/theme-provider";

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
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <FluxThemeProvider>{children}</FluxThemeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
