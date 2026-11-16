"use client";

import { TextInput, TextInputWithTaxtArea, SelectElement } from "@/components/Shared/FormElements";
import { Button } from "@/components/ui/button";
import { createClient, editBasicClientInfo } from "@/lib/apis/clientApi";
import { getAllClientsClient } from "@/lib/apis/readApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { Client } from "@/lib/types";
import { cn, normalizeClientPhone } from "@/lib/utils";
import { SimpleClientRegistrationSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";
import { z } from "zod";

type FormValues = z.infer<typeof SimpleClientRegistrationSchema>;

function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function openingDefaults(client?: Client) {
  const amount = Number(client?.openingBalanceAmount || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return {
    openingBalanceAmount: safeAmount,
    openingBalanceType: client?.openingBalanceType || "",
    openingBalanceDate: client?.openingBalanceDate?.slice(0, 10) || (safeAmount > 0 ? todayIso() : ""),
    openingBalanceNotes: client?.openingBalanceNotes || "",
  };
}

type Props = {
  mode: "create" | "edit";
  initialClient?: Client;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export default function SimpleClientRegistrationForm({
  mode,
  initialClient,
  onSuccess,
  onCancel,
}: Props) {
  const { mutate } = useSWRConfig();
  const { data: clientsRes } = useSWR(SWR_CACH_KEYS.clients.key, getAllClientsClient);
  const canEditOpening = Boolean(
    (clientsRes as { canEditOpeningBalance?: boolean } | undefined)?.canEditOpeningBalance
      ?? initialClient?.canEditOpeningBalance,
  );
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: standardSchemaResolver(SimpleClientRegistrationSchema),
    defaultValues: {
      institution: initialClient?.institution ?? "",
      contactPerson: initialClient?.contactPerson ?? "",
      phone: initialClient?.phone ?? "",
      alternativePhone: initialClient?.alternativePhone ?? "",
      email: initialClient?.email ?? "",
      address: initialClient?.address ?? "",
      notes: initialClient?.notes ?? "",
      isActive: initialClient?.isActive !== false,
      ...openingDefaults(initialClient),
    },
  });

  useEffect(() => {
    if (mode === "edit" && initialClient) {
      reset({
        institution: initialClient.institution ?? "",
        contactPerson: initialClient.contactPerson ?? "",
        phone: initialClient.phone ?? "",
        alternativePhone: initialClient.alternativePhone ?? "",
        email: initialClient.email ?? "",
        address: initialClient.address ?? "",
        notes: initialClient.notes ?? "",
        isActive: initialClient.isActive !== false,
        ...openingDefaults(initialClient),
      });
    }
  }, [initialClient, mode, reset]);

  const statusValue = watch("isActive") ? "active" : "inactive";
  const openingAmount = Number(watch("openingBalanceAmount") || 0);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const phone = normalizeClientPhone(values.phone.trim());
      const alternativePhone = values.alternativePhone?.trim()
        ? normalizeClientPhone(values.alternativePhone.trim())
        : undefined;
      const email = values.email?.trim() || undefined;

      const openingPayload = canEditOpening
        ? {
            openingBalanceAmount: values.openingBalanceAmount,
            openingBalanceType: values.openingBalanceType || undefined,
            openingBalanceDate: values.openingBalanceDate || undefined,
            openingBalanceNotes: values.openingBalanceNotes?.trim() || undefined,
          }
        : {};

      if (mode === "create") {
        const result = await createClient({
          institution: values.institution.trim(),
          contactPerson: values.contactPerson.trim(),
          phone,
          alternativePhone,
          email,
          address: values.address?.trim() || undefined,
          notes: values.notes?.trim() || undefined,
          isActive: values.isActive,
          source: "Direct",
          ...openingPayload,
        });

        if (result.success) {
          toast.success("Client registered successfully");
          await mutate(SWR_CACH_KEYS.clients.key);
          onSuccess?.();
          return;
        }
        toast.error(result.errors?.message ?? "Failed to register client");
        return;
      }

      if (!initialClient?.id) {
        toast.error("Client not found");
        return;
      }

      const result = await editBasicClientInfo({
        clientId: String(initialClient.id),
        newData: {
          institution: values.institution.trim(),
          contactPerson: values.contactPerson.trim(),
          phone,
          alternativePhone: alternativePhone ?? null,
          email: email ?? "",
          address: values.address?.trim() || null,
          notes: values.notes?.trim() || null,
          isActive: values.isActive,
          ...(canEditOpening
            ? {
                openingBalanceAmount: values.openingBalanceAmount,
                openingBalanceType: values.openingBalanceType || null,
                openingBalanceDate: values.openingBalanceDate || null,
                openingBalanceNotes: values.openingBalanceNotes?.trim() || null,
              }
            : {}),
        },
      });

      if (result.success) {
        toast.success("Client updated successfully");
        await mutate(SWR_CACH_KEYS.clients.key);
        onSuccess?.();
        return;
      }
      toast.error(result.errors?.message ?? "Failed to update client");
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            compact
            labelText="Client Name"
            labelId="institution"
            placeholder="Client or organization name"
            otherProps={register("institution")}
            errorMessage={errors.institution?.message}
            invalid={Boolean(errors.institution)}
          />

          <TextInput
            compact
            labelText="Contact Person"
            labelId="contactPerson"
            placeholder="Primary contact"
            otherProps={register("contactPerson")}
            errorMessage={errors.contactPerson?.message}
            invalid={Boolean(errors.contactPerson)}
          />

          <TextInput
            compact
            labelText="Phone Number"
            labelId="phone"
            type="tel"
            placeholder="+252 61 234 5678"
            otherProps={register("phone")}
            errorMessage={errors.phone?.message}
            invalid={Boolean(errors.phone)}
          />

          <TextInput
            compact
            labelText="Alternative Phone"
            labelId="alternativePhone"
            type="tel"
            placeholder="Optional"
            otherProps={register("alternativePhone")}
            errorMessage={errors.alternativePhone?.message}
            invalid={Boolean(errors.alternativePhone)}
          />

          <TextInput
            compact
            labelText="Email Address"
            labelId="email"
            type="email"
            placeholder="Optional"
            otherProps={register("email")}
            errorMessage={errors.email?.message}
            invalid={Boolean(errors.email)}
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

          <div className="sm:col-span-2">
            <TextInputWithTaxtArea
              compact
              labelText="Address"
              labelId="address"
              placeholder="Street address (optional)"
              otherProps={register("address")}
              errorMessage={errors.address?.message}
              invalid={Boolean(errors.address)}
            />
          </div>

          <div className="sm:col-span-2">
            <TextInputWithTaxtArea
              compact
              labelText="Notes"
              labelId="notes"
              placeholder="Internal notes (optional)"
              otherProps={register("notes")}
              errorMessage={errors.notes?.message}
              invalid={Boolean(errors.notes)}
            />
          </div>

          <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold text-zinc-800">Opening Balance</p>
              <p className="text-xs text-zinc-500">
                Optional prior balance in USD. Zero does not create a ledger entry. This is not an invoice or a receipt.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                compact
                labelText="Opening Balance Amount (USD)"
                labelId="openingBalanceAmount"
                type="number"
                placeholder="0.00"
                otherProps={{
                  ...register("openingBalanceAmount"),
                  min: 0,
                  step: "0.01",
                  disabled: !canEditOpening,
                }}
                errorMessage={errors.openingBalanceAmount?.message}
                invalid={Boolean(errors.openingBalanceAmount)}
              />
              <div className="space-y-1.5">
                <SelectElement
                  compact
                  labelText="Balance Type"
                  placeholder="Select balance type"
                  value={watch("openingBalanceType") || undefined}
                  onChange={(value) => setValue("openingBalanceType", value, { shouldValidate: true })}
                  disbaleSelect={!canEditOpening}
                  options={[
                    { value: "CUSTOMER_OWES", label: "Customer Owes Us" },
                    { value: "WE_OWE", label: "We Owe Customer" },
                  ]}
                  invalid={Boolean(errors.openingBalanceType)}
                  errorMessage={errors.openingBalanceType?.message}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700" htmlFor="openingBalanceDate">
                  Opening Balance Date
                </label>
                <input
                  id="openingBalanceDate"
                  type="date"
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-zinc-100"
                  {...register("openingBalanceDate")}
                  disabled={!canEditOpening}
                />
                {errors.openingBalanceDate?.message ? (
                  <p className="text-xs text-red-600">{errors.openingBalanceDate.message}</p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <TextInputWithTaxtArea
                  compact
                  labelText="Opening Balance Notes"
                  labelId="openingBalanceNotes"
                  placeholder="Optional"
                  otherProps={{ ...register("openingBalanceNotes"), disabled: !canEditOpening }}
                  errorMessage={errors.openingBalanceNotes?.message}
                  invalid={Boolean(errors.openingBalanceNotes)}
                />
              </div>
            </div>
            {openingAmount > 0 ? (
              <p className="text-xs text-zinc-600">
                {watch("openingBalanceType") === "WE_OWE"
                  ? "Our company owes this customer the opening amount."
                  : watch("openingBalanceType") === "CUSTOMER_OWES"
                    ? "This customer already owes our company the opening amount."
                    : "Choose who the opening balance belongs to."}
              </p>
            ) : null}
            {!canEditOpening ? (
              <p className="text-xs text-zinc-500">Only accounting or admin users can change the opening balance.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-100 px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className={btnFormCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className={cn(btnFormSubmit, "min-w-[7rem]")}
          disabled={isPending}
        >
          {isPending ? "Saving…" : mode === "create" ? "Register Client" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
