# Guest Mode (Local-only) — Design

**Date:** 2026-06-25
**Status:** Approved

## Goal

Let users try Agenda fully without registering. Guest data lives in `localStorage`
only (no Supabase account). When a guest later signs up or logs in, the existing
`ImportLocalDataPrompt` flow migrates their local data into their cloud account.

## Why local-only

The app is already cache-first: `TaskProvider` initializes from `localStorage`
(`initDataState`), write-throughs every change to `localStorage`, and only reaches the
cloud when a `user` exists. Guest mode therefore needs almost no new persistence code —
it reuses the existing local cache and the existing local→cloud import prompt. No
Supabase configuration changes are required.

## Components

### 1. `AuthProvider` — guest state
- Persist a flag in `localStorage` under key `agenda:guest` (`"1"` when active).
- New context fields:
  - `isGuest: boolean` — true when the guest flag is set **and** there is no `user`.
  - `continueAsGuest(): void` — sets the flag and updates state. No Supabase call.
- `signOut()` also clears the `agenda:guest` flag (covers a guest "exiting").
- A guest has `user === null` and `isGuest === true`.

### 2. `AuthGuard` — routing
- Current: `if (!user) → <Navigate to="/login">`.
- New: `if (!user && !isGuest) → <Navigate to="/login">`. A guest passes the guard and
  renders the protected app via `ProtectedProviders`.
- `loading` behavior unchanged (still shows `AuthSplash`).

### 3. `TaskProvider` — skip cloud sync while guest
- `dispatch` currently always calls `syncAction`, and a login effect calls `fetchAllData`.
  Both require auth and would error for a guest.
- Gate both on `user`: when `user` is null, skip `syncAction` and the cloud-fetch effect
  entirely. The existing `localStorage` write-through already persists all guest data.
- No behavioral change for logged-in users.

### 4. `AuthForm` — entry point
- Add a **"Continue as guest"** button (shared component, so it appears on both the
  login and signup screens). On click: `continueAsGuest()` then `navigate("/today")`.

### 5. `Sidebar` footer — upgrade CTA
- When `isGuest`, replace the email + "Sign out" footer with a **"Guest"** label and a
  **"Sign up to save your data"** link to `/signup`.
- After the guest signs up/logs in, the existing `ImportLocalDataPrompt` automatically
  offers to migrate local data — no new migration code.

## Data flow

```
Guest: "Continue as guest"
  → continueAsGuest() sets agenda:guest=1
  → AuthGuard allows → app renders
  → edits dispatch → reducer + localStorage write-through (NO syncAction)

Guest later signs up / logs in
  → user becomes non-null, agenda:guest cleared on next signOut/login path
  → TaskProvider login effect runs: cloud empty + local non-empty
  → ImportLocalDataPrompt: "Import to my account" → migrateLocalToCloud()
```

## Error handling

- `continueAsGuest` is synchronous and local; no network errors possible.
- Guest dispatch never touches the network, so no sync error toasts while guest.

## Testing

- `AuthProvider`: `continueAsGuest` sets `isGuest` + persists `agenda:guest`; `signOut`
  clears the flag.
- `AuthGuard`: guest (`isGuest`, no user) renders `<Outlet>`; no user + no guest redirects
  to `/login`; `loading` shows splash.
- `TaskProvider`: when `user` is null, dispatch updates state + `localStorage` but does
  **not** call `syncAction`.

## Out of scope (YAGNI)

- No anonymous Supabase sessions.
- No cross-device guest sync.
- No separate guest analytics/limits.
