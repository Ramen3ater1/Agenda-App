import { useState } from "react";
import { motion } from "motion/react";
import { formatDuration } from "@/lib/utils";

export default function EndSessionModal({ elapsed, onSave, onCancel }: {
  elapsed: number;
  onSave: (comment: string) => void;
  onCancel: () => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="bg-card rounded-xl border border-border w-[440px] shadow-2xl p-6"
      >
        <h3 className="text-base font-semibold mb-0.5">End Session</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Duration: <span className="font-mono font-medium text-foreground">{formatDuration(elapsed)}</span>
        </p>
        <label className="text-xs font-medium block mb-1.5">Session notes</label>
        <textarea
          autoFocus
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="What did you accomplish? Any blockers or observations?"
          rows={4}
          className="w-full px-3 py-2.5 border border-border rounded-md text-sm bg-background resize-none outline-none focus:ring-2 focus:ring-accent/30"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onSave(comment)}
            className="flex-1 py-2 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90"
          >
            Save &amp; End
          </button>
          <button onClick={onCancel} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-secondary">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
