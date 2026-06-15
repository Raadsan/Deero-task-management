"use client";

import { authCardClassName, authFieldClassName } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signUpWithEmial } from "@/lib/actions/auth.action";
import { DEPARTMENTS, ICONS, ROUTES } from "@/lib/constants";
import { RegisterSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  ArrowRight,
  DollarSign,
  Lock,
  Mail,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DefaultValues, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";

export default function RegisterForm() {
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof RegisterSchema>>({
    resolver: standardSchemaResolver(RegisterSchema),
    defaultValues: {
      gender: "",
      department: "",
    } as DefaultValues<z.infer<typeof RegisterSchema>>,
  });
  const [transition, startTransition] = useTransition();
  const router = useRouter();

  function hnadleSubmitForm(data: z.infer<typeof RegisterSchema>) {
    startTransition(async () => {
      const result = await signUpWithEmial({
        email: data.email,
        name: data.name,
        password: data.password,
        role: "superadmin",
        gender: data.gender,
        salary: data.salary,
        department: data.department,
      });
      if (result.success) {
        toast.success("Registerd Successful");
        router.push(ROUTES.verify);
      } else {
        toast.error(result?.errors?.message || "Registration  Failed");
      }
    });
  }

  return (
    <div className={`${authCardClassName} max-w-3xl`}>
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-5 flex h-24 w-full max-w-[260px] items-center justify-center">
          <Image
            src={ICONS.logoPng1}
            width={260}
            height={88}
            alt="Deero logo"
            className="h-20 w-auto max-w-[260px] object-contain"
            priority
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Create Account
        </h1>
        <p className="mt-2 text-center text-neutral-500">
          Register a new team member to get started
        </p>
      </div>

      <form onSubmit={handleSubmit(hnadleSubmitForm)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="group space-y-2">
            <Label htmlFor="name" className="ml-1">
              Full Name
            </Label>
            <div className="relative flex items-center">
              <User className="absolute left-3 h-5 w-5 text-neutral-400 transition-colors group-focus-within:text-primary" />
              <input
                id="name"
                type="text"
                placeholder="Your name"
                disabled={transition}
                aria-invalid={!!errors.name}
                className={authFieldClassName}
                {...register("name")}
              />
            </div>
            {errors.name?.message && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div className="group space-y-2">
            <Label htmlFor="email" className="ml-1">
              Email Address
            </Label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 h-5 w-5 text-neutral-400 transition-colors group-focus-within:text-primary" />
              <input
                id="email"
                type="email"
                placeholder="username@gmail.com"
                disabled={transition}
                aria-invalid={!!errors.email}
                className={authFieldClassName}
                {...register("email")}
              />
            </div>
            {errors.email?.message && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div className="group space-y-2">
            <Label htmlFor="password" className="ml-1">
              Password
            </Label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 h-5 w-5 text-neutral-400 transition-colors group-focus-within:text-primary" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                disabled={transition}
                aria-invalid={!!errors.password}
                className={authFieldClassName}
                {...register("password")}
              />
            </div>
            {errors.password?.message && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="ml-1">Gender</Label>
            <Select
              value={getValues("gender") || undefined}
              onValueChange={(value) =>
                setValue("gender", value, { shouldValidate: true })
              }
              disabled={transition}
            >
              <SelectTrigger className="w-full rounded-xl bg-neutral-50 py-6">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender?.message && (
              <p className="text-sm text-red-600">{errors.gender.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="ml-1">Department</Label>
            <Select
              value={getValues("department") || undefined}
              onValueChange={(value) =>
                setValue("department", value, { shouldValidate: true })
              }
              disabled={transition}
            >
              <SelectTrigger className="w-full rounded-xl bg-neutral-50 py-6">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((department) => (
                  <SelectItem key={department} value={department}>
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.department?.message && (
              <p className="text-sm text-red-600">
                {errors.department.message}
              </p>
            )}
          </div>

          <div className="group space-y-2">
            <Label htmlFor="salary" className="ml-1">
              Salary
            </Label>
            <div className="relative flex items-center">
              <DollarSign className="absolute left-3 h-5 w-5 text-neutral-400 transition-colors group-focus-within:text-primary" />
              <input
                id="salary"
                type="text"
                placeholder="0"
                disabled={transition}
                aria-invalid={!!errors.salary}
                className={authFieldClassName}
                {...register("salary")}
              />
            </div>
            {errors.salary?.message && (
              <p className="text-sm text-red-600">{errors.salary.message}</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-brand-primary text-base font-semibold text-white hover:bg-brand-primary/90"
          disabled={transition}
        >
          {transition ? "Creating account..." : "Create Account"}
          {!transition && <ArrowRight className="h-5 w-5" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link
          href={ROUTES.login}
          className="font-medium text-brand-primary underline-offset-4 hover:text-brand-secondary hover:underline"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}
