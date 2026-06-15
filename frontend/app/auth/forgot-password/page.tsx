import Link from "next/link";
import { ROUTES } from "@/lib/constants";

export default function ForgotPasswordPage() {
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
