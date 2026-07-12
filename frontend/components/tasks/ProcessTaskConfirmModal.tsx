"use client";

import Loader from "@/components/Shared/Loader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  configInfoFieldClass,
  preventConfigDialogClose,
} from "@/components/config/config-dialog-styles";
import { btnFormCancel, btnFormSubmit, formatStatusLabel } from "@/lib/dashboard-ui";
import { taskTitle } from "@/lib/my-task-filters";
import { Task } from "@/lib/types";
import { formatTaskDeadline, resolveTaskDisplayStatus } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export default function ProcessTaskConfirmModal({
  open,
  onOpenChange,
  task,
  loading = false,
  onConfirm,
}: Props) {
  const displayStatus = task ? resolveTaskDisplayStatus(task) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={configDialogShellClass}
        onInteractOutside={preventConfigDialogClose}
        onEscapeKeyDown={preventConfigDialogClose}
      >
        <DialogHeader className={configDialogHeaderClass}>
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            Process task?
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Please confirm you want to move this task to processing.
          </DialogDescription>
        </DialogHeader>

        {task ? (
          <div className={configDialogBodyClass}>
            <div className={configInfoFieldClass}>
              <p>
                <span className="font-medium text-zinc-800">Task:</span>{" "}
                {taskTitle(task)}
              </p>
              {task.description ? (
                <p>
                  <span className="font-medium text-zinc-800">Description:</span>{" "}
                  {task.description}
                </p>
              ) : null}
              <p>
                <span className="font-medium text-zinc-800">Deadline:</span>{" "}
                {formatTaskDeadline(task.deadline, {
                  status: task.status,
                  progress: task.progress,
                })}
              </p>
              <p>
                <span className="font-medium text-zinc-800">Status:</span>{" "}
                {formatStatusLabel(displayStatus)}
              </p>
              <p>
                <span className="font-medium text-zinc-800">Progress:</span>{" "}
                {task.progress ?? 0}%
              </p>
            </div>
          </div>
        ) : null}

        <div className={configDialogFooterClass}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className={btnFormCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading || !task}
            className={btnFormSubmit}
          >
            {loading ? <Loader /> : "Process"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
