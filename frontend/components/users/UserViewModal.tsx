"use client";

import { resolveApiAssetUrl } from "@/lib/apis/config";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getUserById } from "@/lib/apis/userApi";
import { btnFormSubmit } from "@/lib/dashboard-ui";
import { UserFiles } from "@/lib/schema";
import { formatDate } from "@/lib/utils";
import {
  Building2,
  Banknote,
  Calendar,
  ExternalLink,
  FileText,
  Mail,
  Shield,
  User as UserIcon,
  Users,
} from "lucide-react";
import useSWR from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export default function UserViewModal({ open, onOpenChange, userId }: Props) {
  const { data, isLoading } = useSWR(
    open && userId ? ["user-view-modal", userId] : null,
    () => getUserById(userId!),
  );

  const user = data?.data as
    | {
        name?: string;
        email?: string;
        role?: string;
        gender?: string;
        salary?: string | null;
        portfolio?: { name?: string };
        createdAt?: string;
        banned?: boolean;
        userFiles?: UserFiles[];
      }
    | undefined;

  const documents = user?.userFiles ?? [];
  const isInactive = !!user?.banned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            Staff Details
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            View staff information and uploaded documents.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="animate-pulse space-y-4 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : !user ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Employee not found.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoItem
                  icon={UserIcon}
                  label="Name"
                  value={user.name ?? "—"}
                />
                <InfoItem icon={Mail} label="Email" value={user.email ?? "—"} />
                <InfoItem icon={Shield} label="Role" value={user.role ?? "—"} />
                <InfoItem
                  icon={Users}
                  label="Gender"
                  value={user.gender ?? "—"}
                />
                <InfoItem
                  icon={Building2}
                  label="Portfolio"
                  value={user.portfolio?.name ?? "—"}
                />
                <InfoItem
                  icon={Banknote}
                  label="Monthly Salary"
                  value={
                    user.salary
                      ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(Number(user.salary))
                      : "—"
                  }
                />
                <InfoItem
                  icon={Calendar}
                  label="Joined"
                  value={formatDate(user.createdAt ?? "") || "—"}
                />
                <InfoItem
                  icon={Shield}
                  label="Status"
                  value={isInactive ? "Inactive" : "Active"}
                />
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="size-4 text-zinc-500" />
                  <h3 className="text-sm font-semibold text-zinc-800">
                    Documents ({documents.length})
                  </h3>
                </div>

                {documents.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No documents uploaded for this employee.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-800">
                            {file.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {(file.fileSize / 1024).toFixed(1)} KB ·{" "}
                            {formatDate(String(file.createdAt)) || "—"}
                          </p>
                        </div>
                        <a
                          href={resolveApiAssetUrl(file.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline"
                        >
                          View
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-6 py-4">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className={btnFormSubmit}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-zinc-800 capitalize">
          {value}
        </p>
      </div>
    </div>
  );
}
