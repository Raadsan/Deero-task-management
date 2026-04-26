import LoginForm from "@/components/auth/LoginForm";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <Suspense>
      <div className="flex h-full w-full items-center justify-center">
        <LoginForm />
      </div>
    </Suspense>
  );
}
