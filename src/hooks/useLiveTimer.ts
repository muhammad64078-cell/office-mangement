import { useEffect, useState } from "react";

// Returns a live-elapsed-seconds counter that ticks every second.
// If `startedAt` is null, returns 0.
export function useLiveTimer(startedAt: string | null, baseSeconds: number = 0) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(baseSeconds + (Date.now() - start) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, baseSeconds]);

  return elapsed;
}
