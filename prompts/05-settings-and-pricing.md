# Prompt 05 — Settings Page + Pricing Page

> For Claude Code Max. Run in `/Users/go/Documents/FluxMind`. Read CLAUDE.md first.

## Problem

- Settings page (`src/app/(app)/settings/page.tsx`) is a placeholder: `<div>Settings</div>`
- Pricing page (`src/app/(marketing)/pricing/page.tsx`) may also be incomplete
- Both need to match the FluxMind design system

## Research Context

**Linear's settings** uses a left sidebar with grouped categories (Account, Workspace, Members, etc.) and a content area on the right. Each section is its own panel. They recently redesigned their settings pages to be cleaner and more scannable.

**Notion's settings** uses a similar left-nav + content pattern, with the left nav divided into sections: Account, Workspace, Members, Plans, etc.

**Common pattern**: Settings pages in premium apps use a 2-column layout on desktop (sidebar + content), collapsing to a single column on mobile. The sidebar is typically 200-240px, uses icon + label for each item, and has subtle active state indication.

**Pricing page patterns**: Premium SaaS apps (Linear, Vercel, Supabase) use weight-contrast typography for headlines, a 3-plan grid, feature comparison with check icons, and one highlighted plan with accent border/background. Dark backgrounds with subtle borders between plans.

## Part A: Settings Page

Rewrite `src/app/(app)/settings/page.tsx` completely:

### Structure
- "use client" component
- 2-column grid: `grid-cols-1 lg:grid-cols-[220px_1fr]`
- Left nav with 5 tabs, content area shows the active tab's panel
- Entry animation: `motion.div` from motion/react with opacity 0→1, y 20→0

### Tabs (use useState for activeTab)
1. **Profile** (User icon, accent: `var(--fm-accent-orange)`)
2. **Appearance** (Palette icon, accent: `var(--fm-accent-violet)`)
3. **Notifications** (Bell icon, accent: `var(--fm-accent-blue)`)
4. **Billing** (CreditCard icon, accent: `var(--fm-accent-rose)`)
5. **Security** (Shield icon, accent: `var(--fm-accent-orange)`)

Tab button styling:
- Active: `background: var(--fm-surface-hover)`, icon in accent color, `font-weight: 500`
- Inactive: `background: transparent`, `color: var(--fm-text-secondary)`
- `border-radius: 12px`, `padding: 10px 12px`

### Tab Content (each inside GlassCard with `padding="lg"`)

**Profile**: Name input (pre-filled from session), Email input (disabled, grayed), "Save Changes" button (orange)

**Appearance**: Dark/Light mode toggle using `useFluxTheme()`. Two buttons side-by-side, active one has `2px solid var(--fm-accent-violet)` border.

**Notifications**: "Notification preferences coming soon." placeholder text

**Billing**: A card showing current plan:
```
Free Plan          [Active badge in green]
Open beta · All features included
```

**Security**: Sign out button styled in subtle red (`color-mix(in srgb, var(--fm-error) 10%, transparent)` background)

### Imports needed
- useState from react
- motion from motion/react
- GlassCard from @/components/shared/glass-card
- useSession, signOut from @/lib/auth-client
- useFluxTheme from @/components/shared/theme-provider
- useRouter from next/navigation
- Icons: User, Palette, Bell, CreditCard, Shield from lucide-react

## Part B: Pricing Page

Read `src/app/(marketing)/pricing/page.tsx`. If it's incomplete, rewrite it.

### Structure
- Matches the landing page visual style: `background: #08080c`
- Same nav as landing (logo + FluxMind text)
- Weight-contrast headline: `"Simple pricing,"` (700) + `"powerful tools."` (300, opacity 0.25)
- Subtitle in `rgba(255,255,255,0.4)`

### 3-plan grid

**Free** ($0/forever):
- Features: 3 notebooks, 50 sources, All AI models, All studio outputs, RAG chat
- Card: `background: rgba(12,12,18,0.88)`, `border: 1px solid rgba(255,255,255,0.05)`
- CTA: "Get Started" — outline style, links to `/`

**Pro** ($15/month — highlighted):
- Features: Unlimited notebooks, 500 sources, Priority processing, API access, Custom branding, Advanced analytics
- Card: `background: rgba(124,58,237,0.08)`, `border: 1px solid rgba(124,58,237,0.2)`, 2px violet accent line on top
- CTA: "Upgrade to Pro" — solid violet background

**Team** ($12/user/month):
- Features: Everything in Pro + Real-time collab, Shared notebooks, Admin dashboard, SSO, Priority support
- Card: same as Free
- CTA: "Contact Sales" — outline style

### Shared styling
- Price: `fontSize: 40`, `fontWeight: 700`, `letterSpacing: -0.03em`
- Features: Check icon from lucide in each plan's accent color (orange, violet, blue)
- Card padding: 32px, border-radius: 16px

## Rules
- Both pages must be default exports
- Use var(--fm-*) tokens in the settings page
- The pricing page can hardcode dark colors since it's marketing (not affected by theme toggle)
- No backdrop-filter
- Run `pnpm build` at the end
