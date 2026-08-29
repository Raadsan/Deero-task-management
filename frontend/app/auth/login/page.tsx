"use client";

import { Button } from "@/components/ui/button";
import { APP_SYSTEM_NAME, APP_VERSION, ROUTES } from "@/lib/constants";
import { loginSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Gauge,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { DefaultValues, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";

const features = [
  { Icon: ShieldCheck, title: "Secure", text: "Your data is always protected" },
  { Icon: Gauge, title: "Fast", text: "Access your system in just a click" },
  { Icon: BarChart3, title: "Smart", text: "Manage tasks and reports easily" },
];

export default function LoginPage() {
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      const apiUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:7003";
      const response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: data.email, password: data.password, rememberMe }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        if (result?.code === "EMAIL_NOT_VERIFIED") {
          window.location.replace(ROUTES.verify);
          return;
        }
        toast.error(result?.message || "Login failed. Please try again.");
        return;
      }
      window.location.replace(ROUTES.dashboard);
    } catch {
      toast.error("Could not reach the login server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-white" />

      <section className="relative grid w-full max-w-[1080px] overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_28px_90px_rgba(101,18,16,0.16)] lg:min-h-[650px] lg:grid-cols-[44%_56%]">
        <aside className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_55%_35%,#8f1d18_0%,#651210_46%,#3d0908_100%)] px-12 py-11 text-white lg:flex lg:flex-col">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.7)_1px,transparent_1.5px)] [background-size:11px_11px] [mask-image:linear-gradient(to_bottom_left,black,transparent_24%)]" />
          <div className="pointer-events-none absolute -left-40 top-24 size-[430px] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -left-24 top-40 size-[430px] rounded-full border border-white/5" />

          <Image src="/logo-02.png" width={180} height={72} alt="Deero" className="relative h-auto w-36 object-contain" priority unoptimized />
          <div className="relative mt-7">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back!</h1>
            <p className="mt-2 max-w-[270px] text-sm leading-6 text-white/70">
              Sign in to access your Deero system and manage your tasks efficiently.
            </p>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center py-3">
            <div className="absolute bottom-[14%] h-14 w-[78%] rounded-[50%] bg-black/20 blur-xl" />
            <Image
              src="/login_icon.png"
              width={420}
              height={320}
              alt="Task analytics illustration"
              className="relative h-auto w-[68%] max-w-[300px] object-contain drop-shadow-[0_16px_22px_rgba(30,0,0,0.24)]"
              priority
            />
          </div>

          <div className="relative grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
            {features.map(({ Icon, title, text }) => (
              <div key={title} className="flex min-w-0 gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#ffb2a2]">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <strong className="block text-[11px] font-semibold">{title}</strong>
                  <span className="mt-0.5 block text-[8px] leading-3 text-white/60">{text}</span>
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex items-center justify-center px-6 py-10 sm:px-12 lg:px-20">
          <div className="w-full max-w-[390px]">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-[#fff0ed] text-[#ec4724] ring-6 ring-[#fff8f7]">
                <ShieldCheck className="size-7" strokeWidth={1.8} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-zinc-950">Sign in to your account</h2>
              <p className="mt-2 text-sm text-zinc-500">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleSubmit(submitForm)} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-zinc-700">Email Address</label>
                <div className="group relative">
                  <Mail className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#651210]" />
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@company.com"
                    autoComplete="email"
                    disabled={submitting}
                    aria-invalid={!!errors.email}
                    className="h-12 w-full rounded-lg border border-zinc-200 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-[#ec4724] focus:ring-4 focus:ring-[#ec4724]/10 disabled:opacity-60"
                    {...register("email")}
                  />
                </div>
                {errors.email?.message ? <p className="text-xs text-rose-600">{errors.email.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-zinc-700">Password</label>
                <div className="group relative">
                  <Lock className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#651210]" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={submitting}
                    aria-invalid={!!errors.password}
                    className="h-12 w-full rounded-lg border border-zinc-200 bg-white pl-12 pr-12 text-sm outline-none transition focus:border-[#ec4724] focus:ring-4 focus:ring-[#ec4724]/10 disabled:opacity-60"
                    {...register("password")}
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#651210]" aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                {errors.password?.message ? <p className="text-xs text-rose-600">{errors.password.message}</p> : null}
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-zinc-600">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="size-4 accent-[#651210]" />
                  Remember me
                </label>
                <Link href={ROUTES.forgotPassword} className="font-semibold text-[#651210] hover:text-[#ec4724]">Forgot password?</Link>
              </div>

              <Button type="submit" className="h-12 w-full rounded-lg bg-gradient-to-r from-[#651210] to-[#8f1d18] font-semibold text-white shadow-[0_10px_22px_rgba(101,18,16,0.2)] hover:from-[#7a1714] hover:to-[#a32922]" disabled={submitting}>
                {submitting ? <><Loader2 className="animate-spin" />Signing in...</> : <>Sign In<ArrowRight className="size-4" /></>}
              </Button>
{/* 
              <div className="flex items-center gap-3 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200" /><span>or</span><span className="h-px flex-1 bg-zinc-200" /></div> */}

              <p className="pt-2 text-center text-xs leading-relaxed text-zinc-400">
                {APP_SYSTEM_NAME}<br /><span className="font-medium text-[#9a2a24]">Version {APP_VERSION}</span>
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
