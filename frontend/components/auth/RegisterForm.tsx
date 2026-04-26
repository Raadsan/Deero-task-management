"use client";

import { signUpWithEmial } from "@/lib/actions/auth.action";
import { DEPARTMENTS, ROUTES } from "@/lib/constants";
import { computeFontSize } from "@/lib/utils";
import { RegisterSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DefaultValues, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import { SelectElement, TextInput } from "../Shared/FormElements";
import Loader from "../Shared/Loader";

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
    <section className="loginWrapperDropShadow mx-4 h-fit w-full max-w-5xl space-y-2.5 rounded-[15px] border border-black/10 py-[50px] pr-[40px] pl-[38px]">
      <div className="flex w-full items-center justify-center gap-[10px] border-b border-neutral-200 pb-[15px]">
        <KeyRound className="text-secondary-100 scale-[1.5]" />
        <span
          style={{
            fontSize: computeFontSize(25),
          }}
          className="text-dark-red font-medium"
        >
          Registering ...
        </span>
      </div>
      <form
        onSubmit={handleSubmit(hnadleSubmitForm)}
        className="flex w-full flex-col"
      >
        <div className="grid w-full grid-cols-1 gap-[24px] border-b border-black/10 pb-5 md:grid-cols-2">
          <TextInput
            labelId="name"
            labelText="Enter Your name"
            type="text"
            placeholder="Your name"
            otherProps={{ ...register("name") }}
            errorMessage={errors.name?.message}
            wrapperStyle="w-full"
          />
          <TextInput
            labelId="email"
            labelText="Enter Your Email"
            type="email"
            placeholder="username@gmail.com"
            otherProps={{ ...register("email") }}
            errorMessage={errors.email?.message}
            wrapperStyle="flex-[1] w-full"
          />

          <TextInput
            labelId="password"
            labelText="Enter Your Password"
            type="text"
            placeholder="Your password"
            otherProps={{ ...register("password") }}
            errorMessage={errors.password?.message}
          />
          <SelectElement
            disbaleSelect={transition}
            labelText="Select User Gender"
            placeholder="Select Gender"
            wrapperStyle="max-w-full"
            defaultValue={getValues("gender")}
            errorMessage={errors.gender?.message}
            elements={["male", "female"]}
            onChange={(value) => {
              setValue("gender", value, {
                shouldValidate: true,
              });
            }}
          />
          <SelectElement
            disbaleSelect={transition}
            labelText="Select Department"
            placeholder="Select Department"
            wrapperStyle="max-w-full"
            defaultValue={getValues("department")}
            errorMessage={errors.department?.message}
            elements={DEPARTMENTS}
            onChange={(value) => {
              setValue("department", value, {
                shouldValidate: true,
              });
            }}
          />
          <TextInput
            labelId="salary"
            labelText="Enter The Salary"
            type="text"
            prefixValue="$"
            placeholder="0"
            paddingLeft="30px"
            otherProps={{ ...register("salary") }}
            errorMessage={errors.salary?.message}
          />
        </div>
        <div className="mx-auto mt-2.5 flex w-fit flex-col items-center py-3">
          {transition ? (
            <Loader />
          ) : (
            <ButtonBuilder
              type="normal"
              disabled={transition}
              htmlType="submit"
            >
              <span
                style={{
                  fontSize: computeFontSize(16),
                }}
                className="font-medium text-white"
              >
                Register
              </span>
            </ButtonBuilder>
          )}
          {!transition && (
            <p className="mt-3">
              Already have an account ?{" "}
              <Link
                href={ROUTES.login}
                style={{
                  fontSize: computeFontSize(15.4),
                }}
                className="applyInterFont text-primary flex-1 grow text-right font-bold"
              >
                Login Here.
              </Link>
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
