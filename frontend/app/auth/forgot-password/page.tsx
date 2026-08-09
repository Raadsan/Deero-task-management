"use client";

import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setSubmitting(true);
    const apiUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:7003";
    try {
      const check = await fetch(`${apiUrl}/api/auth-custom/password-reset/check-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail }) });
      const checked = await check.json().catch(() => null);
      if (!check.ok) return toast.error(checked?.message || "This email address is not registered.");
      const response = await fetch(`${apiUrl}/api/auth/request-password-reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalizedEmail, redirectTo: `${window.location.origin}/auth/reset-password` }) });
      if (!response.ok) return toast.error("Could not send reset email.");
      toast.success("Reset link sent. Please check your email.");
    } catch { toast.error("Could not reach the server."); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-brand-primary">
          Forgot Password
        </h1>
        <p className="text-sm text-neutral-500">
          Password reset is not available yet. Please contact your administrator
          to restore access to your account.
        </p>
        <form onSubmit={submit} className="space-y-3 text-left">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={submitting} className="auth-input" placeholder="Email address" />
          <button type="submit" disabled={submitting} className="h-11 w-full rounded-md bg-[#651210] font-semibold text-white">{submitting ? "Sending..." : "Send reset link"}</button>
        </form>

        <Link
          href={ROUTES.login}
          className="inline-block text-sm font-semibold text-brand-primary hover:text-brand-secondary"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
