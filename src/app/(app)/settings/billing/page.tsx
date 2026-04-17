"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, type PlanId } from "@/lib/stripe";

const BillingPage = (): React.ReactNode => {
  const [loading, setLoading] = useState<string | null>(null);

  const currentPlan: PlanId = "free"; // Would come from user record

  const handleUpgrade = async (planId: PlanId): Promise<void> => {
    setLoading(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      // Error handling
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async (): Promise<void> => {
    setLoading("manage");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      // Error handling
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Billing</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Manage your subscription and billing
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(
          ([planId, plan]) => {
            const isCurrent = planId === currentPlan;
            return (
              <div
                key={planId}
                className={`rounded-lg border p-5 ${
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {isCurrent && (
                    <Badge variant="secondary" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold mb-4">
                  {plan.price === 0 ? (
                    "$0"
                  ) : (
                    <>
                      ${plan.price / 100}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </>
                  )}
                </p>
                <ul className="space-y-2 mb-4 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {plan.limits.notebooks === -1
                      ? "Unlimited"
                      : plan.limits.notebooks}{" "}
                    notebooks
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {plan.limits.chatPerDay === -1
                      ? "Unlimited"
                      : plan.limits.chatPerDay}{" "}
                    chats/day
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {plan.limits.storageMB >= 1000
                      ? `${plan.limits.storageMB / 1000}GB`
                      : `${plan.limits.storageMB}MB`}{" "}
                    storage
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {plan.limits.deepResearchPerMonth === -1
                      ? "Unlimited"
                      : plan.limits.deepResearchPerMonth === 0
                        ? "No"
                        : plan.limits.deepResearchPerMonth}{" "}
                    deep research
                  </li>
                </ul>
                {isCurrent ? (
                  currentPlan !== "free" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={handleManageBilling}
                      disabled={loading === "manage"}
                    >
                      {loading === "manage" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      Manage
                    </Button>
                  )
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleUpgrade(planId)}
                    disabled={loading === planId || plan.price === 0}
                  >
                    {loading === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Upgrade"
                    )}
                  </Button>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};

export default BillingPage;
