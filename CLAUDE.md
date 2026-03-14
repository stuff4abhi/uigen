# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
npm run setup          # installs deps, generates Prisma client, runs migrations

# Development
npm run dev            # start dev server with Turbopack at localhost:3000
npm run dev:daemon     # start in background, logs to logs.txt

# Build & lint
npm run build
npm run lint

# Tests
npm test               # run all tests with vitest
npm test -- --run src/path/to/test.test.tsx  # run a single test file

# Database
npm run db:reset       # reset and re-run all migrations (destructive)
npx prisma migrate dev # apply new migrations
npx prisma generate    # regenerate Prisma client after schema changes
```

Set `ANTHROPIC_API_KEY` in `.env` to enable real AI generation. Without it, a `MockLanguageModel` in `src/lib/provider.ts` returns static component examples.

## Architecture

### Request flow
1. User types in `ChatInterface` → sends to `POST /api/chat` with `messages`, `files` (serialized VFS), and optional `projectId`
2. API route reconstructs `VirtualFileSystem` from the serialized nodes, calls Claude via Vercel AI SDK with two tools: `str_replace_editor` and `file_manager`
3. Streamed tool calls flow back to the client via `useChat`; `ChatContext` calls `handleToolCall` on each, which mutates the in-memory `VirtualFileSystem` through `FileSystemContext`
4. `refreshTrigger` counter increments → `PreviewFrame` re-renders by rebuilding an import map and rewriting the iframe's `srcdoc`
5. On finish, if the user is authenticated, the API route persists `messages` and `fileSystem.serialize()` to the `Project` row in SQLite

### Virtual File System (`src/lib/file-system.ts`)
`VirtualFileSystem` is an in-memory tree of `FileNode` objects (files and directories). It is **never written to disk during a session**. It serializes/deserializes to a plain `Record<string, FileNode>` for persistence in the `Project.data` JSON column. The two AI tools (`str_replace_editor`, `file_manager`) operate on a server-side VFS instance per request; the client maintains its own instance via `FileSystemContext`.

### Live Preview (`src/lib/transform/jsx-transformer.ts`)
`createImportMap` compiles all `.jsx/.tsx/.ts/.js` files using `@babel/standalone`, creates blob URLs for each, and builds an ES module import map. Third-party packages are resolved via `https://esm.sh/`. Tailwind CSS is loaded from CDN. The resulting HTML is written into an sandboxed `<iframe>` as `srcdoc`. Entry point resolution priority: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → `/src/App.jsx`.

### AI Tools
- **`str_replace_editor`** (`src/lib/tools/str-replace.ts`): supports `view`, `create`, `str_replace`, `insert` commands on the server-side VFS
- **`file_manager`** (`src/lib/tools/file-manager.ts`): supports `rename` and `delete`

### Auth (`src/lib/auth.ts`)
JWT-based sessions stored in an httpOnly cookie (`auth-token`). `server-only` is imported to prevent client-side use. `middleware.ts` protects project routes. Anonymous users can generate components freely; their work is temporarily stored in `sessionStorage` via `anon-work-tracker.ts`. On sign-up/sign-in an auth dialog offers to save the anonymous work to the new/existing account.

### Data model
- `User`: email + bcrypt password
- `Project`: belongs to optional `User`; stores `messages` (JSON array) and `data` (serialized VFS JSON) as SQLite text columns

### Key contexts
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`): owns the client-side VFS instance and exposes `handleToolCall` which applies streaming tool calls to the VFS
- `ChatContext` (`src/lib/contexts/chat-context.tsx`): wraps Vercel AI SDK's `useChat`, wires tool call callbacks to `FileSystemContext.handleToolCall`

### Tech choices to be aware of
- **Tailwind v4** — uses `@tailwindcss/postcss` plugin, not the v3 config file
- **Next.js 15 App Router** with React 19 — server components by default; client components need `"use client"`
- **Prisma client output** is `src/generated/prisma` (non-default), imported via `src/lib/prisma.ts`
- `NODE_OPTIONS='--require ./node-compat.cjs'` is prepended to all Next.js commands (see `node-compat.cjs` for the polyfill)
- The model used for generation is `claude-haiku-4-5` (defined in `src/lib/provider.ts`)
