"use client";

import { authClient } from "@/lib/auth-client";
import { ROUTES } from "@/lib/constants";
import { computeFontSize } from "@/lib/utils";
import { loginSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DefaultValues, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import { TextInput } from "../Shared/FormElements";
import Loader from "../Shared/Loader";

export default function LoginForm() {
  const [transition, startTransition] = useTransition();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: {} as DefaultValues<z.infer<typeof loginSchema>>,
  });

  function submitForm(data: z.infer<typeof loginSchema>) {
    startTransition(async () => {
      const { error } = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (!error) {
        toast.success("Login successful!");
        router.push(ROUTES.dashboard);
      } else {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          return router.push(ROUTES.verify);
        }
        toast.error(error.message || "Login failed. Please try again.");
      }
    });
  }

  return (
    <section className="my-auto h-fit w-full max-w-2xl space-y-2.5 rounded-[15px] border border-black/10 py-[50px] pr-[40px] pl-[38px] shadow-sm">
      <div className="flex w-full items-center justify-center gap-[10px] border-b border-neutral-200 pb-[15px]">
        <LogOut className="text-secondary-100 scale-[1.5]" />
        <span
          style={{
            fontSize: computeFontSize(25),
          }}
          className="text-dark-red font-medium"
        >
          Log In
        </span>
      </div>

      <form
        onSubmit={handleSubmit(submitForm)}
        className="flex w-full flex-col gap-[24px]"
      >
        <TextInput
          labelId="email"
          type="email"
          labelText="Email Address"
          otherProps={{ ...register("email") }}
          placeholder="username@gmail.com"
          disbaled={transition}
          errorMessage={errors.email?.message}
        />
        <TextInput
          labelId="password"
          showEyeIcon
          type="text"
          labelText="Password"
          otherProps={{ ...register("password") }}
          placeholder="Enter your password"
          disbaled={transition}
          errorMessage={errors.password?.message}
        />

        {transition ? (
          <Loader />
        ) : (
          <ButtonBuilder disabled={transition} type="normal" htmlType="submit">
            <span
              style={{
                fontSize: computeFontSize(16),
              }}
              className="font-medium text-white"
            >
              Login
            </span>
          </ButtonBuilder>
        )}
        {!transition && (
          <p>
            Dont have an account Yet?
            <Link
              href={ROUTES.register}
              style={{
                fontSize: computeFontSize(15.4),
              }}
              className="applyInterFont text-primary ms-1.5 flex-1 grow text-right font-bold"
            >
              Register Here.
            </Link>
          </p>
        )}
      </form>
    </section>
  );
}
