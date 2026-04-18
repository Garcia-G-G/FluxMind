export type PlanId = "free" | "pro" | "ultra";

export type PlanConfig = {
  name: string;
  price: number;
  limits: {
    notebooks: number;
    sourcesPerNotebook: number;
    chatPerDay: number;
    studioOutputsPerDay: number;
    deepResearchPerMonth: number;
    storageMB: number;
  };
};

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    name: "Free",
    price: 0,
    limits: {
      notebooks: 5, sourcesPerNotebook: 10, chatPerDay: 20,
      studioOutputsPerDay: 3, deepResearchPerMonth: 0, storageMB: 100,
    },
  },
  pro: {
    name: "Pro",
    price: 1200,
    limits: {
      notebooks: 50, sourcesPerNotebook: 50, chatPerDay: 200,
      studioOutputsPerDay: 20, deepResearchPerMonth: 5, storageMB: 5000,
    },
  },
  ultra: {
    name: "Ultra",
    price: 2500,
    limits: {
      notebooks: -1, sourcesPerNotebook: 100, chatPerDay: -1,
      studioOutputsPerDay: -1, deepResearchPerMonth: -1, storageMB: 50000,
    },
  },
};

export const isWithinLimit = (current: number, limit: number): boolean => {
  if (limit === -1) return true;
  return current < limit;
};
