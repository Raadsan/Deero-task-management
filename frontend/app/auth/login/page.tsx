"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { APP_SYSTEM_NAME, APP_VERSION, ROUTES } from "@/lib/constants";
import { loginSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DefaultValues, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";

const LOGIN_LOGO_SRC = "/logo-02.png";

export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: {} as DefaultValues<z.infer<typeof loginSchema>>,
  });

  async function submitForm(data: z.infer<typeof loginSchema>) {
    setSubmitting(true);
    try {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe,
      });

      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          router.replace(ROUTES.verify);
          return;
        }
        toast.error(error.message || "Login failed. Please try again.");
        return;
      }

      router.replace(ROUTES.dashboard);
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
            />
          </div>
          <p className="text-sm text-zinc-500">Sign in to manage your Deero system</p>
        </div>

        <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-zinc-700">
              Email Address
            </label>
            <div className="group relative">
              <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#651210]" />
              <input
                id="email"
                type="email"
                placeholder="admin@company.com"
                autoComplete="email"
                disabled={submitting}
                aria-invalid={!!errors.email}
                className="auth-input"
                {...register("email")}
              />
            </div>
            {errors.email?.message && (
              <p className="text-sm text-[#651210]">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
              Password
            </label>
            <div className="group relative">
              <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-[#651210]" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={submitting}
                aria-invalid={!!errors.password}
                className="auth-input pr-12"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-400 transition-colors hover:text-[#651210] focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="text-sm text-[#651210]">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-[#651210] focus:ring-[#651210]/30"
              />
              Remember me
            </label>
            <Link
              href={ROUTES.forgotPassword}
              className="text-sm font-semibold text-[#651210] transition-colors hover:text-[#2563eb]"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="h-14 w-full rounded-md bg-[#651210] text-base font-semibold text-white transition-colors hover:bg-[#2563eb]"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-xs leading-relaxed text-zinc-400">
            {APP_SYSTEM_NAME}
            <br />
            Version {APP_VERSION}
          </p>
        </form>
      </div>
    </div>
  );
}
