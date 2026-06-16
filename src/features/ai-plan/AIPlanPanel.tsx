import { useState } from "react";
import { motion } from "motion/react";
import { Brain, X, ListTodo, CalendarDays, Sparkles, RefreshCcw, Check } from "lucide-react";
import { PLAN_TEMPLATE } from "@/constants";
import type { Task, PlanStep } from "@/types";

export default function AIPlanPanel({ tasks, onClose }: { tasks: Task[]; onClose: () => void }) {
  const [goalText, setGoalText] = useState("Launch my own design tool SaaS within 12 months");
  const [generating, setGenerating] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [refiningId, setRefiningId] = useState<string | null>(null);

  function generate() {
    setGenerating(true); setPlanReady(false);
    setTimeout(() => {
      setGenerating(false); setPlanReady(true);
      setPlan(PLAN_TEMPLATE.map(p => ({ ...p, status: "pending" as const, refined: false })));
    }, 2400);
  }

  function accept(id: string) { setPlan(ps => ps.map(p => p.id === id ? { ...p, status: "accepted" as const } : p)); }
  function remove(id: string) { setPlan(ps => ps.map(p => p.id === id ? { ...p, status: "removed" as const } : p)); }
  function acceptAll() { setPlan(ps => ps.map(p => p.status === "pending" ? { ...p, status: "accepted" as const } : p)); }

  function refine(id: string) {
    setRefiningId(id);
    setTimeout(() => {
      setPlan(ps => ps.map(p => p.id !== id ? p : {
        ...p,
        description: p.description + " Also: track weekly output metrics (commits, tasks closed, hours logged) to measure momentum objectively.",
        refined: true,
      }));
      setRefiningId(null);
    }, 1600);
  }

  const visible = plan.filter(p => p.status !== "removed");
  const allDone = planReady && visible.length > 0 && visible.every(p => p.status !== "pending");

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-accent/10 rounded-lg flex items-center justify-center">
            <Brain size={17} className="text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Planning</h2>
            <p className="text-xs text-muted-foreground">Long-term goal advisor</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { icon: <ListTodo size={12} />, label: `${tasks.length} tasks`, sub: `${tasks.filter(t => ["critical","high"].includes(t.priority)).length} high/critical` },
            { icon: <Brain size={12} />, label: "2 session notes", sub: "from last 7 days" },
            { icon: <CalendarDays size={12} />, label: "6 calendar events", sub: "this month" },
          ].map((c, i) => (
            <div key={i} className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-muted-foreground shrink-0">{c.icon}</span>
              <div>
                <div className="text-[11px] font-medium">{c.label}</div>
                <div className="text-[10px] text-muted-foreground">{c.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="text-xs font-medium block mb-1.5">What is your long-term goal?</label>
          <div className="flex gap-2">
            <input
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              placeholder="e.g. Become an engineering manager in 18 months"
              className="flex-1 px-3 py-2 border border-border rounded-md text-sm bg-card outline-none focus:ring-2 focus:ring-accent/30"
            />
            <button
              onClick={generate}
              disabled={generating || !goalText.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {generating ? <RefreshCcw size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? "Generating…" : "Generate Plan"}
            </button>
          </div>
        </div>

        {generating && (
          <div className="bg-card border border-border rounded-lg py-8 flex flex-col items-center gap-3">
            <div className="size-10 bg-accent/10 rounded-full flex items-center justify-center">
              <Brain size={16} className="text-accent animate-pulse" />
            </div>
            <p className="text-sm font-medium">Reading your context…</p>
            <p className="text-xs text-muted-foreground">Analyzing tasks, session notes, and calendar events</p>
          </div>
        )}

        {!planReady && !generating && (
          <div className="bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/15 rounded-xl py-8 flex flex-col items-center gap-3 text-center px-6">
            <div className="size-11 bg-accent/10 rounded-full flex items-center justify-center">
              <Sparkles size={18} className="text-accent" />
            </div>
            <h3 className="text-sm font-semibold">AI-powered long-term planning</h3>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              Enter your goal and the AI advisor generates a personalized, step-by-step plan — reading your existing tasks, session notes, and calendar to make it contextually relevant.
            </p>
          </div>
        )}

        {planReady && !generating && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-semibold">Generated Plan</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[280px]">Goal: {goalText}</p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={acceptAll} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[11px] font-medium hover:bg-emerald-100">
                  <Check size={10} /> Accept All
                </button>
                <button onClick={generate} className="flex items-center gap-1 px-2.5 py-1.5 border border-border rounded-md text-[11px] text-muted-foreground hover:text-foreground">
                  <RefreshCcw size={10} /> Regenerate
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {visible.map((step, idx) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-card border rounded-lg p-3.5 transition-colors ${
                    step.status === "accepted" ? "border-emerald-200 bg-emerald-50/20" : step.refined ? "border-accent/25" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`shrink-0 size-5 rounded-full flex items-center justify-center text-[10px] font-medium mt-0.5 ${
                      step.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground font-mono"
                    }`}>
                      {step.status === "accepted" ? <Check size={10} /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-medium leading-snug">{step.title}</h4>
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0 mt-0.5 whitespace-nowrap">{step.timeline}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
                      {step.context && (
                        <div className="mt-1.5 flex items-start gap-1 text-[11px] text-accent">
                          <Sparkles size={9} className="mt-0.5 shrink-0" />
                          <span className="leading-relaxed">{step.context}</span>
                        </div>
                      )}
                      {step.refined && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-emerald-600">
                          <Check size={8} /> Refined by AI
                        </div>
                      )}
                    </div>
                  </div>
                  {step.status === "pending" && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border">
                      <button onClick={() => accept(step.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-[11px] font-medium hover:bg-emerald-100">
                        <Check size={9} /> Accept
                      </button>
                      <button onClick={() => refine(step.id)} disabled={refiningId === step.id} className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 text-accent rounded text-[11px] font-medium hover:bg-accent/15 disabled:opacity-50">
                        {refiningId === step.id ? <RefreshCcw size={9} className="animate-spin" /> : <Sparkles size={9} />}
                        {refiningId === step.id ? "Refining…" : "Refine with AI"}
                      </button>
                      <button onClick={() => remove(step.id)} className="flex items-center gap-1 px-2.5 py-1.5 border border-border text-muted-foreground rounded text-[11px] hover:text-red-500 hover:border-red-200">
                        <X size={9} /> Remove
                      </button>
                    </div>
                  )}
                  {step.status === "accepted" && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-emerald-200 text-[10px] text-emerald-600">
                      <Check size={9} /> Accepted — added to your plan
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {allDone && (
              <div className="mt-5 py-5 bg-accent/5 border border-accent/15 rounded-xl text-center">
                <div className="text-xs font-semibold text-accent mb-1">Plan finalized</div>
                <p className="text-[11px] text-muted-foreground">
                  {visible.filter(p => p.status === "accepted").length} steps accepted.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
