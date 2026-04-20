# FluxMind — Claude Code Max Prompts

Run these in order. Each prompt is a `.md` file — open it and paste the contents into Claude Code Max.

## Execution Order

| # | File | What it does | Time |
|---|------|-------------|------|
| 01 | `01-fix-sidebar-navigation.md` | Fixes dead sidebar links, adds view filtering | ~5 min |
| 02 | `02-fix-shadcn-dark-theme.md` | Fixes Dialog/Input/Button for dark theme | ~5 min |
| 03 | `03-redesign-create-notebook-dialog.md` | Replaces emojis with Lucide icons, premium modal | ~8 min |
| 04 | `04-studio-page-upgrade.md` | Premium glass cards for studio outputs | ~5 min |
| 05 | `05-settings-and-pricing.md` | Full settings page + pricing page | ~8 min |
| 06 | `06-dashboard-polish-and-stats.md` | Real stats API, better greeting, icon resolver | ~5 min |
| 07 | `07-final-verification.md` | Build, lint, performance audit, report | ~3 min |

## Dependencies

- **02 must run before 03** (base dialog theming before notebook dialog redesign)
- **01 must run before 06** (sidebar filtering before dashboard polish)
- **03 must run before 06** (icon resolver needed for dashboard icon update)
- All others are independent

## Design Research Sources

These prompts are informed by research on:
- Linear's sidebar redesign (dimmed nav, customizable, receding visual weight)
- Notion's sidebar (224px, 8px grid, grouped sections, subtle active states)
- Material Design 3 dark theme (surface elevation via luminance stepping, #121212 base)
- NotebookLM (minimal creation flow — name only, no modal clutter)
- Premium modal UX (structured blocks, clear hierarchy, minimal text)
