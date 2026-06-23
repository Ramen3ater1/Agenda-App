import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sun, Layers, Play, Zap, ChevronLeft, ChevronRight, ArrowUpRight,
} from "lucide-react";

const ONBOARDING_SLIDES = [
  {
    icon: <Sun size={28} className="text-accent" />,
    title: "Start every day with Today.",
    body: "Agenda opens on Today — the tasks due now, overdue, or already in motion.",
  },
  {
    icon: <Layers size={28} className="text-accent" />,
    title: "One set of tasks, two views.",
    body: "See your work as a checklist or on the calendars.",
  },
  {
    icon: <Play size={28} className="text-accent" fill="currentColor" />,
    title: "Open a task to focus and finish.",
    body: "Click on the taskbar to see details and track your work",
  },
  {
    icon: <Play size={28} className="text-accent" fill="currentColor" />,
    title: "Connect with your current workflow",
    body: "Sync with google/apple calendar; see and manage everything in one app",
  },
];

export default function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[i];
  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-6" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <button onClick={onDone} className="absolute top-5 right-6 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Skip
      </button>

      <div className="flex items-center gap-2.5 mb-10">
        <div className="size-7 rounded bg-accent flex items-center justify-center">
          <Zap size={13} className="text-white" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">Agenda</span>
      </div>

      <div className="w-full max-w-[440px] min-h-[220px] flex flex-col items-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="flex flex-col items-center"
          >
            <div className="size-14 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
              {slide.icon}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-3 leading-snug">{slide.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mt-10 mb-8">
        {ONBOARDING_SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-accent" : "w-1.5 bg-border hover:bg-muted-foreground"}`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        {i > 0 && (
          <button
            onClick={() => setI(i - 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} /> Back
          </button>
        )}
        <button
          onClick={() => (last ? onDone() : setI(i + 1))}
          className="flex items-center gap-1.5 px-5 py-2 rounded-md text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          {last ? "Get started" : "Next"}
          {last ? <ArrowUpRight size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
}
