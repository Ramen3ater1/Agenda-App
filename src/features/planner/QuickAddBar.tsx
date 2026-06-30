import { useState } from "react";
import { Plus } from "lucide-react";

// The shared quick-add row: a violet "+" that opens the full create modal, plus
// an inline title input for fast capture. Used by checklist, calendar and timeline.
export default function QuickAddBar({
  onAddTask, onAdvancedAdd, placeholder = "Add a task — press Enter", className = "",
}: {
  onAddTask: (title: string) => void;
  onAdvancedAdd: () => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  function submit() { if (draft.trim()) { onAddTask(draft.trim()); setDraft(""); } }

  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 bg-card border border-border rounded-lg ${className}`}>
      <button
        onClick={onAdvancedAdd}
        title="Advanced — full options"
        className="shrink-0 flex items-center justify-center size-7 rounded-full bg-violet-600 hover:bg-violet-500 border border-violet-700 transition-colors"
      >
        <Plus size={16} strokeWidth={3.5} className="text-white" />
      </button>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {draft.trim() && <button onClick={submit} className="text-xs px-2.5 py-1 bg-foreground text-background rounded font-medium">Add</button>}
    </div>
  );
}
