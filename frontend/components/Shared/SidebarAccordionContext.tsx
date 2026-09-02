"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

type SidebarAccordionContextValue = {
  openId: string | null;
  toggle: (id: string) => void;
  isOpen: (id: string) => boolean;
  setOpenId: (id: string | null) => void;
};

const SidebarAccordionContext = createContext<SidebarAccordionContextValue | null>(
  null,
);

export function SidebarAccordionProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const hydrated = useRef(false);
  const storageKey = `deero-sidebar-open-menu:${userId || "anonymous"}`;

  useEffect(() => {
    try {
      setOpenId(localStorage.getItem(storageKey));
    } finally {
      hydrated.current = true;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (openId) localStorage.setItem(storageKey, openId);
    else localStorage.removeItem(storageKey);
  }, [openId, storageKey]);

  // Keep open dropdown persisted; only close when another dropdown is toggled
  const value = useMemo(
    () => ({
      openId,
      setOpenId,
      toggle: (id: string) => setOpenId((prev) => (prev === id ? null : id)),
      isOpen: (id: string) => openId === id,
    }),
    [openId],
  );

  return (
    <SidebarAccordionContext.Provider value={value}>
      {children}
    </SidebarAccordionContext.Provider>
  );
}

export function useSidebarAccordion() {
  const ctx = useContext(SidebarAccordionContext);
  if (!ctx) {
    throw new Error("useSidebarAccordion must be used within SidebarAccordionProvider");
  }
  return ctx;
}
