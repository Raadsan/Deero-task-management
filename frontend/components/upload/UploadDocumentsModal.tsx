"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UploadUserDocumentsForm from "./UploadUserDocumentsForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export default function UploadDocumentsModal({
  open,
  onOpenChange,
  userId,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            Upload Documents
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Add or replace user documents: Certificate, Transcription, CV, and
            CID.
          </DialogDescription>
        </DialogHeader>

        {userId ? (
          <UploadUserDocumentsForm
            userId={userId}
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        ) : (
          <p className="px-6 py-8 text-center text-sm text-zinc-500">
            No user selected.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
