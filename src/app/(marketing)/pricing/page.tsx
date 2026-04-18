"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/billing/plans";

const comparisonFeatures = [
  { name: "Notebooks", key: "notebooks" as const },
  { name: "Sources per notebook", key: "sourcesPerNotebook" as const },
  { name: "Chat messages/day", key: "chatPerDay" as const },
  { name: "Studio outputs/day", key: "studioOutputsPerDay" as const },
  { name: "Deep Research/month", key: "deepResearchPerMonth" as const },
  { name: "Storage", key: "storageMB" as const },
];

const booleanFeatures = [
  { name: "RAG-powered chat", free: true, pro: true, ultra: true },
  { name: "All source types", free: true, pro: true, ultra: true },
  { name: "Quiz & Flashcards", free: true, pro: true, ultra: true },
  { name: "Claude & GPT models", free: false, pro: true, ultra: true },
  { name: "Deep Research", free: false, pro: true, ultra: true },
  { name: "Real-time collaboration", free: false, pro: true, ultra: true },
  { name: "Priority support", free: false, pro: false, ultra: true },
  { name: "API access", free: false, pro: false, ultra: true },
];

const formatLimit = (value: number, key: string): string => {
  if (value === -1) return "Unlimited";
  if (value === 0) return "—";
  if (key === "storageMB") {
    return value >= 1000 ? `${value / 1000}GB` : `${value}MB`;
  }
  return String(value);
};

const PricingPage = (): React.ReactNode => {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">F</span>
            </div>
            <span className="font-semibold">FluxMind</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-center mb-2">Pricing</h1>
        <p className="text-center text-muted-foreground mb-8">
          Start free, upgrade as you grow
        </p>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm ${!annual ? "font-medium" : "text-muted-foreground"}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              annual ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                annual ? "translate-x-5.5 left-0" : "left-0.5"
              }`}
              style={{ transform: annual ? "translateX(22px)" : "translateX(0)" }}
            />
          </button>
          <span className={`text-sm ${annual ? "font-medium" : "text-muted-foreground"}`}>
            Annual{" "}
            <span className="text-xs text-green-600 font-medium">Save 20%</span>
          </span>
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-16">
          {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(
            ([planId, plan]) => {
              const monthlyPrice = annual
                ? Math.round(plan.price * 0.8)
                : plan.price;
              return (
                <div
                  key={planId}
                  className={`rounded-xl border p-6 ${
                    planId === "pro"
                      ? "border-primary ring-1 ring-primary"
                      : "border-border"
                  }`}
                >
                  {planId === "pro" && (
                    <p className="text-xs font-medium text-primary mb-2">
                      Most Popular
                    </p>
                  )}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-3xl font-bold mt-2 mb-1">
                    {monthlyPrice === 0 ? "$0" : `$${monthlyPrice / 100}`}
                    {monthlyPrice > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    )}
                  </p>
                  {annual && plan.price > 0 && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Billed ${Math.round((monthlyPrice / 100) * 12)}/year
                    </p>
                  )}
                  {!annual && <div className="mb-4" />}
                  <Link href="/register">
                    <Button
                      className="w-full"
                      variant={planId === "pro" ? "default" : "outline"}
                    >
                      {plan.price === 0 ? "Get Started" : "Start Free Trial"}
                    </Button>
                  </Link>
                </div>
              );
            }
          )}
        </div>

        {/* Comparison table */}
        <h2 className="text-xl font-bold text-center mb-6">Feature comparison</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium">Feature</th>
                <th className="text-center p-3 font-medium">Free</th>
                <th className="text-center p-3 font-medium text-primary">Pro</th>
                <th className="text-center p-3 font-medium">Ultra</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((f) => (
                <tr key={f.name} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{f.name}</td>
                  <td className="p-3 text-center">
                    {formatLimit(PLANS.free.limits[f.key], f.key)}
                  </td>
                  <td className="p-3 text-center font-medium">
                    {formatLimit(PLANS.pro.limits[f.key], f.key)}
                  </td>
                  <td className="p-3 text-center">
                    {formatLimit(PLANS.ultra.limits[f.key], f.key)}
                  </td>
                </tr>
              ))}
              {booleanFeatures.map((f) => (
                <tr key={f.name} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{f.name}</td>
                  <td className="p-3 text-center">
                    {f.free ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {f.pro ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {f.ultra ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <h2 className="text-xl font-bold mb-3">Ready to get started?</h2>
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
