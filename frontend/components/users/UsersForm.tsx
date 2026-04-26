"use client";

import { createUser, updateUserData } from "@/lib/actions/user.action";
import { authClient } from "@/lib/auth-client";
import { DEPARTMENTS, ROUTES } from "@/lib/constants";
import { User, UserRole } from "@/lib/generated/prisma";
import { getRandomUUID } from "@/lib/utils";
import { EditCreateUserSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import { SelectElement, TextInput } from "../Shared/FormElements";
import Loader from "../Shared/Loader";

interface Props {
  formType: "edit" | "create";
  data: User | undefined;
}

export default function UserForm({ formType, data }: Props) {
  const {
    handleSubmit,
    register,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof EditCreateUserSchema>>({
    defaultValues: {
      name: data?.name ?? "",
      email: data?.email ?? "",
      role: data?.role,
      password: "",
      gender: data?.gender ?? "",
      department: data?.department ?? "",
      salary: data?.salary ?? "",
    },
    resolver: standardSchemaResolver(EditCreateUserSchema),
  });

  const activeUserRole = authClient.useSession().data?.user.role;
  const roles =
    activeUserRole === "admin"
      ? ["admin", "user"]
      : ["admin", "user", "superadmin"];

  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmitForm(
    formData: z.infer<typeof EditCreateUserSchema>,
  ) {
    if (formType === "create") {
      if (!formData.password) {
        setError(
          "password",
          {
            message: "Password Is required to create user",
          },
          {
            shouldFocus: true,
          },
        );
        return;
      }

      startTransition(async () => {
        const result = await createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role as UserRole,
          gender: formData.gender,
          department: formData.department,
          salary: formData.salary,
        });
        if (result.success) {
          toast.success("Successfully Created a user.");
          router.replace(ROUTES.users);
          reset();
        } else {
          toast.error(
            result.errors?.message ?? "Failed to create User. try again",
          );
        }
      });
    } else if (formType === "edit") {
      startTransition(async function () {
        const updateResult = await updateUserData({
          id: data?.id,
          name: formData.name,
          gender: formData.gender,
          department: formData.department,
          salary: formData.salary,
        });

        if (updateResult.success) {
          reset();
          toast.success("Upated User Data successfully!");
          router.refresh();
        } else {
          toast.error(
            updateResult.errors?.message ||
              "Failed to update user data. try again.!",
          );
        }
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleSubmitForm)}
      className="mx-auto flex w-full max-w-2/3 flex-col gap-6"
    >
      <TextInput
        labelId="name"
        labelText="Name"
        type="text"
        placeholder="Enter User name"
        disbaled={pending}
        otherProps={{ ...register("name") }}
        errorMessage={errors.name?.message}
      />
      <TextInput
        labelId="email"
        labelText="Email"
        type="email"
        placeholder="username@gmail.com"
        errorMessage={errors.email?.message}
        otherProps={{ ...register("email") }}
        defaultValue={data?.email}
      />

      <SelectElement
        key={getRandomUUID()}
        disbaleSelect={pending}
        labelText="Select User Gender"
        placeholder="Select Gender"
        wrapperStyle="max-w-full"
        errorMessage={errors.gender?.message}
        defaultValue={undefined}
        elements={["female", "male"]}
        onChange={(value) => {
          setValue("gender", value, {
            shouldValidate: true,
          });
        }}
      />
      <SelectElement
        key={getRandomUUID()}
        disbaleSelect={pending}
        labelText="Select Department"
        placeholder="Select Department"
        wrapperStyle="max-w-full"
        errorMessage={errors.department?.message}
        defaultValue={data?.department}
        elements={DEPARTMENTS}
        onChange={(value) => {
          setValue("department", value, {
            shouldValidate: true,
          });
        }}
      />

      <TextInput
        disbaled={pending}
        labelId="salary"
        labelText="Enter The Salary"
        type="text"
        prefixValue="$"
        placeholder="0"
        paddingLeft="30px"
        otherProps={{ ...register("salary") }}
        errorMessage={errors.salary?.message}
      />
      {/* password */}
      {formType === "create" && (
        <>
          <TextInput
            labelId="password"
            labelText="Password"
            type="text"
            placeholder="Enter the Password"
            disbaled={pending}
            otherProps={{ ...register("password") }}
            errorMessage={errors.password?.message}
          />
          <SelectElement
            key={getRandomUUID()}
            disbaleSelect={pending}
            labelText="Select User Role"
            placeholder="Select Role"
            wrapperStyle="max-w-full"
            defaultValue={undefined}
            errorMessage={errors.role?.message}
            elements={roles}
            onChange={(role) => {
              setValue("role", role as UserRole, {
                shouldValidate: true,
              });
            }}
          />
        </>
      )}
      <div className="mt-10 flex w-full items-center justify-center gap-5">
        {pending ? (
          <Loader />
        ) : (
          <ButtonBuilder
            htmlType="submit"
            classNames="text-white"
            type="normal"
          >
            {formType === "edit" ? "Save Changes" : "Create User"}
          </ButtonBuilder>
        )}
      </div>
    </form>
  );
}
