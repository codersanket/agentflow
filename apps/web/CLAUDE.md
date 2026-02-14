# AgentFlow Frontend — Claude Code Instructions

## Overview
Next.js 14 App Router frontend for the AgentFlow platform.

## Stack
- Next.js 14 (App Router, TypeScript strict)
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- React Flow (visual agent builder canvas)
- Zustand (state management)
- Vitest (unit tests)
- Playwright (E2E tests)

## Directory Structure
```
apps/web/
├── app/
│   ├── (auth)/              # Auth pages (login, signup, sso)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/         # Authenticated app
│   │   ├── agents/          # Agent list, detail, builder
│   │   ├── executions/      # Execution history
│   │   ├── integrations/    # Connected tools
│   │   ├── knowledge/       # Knowledge bases
│   │   ├── templates/       # Template marketplace
│   │   ├── analytics/       # Usage dashboard
│   │   ├── settings/        # Org settings, billing, members
│   │   └── layout.tsx       # Dashboard layout (sidebar + topbar)
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing/marketing page
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── builder/             # React Flow canvas, nodes, edges
│   ├── agents/              # Agent list, cards, forms
│   ├── executions/          # Execution timeline, logs
│   ├── integrations/        # OAuth connect buttons
│   ├── analytics/           # Charts, metrics cards
│   └── shared/              # Common components (sidebar, topbar, etc.)
├── stores/
│   ├── auth-store.ts        # Auth state (user, tokens)
│   ├── builder-store.ts     # Agent builder state (nodes, edges, selection)
│   └── execution-store.ts   # Execution streaming state
├── lib/
│   ├── api.ts               # Typed API client (fetch wrapper)
│   ├── ws.ts                # WebSocket client for execution streaming
│   └── utils.ts             # Shared utilities
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript type definitions
└── __tests__/               # Test files mirror app structure
```

## Conventions
- File naming: `kebab-case.tsx` for components, `kebab-case.ts` for utilities
- Component naming: PascalCase (`AgentCard`, `BuilderCanvas`)
- One component per file, export as named export (not default)
- Use `cn()` utility (from shadcn) for conditional classNames
- Keep components small — extract when >100 lines
- API calls go through `lib/api.ts`, never call fetch directly in components
- Use Zustand stores for cross-component state, React state for local UI state
- Forms: use react-hook-form + zod validation
- Loading states: use Suspense boundaries and shadcn Skeleton components
- Error states: use error.tsx boundary files in App Router

## shadcn/ui Components
Install components as needed:
```bash
npx shadcn-ui@latest add button input card dialog dropdown-menu
```
Components are copied to `components/ui/` — customize freely.

## React Flow (Agent Builder)
- Canvas component: `components/builder/builder-canvas.tsx`
- Custom nodes: `components/builder/nodes/` (trigger, ai, action, logic, human)
- Custom edges: `components/builder/edges/`
- Builder state: `stores/builder-store.ts` (Zustand)
- Node configs: right sidebar panel `components/builder/config-panel.tsx`

## API Client Pattern
```typescript
// lib/api.ts — typed API client
const api = {
  agents: {
    list: (params?) => get<AgentListResponse>('/agents', params),
    get: (id: string) => get<Agent>(`/agents/${id}`),
    create: (data: CreateAgentInput) => post<Agent>('/agents', data),
    execute: (id: string, data?) => post<Execution>(`/agents/${id}/execute`, data),
  },
  // ... other resources
}
```

## Environment Variables
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
