import type { Task, TaskStep, Folder, Workspace, Resource, WorkSession, Priority, TaskStatus, RecurrenceType, ResourceType } from "@/types";
import type { DataState } from "@/store/taskReducer";

export interface FolderRow { id: string; name: string }
export interface TaskRow {
  id: string; title: string; description: string;
  priority: Priority; status: TaskStatus; deadline: string;
  folder_id: string | null; recurrence: RecurrenceType; position: number; updated_at: string;
}
export interface TaskStepRow { id: string; task_id: string; title: string; done: boolean; position: number }
export interface WorkspaceRow { id: string; name: string; task_id: string | null; step_id: string | null }
export interface ResourceRow { id: string; workspace_id: string; type: ResourceType; title: string; value: string }
export interface WorkSessionRow { id: string; workspace_id: string; date: string; duration: number; comment: string }

export interface RawRows {
  folders: FolderRow[]; tasks: TaskRow[]; taskSteps: TaskStepRow[];
  workspaces: WorkspaceRow[]; resources: ResourceRow[]; workSessions: WorkSessionRow[];
}

function stepFromRow(r: TaskStepRow): TaskStep { return { id: r.id, title: r.title, done: r.done }; }
function resFromRow(r: ResourceRow): Resource { return { id: r.id, type: r.type, title: r.title, value: r.value }; }
function sessFromRow(r: WorkSessionRow): WorkSession { return { id: r.id, date: r.date, duration: r.duration, comment: r.comment }; }

export function assembleDataState(rows: RawRows): DataState {
  const byPos = (a: { position: number }, b: { position: number }) => a.position - b.position;

  const workspaces: Workspace[] = rows.workspaces.map(w => ({
    id: w.id,
    name: w.name,
    taskId: w.task_id ?? undefined,
    stepId: w.step_id ?? undefined,
    resources: rows.resources.filter(r => r.workspace_id === w.id).map(resFromRow),
    sessions: rows.workSessions.filter(s => s.workspace_id === w.id).map(sessFromRow),
  }));

  const tasks: Task[] = [...rows.tasks].sort(byPos).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    deadline: t.deadline,
    folderId: t.folder_id ?? undefined,
    workspaceId: rows.workspaces.find(w => w.task_id === t.id)?.id,
    recurrence: t.recurrence,
    steps: rows.taskSteps.filter(s => s.task_id === t.id).sort(byPos).map(stepFromRow),
  }));

  const folders: Folder[] = rows.folders.map(f => ({ id: f.id, name: f.name }));

  return { tasks, folders, workspaces, gcalConnected: false };
}

export function taskToRow(task: Task, position: number): TaskRow {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    deadline: task.deadline,
    folder_id: task.folderId ?? null,
    recurrence: task.recurrence,
    position,
    updated_at: new Date().toISOString(),
  };
}
export function stepToRow(step: TaskStep, taskId: string, position: number): TaskStepRow {
  return { id: step.id, task_id: taskId, title: step.title, done: step.done, position };
}
export function folderToRow(folder: Folder): FolderRow {
  return { id: folder.id, name: folder.name };
}
export function workspaceToRow(ws: Workspace): WorkspaceRow {
  return { id: ws.id, name: ws.name, task_id: ws.taskId ?? null, step_id: ws.stepId ?? null };
}
export function resourceToRow(res: Resource, workspaceId: string): ResourceRow {
  return { id: res.id, workspace_id: workspaceId, type: res.type, title: res.title, value: res.value };
}
export function sessionToRow(sess: WorkSession, workspaceId: string): WorkSessionRow {
  return { id: sess.id, workspace_id: workspaceId, date: sess.date, duration: sess.duration, comment: sess.comment };
}
