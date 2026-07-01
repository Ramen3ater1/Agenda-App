import { useRef } from "react";

interface DragCallbacks {
  // Called on every pointer move with the pixel delta from the press point.
  onMove: (dx: number, dy: number) => void;
  // Called once on release with the final pixel delta.
  onEnd: (dx: number, dy: number) => void;
}

const MOVE_THRESHOLD = 4; // px before a press counts as a drag (vs a click)

// Robust pointer-drag primitive built on setPointerCapture, so move/up events
// keep flowing to the captured element even if the block re-renders or the
// cursor leaves it mid-drag. Shared by the calendar and timeline surfaces.
//
// `moved()` reports whether the last gesture crossed the move threshold; read it
// in onClick to swallow the click that browsers fire right after a drag.
export function usePointerDrag() {
  const movedRef = useRef(false);

  function start(e: React.PointerEvent, { onMove, onEnd }: DragCallbacks) {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const startX = e.clientX;
    const startY = e.clientY;
    movedRef.current = false;
    try { target.setPointerCapture(e.pointerId); } catch { /* no-op */ }

    function handleMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) movedRef.current = true;
      onMove(dx, dy);
    }
    function handleUp(ev: PointerEvent) {
      target.removeEventListener("pointermove", handleMove);
      target.removeEventListener("pointerup", handleUp);
      target.removeEventListener("pointercancel", handleUp);
      try { target.releasePointerCapture(ev.pointerId); } catch { /* no-op */ }
      onEnd(ev.clientX - startX, ev.clientY - startY);
      // Let the click that follows pointerup observe the moved flag, then clear it.
      setTimeout(() => { movedRef.current = false; }, 0);
    }
    target.addEventListener("pointermove", handleMove);
    target.addEventListener("pointerup", handleUp);
    // A canceled gesture (touch interruption, capture loss) must still tear down
    // and finalize, or the drag would stay stuck and the listeners would leak.
    target.addEventListener("pointercancel", handleUp);
  }

  return { start, moved: () => movedRef.current };
}
