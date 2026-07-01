import { useState } from "react";
import { ChevronLeft, ChevronRight, List, CalendarDays, GanttChart, Brain, Wand2, RefreshCw, Check, AlertTriangle } from "lucide-react";
import type { PlannerLevel, PlannerView } from "@/types";
import type { TimeWindow } from "@/lib/timeWindow";

const LEVELS: { id: PlannerLevel; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const VIEWS: { id: PlannerView; label: string; icon: React.ReactNode }[] = [
  { id: "checklist", label: "Checklist", icon: <List size={14} /> },
  { id: "calendar", label: "Calendar", icon: <CalendarDays size={14} /> },
  { id: "timeline", label: "Timeline", icon: <GanttChart size={14} /> },
];

export default function PlannerHeader({
  title, subtitle, window, level, view,
  onLevel, onView, onPrev, onNext, onToday,
  onShowAIPlan, onShowOptimize,
  gcalAvailable, gcalConnected, gcalSyncing, gcalNeedsReauth, onConnectGcal, onDisconnectGcal,
}: {
  title: string;
  subtitle?: string;
  window: TimeWindow;
  level: PlannerLevel;
  view: PlannerView;
  onLevel: (l: PlannerLevel) => void;
  onView: (v: PlannerView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onShowAIPlan: () => void;
  onShowOptimize: () => void;
  gcalAvailable: boolean;
  gcalConnected: boolean;
  gcalSyncing: boolean;
  gcalNeedsReauth: boolean;
  onConnectGcal: () => void;
  onDisconnectGcal: () => void;
}) {
  const [gcalMenu, setGcalMenu] = useState(false);
  const seg = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`;
  const btn = "flex items-center gap-2 px-3.5 py-2 border border-border text-sm font-medium rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground";

  return (
    <div className="px-8 py-4 border-b border-border shrink-0 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {gcalAvailable && (
            gcalNeedsReauth ? (
              <button onClick={onConnectGcal} className={`${btn} border-amber-500/40 text-amber-600 hover:text-amber-700`}>
                <AlertTriangle size={14} /> Reconnect Google
              </button>
            ) : gcalConnected ? (
              <div className="relative">
                <button onClick={() => setGcalMenu(v => !v)} className={btn}>
                  {gcalSyncing
                    ? <RefreshCw size={14} className="text-accent animate-spin" />
                    : <Check size={14} className="text-emerald-500" />}
                  Google Synced
                </button>
                {gcalMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setGcalMenu(false)} />
                    <div className="absolute right-0 mt-1 z-30 w-40 bg-card border border-border rounded-md shadow-lg py-1">
                      <button
                        onClick={() => { setGcalMenu(false); onDisconnectGcal(); }}
                        className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={onConnectGcal} className={btn}>
                <CalendarDays size={14} className="text-accent" /> Connect Google
              </button>
            )
          )}
          <button onClick={onShowAIPlan} className={btn}>
            <Brain size={14} className="text-accent" /> AI Plan
          </button>
          <button onClick={onShowOptimize} className={btn}>
            <Wand2 size={14} className="text-accent" /> AI Optimize
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* When (period navigator + level) */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={onPrev} className="p-1.5 hover:bg-secondary rounded transition-colors" aria-label="Previous">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-medium min-w-[150px] text-center">{window.label}</span>
            <button onClick={onNext} className="p-1.5 hover:bg-secondary rounded transition-colors" aria-label="Next">
              <ChevronRight size={15} />
            </button>
          </div>
          <button onClick={onToday} className="text-xs px-2.5 py-1 border border-border rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            Today
          </button>
          <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5">
            {LEVELS.map(l => (
              <button key={l.id} onClick={() => onLevel(l.id)} className={seg(level === l.id)}>{l.label}</button>
            ))}
          </div>
        </div>

        {/* How (view) */}
        <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => onView(v.id)} className={`flex items-center gap-1.5 ${seg(view === v.id)}`}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
