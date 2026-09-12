"use client";

import React, { createContext, useContext, useLayoutEffect, useMemo } from "react";
import {
  applyBranchBranding,
  BranchBranding,
  clearBranchBranding,
  DEFAULT_BRANCH_BRANDING,
} from "@/lib/portfolio-branding";

const BranchThemeContext = createContext<BranchBranding>(DEFAULT_BRANCH_BRANDING);

export function useBranchTheme(): BranchBranding {
  return useContext(BranchThemeContext);
}

type Props = {
  branding?: BranchBranding | null;
  children: React.ReactNode;
};

export function BranchThemeProvider({ branding, children }: Props) {
  const activeBranding = useMemo(
    () => branding ?? DEFAULT_BRANCH_BRANDING,
    [branding]
  );

  useLayoutEffect(() => {
    applyBranchBranding(activeBranding);
    return () => clearBranchBranding();
  }, [activeBranding]);

  return (
    <BranchThemeContext.Provider value={activeBranding}>
      {children}
    </BranchThemeContext.Provider>
  );
}

