"use client";

import { useEffect, useState } from "react";

/** Re-render on an interval so scheduled buttons unlock without a page refresh. */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
