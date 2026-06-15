"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import Loader from "./Loader";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  loading = false,
  destructive = false,
}: ConfirmDialogProps) {
  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-200 bg-white sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-lg font-semibold text-[#1e293b]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-sm text-zinc-500">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {children ? <div className="space-y-2 text-sm text-zinc-600">{children}</div> : null}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className={btnFormCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              destructive ? "bg-rose-600 text-white hover:bg-rose-700" : btnFormSubmit,
            )}
          >
            {loading ? <Loader /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
