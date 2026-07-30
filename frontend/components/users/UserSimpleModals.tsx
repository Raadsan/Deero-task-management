"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserById, updateUserData } from "@/lib/apis/userApi";
import { authClient } from "@/lib/auth-client";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormSubmit } from "@/lib/dashboard-ui";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

export default function UserSimpleViewModal({ open, onOpenChange, userId }: Props) {
  const { data, isLoading } = useSWR(
    open && userId ? ["user-simple-view", userId] : null,
    () => getUserById(userId!),
  );

  const user = data?.data as
    | { id?: string; name?: string; email?: string }
    | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>View User</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3 py-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded bg-zinc-100" />
            ))}
          </div>
        ) : user ? (
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium text-zinc-500">User ID</dt>
              <dd className="mt-1 font-mono text-zinc-900">{user.id}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Name</dt>
              <dd className="mt-1 text-zinc-900">{user.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Email</dt>
              <dd className="mt-1 text-zinc-900">{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-500">Password</dt>
              <dd className="mt-1 font-mono text-zinc-600">••••••••</dd>
              <p className="mt-1 text-xs text-zinc-400">
                Passwords are stored securely and cannot be displayed.
              </p>
            </div>
          </dl>
        ) : (
          <p className="py-6 text-center text-zinc-500">User not found.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserSimpleEditModal({ open, onOpenChange, userId }: Props) {
  const { mutate } = useSWRConfig();
  const { data, isLoading } = useSWR(
    open && userId ? ["user-simple-edit", userId] : null,
    () => getUserById(userId!),
  );

  const user = data?.data as
    | { id?: string; name?: string; email?: string }
    | undefined;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setPassword("");
  }, [user]);

  function handleSave() {
    if (!userId) return;
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    startTransition(async () => {
      const result = await updateUserData({
        id: userId,
        name: name.trim(),
        email: email.trim(),
      });
      if (!result.success) {
        toast.error(result.errors?.message ?? "Failed to update user");
        return;
      }

      if (password.trim()) {
        const passwordResult = await authClient.admin.setUserPassword({
          userId,
          newPassword: password.trim(),
        });
        if (passwordResult.error) {
          toast.error(
            passwordResult.error.message ??
              "User updated but password change failed.",
          );
          return;
        }
      }

      toast.success(
        password.trim() ? "User and password updated" : "User updated",
      );
      mutate(SWR_CACH_KEYS.users.key);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3 py-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded bg-zinc-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-600">
                User ID
              </label>
              <Input value={user?.id ?? userId ?? ""} readOnly disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-600">
                Name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-600">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-600">
                New password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className={btnFormSubmit}
            disabled={pending || isLoading}
            onClick={handleSave}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
