# Prompt 07 — Final Verification & Cleanup

> For Claude Code Max. Run in `/Users/go/Documents/FluxMind`. Read CLAUDE.md first.
> Run this LAST after all other prompts.

## What to Do

### Step 1: Build check
```bash
pnpm build
```
Fix ALL TypeScript errors. Do not skip any.

### Step 2: Lint check
```bash
pnpm lint
```
Fix ALL lint errors.

### Step 3: Performance audit

Search for remaining performance issues:

```bash
# Should only exist in: landing-page.tsx (auth card), dialog.tsx, sheet.tsx
grep -rn "backdropFilter" src/

# Should only exist in: landing-page.tsx (3 blobs ≤40px), not-found.tsx (40px)
grep -rn 'filter:.*blur' src/

# Should only exist in landing-page.tsx (3 aurora blobs)
grep -rn "willChange" src/

# Should be ZERO results
grep -rn "feTurbulence" src/
```

If any violations are found:
- Remove backdropFilter from any component that's NOT the landing auth card or the shadcn dialog/sheet overlays
- Reduce any blur > 40px to 40px
- Remove willChange from anything that's not an aurora blob

### Step 4: Design consistency audit

Search for components still using generic shadcn classes instead of the FluxMind token system:

```bash
grep -rn "border-border" src/ --include="*.tsx" | grep -v node_modules | grep -v ".next"
grep -rn "bg-card" src/ --include="*.tsx" | grep -v node_modules | grep -v ".next"
grep -rn "text-muted-foreground" src/ --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

Report which files still use these — don't change them in this prompt, just list them for a future pass.

### Step 5: Navigation test

Verify all sidebar links work:
- `/dashboard` → Dashboard view (no view param)
- `/dashboard?view=all` → All Notebooks
- `/dashboard?view=recent` → Recent
- `/dashboard?view=shared` → Shared with empty state
- `/dashboard?view=starred` → Starred with empty state
- `/settings` → Settings page with tabs
- `/pricing` → Pricing page

Check that the dev server starts without errors:
```bash
pnpm dev
```

### Step 6: Report

List:
1. Build status (pass/fail, any remaining warnings)
2. Lint status
3. Files with backdropFilter (should be ≤3)
4. Files with filter:blur (should be ≤4)
5. Files still using generic shadcn classes (for future cleanup)
6. Any broken imports or missing dependencies
