"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Providers mounted under (app) routes only. Keeps @tanstack/react-query
 * (~9kb) off marketing, auth, and public share routes which don't use it.
 */
export const AppProviders = ({ children }: { children: ReactNode }): ReactNode => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
