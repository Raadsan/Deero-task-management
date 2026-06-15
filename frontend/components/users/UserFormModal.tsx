"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUserById } from "@/lib/actions/user.action";
import { User } from "@/lib/schema";
import useSWR from "swr";
import UserForm from "./UsersForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  userId?: string;
}

async function loadUserFormData(mode: "create" | "edit", userId?: string) {
  if (mode === "edit" && userId) {
    const result = await getUserById(userId);
    return { user: result.data as User | undefined };
  }
  return { user: undefined };
}

export default function UserFormModal({
  open,
  onOpenChange,
  mode,
  userId,
}: Props) {
  const { data, isLoading } = useSWR(
    open ? ["user-form-modal", mode, userId ?? "new"] : null,
    () => loadUserFormData(mode, userId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            {mode === "create" ? "Create User" : "Edit User"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {mode === "create"
              ? "Add a new team member with role and branch."
              : "Update user profile details."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <div className="space-y-4 animate-pulse px-6 py-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : (
            <UserForm
              formType={mode}
              data={data?.user}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
