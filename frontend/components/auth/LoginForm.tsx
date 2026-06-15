"use client";

import { BranchThemeProvider } from "@/components/branding/BranchThemeProvider";
import { Button } from "@/components/ui/button";
import {
  getPublicBranchBySlug,
  getMainBranchBranding,
  setLoginBranchCookie,
  validateUserLoginBranch,
} from "@/lib/actions/branch.action";
import { getUserById } from "@/lib/actions/user.action";
import {
  BranchBranding,
  resolveBranchLogoUrl,
} from "@/lib/branch-branding";
import { authClient } from "@/lib/auth-client";
import { BRANCH_SLUG_COOKIE, ICONS, ROUTES } from "@/lib/constants";
import { loginSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  BarChart3,
  ClipboardList,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { DefaultValues, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";

const features = [
  {
    icon: ClipboardList,
    text: "Manage tasks and projects across your team",
  },
  {
    icon: BarChart3,
    text: "Track payments, income, and business reports",
  },
  {
    icon: Users,
    text: "Organize clients, users, and departments",
  },
];

function getCookieValue(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

type LoginFormProps = {
  branchSlug?: string;
  initialBranding?: BranchBranding | null;
  isRootLogin?: boolean;
};

export default function LoginForm({
  branchSlug: branchSlugProp,
  initialBranding,
  isRootLogin = false,
}: LoginFormProps) {
  const [transition, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [branchBranding, setBranchBranding] = useState<BranchBranding | null>(
    initialBranding ?? null,
  );
  const [loadingBranch, setLoadingBranch] = useState(!initialBranding);
  const router = useRouter();
  const branchSlug = branchSlugProp || getCookieValue(BRANCH_SLUG_COOKIE);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: {} as DefaultValues<z.infer<typeof loginSchema>>,
  });

  useEffect(() => {
    if (initialBranding) {
      setBranchBranding(initialBranding);
      setLoadingBranch(false);
      return;
    }

    let active = true;

    async function loadBranchBranding() {
      setLoadingBranch(true);

      if (!branchSlug) {
        const result = await getMainBranchBranding();
        if (!active) return;

        if (result.success && result.data) {
          setBranchBranding(result.data);
        } else {
          setBranchBranding(null);
        }
        setLoadingBranch(false);
        return;
      }

      const result = await getPublicBranchBySlug(branchSlug);
      if (!active) return;

      if (result.success && result.data) {
        setBranchBranding(result.data);
      } else {
        setBranchBranding(null);
        toast.error("Branch not found for this login URL");
      }

      setLoadingBranch(false);
    }

    loadBranchBranding();

    return () => {
      active = false;
    };
  }, [branchSlug, initialBranding]);

  const desktopLogo = useMemo(() => {
    const branchLogo = resolveBranchLogoUrl(branchBranding?.logoUrl);
    return branchLogo || ICONS.logoPng1;
  }, [branchBranding]);

  const mobileLogo = useMemo(() => {
    const branchLogo = resolveBranchLogoUrl(branchBranding?.logoUrl);
    return branchLogo || ICONS.logoPng;
  }, [branchBranding]);

  const brandName = branchBranding?.name || "Deero";

  function submitForm(data: z.infer<typeof loginSchema>) {
    startTransition(async () => {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe,
      });

      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          return router.push(ROUTES.verify);
        }
        toast.error(error.message || "Login failed. Please try again.");
        return;
      }

      if (branchBranding) {
        const session = await authClient.getSession();
        const sessionUser = session.data?.user as
          | { id?: string; branchId?: string | null; role?: string }
          | undefined;

        let userBranchId = sessionUser?.branchId ?? null;
        if (!userBranchId && sessionUser?.id) {
          const userResult = await getUserById(sessionUser.id);
          if (userResult.success && userResult.data) {
            userBranchId = (userResult.data as { branchId?: string | null }).branchId ?? null;
          }
        }

        const validation = await validateUserLoginBranch({
          userBranchId,
          loginBranchId: branchBranding.id,
          isRootLogin: isRootLogin || !branchSlug,
          userRole: sessionUser?.role,
        });

        if (!validation.success) {
          await authClient.signOut();
          const loginPath = validation.errors?.loginPath;
          toast.error(
            validation.errors?.message ||
              "This account does not belong to this branch",
          );
          if (loginPath) {
            router.push(loginPath);
          }
          return;
        }

        const branchId = validation.data?.branchId || branchBranding.id;
        await setLoginBranchCookie(branchId);
      }

      toast.success("Login successful!");
      router.push(ROUTES.dashboard);
    });
  }

  return (
    <BranchThemeProvider branding={branchBranding}>
      <div className="relative flex min-h-screen w-full">
        <aside className="auth-brand-panel relative hidden w-1/2 flex-col justify-between overflow-hidden py-14 pr-12 pl-16 lg:flex lg:pr-16 lg:pl-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-16 left-16 h-40 w-40 rounded-full bg-white/10 lg:left-24" />
            <div className="absolute top-1/3 right-16 h-28 w-28 rounded-full bg-brand-secondary/20" />
            <div className="absolute bottom-24 left-1/3 h-52 w-52 rounded-full bg-white/5" />
            <div className="absolute right-24 bottom-12 h-24 w-24 rounded-full bg-brand-secondary/15" />
          </div>

          <div className="relative z-10 flex flex-1 flex-col justify-center">
            <div className="w-full max-w-xl space-y-8 text-left">
              <div className="flex w-full justify-center">
                {loadingBranch ? (
                  <div className="h-20 w-56 animate-pulse rounded bg-white/10" />
                ) : (
                  <Image
                    src={desktopLogo}
                    width={280}
                    height={115}
                    alt={`${brandName} logo`}
                    className="h-20 w-auto max-w-[280px] object-contain"
                    priority
                    unoptimized={desktopLogo.startsWith("http")}
                  />
                )}
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl leading-tight font-semibold text-white">
                  Welcome Back!
                </h1>
                <p className="text-base leading-relaxed text-white/80">
                  Sign in to access your {brandName} management dashboard and keep
                  your team, clients, and operations organized in one place.
                </p>
              </div>

              <ul className="space-y-5">
                {features.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                      <Icon className="h-5 w-5 text-white" />
                    </span>
                    <span className="pt-2 text-sm leading-relaxed text-white/85">
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="relative z-10 shrink-0 text-left text-sm text-white/60">
            {brandName} Task Management System
          </p>
        </aside>

        <main className="flex w-full flex-col items-center justify-center bg-white px-6 py-10 sm:py-12 lg:w-1/2">
          <div className="w-full max-w-md space-y-10">
            <div className="flex w-full justify-center lg:hidden">
              {loadingBranch ? (
                <div className="h-14 w-40 animate-pulse rounded bg-zinc-100" />
              ) : (
                <Image
                  src={mobileLogo}
                  width={200}
                  height={80}
                  alt={`${brandName} logo`}
                  className="h-14 w-auto object-contain sm:h-16"
                  priority
                  unoptimized={mobileLogo.startsWith("http")}
                />
              )}
            </div>

            <div className="space-y-12 text-left">
              <h2 className="text-3xl font-semibold text-brand-primary">Sign In</h2>
              <p className="text-sm text-neutral-500">
                {branchBranding
                  ? `Enter your credentials for ${brandName}`
                  : "Enter your credentials to access your account"}
              </p>
            </div>

            <form onSubmit={handleSubmit(submitForm)} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-neutral-700"
                >
                  Email Address
                </label>
                <div className="group relative">
                  <Mail className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-400 transition-colors group-focus-within:text-brand-primary" />
                  <input
                    id="email"
                    type="email"
                    placeholder="username@gmail.com"
                    autoComplete="email"
                    disabled={transition || loadingBranch}
                    aria-invalid={!!errors.email}
                    className="auth-input"
                    {...register("email")}
                  />
                </div>
                {errors.email?.message && (
                  <p className="text-sm text-brand-secondary">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-neutral-700"
                >
                  Password
                </label>
                <div className="group relative">
                  <Lock className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-neutral-400 transition-colors group-focus-within:text-brand-primary" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={transition || loadingBranch}
                    aria-invalid={!!errors.password}
                    className="auth-input pr-12"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 transition-colors hover:text-brand-primary focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password?.message && (
                  <p className="text-sm text-brand-secondary">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-primary focus:ring-brand-primary/30"
                  />
                  Remember me
                </label>
                <Link
                  href={ROUTES.forgotPassword}
                  className="text-sm font-semibold text-brand-primary transition-colors hover:text-brand-secondary"
                >
                  Forgot Password?
                </Link>
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-brand-primary text-base font-semibold text-white hover:bg-brand-primary/90"
                disabled={transition || loadingBranch}
              >
                {transition ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </div>
        </main>
      </div>
    </BranchThemeProvider>
  );
}
