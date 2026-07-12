"use client";

import { createContext, useContext, useMemo, useState } from "react";

type SidebarAccordionContextValue = {
  openId: string | null;
  toggle: (id: string) => void;
  isOpen: (id: string) => boolean;
  setOpenId: (id: string | null) => void;
};

const SidebarAccordionContext = createContext<SidebarAccordionContextValue | null>(
  null,
);

export function SidebarAccordionProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);

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
