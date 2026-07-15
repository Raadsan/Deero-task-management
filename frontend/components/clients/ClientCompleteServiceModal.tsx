"use client";

import ConfirmDialog from "@/components/Shared/ConfirmDialog";

type AgreementTarget = {
  agreementId: string;
  serviceName: string;
  subServiceName: string;
  branchName?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  agreement: AgreementTarget | null;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function ClientCompleteServiceModal({
  open,
  onOpenChange,
  clientName,
  agreement,
  loading,
  onConfirm,
}: Props) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mark service as complete?"
      description="Please confirm you want to update this service status to complete."
      confirmLabel="Mark complete"
      loading={loading}
      onConfirm={onConfirm}
    >
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
        <p>
          <span className="font-medium text-zinc-800">Client:</span> {clientName}
        </p>
        <p>
          <span className="font-medium text-zinc-800">Portfolio:</span>{" "}
          {agreement?.branchName || "—"}
        </p>
        <p>
          <span className="font-medium text-zinc-800">Service:</span>{" "}
          {agreement?.serviceName || "—"}
        </p>
        <p>
          <span className="font-medium text-zinc-800">Sub service:</span>{" "}
          {agreement?.subServiceName || "—"}
        </p>
      </div>
    </ConfirmDialog>
  );
}
