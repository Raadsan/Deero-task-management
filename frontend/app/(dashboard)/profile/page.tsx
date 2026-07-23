"use client";

import { authClient } from "@/lib/auth-client";
import {
  getUserUploadedFiles,
  saveUserFiles,
  deleteUserFileById,
  updateUserData,
} from "@/lib/actions/user.action";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { getTaskFormBranchOptions } from "@/lib/actions/shared.action";
import { USER_DOCUMENT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Camera,
  FileText,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  Shield,
  User,
  Building2,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Check,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

// Compress image on client side before upload (prevents 1MB body limit errors)
function compressImage(
  file: File,
  maxWidth = 250,
  quality = 0.75,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas error");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getInitials(name?: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const session = authClient.useSession();
  const user = session.data?.user as any;
  const { mutate } = useSWRConfig();

  const [isEditing, setIsEditing] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [emailVal, setEmailVal] = useState("");
  const [departmentVal, setDepartmentVal] = useState("");
  const [roleVal, setRoleVal] = useState("");
  const [portfolioVal, setPortfolioVal] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [removeImageDialogOpen, setRemoveImageDialogOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [docSelections, setDocSelections] = useState<Record<string, File>>({});
  const docInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: portfoliosRes } = useSWR(
    "profile-portfolios",
    getTaskFormBranchOptions,
  );
  const portfolios = portfoliosRes?.data?.portfolios ?? [];
  const portfolio = portfolios.find(
    (p: any) => String(p.id) === String(user?.portfolioId),
  );

  // Fetch ONLY the logged-in user's documents
  const { data: filesRes, isLoading: loadingFiles } = useSWR(
    user?.id ? ["user-uploaded-files", user.id] : null,
    () => getUserUploadedFiles(user.id),
  );

  const existingFiles = filesRes?.data ?? [];
  const existingByType: Record<string, any> = {};
  for (const f of existingFiles) {
    existingByType[f.documentType || f.name] = f;
  }

  useEffect(() => {
    if (user) {
      setNameVal(user.name || "");
      setEmailVal(user.email || "");
      setDepartmentVal(user.department || "");
      setRoleVal(user.role || "staff");
      setPortfolioVal(user.portfolioId || "");
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center text-sm font-medium text-zinc-400">
        Loading profile...
      </div>
    );
  }

  const initials = getInitials(user.name);
  const isSuperadmin = user.role === "superadmin";
  const isAdmin = user.role === "admin" || isSuperadmin;
  const canManageDocuments = isAdmin; // Superadmin & Admin only can upload/edit documents

  // Handle Profile Picture Upload (Compresses image before upload)
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, etc).");
      return;
    }

    try {
      setUploadingImage(true);
      const dataUrl = await compressImage(file, 250, 0.75);
      const res = await updateUserData({ id: user.id, image: dataUrl });

      if (res.success) {
        toast.success("Profile picture updated successfully!");
        if (session.refetch) {
          await session.refetch();
        }
        mutate(["user-session"]);
        window.dispatchEvent(new Event("user-profile-updated"));
      } else {
        toast.error("Failed to update profile picture. Try again.");
      }
    } catch {
      toast.error("An error occurred while processing profile picture.");
    } finally {
      setUploadingImage(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleAvatarRemove() {
    if (!user.image || uploadingImage) return;

    try {
      setUploadingImage(true);
      const res = await updateUserData({ id: user.id, image: null });

      if (res.success) {
        toast.success("Profile picture removed successfully!");
        setRemoveImageDialogOpen(false);
        if (session.refetch) {
          await session.refetch();
        }
        mutate(["user-session"]);
        window.dispatchEvent(new Event("user-profile-updated"));
      } else {
        toast.error("Failed to remove profile picture. Try again.");
      }
    } catch {
      toast.error("An error occurred while removing the profile picture.");
    } finally {
      setUploadingImage(false);
    }
  }

  // Save Profile & Password Changes
  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      let hasError = false;

      // 1. Password update (Only triggered if user enters a new password)
      if (newPassword.trim().length > 0) {
        if (!currentPassword) {
          toast.error("Current password is required to change password.");
          return;
        }
        if (newPassword.length < 8) {
          toast.error("New password must be at least 8 characters.");
          return;
        }
        if (newPassword !== confirmPassword) {
          toast.error("New passwords do not match.");
          return;
        }

        const passRes = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        });

        if (passRes.error) {
          toast.error(passRes.error.message || "Failed to update password.");
          hasError = true;
        } else {
          toast.success("Password updated successfully!");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      }

      // 2. Profile Details Update
      const payload: { id: string; [key: string]: any } = { id: user.id };
      if (nameVal.trim() && nameVal.trim() !== user.name) {
        payload.name = nameVal.trim();
      }
      if (departmentVal !== (user.department || "")) {
        payload.department = departmentVal;
      }
      if (isAdmin) {
        if (emailVal.trim() && emailVal.trim() !== user.email) {
          payload.email = emailVal.trim();
        }
        if (roleVal && roleVal !== user.role) {
          payload.role = roleVal;
        }
        if (portfolioVal !== (user.portfolioId || "")) {
          payload.portfolioId = portfolioVal || null;
        }
      }

      if (Object.keys(payload).length > 1) {
        const updateRes = await updateUserData(payload);
        if (updateRes.success) {
          toast.success("Profile updated successfully!");
          if (session.refetch) {
            await session.refetch();
          }
          window.dispatchEvent(new Event("user-profile-updated"));
        } else {
          toast.error(updateRes.errors?.message || "Failed to update profile.");
          hasError = true;
        }
      }

      if (!hasError) {
        setIsEditing(false);
      }
    });
  }

  // Document Pick & Upload
  function handleDocFilePick(typeLabel: string, fileList: FileList | null) {
    if (!fileList?.length) return;
    const file = fileList[0];
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Only PDF files are allowed.");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error(`"${file.name}" exceeds 1MB limit.`);
      return;
    }
    setDocSelections((prev) => ({ ...prev, [typeLabel]: file }));
  }

  function clearDocSelection(typeLabel: string) {
    setDocSelections((prev) => {
      const next = { ...prev };
      delete next[typeLabel];
      return next;
    });
    if (docInputRefs.current[typeLabel]) {
      docInputRefs.current[typeLabel]!.value = "";
    }
  }

  function handleDocDelete(fileId: string) {
    startTransition(async () => {
      const result = await deleteUserFileById({ fileId, userId: user.id });
      if (result.success) {
        toast.success("Document deleted.");
        mutate(["user-uploaded-files", user.id]);
      } else {
        toast.error("Failed to delete document.");
      }
    });
  }

  function handleDocUpload() {
    const entries = USER_DOCUMENT_TYPES.flatMap(({ label }) => {
      const file = docSelections[label];
      return file ? [{ label, file }] : [];
    });

    if (!entries.length) {
      toast.error("Select at least one PDF document to upload.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = await Promise.all(
          entries.map(async ({ label, file }) => ({
            name: file.name,
            documentType: label,
            fileSize: file.size,
            data: await readFileAsDataUrl(file),
          })),
        );
        const result = await saveUserFiles({ userId: user.id, files: payload });
        if (!result.success) {
          toast.error(result.errors?.message ?? "Upload failed.");
          return;
        }
        toast.success("Documents uploaded successfully!");
        setDocSelections({});
        for (const { label } of USER_DOCUMENT_TYPES) {
          if (docInputRefs.current[label]) {
            docInputRefs.current[label]!.value = "";
          }
        }
        mutate(["user-uploaded-files", user.id]);
      } catch {
        toast.error("Failed to upload documents.");
      }
    });
  }

  return (
    <div className="w-full space-y-6 pb-12 pt-2">
      {/* ── Single Full-Width Consolidated Card ── */}
      <div className="w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl">
        {/* Banner Gradient */}
        <div className="relative h-36 w-full bg-gradient-to-r from-[#651210] via-primary to-secondary p-6 sm:px-8">
          <div className="flex items-center justify-between text-white">
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold backdrop-blur-md">
              <Sparkles className="size-3.5 text-amber-300" /> User Profile & Security
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/30"
            >
              <Pencil className="size-3.5" />
              {isEditing ? "View Details" : "Edit Profile"}
            </button>
          </div>
        </div>

        {/* Header Profile Summary */}
        <div className="px-6 pb-6 pt-0 sm:px-8">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end">
            {/* Avatar (ROUNDED FULL - Circular Avatar) */}
            <div className="relative -mt-16 shrink-0">
              <div className="relative flex size-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-primary shadow-2xl">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-black text-white">
                    {initials}
                  </span>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white backdrop-blur-sm">
                    Uploading...
                  </div>
                )}
              </div>

              {/* Upload Input & Camera Button ONLY when isEditing */}
              {isEditing && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    title="Upload Profile Picture"
                    disabled={uploadingImage}
                    className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-xl transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                  >
                    <Camera className="size-4" />
                  </button>
                  {user.image && (
                    <button
                      type="button"
                      onClick={() => setRemoveImageDialogOpen(true)}
                      title="Remove Profile Picture"
                      aria-label="Remove profile picture"
                      disabled={uploadingImage}
                      className="absolute bottom-0 left-0 flex size-9 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition-all hover:scale-110 hover:bg-red-700 active:scale-95 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* User Details Title & Badges */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                {user.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  <Shield className="size-3.5" />
                  {user.role || "Staff"}
                </span>
                {portfolio && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-secondary">
                    <Building2 className="size-3.5" />
                    {portfolio.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1 text-xs font-semibold text-zinc-600">
                  <Mail className="size-3.5 text-zinc-400" />
                  {user.email}
                </span>
              </div>
            </div>
          </div>

          <hr className="my-6 border-zinc-100" />

          {/* ── EDIT MODE ── */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    Edit Account Details & Password
                  </h3>
                  <span className="text-[11px] font-semibold text-zinc-500">
                    Fields marked (Inactive) cannot be modified by your role
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Full Name */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={nameVal}
                      onChange={(e) => setNameVal(e.target.value)}
                      required
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      Email Address {!isAdmin && <span className="text-[10px] text-zinc-400">(Inactive)</span>}
                    </label>
                    <input
                      type="email"
                      value={emailVal}
                      onChange={(e) => setEmailVal(e.target.value)}
                      disabled={!isAdmin}
                      className={cn(
                        "h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-medium outline-none",
                        isAdmin ? "bg-white focus:border-primary" : "cursor-not-allowed bg-zinc-100 text-zinc-500",
                      )}
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      Role {!isAdmin && <span className="text-[10px] text-zinc-400">(Inactive)</span>}
                    </label>
                    {isAdmin ? (
                      <select
                        value={roleVal}
                        onChange={(e) => setRoleVal(e.target.value)}
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium outline-none focus:border-primary"
                      >
                        <option value="superadmin">Superadmin</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                        <option value="user">User</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={user.role || "Staff"}
                        disabled
                        className="h-10 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 text-sm font-medium capitalize text-zinc-500"
                      />
                    )}
                  </div>

                  {/* Department */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      Department
                    </label>
                    <input
                      type="text"
                      value={departmentVal}
                      onChange={(e) => setDepartmentVal(e.target.value)}
                      placeholder="Department"
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm font-medium outline-none focus:border-primary"
                    />
                  </div>

                  {/* Portfolio */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      Portfolio {!isAdmin && <span className="text-[10px] text-zinc-400">(Inactive)</span>}
                    </label>
                    {isAdmin ? (
                      <select
                        value={portfolioVal}
                        onChange={(e) => setPortfolioVal(e.target.value)}
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium outline-none focus:border-primary"
                      >
                        <option value="">All Portfolios (Global)</option>
                        {portfolios.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={portfolio?.name || "Global"}
                        disabled
                        className="h-10 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 text-sm font-medium text-zinc-500"
                      />
                    )}
                  </div>

                  {/* Portfolio ID (Inactive) */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      Portfolio ID <span className="text-[10px] text-zinc-400">(Inactive)</span>
                    </label>
                    <input
                      type="text"
                      value={user.portfolioId || "Global"}
                      disabled
                      className="h-10 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 text-sm font-medium text-zinc-500"
                    />
                  </div>

                  {/* User ID (Inactive) */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      User ID <span className="text-[10px] text-zinc-400">(Inactive)</span>
                    </label>
                    <input
                      type="text"
                      value={user.id}
                      disabled
                      className="h-10 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 text-xs font-mono font-medium text-zinc-500"
                    />
                  </div>

                  {/* Member Since (Inactive) */}
                  <div>
                    <label className="mb-1 block text-xs font-bold text-zinc-700">
                      Member Since <span className="text-[10px] text-zinc-400">(Inactive)</span>
                    </label>
                    <input
                      type="text"
                      value={
                        user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "N/A"
                      }
                      disabled
                      className="h-10 w-full cursor-not-allowed rounded-xl border border-zinc-200 bg-zinc-100 px-3.5 text-sm font-medium text-zinc-500"
                    />
                  </div>
                </div>

                {/* Password Change Sub-section */}
                <div className="mt-6 border-t border-primary/10 pt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <KeyRound className="size-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                      Change Password
                    </h4>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-zinc-600">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Current password"
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-3.5 pr-9 text-sm outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-zinc-600">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-3.5 pr-9 text-sm outline-none focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                        >
                          {showNewPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-zinc-600">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Document Upload Section ONLY for Superadmin & Admin in Edit Mode */}
                {canManageDocuments && (
                  <div className="mt-6 border-t border-primary/10 pt-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                        Upload / Manage Documents
                      </h4>
                      <span className="text-[11px] text-zinc-500">
                        Max 1MB per PDF document
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      {USER_DOCUMENT_TYPES.map(({ id, label }) => {
                        const selected = docSelections[label];
                        const existing = existingByType[label];
                        return (
                          <div
                            key={id}
                            className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm"
                          >
                            <div>
                              <div className="mb-1.5 flex items-center justify-between gap-1">
                                <p className="text-xs font-bold text-slate-800">
                                  {label}
                                </p>
                                {existing && !selected && (
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                    <Check className="size-3" /> Uploaded
                                  </span>
                                )}
                              </div>

                              {existing && !selected && (
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="truncate text-[11px] text-zinc-500">
                                    {existing.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDocDelete(existing.id)}
                                    disabled={isPending}
                                    className="flex items-center gap-0.5 text-[10px] font-bold text-rose-500 hover:text-rose-700"
                                  >
                                    <Trash2 className="size-3" /> Delete
                                  </button>
                                </div>
                              )}
                            </div>

                            <input
                              ref={(node) => {
                                docInputRefs.current[label] = node;
                              }}
                              type="file"
                              accept=".pdf,application/pdf"
                              className="hidden"
                              onChange={(e) =>
                                handleDocFilePick(label, e.target.files)
                              }
                            />

                            {selected ? (
                              <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1.5">
                                <span className="truncate text-xs font-semibold text-slate-800">
                                  {selected.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => clearDocSelection(label)}
                                  className="text-zinc-400 hover:text-zinc-600"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  docInputRefs.current[label]?.click()
                                }
                                disabled={isPending}
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 bg-white py-2 text-xs font-semibold text-zinc-600 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                              >
                                <Upload className="size-3.5" /> Upload PDF
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {Object.keys(docSelections).length > 0 && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleDocUpload}
                          disabled={isPending}
                          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-primary/90 disabled:opacity-50"
                        >
                          <Upload className="size-3.5" />
                          {isPending ? "Uploading..." : "Upload Selected Files"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Form Action Buttons */}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "Saving..." : "Save Profile & Password"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* ── READ-ONLY DETAILS VIEW (3 items per row) ── */
            <div className="space-y-6">
              {/* Account Details - 3 Columns Per Row */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Account Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Full Name
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
                      {user.name}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Email Address
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
                      {user.email}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Role
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-800 capitalize">
                      {user.role || "Staff"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Portfolio
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
                      {portfolio?.name || (user.portfolioId ? `ID: ${user.portfolioId}` : "All Portfolios")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Department
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
                      {user.department || "N/A"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Portfolio ID
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
                      {user.portfolioId || "Global"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      User ID
                    </p>
                    <p className="mt-1.5 truncate text-xs font-mono font-bold text-slate-700">
                      {user.id}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Member Since
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold text-slate-800">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>

                  {/* Password Field Box */}
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Password
                    </p>
                    <p className="mt-1.5 truncate text-sm font-bold tracking-widest text-slate-800">
                      ••••••••
                    </p>
                  </div>
                </div>
              </div>

              {/* ── MY DOCUMENTS (Read Mode - 3 Columns Per Row, View Button or N/A, No Upload Buttons) ── */}
              <div className="border-t border-zinc-100 pt-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    My Documents
                  </h3>
                  <span className="text-[11px] font-medium text-zinc-400">
                    PDF Documents
                  </span>
                </div>

                {loadingFiles ? (
                  <div className="py-6 text-center text-xs text-zinc-400">
                    Loading documents...
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {USER_DOCUMENT_TYPES.map(({ id, label }) => {
                      const existing = existingByType[label];
                      const fileUrl =
                        existing?.url || existing?.filePath || existing?.path;

                      return (
                        <div
                          key={id}
                          className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 transition-all hover:bg-white hover:shadow-md"
                        >
                          <div>
                            <div className="mb-2 flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-800">
                                {label}
                              </p>
                              {existing ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                  <Check className="size-3" /> Uploaded
                                </span>
                              ) : (
                                <span className="rounded bg-zinc-200/60 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                                  N/A
                                </span>
                              )}
                            </div>

                            {existing ? (
                              <div className="mt-2 space-y-1">
                                <p className="truncate text-xs font-semibold text-slate-700">
                                  {existing.name}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-2 text-xs font-medium text-zinc-400">
                                N/A
                              </p>
                            )}
                          </div>

                          {/* View Button in Read Mode if file exists */}
                          <div className="mt-4">
                            {existing && fileUrl ? (
                              <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white"
                              >
                                <ExternalLink className="size-3.5" /> View Document
                              </a>
                            ) : existing ? (
                              <button
                                type="button"
                                onClick={() =>
                                  toast.error("Document link unavailable.")
                                }
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2 text-xs font-semibold text-zinc-400"
                              >
                                <FileText className="size-3.5" /> Document Uploaded
                              </button>
                            ) : (
                              <div className="flex w-full items-center justify-center rounded-xl border border-dashed border-zinc-200 py-2 text-xs font-semibold text-zinc-400">
                                N/A
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={removeImageDialogOpen}
        onOpenChange={setRemoveImageDialogOpen}
        title="Remove profile picture?"
        description="Your current profile picture will be removed and replaced with your initials."
        confirmLabel="Remove picture"
        cancelLabel="Keep picture"
        onConfirm={handleAvatarRemove}
        loading={uploadingImage}
        destructive
      />
    </div>
  );
}
