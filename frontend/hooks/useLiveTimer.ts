"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight live timer hook that triggers a state update at the specified interval
 * (default 1000ms / 1 second) to keep countdowns, overdue timers, and task statuses live.
 */
export function useLiveTimer(intervalMs = 1000) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => (t + 1) % 1_000_000);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return tick;
}
