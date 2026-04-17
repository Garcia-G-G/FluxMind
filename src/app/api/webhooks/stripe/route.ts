import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getStripeClient } from "@/lib/stripe";
import { db } from "@/lib/db";
import { users } from "@/db/schema/users";
import { subscriptions } from "@/db/schema/subscriptions";
import type Stripe from "stripe";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && customerId) {
          await db
            .update(users)
            .set({ stripeCustomerId: customerId, plan: "pro" })
            .where(eq(users.id, userId));

          // Create subscription record
          const now = new Date();
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          await db.insert(subscriptions).values({
            id: createId(),
            userId,
            stripeSubscriptionId: subscriptionId,
            plan: "pro",
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            createdAt: now,
            updatedAt: now,
          });
        }
        break;
      }

      case "invoice.paid": {
        const paidInvoice = event.data.object;
        const paidSubId = String((paidInvoice as unknown as Record<string, unknown>).subscription ?? "");
        if (paidSubId) {
          await db
            .update(subscriptions)
            .set({ status: "active", updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, paidSubId));
        }
        break;
      }

      case "invoice.payment_failed": {
        const failedInvoice = event.data.object;
        const failedSubId = String((failedInvoice as unknown as Record<string, unknown>).subscription ?? "");
        if (failedSubId) {
          await db
            .update(subscriptions)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(eq(subscriptions.stripeSubscriptionId, failedSubId));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object;
        const deletedSubId = deletedSub.id;
        await db
          .update(subscriptions)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(subscriptions.stripeSubscriptionId, deletedSubId));

        // Downgrade user to free
        const [existing] = await db
          .select({ userId: subscriptions.userId })
          .from(subscriptions)
          .where(eq(subscriptions.stripeSubscriptionId, deletedSubId));

        if (existing) {
          await db
            .update(users)
            .set({ plan: "free" })
            .where(eq(users.id, existing.userId));
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
};
