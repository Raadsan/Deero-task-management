"use client";

import { useLayoutEffect } from "react";
import {
  applyBranchBranding,
  BranchBranding,
  clearBranchBranding,
} from "@/lib/portfolio-branding";

type Props = {
  branding?: BranchBranding | null;
  children: React.ReactNode;
};

export function BranchThemeProvider({ branding, children }: Props) {
  useLayoutEffect(() => {
    applyBranchBranding(branding);
    return () => clearBranchBranding();
  }, [branding]);

  return <>{children}</>;
}
