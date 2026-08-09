"use client";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import toast from "react-hot-toast";

const LOGIN_LOGO_SRC = "/logo-02.png";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate token presence
  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset link. Please request a new one.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    setSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:7003";
      const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.message || "Failed to reset password. The link may have expired.");
        return;
      }

      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => router.replace(ROUTES.login), 3000);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f6f4f1] px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-zinc-100 bg-white px-8 pt-8 pb-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-10 sm:pt-9 sm:pb-7">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-6 flex h-28 w-full items-center justify-center overflow-hidden sm:h-32">
            <Image
              src={LOGIN_LOGO_SRC}
              width={334}
              height={128}
              alt="Deero logo"
              className="h-auto max-h-28 w-auto max-w-full object-contain"
              priority
            />
          </div>
        </div>

        {success ? (
          /* ── Success State ── */
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-500" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-zinc-800">Password Reset!</h1>
            <p className="text-sm text-zinc-500">
              Your password has been updated successfully. You will be redirected to the
              sign-in page shortly.
            </p>
            <Link
              href={ROUTES.login}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#651210] transition-colors hover:text-[#2563eb]"
            >
              Go to Sign In <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          /* ── Form State ── */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-2 text-center">
              <h1 className="text-xl font-semibold text-zinc-800">Set New Password</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Enter your new password below.
              </p>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700">
                New Password
              </label>
              <div className="group relative">
                <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#651210]" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  disabled={submitting || !token}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 transition-colors hover:text-[#651210] focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
                Confirm Password
              </label>
              <div className="group relative">
                <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#651210]" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  disabled={submitting || !token}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={submitting}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 transition-colors hover:text-[#651210] focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-[#651210]">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-14 w-full rounded-md bg-[#651210] text-base font-semibold text-white transition-colors hover:bg-[#2563eb]"
              disabled={submitting || !token}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  Reset Password
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center">
              <Link
                href={ROUTES.login}
                className="text-sm font-semibold text-[#651210] transition-colors hover:text-[#2563eb]"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f6f4f1]">
          <Loader2 className="h-8 w-8 animate-spin text-[#651210]" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
