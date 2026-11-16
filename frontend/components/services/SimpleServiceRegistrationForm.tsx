"use client";

import { SelectElement, TextInput, TextInputWithTaxtArea } from "@/components/Shared/FormElements";
import { Button } from "@/components/ui/button";
import { createMainService, ServiceRecord, updateMainService } from "@/lib/apis/serviceApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { SimpleServiceRegistrationSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";
import { z } from "zod";

type FormValues = z.infer<typeof SimpleServiceRegistrationSchema>;

type Props = {
  mode: "create" | "edit";
  initialService?: ServiceRecord;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function SimpleServiceRegistrationForm({
  mode,
  initialService,
  onSuccess,
  onCancel,
}: Props) {
  const { mutate } = useSWRConfig();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: standardSchemaResolver(SimpleServiceRegistrationSchema),
    defaultValues: {
      serviceName: initialService?.serviceName ?? "",
      description: initialService?.description ?? "",
      isActive: initialService?.isActive !== false,
    },
  });

  useEffect(() => {
    if (mode === "edit" && initialService) {
      reset({
        serviceName: initialService.serviceName ?? "",
        description: initialService.description ?? "",
        isActive: initialService.isActive !== false,
      });
    }
  }, [initialService, mode, reset]);

  const statusValue = watch("isActive") ? "active" : "inactive";

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const payload = {
        serviceName: values.serviceName.trim(),
        description: values.description?.trim() || undefined,
        isActive: values.isActive,
      };

      if (mode === "create") {
        const result = await createMainService(payload);
        if (result.success) {
          toast.success("Service registered successfully");
          await mutate(SWR_CACH_KEYS.services.key);
          onSuccess?.();
          return;
        }
        toast.error(result.errors?.message || "Could not register service.");
        return;
      }

      if (!initialService?.id) {
        toast.error("Service not found.");
        return;
      }

      const result = await updateMainService(initialService.id, payload);
      if (result.success) {
        toast.success("Service updated successfully");
        await mutate(SWR_CACH_KEYS.services.key);
        onSuccess?.();
        return;
      }
      toast.error(result.errors?.message || "Could not update service.");
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <TextInput
          compact
          labelText="Service Name"
          labelId="serviceName"
          placeholder="e.g. Digital Marketing"
          otherProps={register("serviceName")}
          errorMessage={errors.serviceName?.message}
          invalid={Boolean(errors.serviceName)}
        />

        <TextInputWithTaxtArea
          compact
          labelText="Description"
          labelId="description"
          placeholder="Optional summary of this main service"
          otherProps={register("description")}
          errorMessage={errors.description?.message}
          invalid={Boolean(errors.description)}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Status</label>
          <SelectElement
            compact
            placeholder="Status"
            onChange={(value) => setValue("isActive", value === "active")}
            value={statusValue}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-100 bg-white px-6 py-4">
        <Button
          type="button"
          variant="outline"
          className={btnFormCancel}
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" className={cn(btnFormSubmit)} disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Register Service" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
