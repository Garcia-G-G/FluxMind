# FluxMind V3 Premium Design Upgrade

> Instrucciones para Claude Code Max. Ejecutar en orden de secciones.
> Proyecto: `/Users/go/Documents/FluxMind` (Next.js 15, Tailwind v4, shadcn/ui)

---

## CONTEXTO

FluxMind es una plataforma de knowledge intelligence (como NotebookLM pero más potente). La landing page ya tiene el diseño premium con 3 blobs animados + mouse tracking + tipografía weight-contrast. Ahora necesitamos llevar ese nivel de calidad visual al resto de la app: dashboard, studio, chat, settings.

**Filosofía de diseño — "One Aurora":**
- Tipografía hace el 80% del trabajo (tamaños grandes, contraste de peso)
- Color en máximo 3 elementos por vista
- Fondo semi-opaco (`rgba(12,12,18,0.85)`) en vez de `backdrop-filter`
- Animaciones sutiles: solo `opacity`, `transform`, `background-position`
- Máximo 3 GPU layers, 3 CSS animations, 0 SVG filters

**Reglas de rendimiento (NO ROMPER):**
- CERO `backdrop-filter` en cards o superficies grandes
- CERO `filter: blur()` mayor a 40px
- CERO `setState` dentro de `mousemove` o `requestAnimationFrame`
- Máximo 3 `will-change` en pantalla al mismo tiempo
- El `GlassCard` component ya está optimizado (usa `background` sólido, no blur)
- Los icon components (`OrbitalIcon`, `BreathingIcon`, `RotatingBorderIcon`) ya son tiles estáticos

**Token system** — usar siempre variables CSS, NUNCA hardcodear colores:
- `var(--fm-bg)` para fondo principal
- `var(--fm-surface)` para cards
- `var(--fm-glass-bg)` para superficies con transparencia (ya es `rgba(12,12,18,0.85)`, NO usa blur)
- `var(--fm-glass-border)` para bordes sutiles
- `var(--fm-text)`, `var(--fm-text-secondary)`, `var(--fm-text-tertiary)` para texto
- `var(--fm-accent-orange)` (#ff6b35), `var(--fm-accent-rose)` (#e11d48), `var(--fm-accent-violet)` (#7c3aed), `var(--fm-accent-blue)` (#2563eb)
- `var(--fm-accent-gradient)` para gradientes
- `var(--fm-surface-border)` para bordes de cards

---

## SECCIÓN 1 — Dashboard (`src/app/(app)/dashboard/page.tsx`)

El dashboard ya tiene una buena base pero necesita refinamiento visual para verse premium.

### 1.1 Greeting section
El h1 con shimmer gradient está bien. Cambiar el subtítulo para que sea más contextual:

```tsx
// Cambiar esto:
<p className="text-base mt-3" style={{ color: "var(--fm-text-secondary)" }}>
  Your knowledge base is growing. {notebookCount > 0 ? `${notebookCount} notebooks updated today.` : "Create your first notebook to get started."}
</p>

// Por esto:
<p className="text-base mt-3" style={{ color: "var(--fm-text-tertiary)" }}>
  {notebookCount > 0
    ? `${notebookCount} notebook${notebookCount > 1 ? "s" : ""} · ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`
    : "Start by creating a notebook and adding sources."}
</p>
```

### 1.2 Stats cards — agregar API real de conteos

Crear un endpoint para obtener stats reales. Archivo: `src/app/api/stats/route.ts`

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
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [notebookCount] = await db.select({ count: count() }).from(notebooks).where(eq(notebooks.userId, userId));
  const [sourceCount] = await db.select({ count: count() }).from(sources).where(eq(sources.userId, userId));
  const [conversationCount] = await db.select({ count: count() }).from(conversations).where(eq(conversations.userId, userId));
  const [outputCount] = await db.select({ count: count() }).from(outputs).where(eq(outputs.userId, userId));

  return NextResponse.json({
    notebooks: notebookCount?.count ?? 0,
    sources: sourceCount?.count ?? 0,
    conversations: conversationCount?.count ?? 0,
    outputs: outputCount?.count ?? 0,
  });
};
```

Crear hook: `src/hooks/use-stats.ts`

```typescript
import { useQuery } from "@tanstack/react-query";

type Stats = {
  notebooks: number;
  sources: number;
  conversations: number;
  outputs: number;
};

export const useStats = () => {
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

En el dashboard, usar el hook:

```tsx
const { data: stats } = useStats();

// En el render de stats, reemplazar los "0" hardcodeados:
{i === 0 ? stats?.notebooks ?? 0 : i === 1 ? stats?.sources ?? 0 : i === 2 ? stats?.conversations ?? 0 : stats?.outputs ?? 0}
```

### 1.3 Notebook cards — mejorar empty state

El empty state actual tiene un botón con gradiente de 4 colores que se ve "AI generated". Simplificar:

```tsx
// Cambiar el botón de:
style={{ background: "linear-gradient(90deg, #ff6b35, #e11d48, #7c3aed, #2563eb)" }}

// A:
style={{ background: "var(--fm-accent-orange)" }}
```

### 1.4 Agregar quick actions debajo de stats

Después de la stats grid y antes de "Your Notebooks", agregar una sección de acciones rápidas:

```tsx
{/* Quick Actions */}
<div className="flex items-center gap-3 mb-8">
  <button
    onClick={() => setCreateOpen(true)}
    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:-translate-y-0.5"
    style={{ background: "var(--fm-accent-orange)" }}
  >
    <Plus className="h-4 w-4" />
    New Notebook
  </button>
  <button
    className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl transition-colors"
    style={{
      background: "var(--fm-surface)",
      border: "1px solid var(--fm-surface-border)",
      color: "var(--fm-text-secondary)",
    }}
  >
    <Upload className="h-4 w-4" />
    Upload Sources
  </button>
</div>
```

(Importar `Upload` de lucide-react)

---

## SECCIÓN 2 — Studio Page (`src/app/(app)/notebook/[id]/studio/page.tsx`)

El studio usa cards básicos de shadcn (`border border-border bg-card`). Necesita el tratamiento premium con el token system de FluxMind.

### 2.1 Reemplazar el StudioCard interno

El componente `StudioCard` interno usa classes de shadcn sin los tokens de FluxMind. Reescribir:

```tsx
const StudioCard = ({
  icon: Icon,
  title,
  description,
  onGenerate,
  isPending,
  error,
  hasData,
  tab,
  accent = "var(--fm-accent-orange)",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onGenerate: () => void;
  isPending: boolean;
  error: Error | null;
  hasData: boolean;
  tab: StudioTab;
  accent?: string;
}): React.ReactNode => (
  <div
    className="relative overflow-hidden rounded-2xl p-5 transition-transform duration-300 hover:-translate-y-1 fm-lift-card"
    style={{
      background: "var(--fm-glass-bg)",
      border: "1px solid var(--fm-glass-border)",
      boxShadow: "var(--fm-card-shadow)",
    }}
  >
    {/* Top accent line */}
    <div
      className="absolute top-0 left-0 right-0 h-[2px]"
      style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
    />

    <div className="flex items-center gap-3 mb-3">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center"
        style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}
      >
        <Icon className="h-5 w-5" style={{ color: accent }} />
      </div>
      <div>
        <h3 className="font-semibold text-sm" style={{ color: "var(--fm-text)" }}>
          {title}
        </h3>
        <p className="text-xs" style={{ color: "var(--fm-text-tertiary)" }}>
          {description}
        </p>
      </div>
    </div>

    <div className="flex gap-2 mt-4">
      <button
        onClick={onGenerate}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all hover:-translate-y-0.5 disabled:opacity-50"
        style={{ background: accent }}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" />
        )}
        Generate
      </button>
      {hasData && (
        <button
          onClick={() => setActiveTab(tab)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
          style={{
            background: "var(--fm-surface)",
            border: "1px solid var(--fm-surface-border)",
            color: "var(--fm-text-secondary)",
          }}
        >
          View
        </button>
      )}
    </div>
    {error && (
      <p className="text-xs mt-2" style={{ color: "var(--fm-error)" }}>
        {error.message}
      </p>
    )}
  </div>
);
```

### 2.2 Agregar accent colors por tipo de output

Pasar colores de acento a cada card para crear variedad visual:

```tsx
// Study section
<StudioCard icon={HelpCircle} title="Quiz" accent="var(--fm-accent-violet)" ...
<StudioCard icon={Layers} title="Flashcards" accent="var(--fm-accent-blue)" ...
<StudioCard icon={GraduationCap} title="Mini-Course" accent="var(--fm-accent-rose)" ...

// Visual section
<StudioCard icon={Presentation} title="Slide Deck" accent="var(--fm-accent-orange)" ...
<StudioCard icon={Image} title="Infographic" accent="var(--fm-accent-rose)" ...
<StudioCard icon={Table} title="Data Tables" accent="var(--fm-accent-blue)" ...
<StudioCard icon={Network} title="Mind Map" accent="var(--fm-accent-violet)" ...
<StudioCard icon={Film} title="Video Overview" accent="var(--fm-accent-orange)" ...

// Content section
<StudioCard icon={MessageCircle} title="X Thread" accent="var(--fm-accent-blue)" ...
<StudioCard icon={Mail} title="Newsletter" accent="var(--fm-accent-violet)" ...
<StudioCard icon={Video} title="Reel Script" accent="var(--fm-accent-rose)" ...
```

### 2.3 Estilizar los section headers

```tsx
// Cambiar de:
<h3 className="text-sm font-medium text-muted-foreground mb-2">Study</h3>

// A:
<div className="flex items-center gap-2 mb-3">
  <div style={{ width: 24, height: 1, background: "var(--fm-accent-violet)" }} />
  <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--fm-text-tertiary)" }}>
    Study
  </h3>
</div>
```

Hacer lo mismo para "Visual" (con `--fm-accent-orange`) y "Content" (con `--fm-accent-blue`).

### 2.4 Estilizar el page header

```tsx
// Cambiar de:
<h2 className="text-xl font-semibold mb-1">Studio</h2>
<p className="text-sm text-muted-foreground mb-6">
  Generate study materials, presentations, and content from your sources
</p>

// A:
<h2
  className="font-display text-3xl font-normal tracking-tight"
  style={{ color: "var(--fm-text)" }}
>
  Studio
</h2>
<p className="text-sm mt-2 mb-8" style={{ color: "var(--fm-text-tertiary)" }}>
  Generate study materials, presentations, and content from your sources.
</p>
```

### 2.5 Estilizar el Deep Research card al final

```tsx
// Cambiar de:
<div className="rounded-lg border border-border bg-card p-4">

// A:
<div
  className="rounded-2xl p-5 mt-2"
  style={{
    background: "var(--fm-glass-bg)",
    border: "1px solid var(--fm-glass-border)",
    boxShadow: "var(--fm-card-shadow)",
  }}
>
```

Y cambiar el botón de Start Research al mismo estilo premium.

---

## SECCIÓN 3 — Settings Page (`src/app/(app)/settings/page.tsx`)

La settings page es un placeholder vacío. Construir una página completa.

### 3.1 Crear la página de settings

```tsx
"use client";

import { useState } from "react";
import { User, CreditCard, Bell, Palette, Shield, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { GlassCard } from "@/components/shared/glass-card";
import { useSession, signOut } from "@/lib/auth-client";
import { useFluxTheme } from "@/components/shared/theme-provider";
import { useRouter } from "next/navigation";

type SettingsTab = "profile" | "appearance" | "notifications" | "billing" | "security";

const tabs = [
  { id: "profile" as const, icon: User, label: "Profile", color: "var(--fm-accent-orange)" },
  { id: "appearance" as const, icon: Palette, label: "Appearance", color: "var(--fm-accent-violet)" },
  { id: "notifications" as const, icon: Bell, label: "Notifications", color: "var(--fm-accent-blue)" },
  { id: "billing" as const, icon: CreditCard, label: "Billing", color: "var(--fm-accent-rose)" },
  { id: "security" as const, icon: Shield, label: "Security", color: "var(--fm-accent-orange)" },
];

const SettingsPage = (): React.ReactNode => {
  const { data: session } = useSession();
  const { mode, setMode } = useFluxTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const handleSignOut = async (): Promise<void> => {
    await signOut({ fetchOptions: { onSuccess: () => { router.push("/"); router.refresh(); } } });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1
          className="font-display text-3xl font-normal tracking-tight mb-1"
          style={{ color: "var(--fm-text)" }}
        >
          Settings
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--fm-text-tertiary)" }}>
          Manage your account and preferences.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar nav */}
        <nav className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left"
              style={{
                background: activeTab === tab.id ? "var(--fm-surface-hover)" : "transparent",
                color: activeTab === tab.id ? "var(--fm-text)" : "var(--fm-text-secondary)",
                fontWeight: activeTab === tab.id ? 500 : 400,
              }}
            >
              <tab.icon className="h-4 w-4" style={{ color: activeTab === tab.id ? tab.color : undefined }} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div>
          {activeTab === "profile" && (
            <GlassCard padding="lg">
              <h2 className="text-lg font-medium mb-6" style={{ color: "var(--fm-text)" }}>
                Profile
              </h2>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fm-text-tertiary)" }}>
                    Name
                  </label>
                  <input
                    type="text"
                    defaultValue={session?.user?.name ?? ""}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                    style={{
                      background: "var(--fm-input-bg)",
                      border: "1px solid var(--fm-input-border)",
                      color: "var(--fm-text)",
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fm-text-tertiary)" }}>
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={session?.user?.email ?? ""}
                    disabled
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none opacity-60"
                    style={{
                      background: "var(--fm-input-bg)",
                      border: "1px solid var(--fm-input-border)",
                      color: "var(--fm-text)",
                    }}
                  />
                </div>
                <button
                  className="px-4 py-2 text-sm font-medium text-white rounded-xl transition-all hover:-translate-y-0.5"
                  style={{ background: "var(--fm-accent-orange)" }}
                >
                  Save Changes
                </button>
              </div>
            </GlassCard>
          )}

          {activeTab === "appearance" && (
            <GlassCard padding="lg">
              <h2 className="text-lg font-medium mb-6" style={{ color: "var(--fm-text)" }}>
                Appearance
              </h2>
              <div className="space-y-4">
                <p className="text-sm" style={{ color: "var(--fm-text-secondary)" }}>
                  Choose your preferred theme.
                </p>
                <div className="flex gap-3">
                  {(["dark", "light"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="flex-1 p-4 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: mode === m ? "var(--fm-surface-hover)" : "var(--fm-surface)",
                        border: mode === m ? "2px solid var(--fm-accent-violet)" : "1px solid var(--fm-surface-border)",
                        color: "var(--fm-text)",
                      }}
                    >
                      {m === "dark" ? "Dark" : "Light"}
                    </button>
                  ))}
                </div>
              </div>
            </GlassCard>
          )}

          {activeTab === "notifications" && (
            <GlassCard padding="lg">
              <h2 className="text-lg font-medium mb-6" style={{ color: "var(--fm-text)" }}>
                Notifications
              </h2>
              <p className="text-sm" style={{ color: "var(--fm-text-tertiary)" }}>
                Notification preferences coming soon.
              </p>
            </GlassCard>
          )}

          {activeTab === "billing" && (
            <GlassCard padding="lg">
              <h2 className="text-lg font-medium mb-6" style={{ color: "var(--fm-text)" }}>
                Billing
              </h2>
              <div
                className="p-4 rounded-xl mb-4"
                style={{
                  background: "var(--fm-surface)",
                  border: "1px solid var(--fm-surface-border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--fm-text)" }}>Free Plan</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--fm-text-tertiary)" }}>
                      Open beta · All features included
                    </p>
                  </div>
                  <span
                    className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{ background: "color-mix(in srgb, var(--fm-success) 15%, transparent)", color: "var(--fm-success)" }}
                  >
                    Active
                  </span>
                </div>
              </div>
            </GlassCard>
          )}

          {activeTab === "security" && (
            <GlassCard padding="lg">
              <h2 className="text-lg font-medium mb-6" style={{ color: "var(--fm-text)" }}>
                Security
              </h2>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl transition-colors"
                style={{
                  background: "color-mix(in srgb, var(--fm-error) 10%, transparent)",
                  color: "var(--fm-error)",
                  border: "1px solid color-mix(in srgb, var(--fm-error) 20%, transparent)",
                }}
              >
                Sign out
              </button>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
```

---

## SECCIÓN 4 — Pricing Page (`src/app/(marketing)/pricing/page.tsx`)

Lee el archivo actual de pricing. Si es un placeholder, reemplazar con una página premium que siga el mismo estilo de la landing (fondo `#08080c`, tipografía weight-contrast, pills):

```tsx
"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals getting started",
    features: [
      "3 notebooks",
      "50 sources per notebook",
      "All AI models",
      "All studio outputs",
      "RAG chat with citations",
    ],
    cta: "Get Started",
    accent: "var(--fm-accent-orange)",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$15",
    period: "/month",
    description: "For power users and researchers",
    features: [
      "Unlimited notebooks",
      "500 sources per notebook",
      "Priority AI processing",
      "API access",
      "Custom branding on shares",
      "Advanced analytics",
    ],
    cta: "Upgrade to Pro",
    accent: "var(--fm-accent-violet)",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$12",
    period: "/user/month",
    description: "For teams collaborating on research",
    features: [
      "Everything in Pro",
      "Real-time collaboration",
      "Shared notebooks",
      "Admin dashboard",
      "SSO integration",
      "Priority support",
    ],
    cta: "Contact Sales",
    accent: "var(--fm-accent-blue)",
    highlighted: false,
  },
];

const PricingPage = (): ReactNode => {
  return (
    <div className="min-h-screen" style={{ background: "#08080c" }}>
      <nav className="flex items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center" style={{ gap: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              background: "#ff6b35",
              borderRadius: 7,
              color: "white",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            F
          </span>
          <span style={{ fontSize: 15, fontWeight: 500, color: "white" }}>
            FluxMind
          </span>
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-8 py-16">
        <div className="text-center mb-16">
          <h1
            style={{
              fontSize: 48,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: "white",
            }}
          >
            Simple pricing,{" "}
            <span style={{ fontWeight: 300, color: "rgba(255,255,255,0.25)" }}>
              powerful tools.
            </span>
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.4)",
              marginTop: 16,
              fontWeight: 380,
            }}
          >
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-2xl p-6 relative"
              style={{
                background: plan.highlighted
                  ? "rgba(124,58,237,0.08)"
                  : "rgba(12,12,18,0.88)",
                border: plan.highlighted
                  ? "1px solid rgba(124,58,237,0.2)"
                  : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {plan.highlighted && (
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: "linear-gradient(90deg, var(--fm-accent-violet), transparent)" }}
                />
              )}
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: 8,
                }}
              >
                {plan.name}
              </h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 40, fontWeight: 700, color: "white", letterSpacing: "-0.03em" }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>
                  {plan.period}
                </span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>
                {plan.description}
              </p>

              <ul className="space-y-2.5 mb-8">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    <Check className="h-4 w-4 shrink-0" style={{ color: plan.accent }} />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/"
                className="block text-center py-2.5 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
                style={{
                  background: plan.highlighted ? plan.accent : "transparent",
                  border: plan.highlighted ? "none" : "1px solid rgba(255,255,255,0.08)",
                  color: plan.highlighted ? "white" : "rgba(255,255,255,0.6)",
                }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
```

---

## SECCIÓN 5 — Sidebar polish (`src/components/layout/sidebar.tsx`)

### 5.1 Header del sidebar — agregar settings link

Al final del sidebar (antes del cierre de `</aside>`), después de la sección "Recent Notebooks", agregar un link a settings:

```tsx
{/* Settings link at bottom */}
<div className="px-3 pb-3 mt-auto">
  <Link
    href="/settings"
    className="flex items-center gap-3 px-2.5 py-2 text-sm transition-colors"
    style={{
      borderRadius: 10,
      color: "var(--fm-text-tertiary)",
    }}
  >
    <Settings className="h-[18px] w-[18px] shrink-0" />
    {!collapsed && <span>Settings</span>}
  </Link>
</div>
```

(Importar `Settings` de lucide-react)

---

## SECCIÓN 6 — Verificación final

Después de implementar todas las secciones:

1. **`pnpm build`** — debe compilar sin errores de TypeScript
2. **`pnpm lint`** — debe pasar sin errores
3. **Buscar `backdropFilter`** en src/ — solo debe existir en `landing-page.tsx` (auth card), `dialog.tsx`, y `sheet.tsx`
4. **Buscar `filter:.*blur`** en src/ — solo landing blobs (40px, 40px, 30px) y not-found (40px)
5. **Navegar visualmente**: landing → dashboard → notebook → studio → settings. Cada vista debe sentirse coherente con el mismo language visual: cards con `--fm-glass-bg`, tipografía con peso variable, accent colors consistentes
6. **Verificar light mode** — cambiar el theme toggle y confirmar que todos los tokens se aplican correctamente

---

## RESUMEN DE ARCHIVOS A MODIFICAR

| Archivo | Cambio |
|---------|--------|
| `src/app/(app)/dashboard/page.tsx` | Subtítulo contextual, stats con datos reales, botón simple, quick actions |
| `src/app/api/stats/route.ts` | **NUEVO** — endpoint de conteos |
| `src/hooks/use-stats.ts` | **NUEVO** — hook para stats |
| `src/app/(app)/notebook/[id]/studio/page.tsx` | StudioCard premium, section headers, accent colors |
| `src/app/(app)/settings/page.tsx` | **REESCRIBIR** — settings completa con tabs |
| `src/app/(marketing)/pricing/page.tsx` | **REESCRIBIR** si es placeholder — pricing premium |
| `src/components/layout/sidebar.tsx` | Settings link al fondo |
