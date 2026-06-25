import { supabase } from "@/lib/supabase";
import type { DataState } from "@/store/taskReducer";
import { taskToRow, stepToRow, folderToRow, workspaceToRow, resourceToRow, sessionToRow } from "@/lib/db/mappers";

export async function migrateLocalToCloud(local: DataState): Promise<void> {
  if (local.folders.length) {
    await supabase.from("folders").insert(local.folders.map(folderToRow));
  }
  if (local.tasks.length) {
    await supabase.from("tasks").insert(local.tasks.map((t, i) => taskToRow(t, i)));
    const steps = local.tasks.flatMap(t => t.steps.map((s, i) => stepToRow(s, t.id, i)));
    if (steps.length) await supabase.from("task_steps").insert(steps);
  }
  if (local.workspaces.length) {
    await supabase.from("workspaces").insert(local.workspaces.map(workspaceToRow));
    const resources = local.workspaces.flatMap(w => w.resources.map(r => resourceToRow(r, w.id)));
    if (resources.length) await supabase.from("resources").insert(resources);
    const sessions = local.workspaces.flatMap(w => w.sessions.map(s => sessionToRow(s, w.id)));
    if (sessions.length) await supabase.from("work_sessions").insert(sessions);
  }
}
