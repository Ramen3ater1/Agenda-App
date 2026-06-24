import { Zap } from "lucide-react";
import type { ReactNode } from "react";

export default function AuthCard({
  title, subtitle, children,
}: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6"
      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
    >
      <div className="flex items-center gap-2.5 mb-8">
        <div className="size-7 rounded bg-accent flex items-center justify-center">
          <Zap size={13} className="text-white" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">Agenda</span>
      </div>
      <div className="w-full max-w-[360px]">
        <h1 className="text-2xl font-semibold tracking-tight mb-1.5 text-center">{title}</h1>
        <p className="text-sm text-muted-foreground text-center mb-7">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
