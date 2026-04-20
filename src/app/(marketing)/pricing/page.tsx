"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { FluxLogo } from "@/components/shared/flux-logo";
import type { CSSProperties } from "react";

type Plan = {
  id: "free" | "pro" | "team";
  name: string;
  price: string;
  period: string;
  accent: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  cardStyle: CSSProperties;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    accent: "#ff6b35",
    features: [
      "3 notebooks",
      "50 sources",
      "All AI models",
      "All studio outputs",
      "RAG chat",
    ],
    cta: "Get started",
    highlighted: false,
    cardStyle: {
      background: "rgba(12,12,18,0.88)",
      border: "1px solid rgba(255,255,255,0.05)",
    },
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "/month",
    accent: "#7c3aed",
    features: [
      "Unlimited notebooks",
      "500 sources",
      "Priority processing",
      "API access",
      "Custom branding",
      "Advanced analytics",
    ],
    cta: "Start 7-day trial",
    highlighted: true,
    cardStyle: {
      background: "rgba(124,58,237,0.08)",
      border: "1px solid rgba(124,58,237,0.2)",
    },
  },
  {
    id: "team",
    name: "Team",
    price: "$12",
    period: "/user/month",
    accent: "#2563eb",
    features: [
      "Everything in Pro",
      "Real-time collaboration",
      "Shared notebooks",
      "Admin dashboard",
      "SSO",
      "Priority support",
    ],
    cta: "Contact sales",
    highlighted: false,
    cardStyle: {
      background: "rgba(12,12,18,0.88)",
      border: "1px solid rgba(255,255,255,0.05)",
    },
  },
];

const priceStyle: CSSProperties = {
  fontSize: 40,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: "white",
  lineHeight: 1,
};

const PricingPage = (): React.ReactNode => {
  return (
    <div
      className="min-h-screen relative"
      style={{ background: "#08080c" }}
    >
      <style>{`
        .fm-pricing-cta-solid { transition: filter 0.2s, transform 0.2s; }
        .fm-pricing-cta-solid:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .fm-pricing-cta-outline { transition: background 0.2s, transform 0.2s, border-color 0.2s; }
        .fm-pricing-cta-outline:hover { background: rgba(255,255,255,0.04); transform: translateY(-1px); border-color: rgba(255,255,255,0.12); }
        .fm-pricing-nav-link { color: rgba(255,255,255,0.35); transition: color 0.2s; }
        .fm-pricing-nav-link:hover { color: rgba(255,255,255,0.7); }
      `}</style>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center" style={{ gap: 10 }}>
          <FluxLogo size={28} />
          <span
            style={{
              color: "white",
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            FluxMind
          </span>
        </Link>
        <Link
          href="/"
          className="fm-pricing-nav-link"
          style={{ fontSize: 13 }}
        >
          ← Back
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-8 pt-12 pb-14 text-center">
        <h1
          style={{
            fontSize: 64,
            lineHeight: 1.05,
            letterSpacing: "-0.045em",
            margin: 0,
          }}
        >
          <span style={{ fontWeight: 700, color: "white" }}>
            Simple pricing,
          </span>{" "}
          <span
            style={{ fontWeight: 300, color: "rgba(255,255,255,0.25)" }}
          >
            powerful tools.
          </span>
        </h1>
        <p
          style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 16,
            fontWeight: 380,
            marginTop: 24,
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Start free. Upgrade when you need more.
        </p>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-8 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="relative overflow-hidden"
              style={{
                ...plan.cardStyle,
                borderRadius: 16,
                padding: "32px 28px",
              }}
            >
              {plan.highlighted && (
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, ${plan.accent}, transparent)`,
                  }}
                />
              )}

              <div style={{ marginBottom: 24 }}>
                <p
                  style={{
                    color: plan.accent,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  {plan.name}
                </p>
                <div
                  className="flex items-baseline"
                  style={{ gap: 6, marginTop: 12 }}
                >
                  <span style={priceStyle}>{plan.price}</span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 14,
                      fontWeight: 400,
                    }}
                  >
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginBottom: 28,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start"
                    style={{ gap: 10, fontSize: 14 }}
                  >
                    <Check
                      className="h-4 w-4 shrink-0"
                      style={{ color: plan.accent, marginTop: 2 }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.75)" }}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="/"
                className={
                  plan.highlighted
                    ? "fm-pricing-cta-solid"
                    : "fm-pricing-cta-outline"
                }
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "11px 0",
                  borderRadius: 10,
                  textDecoration: "none",
                  ...(plan.highlighted
                    ? {
                        background: plan.accent,
                        color: "white",
                        border: `1px solid ${plan.accent}`,
                      }
                    : {
                        background: "transparent",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }),
                }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 40,
            fontSize: 13,
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "-0.01em",
          }}
        >
          Open beta · Free while in preview
        </p>
      </section>
    </div>
  );
};

export default PricingPage;
