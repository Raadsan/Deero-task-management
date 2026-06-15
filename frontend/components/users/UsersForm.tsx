"use client";

import { createUser, updateUserData } from "@/lib/actions/user.action";
import { getAllBranches } from "@/lib/actions/branch.action";
import { getAllDepartments } from "@/lib/actions/department.action";
import { authClient } from "@/lib/auth-client";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { User, UserRole } from "@/lib/schema";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { EditCreateUserSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import { SelectElement, TextInput } from "../Shared/FormElements";
import Loader from "../Shared/Loader";
import { Button } from "../ui/button";

interface Props {
  formType: "edit" | "create";
  data: User | undefined;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function UserForm({
  formType,
  data,
  onSuccess,
  onCancel,
}: Props) {
  const isModal = Boolean(onSuccess || onCancel);
  const fieldCompact = isModal;

  const {
    handleSubmit,
    register,
    setValue,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof EditCreateUserSchema>>({
    defaultValues: {
      name: data?.name ?? "",
      email: data?.email ?? "",
      role: data?.role ?? UserRole.user,
      password: "",
      gender: data?.gender ?? "",
      department: data?.department ?? "",
      branchId: (data as { branchId?: string; branch?: { id: string } })?.branchId
        ?? (data as { branch?: { id: string } })?.branch?.id
        ?? "",
      status: data?.banned ? "inactive" : "active",
    },
    resolver: standardSchemaResolver(EditCreateUserSchema),
  });

  const defaultBranchId =
    (data as { branchId?: string; branch?: { id: string } })?.branchId ??
    (data as { branch?: { id: string } })?.branch?.id ??
    "";

  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);

  const { data: branchesRes } = useSWR(SWR_CACH_KEYS.branches.key, getAllBranches);
  const branchOptions =
    branchesRes?.data?.filter((branch) => branch.isActive !== false).map((branch) => branch.name) ?? [];

  const { data: departmentsRes } = useSWR(
    selectedBranchId
      ? [SWR_CACH_KEYS.departments.key, selectedBranchId]
      : null,
    () => getAllDepartments({ branchId: selectedBranchId, activeOnly: true }),
  );
  const departmentOptions =
    departmentsRes?.data?.map((department) => department.name) ?? [];

  useEffect(() => {
    setSelectedBranchId(defaultBranchId);
  }, [defaultBranchId]);

  const activeUserRole = authClient.useSession().data?.user.role;
  const roles =
    activeUserRole === "admin"
      ? ["admin", "user"]
      : ["admin", "user", "superadmin"];

  const genderValue = watch("gender");
  const departmentValue = watch("department");
  const branchIdValue = watch("branchId");
  const statusValue = watch("status");
  const roleValue = watch("role");
  const selectedBranchName =
    branchesRes?.data?.find((branch) => branch.id === branchIdValue)?.name ?? "";

  const genderOptions = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
  ];
  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];
  const assignableRoles = [...roles];
  if (data?.role && !assignableRoles.includes(data.role)) {
    assignableRoles.push(data.role);
  }
  const roleOptions = assignableRoles.map((role) => ({
    value: role,
    label: role.charAt(0).toUpperCase() + role.slice(1),
  }));

  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { mutate } = useSWRConfig();

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
          department: formData.department?.trim() || undefined,
          branchId: formData.branchId || undefined,
          banned: formData.status === "inactive",
        });
        if (result.success) {
          toast.success("Successfully Created a user.");
          await mutate(SWR_CACH_KEYS.users.key);
          reset();
          if (onSuccess) {
            onSuccess();
            return;
          }
          router.replace(ROUTES.users);
        } else {
          toast.error(
            result.errors?.message ?? "Failed to create User. try again",
          );
        }
      });
    } else if (formType === "edit") {
      startTransition(async function () {
        const updateResult = await updateUserData({
          id: data?.id as string,
          name: formData.name,
          email: formData.email,
          role: formData.role as UserRole,
          gender: formData.gender,
          department: formData.department?.trim() || undefined,
          branchId: formData.branchId || undefined,
          banned: formData.status === "inactive",
        });

        if (updateResult.success) {
          reset();
          toast.success("Updated User Data successfully!");
          await mutate(SWR_CACH_KEYS.users.key);
          if (onSuccess) {
            onSuccess();
            return;
          }
          router.push(ROUTES.users);
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
      className={cn(
        "flex w-full flex-col",
        isModal
          ? "min-h-0 flex-1 overflow-hidden"
          : "mx-auto max-w-2/3 gap-6",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col",
          isModal
            ? "min-h-0 flex-1 gap-4 overflow-y-auto px-6 pt-5"
            : "gap-6",
        )}
      >
        <TextInput
          labelId="name"
          labelText="Name"
          type="text"
          placeholder="Enter User name"
          disbaled={pending}
          otherProps={{ ...register("name") }}
          errorMessage={errors.name?.message}
          compact={fieldCompact}
        />
        <TextInput
          labelId="email"
          labelText="Email"
          type="email"
          placeholder="username@gmail.com"
          errorMessage={errors.email?.message}
          otherProps={{ ...register("email") }}
          defaultValue={data?.email}
          compact={fieldCompact}
        />

        <SelectElement
          disbaleSelect={pending}
          labelText="Gender"
          placeholder="Select gender"
          wrapperStyle="max-w-full"
          errorMessage={errors.gender?.message}
          value={genderValue}
          options={genderOptions}
          compact={fieldCompact}
          onChange={(value) => {
            setValue("gender", value, {
              shouldValidate: true,
            });
          }}
        />
        <SelectElement
          disbaleSelect={pending}
          labelText="Branch"
          placeholder="Select branch"
          wrapperStyle="max-w-full"
          errorMessage={errors.branchId?.message}
          value={selectedBranchName}
          elements={branchOptions}
          compact={fieldCompact}
          onChange={(value) => {
            const branch = branchesRes?.data?.find((item) => item.name === value);
            const nextBranchId = branch?.id ?? "";
            setSelectedBranchId(nextBranchId);
            setValue("branchId", nextBranchId, {
              shouldValidate: true,
            });
            setValue("department", "", {
              shouldValidate: true,
            });
          }}
        />

        <SelectElement
          disbaleSelect={pending || !selectedBranchId}
          labelText="Department (optional)"
          placeholder={
            selectedBranchId ? "Select department (optional)" : "Select branch first"
          }
          wrapperStyle="max-w-full"
          errorMessage={errors.department?.message}
          value={departmentValue}
          elements={departmentOptions}
          compact={fieldCompact}
          onChange={(value) => {
            setValue("department", value, {
              shouldValidate: true,
            });
          }}
        />

        <SelectElement
          disbaleSelect={pending}
          labelText="Status"
          placeholder="Select status"
          wrapperStyle="max-w-full"
          errorMessage={errors.status?.message}
          value={statusValue}
          options={statusOptions}
          compact={fieldCompact}
          onChange={(value) => {
            setValue("status", value as "active" | "inactive", {
              shouldValidate: true,
            });
          }}
        />

        <SelectElement
          disbaleSelect={pending}
          labelText="Role"
          placeholder="Select role"
          wrapperStyle="max-w-full"
          value={roleValue}
          options={roleOptions}
          errorMessage={errors.role?.message}
          compact={fieldCompact}
          onChange={(role) => {
            setValue("role", role as UserRole, {
              shouldValidate: true,
            });
          }}
        />

        {formType === "create" && (
          <TextInput
            labelId="password"
            labelText="Password"
            type="text"
            placeholder="Enter the Password"
            disbaled={pending}
            otherProps={{ ...register("password") }}
            errorMessage={errors.password?.message}
            compact={fieldCompact}
          />
        )}
      </div>

      <div
        className={cn(
          "flex w-full items-center gap-3",
          isModal
            ? "shrink-0 justify-end border-t border-zinc-100 bg-white px-6 py-4"
            : "mt-10 justify-center",
        )}
      >
        {pending ? (
          <Loader />
        ) : (
          <>
            {isModal && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className={btnFormCancel}
              >
                Cancel
              </Button>
            )}
            {isModal ? (
              <Button type="submit" className={btnFormSubmit}>
                {formType === "edit" ? "Save" : "Add"}
              </Button>
            ) : (
              <ButtonBuilder
                htmlType="submit"
                classNames="text-white"
                type="normal"
              >
                {formType === "edit" ? "Save Changes" : "Create User"}
              </ButtonBuilder>
            )}
          </>
        )}
      </div>
    </form>
  );
}
