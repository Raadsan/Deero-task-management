"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProjectRegistrationForm from "./ProjectRegistrationForm";

interface Props {
  open: boolean;
  projectId?: string;
  onOpenChange: (open: boolean) => void;
}

export default function ProjectRegistrationModal({ open, projectId, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-6xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">{projectId ? "Edit Project" : "Project Registration"}</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {projectId
              ? "Update the project, its services, schedule, and tasks."
              : "Register the project, its services, schedule, and tasks in one workflow."}
          </DialogDescription>
        </DialogHeader>
        {open ? <ProjectRegistrationForm projectId={projectId} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
