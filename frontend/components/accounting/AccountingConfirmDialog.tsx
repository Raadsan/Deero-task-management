'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  accountingDialogClass,
  accountingDeleteBtnClass,
  btnFormCancel,
  btnFormSubmit,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
} from '@/lib/accounting-ui';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  details?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function AccountingConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy,
  destructive,
  details,
  onCancel,
  onConfirm,
}: Props) {
  const Icon = destructive ? AlertTriangle : Send;
  return (
    <Dialog open={open} onOpenChange={(value) => !busy && !value && onCancel()}>
      <DialogContent className={accountingDialogClass}>
        <DialogHeader className={configDialogHeaderClass}>
          <div className={`mb-2 flex size-11 items-center justify-center rounded-lg ${destructive ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
            <Icon className="size-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className={configDialogBodyClass}>
          {details ? <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm">{details}</div> : null}
          <div className={`rounded-lg border p-3 text-xs ${destructive ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-secondary/30 bg-secondary/10 text-secondary'}`}>
            {destructive ? 'This action cannot be undone.' : 'Posting locks this record from further editing.'}
          </div>
        </div>
        <DialogFooter className={configDialogFooterClass}>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel} className={btnFormCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={destructive ? accountingDeleteBtnClass : btnFormSubmit}
          >
            {busy ? 'Processing…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
