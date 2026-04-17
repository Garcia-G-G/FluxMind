import Stripe from "stripe";

let _stripe: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  }
  return _stripe;
};

export type PlanId = "free" | "pro" | "ultra";

export type PlanConfig = {
  name: string;
  price: number;
  priceId: string;
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
    priceId: "",
    limits: {
      notebooks: 5, sourcesPerNotebook: 10, chatPerDay: 20,
      studioOutputsPerDay: 3, deepResearchPerMonth: 0, storageMB: 100,
    },
  },
  pro: {
    name: "Pro",
    price: 1200,
    priceId: process.env.STRIPE_PRO_PRICE_ID ?? "",
    limits: {
      notebooks: 50, sourcesPerNotebook: 50, chatPerDay: 200,
      studioOutputsPerDay: 20, deepResearchPerMonth: 5, storageMB: 5000,
    },
  },
  ultra: {
    name: "Ultra",
    price: 2500,
    priceId: process.env.STRIPE_ULTRA_PRICE_ID ?? "",
    limits: {
      notebooks: -1, sourcesPerNotebook: 100, chatPerDay: -1,
      studioOutputsPerDay: -1, deepResearchPerMonth: -1, storageMB: 50000,
    },
  },
};

export const createCheckoutSession = async (
  customerId: string, priceId: string, userId: string
): Promise<string> => {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    customer: customerId, mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    metadata: { userId },
  });
  return session.url!;
};

export const createCustomerPortalSession = async (customerId: string): Promise<string> => {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });
  return session.url;
};

export const isWithinLimit = (current: number, limit: number): boolean => {
  if (limit === -1) return true;
  return current < limit;
};
