# FluxMind — Documento Completo de Handoff para Siguiente Sesión

## Qué es FluxMind
FluxMind es un competidor de NotebookLM (Google). Es una plataforma de inteligencia de conocimiento donde el usuario sube fuentes (PDFs, URLs, texto, YouTube) y puede chatear con AI sobre ellas, generar quizzes, flashcards, presentaciones, infografías, threads de X, newsletters, etc. desde el Studio.

## Stack Técnico
- Next.js 15+ (App Router, RSC, Server Actions, TypeScript strict)
- Tailwind CSS v4 + shadcn/ui
- Drizzle ORM + PostgreSQL 16 + pgvector
- Vercel AI SDK v5 (@ai-sdk/google, @ai-sdk/anthropic, @ai-sdk/openai)
- Redis 7 / BullMQ
- Better Auth (email/password + Google OAuth + GitHub OAuth)
- tldraw SDK para canvas infinito
- ElevenLabs para TTS/podcasts
- Fal.ai para imagen/video
- Cloudflare R2 para storage
- Stripe para pagos
- pnpm como package manager
- El dev server corre en localhost:4500

## Estado Actual del Proyecto
La app funciona — autenticación, notebooks, sources, chat con GPT-4o, studio genera outputs. El problema es que el DISEÑO y la EXPERIENCIA son malos y el RENDIMIENTO es pésimo.

## Diseño Original (v3 Liquid Mockup)
Existe un archivo de mockup JSX de 1429 líneas que el usuario creó como referencia visual. El diseño tiene: blobs animados de fondo, glass cards con backdrop-blur, iconos con glow orbital/breathing, gradient shimmer en textos, mesh grid, god rays, partículas, etc. Se intentó implementar pero causó problemas de rendimiento graves. Actualmente se simplificó a versiones estáticas (sin animación) de los iconos y fondo.

El usuario NO está contento con el diseño actual. Dice que "no tiene nada que ver con lo planeado" y las cards son "super AI design" (genéricas).

---

## PROBLEMAS A RESOLVER (por prioridad del usuario)

### 1. UNIFICAR LOS 3 INPUTS DE SOURCES EN 1 SOLO
**Ubicación:** `src/components/notebook/source-panel.tsx`

Actualmente hay 3 componentes separados para agregar sources:
- `FileUploader` (`src/components/upload/file-uploader.tsx`) — drag-and-drop para archivos
- `UrlInput` (`src/components/upload/url-input.tsx`) — input para URLs/YouTube/búsquedas AI
- `ContextInput` (`src/components/upload/context-input.tsx`) — textarea colapsable para pegar texto

El usuario quiere UN SOLO input unificado tipo NotebookLM: un textarea grande donde puedas:
- Pegar una URL → se detecta automáticamente y se procesa
- Pegar texto largo → se detecta como texto y se agrega como source
- Arrastrar archivos → se suben
- Escribir una búsqueda como "como se hace arroz" → AI investiga y crea un source

La lógica de detección ya existe en `url-input.tsx` (función `looksLikeUrl()`). Los endpoints API ya existen:
- `POST /api/sources/upload` — archivos
- `POST /api/sources/url` — URLs y YouTube
- `POST /api/sources/text` — texto plano
- `POST /api/sources/search` — búsquedas AI (usa generateText con gpt-4o)

Solo hay que unificar la UI en un solo componente limpio.

### 2. RENDIMIENTO — CAMBIOS DE ARQUITECTURA NECESARIOS

**Problemas identificados:**

a) **next-themes redundante** — En `src/components/providers.tsx` se cargan DOS theme providers: `ThemeProvider` de next-themes Y `FluxThemeProvider` custom. El custom ya funciona solo con CSS (`src/styles/theme-tokens.css` + `data-theme` attribute). Eliminar next-themes ahorra ~15KB.

```
// src/components/providers.tsx — ACTUAL (malo):
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <FluxThemeProvider>{children}</FluxThemeProvider>
</ThemeProvider>

// DEBERÍA SER:
<FluxThemeProvider>{children}</FluxThemeProvider>
```

b) **CommandPalette siempre montado** — En `src/components/layout/app-shell.tsx`, CommandPalette se importa estáticamente. Debería ser `dynamic()` con `ssr: false` porque solo se usa con Cmd+K.

c) **11 archivos aún usan motion/react** — Se redujo de 24 a 11 pero aún quedan. Los 8 en `src/components/studio/` (quiz-view, flashcard-view, course-view, slide-viewer, deep-research, interactive-mode, reel-script-view, thread-preview) + onboarding-wizard, audio-player, live-cursor. Idealmente reemplazar motion por CSS transitions/animations.

d) **Diálogos cargados eagerly en dashboard** — CreateNotebookDialog, EditNotebookDialog, DeleteNotebookDialog se importan estáticamente en `src/app/(app)/dashboard/page.tsx`. Hacerlos `dynamic()`.

e) **80 archivos con "use client"** — Muchos podrían ser Server Components.

f) **AnimatedBackground** en `src/components/shared/animated-background.tsx` se carga en CADA página via AppShell — evaluar si realmente se necesita.

**Archivos clave de rendimiento:**
- `src/components/providers.tsx` — quitar next-themes
- `src/components/layout/app-shell.tsx` — lazy load CommandPalette
- `src/components/shared/theme-provider.tsx` — ya está optimizado (CSS-only)
- `src/styles/theme-tokens.css` — tokens CSS, ya optimizado
- `src/styles/animations.css` — animaciones CSS ligeras, ya optimizado

### 3. REDISEÑAR LAS STUDIO CARDS
**Ubicación:** `src/app/(app)/notebook/[id]/studio/page.tsx` (líneas 195-318)

El componente `StudioCard` actual tiene:
- Glass background con glass border
- Top accent gradient de 2px
- Corner glow en hover (top-left y bottom-right con radial-gradient)
- `RotatingBorderIcon` para los iconos
- Botón "Generate" con color accent
- Botón "View Output" secundario

El usuario dice que son "super super AI design" (se ven genéricas, como generadas por AI). Necesitan un rediseño más limpio y profesional. Referencia: estilo Notion/Linear — minimal, funcional, sin tantos efectos glow/gradient.

También el `RotatingBorderIcon` (`src/components/shared/rotating-border-icon.tsx`) es demasiado recargado con su borde coloreado, radial gradient inner glow, y drop-shadow. Simplificar.

Lo mismo aplica para `OrbitalIcon` (`src/components/shared/orbital-icon.tsx`) y `BreathingIcon` (`src/components/shared/breathing-icon.tsx`).

### 4. ARREGLAR MOBILE SIDEBAR
**Ubicación:** `src/components/layout/mobile-sidebar.tsx`

Los navItems actuales son:
```typescript
const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/dashboard", icon: BookOpen, label: "All Notebooks" },  // ← MISMO href que Dashboard
  { href: "/dashboard", icon: Compass, label: "Explore" },          // ← MISMO href, no existe Explore
  { href: "/settings", icon: Settings, label: "Settings" },
];
```

Debería ser igual que el desktop sidebar (`src/components/layout/sidebar.tsx`):
```typescript
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard?view=all", label: "All Notebooks" },
  { href: "/dashboard?view=recent", label: "Recent" },
  { href: "/dashboard?view=shared", label: "Shared with Me" },
  { href: "/dashboard?view=starred", label: "Starred" },
];
```

El desktop sidebar SÍ funciona correctamente. Solo el mobile está roto.

### 5. AVATAR/PERFIL NO FUNCIONA
**Ubicación:** `src/components/layout/header.tsx` (líneas 102-112)

El avatar en el header es solo un div visual — no tiene onClick, no hay dropdown, no hay link. Necesita:
- Un dropdown menu al hacer click con: "Profile", "Settings", "Sign Out"
- O al menos linkearlo a `/settings`

La campanita de notificaciones (líneas 70-80) tampoco hace nada — agregar al menos un placeholder.

### 6. ICONOS FEOS
Los 3 componentes de iconos custom son demasiado complicados:

- `RotatingBorderIcon` (`src/components/shared/rotating-border-icon.tsx`) — 74 líneas, múltiples divs anidados, radial-gradient, drop-shadow, box-shadow, border coloreado
- `BreathingIcon` (`src/components/shared/breathing-icon.tsx`) — 74 líneas, mismo patrón
- `OrbitalIcon` (`src/components/shared/orbital-icon.tsx`) — 85 líneas, anillo exterior extra

Todos usan inline styles con hex+alpha concatenation (`${accent}0a`, `${accent}30`), lo cual es frágil y feo. Simplificarlos drásticamente — un icono con un sutil color de fondo y ya.

---

## ESTRUCTURA DE ARCHIVOS CLAVE

```
src/
├── app/
│   ├── (app)/                    # Rutas autenticadas
│   │   ├── layout.tsx            # Server Component, auth check, wraps AppShell
│   │   ├── dashboard/page.tsx    # Dashboard principal
│   │   ├── notebook/[id]/
│   │   │   ├── layout.tsx        # Notebook layout con tabs (Chat/Studio/Canvas) y source panel
│   │   │   ├── page.tsx          # Redirect a chat
│   │   │   ├── studio/page.tsx   # Studio con todas las cards
│   │   │   └── canvas/page.tsx   # tldraw canvas
│   │   └── settings/page.tsx     # Settings
│   ├── api/
│   │   ├── chat/route.ts         # Chat streaming con GPT-4o
│   │   ├── sources/
│   │   │   ├── upload/route.ts   # File upload
│   │   │   ├── url/route.ts      # URL processing
│   │   │   ├── text/route.ts     # Text source
│   │   │   └── search/route.ts   # AI search/research
│   │   └── studio/               # Todos los endpoints de generación
│   ├── layout.tsx                # Root layout (fonts, CSS imports)
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx         # Shell: Sidebar + Header + AnimatedBg + CommandPalette
│   │   ├── sidebar.tsx           # Desktop sidebar (funciona bien)
│   │   ├── mobile-sidebar.tsx    # Mobile sidebar (ROTO - links muertos)
│   │   ├── header.tsx            # Header con search, bell, theme toggle, avatar
│   │   └── command-palette.tsx   # Cmd+K palette
│   ├── shared/
│   │   ├── theme-provider.tsx    # CSS-only theme (data-theme toggle)
│   │   ├── animated-background.tsx # Static blobs/mesh (perf OK pero innecesario?)
│   │   ├── glass-card.tsx        # GlassCard component
│   │   ├── orbital-icon.tsx      # Icono con anillo (dashboard stats)
│   │   ├── breathing-icon.tsx    # Icono con glow (notebook cards)
│   │   ├── rotating-border-icon.tsx # Icono con borde (studio cards)
│   │   └── flux-logo.tsx         # Logo SVG
│   ├── upload/
│   │   ├── file-uploader.tsx     # Drag-and-drop file upload
│   │   ├── url-input.tsx         # URL/YouTube/search input
│   │   └── context-input.tsx     # Textarea para pegar texto
│   ├── notebook/
│   │   ├── source-panel.tsx      # Panel lateral de sources (contiene los 3 inputs)
│   │   ├── create-notebook-dialog.tsx
│   │   ├── edit-notebook-dialog.tsx
│   │   └── delete-notebook-dialog.tsx
│   ├── chat/
│   │   ├── chat-panel.tsx        # Panel de chat principal
│   │   ├── chat-message.tsx      # Mensaje individual (ya sin motion)
│   │   └── suggested-questions.tsx # Preguntas sugeridas (ya sin motion)
│   ├── studio/                   # Todos los viewers de outputs (8 archivos con motion)
│   └── auth/                     # Login/Register forms
├── styles/
│   ├── theme-tokens.css          # CSS custom properties para dark/light
│   └── animations.css            # Keyframes y utility classes (fm-fade-in, fm-stagger-item, etc.)
├── hooks/                        # React Query hooks
├── lib/
│   ├── ai/models.ts              # Config de modelos AI (GPT-4o default)
│   └── auth-client.ts            # Better Auth client
└── db/                           # Drizzle schema y queries
```

## RUTAS QUE EXISTEN
- `/` — Landing page
- `/login`, `/register` — Auth
- `/pricing` — Pricing
- `/dashboard` — Dashboard (con `?view=all|recent|shared|starred`)
- `/notebook/[id]` — Notebook (redirect a chat)
- `/notebook/[id]/studio` — Studio
- `/notebook/[id]/canvas` — Canvas
- `/settings` — Settings
- `/settings/billing` — Billing

## ENV VARS IMPORTANTES
- `OPENAI_API_KEY` — Configurado y funcionando (sk-proj-nzSNR2...)
- NO hay `GOOGLE_GENERATIVE_AI_API_KEY` — por eso el modelo default se cambió a gpt-4o
- `MOCK_EMBEDDINGS=false` — embeddings reales con OpenAI

## CONTEXTO DE RENDIMIENTO — LO QUE YA SE HIZO
1. ✅ Theme provider reescrito → CSS-only (data-theme attribute, 0 setProperty calls)
2. ✅ theme-tokens.css creado con :root y [data-theme="light"]
3. ✅ motion/react eliminado de: dashboard, sidebar, header, source-panel, context-input, file-uploader, suggested-questions, chat-message, settings, error, not-found, login-form, register-form (24 → 11 archivos)
4. ✅ CSS animations creadas: fm-fade-in, fm-stagger-item (reemplaza motion variants)
5. ✅ AnimatedBackground simplificado a radial-gradients estáticos (sin filter:blur, sin animación)
6. ✅ Iconos (Orbital/Breathing/Rotating) simplificados a versiones estáticas sin animación continua
7. ❌ next-themes aún cargado en providers.tsx (redundante)
8. ❌ CommandPalette aún cargado eagerly
9. ❌ 11 archivos aún con motion/react (studio + onboarding + audio + canvas)
10. ❌ Diálogos del dashboard no son lazy

## LO QUE EL USUARIO QUIERE (en sus palabras)
- "dejemos una donde el usuario pueda poner todo lo que el guste" (1 solo input unificado)
- "el diseno no me gusta, no tiene nada que ver con lo que habiamos planeado" (rediseño completo)
- "el rendimiento me sigue pareciendo muy nefasto" (performance = prioridad máxima)
- "investiga y encuentra la manera de mejorar el rendimiento incluso con el diseno que habiamos planeado"
- "cambies el diseno de las cards (estan super super ai desing)" (studio cards genéricas)
- "muchos botones no funcionan como la mayoria del side bar izquierdo" (mobile sidebar roto)
- "el perfil tampoco" (avatar no clickeable)
- "los iconos son feos necesitamos mejorar todo"
- "da igual si tenemos que cambiar de arquitectura" (libertad total para cambiar approach)

## INSTRUCCIONES PARA LA SIGUIENTE SESIÓN
1. Lee CLAUDE.md del proyecto para reglas de código
2. NO uses pnpm en el sandbox de Cowork — el build se hace en la máquina del usuario
3. Usa named exports, no default exports (excepto Next.js pages)
4. TypeScript strict, return types explícitos en componentes
5. shadcn/ui usa @base-ui/react primitives, NO @radix-ui (excepto donde ya esté)
6. Motion library = "motion/react" (antes era framer-motion, ahora es motion v12)
7. El usuario habla español pero el código y la UI están en inglés
8. Fonts: Plus Jakarta Sans (body), JetBrains Mono (mono), Instrument Serif (display/headings)
