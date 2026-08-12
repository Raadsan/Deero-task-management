"use client";

import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Mail } from "lucide-react";
import { ROUTES } from "@/lib/constants";

const LOGIN_LOGO_SRC = "/logo-02.png";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setSubmitting(true);
    const apiUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:7003";
    try {
      const check = await fetch(`${apiUrl}/api/auth-custom/password-reset/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const checked = await check.json().catch(() => null);
      if (!check.ok) return toast.error(checked?.message || "This email address is not registered.");

      const response = await fetch(`${apiUrl}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }),
      });
      if (!response.ok) return toast.error("Could not send reset email.");
      toast.success("Reset link sent. Please check your email.");
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#f6f4f1] px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-zinc-100 bg-white px-8 pt-8 pb-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:px-10 sm:pt-9 sm:pb-7">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-6 flex h-28 w-full items-center justify-center overflow-hidden sm:h-32">
            <Image
              src={LOGIN_LOGO_SRC}
              width={334}
              height={128}
              alt="Deero logo"
              className="h-auto max-h-28 w-auto max-w-full object-contain"
              priority
              unoptimized
            />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Forgot Password</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Enter your registered email address to receive password reset instructions.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700">
              Email Address
            </label>
            <div className="group relative">
              <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#651210]" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={submitting}
                className="auth-input"
                placeholder="admin@company.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-11 w-full items-center justify-center rounded-md bg-[#651210] font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-100 pt-4 text-center">
          <Link
            href={ROUTES.login}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#651210] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
