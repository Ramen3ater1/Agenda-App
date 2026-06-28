# Three-Axis Task Planner — Design

Status: approved (2026-06-28)
Branch: `feature/three-axis-planner`

## Goal

Let users observe and edit all of their tasks across three time levels
(daily / weekly / monthly) and three views (checklist / calendar / timeline).

## Core model: three orthogonal axes

The UI is organized around three independent axes. Each is a separate control;
they compose freely.

| Axis | Meaning | Control location | Values |
|------|---------|------------------|--------|
| Where | which tasks | Sidebar | `All` + each folder |
| When | time window | Content header | `Day` / `Week` / `Month` + period navigator (`‹ ›`) |
| How | representation | Content header | `Checklist` / `Calendar` / `Timeline` |

Consequences:

- The sidebar's job becomes purely "where". The current `Calendar` entry is
  removed (Calendar is now a `How`, not a place). The current `Today` entry is
  removed (Today = the `Day` level landing on the current date).
- State lives in the URL so refresh/share works:
  `/list/:where?level=week&view=calendar&date=2026-06-28`.
  - `:where` is `all` or a folder id.
  - `date` is the anchor date of the current window.

## Data model extension

A single `deadline` date cannot express duration or time-of-day, which the
calendar hour-grid and the timeline Gantt bars require. Extend `Task` with
optional, backward-compatible fields:

```ts
interface Task {
  // existing
  deadline: string;       // "2026-06-28"
  // new (all optional)
  startDate?: string;     // "2026-06-28"
  startTime?: string;     // "09:30"
  durationMin?: number;   // estimated minutes; length of the timeline/calendar block
}
```

Migration / fallback (no data loss, ever):

- A task with no `startDate` is treated as an all-day task on its `deadline`
  date.
- A task with no `durationMin` renders with a sensible default block length
  (e.g. 60 min) in time-grid views, and as a point/marker where duration is
  irrelevant.
- No destructive migration: old records remain valid; new fields are filled in
  lazily as the user edits.

## View × Level behavior matrix

View is the primary toggle; level changes the window each view renders. Each
view interprets the level in its own natural way. No cell is disabled — cells
that are a poor fit degrade to the simplest sensible rendering rather than
showing an empty screen.

|         | Checklist                     | Calendar                          | Timeline                          |
|---------|-------------------------------|-----------------------------------|-----------------------------------|
| Day     | list grouped by time-of-day   | single-day 24h grid               | single-day hour-scale Gantt       |
| Week    | list grouped by day           | 7-column hour grid                | Gantt across 7 days               |
| Month   | list grouped by week          | month grid (upgraded current one) | Gantt across the whole month      |

## Component structure

- `WorkPlanner` (new top-level container): reads URL → derives the time window →
  selects the `where` task set → filters by level/window → dispatches to the
  active view.
- `PlannerHeader`: period navigator (`‹ ›` + label) + level segmented control +
  view segmented control.
- Three view components sharing one interface `{ tasks, window, onEdit }`:
  - `ChecklistView` — refactor of the current `TaskListView`, fed the window so
    it can group rows by day/week/time-of-day.
  - `CalendarView` — upgrade the current month-only grid into day/week/month
    states with an hour grid for day/week.
  - `TimelineView` — new Gantt view.
- Shared hooks:
  - `useTimeWindow(level, date)` — pure: derives `{ start, end }` and grouping
    buckets for a level + anchor date.
  - `useDragSchedule()` — shared logic for drag-to-reschedule and
    drag-to-resize, converting pointer coordinates into new `startDate` /
    `startTime` / `durationMin`.

## Editing — rich direct manipulation

- Calendar / Timeline:
  - drag a block → reschedule (`startDate` / `startTime`)
  - drag a block edge → resize (`durationMin`)
  - drag across an empty slot → create a task pre-filled with that slot's time
  - click a block → open the existing detail panel for full edits
- Checklist:
  - inline toggle done
  - inline title edit
  - quick-add row (existing behavior)
- All edits route through the existing `onUpdateTask` path so persistence
  (store + IndexedDB) is unchanged.

## Testing

- `useTimeWindow` and the migration/fallback logic: unit tests, including
  boundaries (cross-month, cross-year, missing `startDate`).
- `useDragSchedule`: unit-test the pure coordinate → date/duration conversion.
- Each view: React Testing Library render checks plus key interactions
  (toggle done, quick-add), matching the existing `Sidebar.test.tsx` style.

## Phased delivery

The change is large; ship in order so each phase is independently mergeable:

1. Data model + migration/fallback (types, store, lazy fill).
2. `WorkPlanner` + `PlannerHeader` + URL routing; wire up `ChecklistView`
   (refactored `TaskListView`) with level grouping. Remove sidebar
   `Calendar`/`Today`.
3. `CalendarView` upgrade to day/week/month + hour grid.
4. `TimelineView` (Gantt).
5. Rich drag editing (`useDragSchedule`) across calendar/timeline.

## Out of scope (YAGNI for now)

- Cross-folder multi-select filtering (the chosen scope model is one `where` at
  a time).
- Recurring-task expansion onto the calendar/timeline beyond the existing
  `recurrence` label (revisit after the views land).
- Google Calendar two-way sync changes (existing read-only mock stays as is).
