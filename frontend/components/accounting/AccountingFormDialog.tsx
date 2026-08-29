'use client';

import { ReactNode } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  accountingDialogClass,
  accountingDialogWideClass,
  accountingDialogFormClass,
  accountingDialogFormWideClass,
  accountingDeleteBtnClass,
  accountingFormFieldClass,
  btnFormCancel,
  btnFormSubmit,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
} from '@/lib/accounting-ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  saving?: boolean;
  onSubmit: (event: React.FormEvent) => void;
  children: ReactNode;
  submitLabel?: string;
  size?: 'default' | 'wide' | 'form' | 'formWide';
};

export function AccountingFormDialog({
  open,
  onOpenChange,
  title,
  description,
  saving,
  onSubmit,
  children,
  submitLabel = 'Save changes',
  size = 'default',
}: Props) {
  const shellClass =
    size === 'formWide' ? accountingDialogFormWideClass
    : size === 'form' ? accountingDialogFormClass
    : size === 'wide' ? accountingDialogWideClass
    : accountingDialogClass;

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className={shellClass}>
        <DialogHeader className={configDialogHeaderClass}>
          <DialogTitle>{title}</DialogTitle>
          {description ? <p className="text-sm text-zinc-500">{description}</p> : null}
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className={configDialogBodyClass}>{children}</div>
          <DialogFooter className={configDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className={btnFormCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className={btnFormSubmit}>
              {saving ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountingFieldLabel({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

export { accountingFormFieldClass, accountingDeleteBtnClass };
