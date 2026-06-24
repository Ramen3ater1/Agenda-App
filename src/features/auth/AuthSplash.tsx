import { Zap } from "lucide-react";

export default function AuthSplash() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-background"
      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="size-9 rounded-lg bg-accent flex items-center justify-center animate-pulse">
          <Zap size={18} className="text-white" />
        </div>
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    </div>
  );
}
