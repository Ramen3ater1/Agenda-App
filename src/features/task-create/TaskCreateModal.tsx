import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Plus, Check, Trash2, X } from "lucide-react";
import { uid, todayISO } from "@/lib/utils";
import { PRIORITY_CFG, RECURRENCE_LABELS } from "@/constants";
import type { Task, TaskStep, Folder as FolderType, Priority, RecurrenceType } from "@/types";

export default function TaskCreateModal({ folders, defaultFolderId, onCreate, onClose }: {
  folders: FolderType[];
  defaultFolderId?: string;
  onCreate: (title: string, opts: Partial<Omit<Task, "id" | "title">>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState(todayISO());
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [folderId, setFolderId] = useState(defaultFolderId ?? "");
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [newStep, setNewStep] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState("");

  function addStep() { if (newStep.trim()) { setSteps(s => [...s, { id: uid(), title: newStep.trim(), done: false }]); setNewStep(""); } }
  function saveStep(id: string) { if (stepTitle.trim()) setSteps(s => s.map(x => x.id === id ? { ...x, title: stepTitle.trim() } : x)); setEditingStepId(null); }
  function toggleStep(id: string) { setSteps(s => s.map(x => x.id === id ? { ...x, done: !x.done } : x)); }
  function removeStep(id: string) { setSteps(s => s.filter(x => x.id !== id)); }

  function submit() {
    if (!title.trim()) return;
    onCreate(title.trim(), { description, priority, deadline, recurrence, steps, folderId: folderId || undefined });
    toast.success("Task created");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-xl border border-border w-full max-w-[560px] shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">New task</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Notes</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Add notes, context, or acceptance criteria…"
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background resize-none outline-none focus:ring-1 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-2">Steps</label>
            <div className="space-y-2">
              {steps.map(step => (
                <div key={step.id} className="flex items-center gap-2.5 group border border-border rounded-md px-3 py-2 bg-background">
                  <div onClick={() => toggleStep(step.id)} className={`shrink-0 size-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${step.done ? "bg-accent border-accent" : "border-border hover:border-foreground/40"}`}>
                    {step.done && <Check size={9} className="text-white" />}
                  </div>
                  {editingStepId === step.id ? (
                    <input autoFocus value={stepTitle} onChange={e => setStepTitle(e.target.value)} onBlur={() => saveStep(step.id)} onKeyDown={e => e.key === "Enter" && saveStep(step.id)} className="flex-1 text-sm px-1.5 py-0.5 border border-border rounded outline-none focus:ring-1 focus:ring-accent/30 bg-background" />
                  ) : (
                    <span onClick={() => { setEditingStepId(step.id); setStepTitle(step.title); }} className={`flex-1 text-sm cursor-text ${step.done ? "line-through text-muted-foreground" : ""}`}>{step.title}</span>
                  )}
                  <button onClick={() => removeStep(step.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all p-0.5"><Trash2 size={11} /></button>
                </div>
              ))}
              <div className="flex items-center gap-2.5 border border-dashed border-border rounded-md px-3 py-2">
                <div className="size-4 shrink-0 rounded border border-dashed border-border" />
                <input value={newStep} onChange={e => setNewStep(e.target.value)} onKeyDown={e => e.key === "Enter" && addStep()} placeholder="Add a step…" className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60" />
                {newStep.trim() && <button onClick={addStep} className="text-xs text-accent hover:opacity-80">Add</button>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">List</label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30">
                <option value="">No list</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30">
                {(Object.keys(PRIORITY_CFG) as Priority[]).map(p => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Due date</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Repeat</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value as RecurrenceType)} className="w-full px-2.5 py-1.5 border border-border rounded-md text-sm bg-background outline-none focus:ring-1 focus:ring-accent/30">
                {(Object.keys(RECURRENCE_LABELS) as RecurrenceType[]).map(r => <option key={r} value={r}>{RECURRENCE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-sm px-3.5 py-2 border border-border rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={!title.trim()} className="flex items-center gap-1.5 text-sm px-3.5 py-2 bg-foreground text-background rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={14} strokeWidth={3} /> Create task
          </button>
        </div>
      </motion.div>
    </div>
  );
}
