import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Wand2, X, Check } from "lucide-react";
import { generateOptimizations } from "@/lib/utils";
import type { Task, OptimizeSuggestion } from "@/types";

export default function AIOptimizeModal({ tasks, onApply, onClose }: {
  tasks: Task[];
  onApply: (taskId: string, field: string, value: unknown) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<OptimizeSuggestion[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(false);
      setSuggestions(generateOptimizations(tasks));
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  function accept(s: OptimizeSuggestion) {
    setSuggestions(ss => ss.map(x => x.id === s.id ? { ...x, status: "accepted" } : x));
    onApply(s.taskId, s.field, s.value);
    toast.success("Optimization applied");
  }

  function reject(id: string) {
    setSuggestions(ss => ss.map(x => x.id === id ? { ...x, status: "rejected" } : x));
  }

  const tagColors: Record<string, string> = {
    Priority: "bg-red-50 text-red-700 border-red-200",
    Status: "bg-blue-50 text-blue-700 border-blue-200",
    Visibility: "bg-amber-50 text-amber-700 border-amber-200",
    Deadline: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card rounded-xl border border-border w-full max-w-[560px] shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 bg-accent/10 rounded-lg flex items-center justify-center">
              <Wand2 size={15} className="text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Task Optimizer</h2>
              <p className="text-[11px] text-muted-foreground">Analyzes your tasks for quick wins</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <div className="size-12 bg-accent/10 rounded-full flex items-center justify-center">
                <Wand2 size={18} className="text-accent animate-pulse" />
              </div>
              <p className="text-sm font-medium">Analyzing your tasks…</p>
              <p className="text-xs text-muted-foreground">Checking priorities, deadlines, and workload</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <Check size={32} className="text-emerald-500" />
              <p className="text-sm font-medium">Your task setup looks great!</p>
              <p className="text-xs text-muted-foreground">No optimizations needed right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(s => (
                <div
                  key={s.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    s.status === "accepted" ? "border-emerald-200 bg-emerald-50/30" :
                    s.status === "rejected" ? "border-border opacity-40" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${tagColors[s.tag] ?? "bg-secondary text-muted-foreground border-border"}`}>
                          {s.tag}
                        </span>
                        {s.status === "accepted" && <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><Check size={9} /> Applied</span>}
                        {s.status === "rejected" && <span className="text-[10px] text-muted-foreground">Dismissed</span>}
                      </div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                  {s.status === "pending" && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => accept(s)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded text-xs font-medium hover:opacity-90"
                      >
                        <Check size={10} /> Apply
                      </button>
                      <button
                        onClick={() => reject(s.id)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-border text-muted-foreground rounded text-xs hover:bg-secondary"
                      >
                        <X size={10} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
