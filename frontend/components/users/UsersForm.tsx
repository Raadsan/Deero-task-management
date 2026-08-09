"use client";

import { createUser, getAllUsers, updateUserData } from "@/lib/apis/userApi";
import { getConfigRoles } from "@/lib/apis/configApi";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import { authClient } from "@/lib/auth-client";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { User } from "@/lib/schema";
import { canChangeUserPassword } from "@/lib/user-permissions";
import { buildUserRoleOptions, resolveConfigRoleId } from "@/lib/role-options";
import { isSuperadminRole } from "@/lib/portfolio-access";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { EditCreateUserSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
      staffCode: data?.staffCode ?? "",
      jobTitle: data?.jobTitle ?? "",
      employmentType: data?.employmentType ?? "FULL_TIME",
      email: data?.email ?? "",
      role: data?.role ?? "",
      password: "",
      gender: data?.gender ?? "",
      salary: data?.salary ?? "",
      portfolioId:
        (data as { portfolioId?: string; portfolio?: { id: string } })?.portfolioId ??
        (data as { portfolio?: { id: string } })?.portfolio?.id ??
        "",
      status: data?.banned ? "inactive" : "active",
    },
    resolver: standardSchemaResolver(EditCreateUserSchema),
  });

  const defaultBranchId =
    (data as { portfolioId?: string; portfolio?: { id: string } })?.portfolioId ??
    (data as { portfolio?: { id: string } })?.portfolio?.id ??
    "";

  const [selectedBranchId, setSelectedBranchId] = useState(defaultBranchId);
  const [staffCodeManuallyEdited, setStaffCodeManuallyEdited] = useState(false);

  const { data: rolesRes, isLoading: rolesLoading } = useSWR(
    SWR_CACH_KEYS.configRoles.key,
    getConfigRoles,
  );
  const configRoles = rolesRes?.data ?? [];

  const { data: branchOptionsRes } = useSWR(
    "task-form-portfolios-users",
    getTaskFormBranchOptions,
  );
  const scopedBranches = branchOptionsRes?.data?.portfolios ?? [];
  const { data: allStaffRes } = useSWR(
    formType === "create" ? SWR_CACH_KEYS.users.key : null,
    getAllUsers,
  );
  const singleBranch = branchOptionsRes?.data?.singleBranch ?? false;
  const branchOptions = scopedBranches.map((portfolio) => portfolio.name);

  const portfolioIdValue = watch("portfolioId");
  const staffCodeValue = watch("staffCode");
  const employmentTypeValue = watch("employmentType");
  const roleValue = watch("role");
  const isSuperadmin = isSuperadminRole(roleValue);

  useEffect(() => {
    setSelectedBranchId(defaultBranchId);
  }, [defaultBranchId]);

  useEffect(() => {
    if (data && formType === "edit") {
      reset({
        name: data.name ?? "",
        staffCode: data.staffCode ?? "",
        jobTitle: data.jobTitle ?? "",
        employmentType: data.employmentType ?? "FULL_TIME",
        email: data.email ?? "",
        role: data.role ?? "",
        password: "",
        gender: data.gender ?? "",
        salary: data.salary ?? "",
        portfolioId:
          (data as { portfolioId?: string; portfolio?: { id: string } })?.portfolioId ??
          (data as { portfolio?: { id: string } })?.portfolio?.id ??
          "",
        status: data.banned ? "inactive" : "active",
      });
      setSelectedBranchId(
        (data as { portfolioId?: string; portfolio?: { id: string } })?.portfolioId ??
          (data as { portfolio?: { id: string } })?.portfolio?.id ??
          "",
      );
    }
  }, [data, formType, reset]);

  const session = authClient.useSession();
  const activeUserRole = session.data?.user.role;
  const activeRoleId = (session.data?.user as { roleId?: string } | undefined)?.roleId;
  const canViewSalary =
    isSuperadminRole(activeUserRole) ||
    configRoles.find((role) => role.id === activeRoleId)?.canViewSalary === true;
  const [canSetPassword, setCanSetPassword] = useState(false);

  useEffect(() => {
    let active = true;
    canChangeUserPassword(activeUserRole).then((allowed) => {
      if (active) setCanSetPassword(allowed);
    });
    return () => {
      active = false;
    };
  }, [activeUserRole]);

  const roleOptions = useMemo(
    () => buildUserRoleOptions(configRoles, data?.role),
    [configRoles, data?.role],
  );

  const genderValue = watch("gender");
  const statusValue = watch("status");
  const selectedBranchName =
    isSuperadmin && !portfolioIdValue
      ? "— None (main portfolio) —"
      : (scopedBranches.find((portfolio) => portfolio.id === portfolioIdValue)?.name ??
        "");

  const genderOptions = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
  ];
  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  useEffect(() => {
    if (formType !== "create" || roleValue || !roleOptions.length) return;
    const defaultRole =
      roleOptions.find((option) => option.value === "user")?.value ??
      roleOptions[0]?.value;
    if (defaultRole) {
      setValue("role", defaultRole, { shouldValidate: false });
    }
  }, [formType, roleOptions, roleValue, setValue]);

  useEffect(() => {
    if (formType !== "create" || portfolioIdValue || !scopedBranches.length)
      return;
    if (isSuperadminRole(roleValue)) return;
    const nextBranchId =
      branchOptionsRes?.data?.defaultBranchId ?? scopedBranches[0]?.id;
    if (nextBranchId) {
      setSelectedBranchId(nextBranchId);
      setValue("portfolioId", nextBranchId, { shouldValidate: false });
    }
  }, [
    formType,
    portfolioIdValue,
    scopedBranches,
    branchOptionsRes?.data?.defaultBranchId,
    roleValue,
    setValue,
  ]);

  useEffect(() => {
    if (formType !== "create" || staffCodeManuallyEdited) return;
    const branchName =
      scopedBranches.find((portfolio) => portfolio.id === portfolioIdValue)?.name ??
      "Deero Advert";
    const prefix = /raadsan/i.test(branchName) ? "RT" : "DAA";
    const year = String(new Date().getFullYear()).slice(-2);
    const stem = `${prefix}${year}#`;
    const max = ((allStaffRes?.data ?? []) as Array<{ staffCode?: string | null }>).reduce(
      (value, staff) => {
        if (!String(staff.staffCode ?? "").startsWith(prefix)) return value;
        const sequence = Number(String(staff.staffCode).split("#").pop());
        return Number.isFinite(sequence) ? Math.max(value, sequence) : value;
      },
      0,
    );
    setValue("staffCode", `${stem}${String(max + 1).padStart(2, "0")}`, {
      shouldValidate: true,
    });
  }, [formType, staffCodeManuallyEdited, portfolioIdValue, scopedBranches, allStaffRes?.data, setValue]);
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
            message: "Password is required to create a staff member",
          },
          {
            shouldFocus: true,
          },
        );
        return;
      }

      startTransition(async () => {
        const roleId = resolveConfigRoleId(configRoles, formData.role);
        const result = await createUser({
          name: formData.name,
          staffCode: formData.staffCode,
          jobTitle: formData.jobTitle?.trim() || undefined,
          employmentType: formData.employmentType,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          roleId,
          gender: formData.gender,
          salary: formData.salary.trim(),
          portfolioId: formData.portfolioId?.trim() || undefined,
          banned: formData.status === "inactive",
        });
        if (result.success) {
          toast.success("Staff created successfully.");
          await mutate(SWR_CACH_KEYS.users.key);
          await mutate((key) => true, undefined, { revalidate: true });
          reset();
          if (onSuccess) {
            onSuccess();
            return;
          }
          router.replace(ROUTES.users);
        } else {
          toast.error(
            result.errors?.message ?? "Failed to create employee. Try again.",
          );
        }
      });
    } else if (formType === "edit") {
      if (canSetPassword && formData.password?.trim()) {
        if (formData.password.length < 6) {
          setError(
            "password",
            { message: "Password should be at least 6 characters." },
            { shouldFocus: true },
          );
          return;
        }
      }

      startTransition(async function () {
        const roleId = resolveConfigRoleId(configRoles, formData.role);
        const updateResult = await updateUserData({
          id: data?.id as string,
          name: formData.name,
          staffCode: formData.staffCode,
          jobTitle: formData.jobTitle?.trim() || undefined,
          employmentType: formData.employmentType,
          email: formData.email,
          role: formData.role,
          roleId,
          gender: formData.gender,
          salary: formData.salary.trim(),
          portfolioId: isSuperadmin
            ? formData.portfolioId?.trim() || null
            : formData.portfolioId?.trim() || undefined,
          banned: formData.status === "inactive",
        });

        if (!updateResult.success) {
          toast.error(
            updateResult.errors?.message ||
              "Failed to update user data. try again.!",
          );
          return;
        }

        if (canSetPassword && formData.password?.trim()) {
          const passwordResult = await authClient.admin.setUserPassword({
            userId: data?.id as string,
            newPassword: formData.password.trim(),
          });

          if (passwordResult.error) {
            toast.error(
              passwordResult.error.message ||
                "User updated but password change failed.",
            );
            return;
          }
        }

        reset();
        toast.success(
          canSetPassword && formData.password?.trim()
            ? "User and password updated successfully!"
            : "Updated User Data successfully!",
        );
        await mutate(SWR_CACH_KEYS.users.key);
        await mutate((key) => true, undefined, { revalidate: true });
        if (onSuccess) {
          onSuccess();
          return;
        }
        router.push(ROUTES.users);
        router.refresh();
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleSubmitForm)}
      className={cn(
        "flex w-full flex-col",
        isModal ? "min-h-0 flex-1 overflow-hidden" : "mx-auto max-w-2/3 gap-6",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col",
          isModal ? "min-h-0 flex-1 gap-4 overflow-y-auto px-6 pt-5" : "gap-6",
        )}
      >
        <TextInput
          labelId="staffCode"
          labelText="Staff ID"
          type="text"
          placeholder="DAA26#01"
          disbaled={pending}
          otherProps={{
            ...register("staffCode"),
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              setStaffCodeManuallyEdited(true);
              setValue("staffCode", event.target.value, { shouldValidate: true });
            },
          }}
          errorMessage={errors.staffCode?.message}
          compact={fieldCompact}
        />
        {canViewSalary ? <TextInput
          labelId="name"
          labelText="Name"
          type="text"
          placeholder="Enter User name"
          disbaled={pending}
          otherProps={{ ...register("name") }}
          errorMessage={errors.name?.message}
          compact={fieldCompact}
/> : null}
        <TextInput
          labelId="jobTitle"
          labelText="Job Title"
          type="text"
          placeholder="Enter job title"
          disbaled={pending}
          otherProps={{ ...register("jobTitle") }}
          errorMessage={errors.jobTitle?.message}
          compact={fieldCompact}
        />
        <SelectElement
          disbaleSelect={pending}
          labelText="Type"
          placeholder="Select employment type"
          wrapperStyle="max-w-full"
          value={employmentTypeValue}
          options={[
            { value: "FULL_TIME", label: "Full-Time" },
            { value: "PART_TIME", label: "Part-Time" },
          ]}
          compact={fieldCompact}
          onChange={(value) => {
            setValue("employmentType", value as "FULL_TIME" | "PART_TIME", {
              shouldValidate: true,
            });
          }}
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
          disbaleSelect={pending || (singleBranch && !isSuperadmin)}
          labelText={isSuperadmin ? "Portfolio (optional)" : "Portfolio"}
          placeholder={
            isSuperadmin
              ? "Default: main portfolio (Deero Advert)"
              : "Select portfolio"
          }
          wrapperStyle="max-w-full"
          errorMessage={errors.portfolioId?.message}
          value={selectedBranchName}
          elements={
            isSuperadmin
              ? ["— None (main portfolio) —", ...branchOptions]
              : branchOptions
          }
          compact={fieldCompact}
          onChange={(value) => {
            if (isSuperadmin && value === "— None (main portfolio) —") {
              setSelectedBranchId("");
              setValue("portfolioId", "", { shouldValidate: true });
              return;
            }
            const portfolio = scopedBranches.find((item) => item.name === value);
            const nextBranchId = portfolio?.id ?? "";
            setSelectedBranchId(nextBranchId);
            setValue("portfolioId", nextBranchId, {
              shouldValidate: true,
            });
          }}
        />

        <SelectElement
          disbaleSelect={pending || rolesLoading || !roleOptions.length}
          labelText="Role"
          placeholder={
            rolesLoading
              ? "Loading roles..."
              : roleOptions.length
                ? "Select role"
                : "No roles configured"
          }
          wrapperStyle="max-w-full"
          value={roleValue}
          options={roleOptions}
          errorMessage={errors.role?.message}
          compact={fieldCompact}
          onChange={(role) => {
            setValue("role", role, {
              shouldValidate: true,
            });
          }}
        />

        <TextInput
          labelId="salary"
          labelText="Monthly Salary"
          type="number"
          placeholder="Enter monthly salary"
          disbaled={pending}
          otherProps={{
            ...register("salary"),
            min: 0,
            step: "0.01",
            inputMode: "decimal",
          }}
          errorMessage={errors.salary?.message}
          compact={fieldCompact}
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

        {(formType === "create" || (formType === "edit" && canSetPassword)) && (
          <TextInput
            labelId="password"
            labelText={
              formType === "edit" ? "New Password (optional)" : "Password"
            }
            type="password"
            showEyeIcon
            placeholder={
              formType === "edit"
                ? "Leave blank to keep current password"
                : "Enter the Password"
            }
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
                {formType === "edit" ? "Save Changes" : "Create Staff"}
              </ButtonBuilder>
            )}
          </>
        )}
      </div>
    </form>
  );
}
