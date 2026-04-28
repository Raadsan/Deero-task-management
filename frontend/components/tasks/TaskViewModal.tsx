"use client";

import { formatTaskDeadline } from "@/lib/utils";
import { Task } from "@/lib/types";
import { X, Calendar, User, Users, Building2, Tag, AlertCircle } from "lucide-react";

interface Props {
  task: Task;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-800" },
  overdue: { bg: "bg-red-100", text: "text-red-800" },
  completed: { bg: "bg-green-100", text: "text-green-800" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  normal: { bg: "bg-blue-100", text: "text-blue-800" },
  medium: { bg: "bg-orange-100", text: "text-orange-800" },
  urgent: { bg: "bg-red-100", text: "text-red-800" },
};

export default function TaskViewModal({ task, onClose }: Props) {
  const statusColor = STATUS_COLORS[task.status] ?? { bg: "bg-gray-100", text: "text-gray-800" };
  const priorityColor = PRIORITY_COLORS[task.priority] ?? { bg: "bg-gray-100", text: "text-gray-800" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-[#8B0000] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Task Details</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-6">

          {/* ID */}
          <div className="flex items-center gap-2 text-xs text-gray-400 font-mono">
            ID: {task.id}
          </div>

          <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Description</p>
            <p className="text-sm text-gray-800 leading-relaxed">{task.description}</p>
          </div>

          {/* Progress */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Completion Progress</p>
              <span className="text-sm font-bold text-[#8B0000]">{task.progress || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-[#8B0000] h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${task.progress || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-2 gap-3">

            {/* Assigned To */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Assigned To</p>
                <p className="text-sm font-medium text-gray-800">{task.assignedTo?.name ?? "—"}</p>
              </div>
            </div>

            {/* Supervisor */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Supervisor</p>
                <p className="text-sm font-medium text-gray-800">{task.supervisor || "—"}</p>
              </div>
            </div>

            {/* Department */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Department</p>
                <p className="text-sm font-medium text-gray-800">{task.department}</p>
              </div>
            </div>

            {/* Deadline */}
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Deadline</p>
                <p className="text-sm font-medium text-gray-800">{formatTaskDeadline(task.deadline)}</p>
              </div>
            </div>

          </div>

          {/* Status & Priority */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-gray-400" />
              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColor.bg} ${statusColor.text}`}>
                {task.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-400" />
              <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${priorityColor.bg} ${priorityColor.text}`}>
                {task.priority}
              </span>
            </div>
          </div>

          {/* Clients */}
          {task.institutions?.length > 0 && (
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Clients</p>
              <div className="flex flex-wrap gap-2">
                {task.institutions.map(({ id, institution }) => (
                  <span key={id} className="rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                    {institution}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-end rounded-b-xl border-t border-gray-100 px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#8B0000] px-5 py-2 text-sm font-medium text-white hover:bg-[#6b0000] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
