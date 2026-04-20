"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type Stats = {
  notebooks: number;
  sources: number;
  conversations: number;
  outputs: number;
};

const fetchStats = async (): Promise<Stats> => {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
};

export const useStats = (options?: {
  initialData?: Stats;
}): UseQueryResult<Stats, Error> => {
  return useQuery<Stats, Error>({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 30_000,
    initialData: options?.initialData,
  });
};
