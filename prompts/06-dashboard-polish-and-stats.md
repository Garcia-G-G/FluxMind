# Prompt 06 — Dashboard Polish + Real Stats

> For Claude Code Max. Run in `/Users/go/Documents/FluxMind`. Read CLAUDE.md first.
> **Prerequisite**: Run prompt 01 first (adds view filtering), prompt 03 (adds icon resolver).

## Problem

Dashboard stat cards show hardcoded "0" values. The greeting subtitle is generic. The empty state "New Notebook" button uses a 4-color gradient that looks AI-generated.

## What to Do

### Step 1: Create stats API endpoint

Create `src/app/api/stats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { notebooks } from "@/db/schema/notebooks";
import { sources } from "@/db/schema/sources";
import { conversations } from "@/db/schema/conversations";
import { outputs } from "@/db/schema/outputs";
import { eq, count } from "drizzle-orm";

export const GET = async (): Promise<Response> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [nb] = await db.select({ count: count() }).from(notebooks).where(eq(notebooks.userId, userId));
  const [src] = await db.select({ count: count() }).from(sources).where(eq(sources.userId, userId));
  const [conv] = await db.select({ count: count() }).from(conversations).where(eq(conversations.userId, userId));
  const [out] = await db.select({ count: count() }).from(outputs).where(eq(outputs.userId, userId));

  return NextResponse.json({
    notebooks: nb?.count ?? 0,
    sources: src?.count ?? 0,
    conversations: conv?.count ?? 0,
    outputs: out?.count ?? 0,
  });
};
```

**Important**: Check the actual schema files first. The column might be `userId` or `user_id` or referenced differently. Read the schemas before writing:
- `src/db/schema/notebooks.ts`
- `src/db/schema/sources.ts`
- `src/db/schema/conversations.ts`
- `src/db/schema/outputs.ts`

Adapt the query to match the actual column names.

### Step 2: Create stats hook

Create `src/hooks/use-stats.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

type Stats = {
  notebooks: number;
  sources: number;
  conversations: number;
  outputs: number;
};

export const useStats = (): ReturnType<typeof useQuery<Stats>> => {
  return useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    staleTime: 30_000,
  });
};
```

### Step 3: Wire stats to dashboard

In `src/app/(app)/dashboard/page.tsx`:

```typescript
import { useStats } from "@/hooks/use-stats";

// Inside the component:
const { data: stats } = useStats();

// In the stat card render, replace hardcoded values:
// i === 0 → stats?.notebooks ?? 0
// i === 1 → stats?.sources ?? 0
// i === 2 → stats?.conversations ?? 0
// i === 3 → stats?.outputs ?? 0
```

### Step 4: Improve greeting subtitle

Change from generic text to contextual date:

```tsx
<p className="text-sm mt-3" style={{ color: "var(--fm-text-tertiary)" }}>
  {notebookCount > 0
    ? `${notebookCount} notebook${notebookCount > 1 ? "s" : ""} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`
    : "Start by creating a notebook and adding sources."}
</p>
```

### Step 5: Fix the empty state button

The "New Notebook" button in the empty state uses a rainbow gradient. Change to solid orange:

```tsx
// Change from:
style={{ background: "linear-gradient(90deg, #ff6b35, #e11d48, #7c3aed, #2563eb)" }}

// To:
style={{ background: "var(--fm-accent-orange)" }}
```

### Step 6: Use notebook's own icon in cards

If prompt 03 has been applied and `resolveIcon` exists at `src/lib/icon-resolver.ts`, update the notebook card rendering:

```typescript
import { resolveIcon } from "@/lib/icon-resolver";

// Inside the notebook map, replace:
// const CardIcon = CARD_ICONS[i % CARD_ICONS.length];
// With:
const CardIcon = resolveIcon(notebook.icon ?? "BookOpen");
```

If the icon resolver doesn't exist yet, skip this step.

## Rules
- Read the actual DB schema files before writing the API route
- Use proper TypeScript types
- No backdrop-filter
- Run `pnpm build` at the end
