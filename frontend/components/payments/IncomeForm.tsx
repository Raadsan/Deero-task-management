"use client";
import { useEffect } from "react";

import {
  createIncomeTransaction,
  getServiceAgreements,
} from "@/lib/actions/payment.action";
import {
  INCOME_STATUS,
  INCOME_TYEPS,
  PAYMENT_METHODS,
  ROUTES,
  Taxs,
} from "@/lib/constants";
import { Income as IncomeModel } from "@/lib/schema";
import { Client, TableIncome } from "@/lib/types";
import { formatDate, getRandomUUID } from "@/lib/utils";
import { IncomeSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import {
  DatePicker,
  GetSelectItem,
  SelectElement,
  TextInput,
  TextInputWithTaxtArea,
} from "../Shared/FormElements";

import { getInsitutionsbyId } from "@/lib/actions/client.action";
import useSWR from "swr";
import Loader from "../Shared/Loader";

interface Props {
  formType: "create" | "edit";
  currentIncome?: TableIncome;
  incomes?: IncomeModel[];
  clients: Pick<Client, "id" | "institution" | "phone">[] | undefined;
}
export default function IncomeForm({ clients, currentIncome }: Props) {
  const searchParms = useSearchParams();
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      totalAmount: "",
      amountPaid: "",
      clientId: searchParms.get("insitution") ?? "",
      service: "",
      subService: "",
      status: "",
      method: "",
      incomeType: "",
      duetoDate: undefined,
      customInput: "",
      notes: "",
      createdAt: new Date(),
      tax: "",
      taxtType: "",
      discount: "",
      agreement: "",
    },
    mode: "onChange",
    shouldFocusError: true,
    resolver: standardSchemaResolver(IncomeSchema),
  });
  const watchInstitution = watch("clientId");
  const watchServiceId = watch("service");
  const watchSubServiceId = watch("subService");

  const { data: insitutionsResult, isLoading: areInstitutionsLoading } = useSWR(
    [watchInstitution],
    () =>
      getInsitutionsbyId({
        id: watchInstitution,
      }),
  );

  const institutions = insitutionsResult?.data;
  const { data: agreements } = useSWR(["agreements", watchSubServiceId], () =>
    getServiceAgreements({
      clientId: watchInstitution,
      serviceId: watchServiceId,
      subServiceId: watchSubServiceId ?? "",
    }),
  );

  const router = useRouter();
  const [transition, startTransition] = useTransition();

  const watchedTotal = watch("totalAmount");
  const watchedDiscount = watch("discount");
  const watchedAmountPaid = watch("amountPaid");
  const tax = watch("tax");

  const totalAmountNum = parseFloat(watchedTotal) || 0;
  const discountNum = parseFloat(watchedDiscount) || 0;

  // Calculate tax value
  const taxValue = parseFloat(tax) || 0;

  //amount to pay in total after discount.
  const discountedValue =
    totalAmountNum - totalAmountNum * discountNum + taxValue;
  const amountPaidNum = parseFloat(watchedAmountPaid) || 0;

  // amount to pay later.
  const finalValue = discountedValue - amountPaidNum;

  // update the amountAfterDisocunt incase either discount or
  // total amount changes.
  useEffect(() => {
    setValue("amountAfterDiscount", discountedValue.toFixed(2), {
      shouldValidate: true,
    });
  }, [discountedValue, setValue]);

  const computeSubServices = institutions?.subServices.filter(
    (each) => each.categoryId === getValues("service"),
  );

  function handleFormSubmit(data: z.infer<typeof IncomeSchema>) {
    if (INCOME_STATUS.slice(1).includes(data.status) && !data.duetoDate) {
      return setError(
        "duetoDate",
        {
          message: "Due to Date is required.",
          type: "manaul",
        },
        {
          shouldFocus: true,
        },
      );
    } else if (
      INCOME_STATUS.at(0) === data.status &&
      amountPaidNum !== discountedValue
    ) {
      return toast.error(
        "For paid status, the amount you are paying must be same as total after discount",
      );
    } else if (
      INCOME_STATUS.at(1) === data.status &&
      amountPaidNum >= discountedValue
    ) {
      return toast.error(
        "For partially Paid status, the amount you are paying must be less than total amount after discount.",
      );
    } else if (INCOME_STATUS.at(-1) === data.status && amountPaidNum !== 0) {
      return toast.error(
        "For unpaid status, the amount you are paying must be 0.",
      );
    } else if (taxValue === 0 && Taxs.at(-1) !== data.taxtType) {
      return toast.error(
        "Please select 'NONE' option fron 'tax type dropdown' if there is no taxation",
      );
    }
    startTransition(async () => {
      const result = await createIncomeTransaction({
        createdAt: data.createdAt,
        agreementId: data.agreement,
        duetoDate: data.duetoDate ?? null,
        status: data.status,
        method: data.method,
        notes: data.notes ?? "",
        totalAmount: Number(data.totalAmount),
        amountPaid: Number(data.amountPaid),
        incomeCategoryName: data.incomeType,
        discount: data.discount,
        subTotal: discountedValue,
        taxType: data.taxtType ?? "",
        taxValue: taxValue,
      });

      if (result.success) {
        toast.success("Succesfully Created Income");
        reset();
        return router.push(ROUTES.payments);
      }
      toast.error("Failed to Create Income! try again");
    });
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="shado-sm flex min-h-[600px] w-full flex-col gap-[40px] border border-gray-100 px-[10px] py-[20px]"
    >
      {watchInstitution &&
        watchSubServiceId &&
        watchSubServiceId &&
        agreements?.data &&
        agreements.data.length === 0 && (
          <div className="col-span-full mb-4 rounded border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            No available agreements for this client/service/subservice that need
            payment. This usually means all are either fully paid or partially
            paid. Please go to the Income tab in the payment page, find the
            client, and check "details" to see any transaction history or
            pending payments for this client.
          </div>
        )}
      <h2 className="text-dark-red text-lg italic">
        if you wonna pay the remaining amount of previous transaction then go
        the income table, find the client and click 'details', then you can see
        if there are pendings, and you can pay in one click. Here is only for
        creating new income transaction.
      </h2>

      <div className="grid w-full grid-cols-1 gap-[20px] md:grid-cols-2 lg:grid-cols-3">
        <SelectElement
          key={getRandomUUID()}
          disbaleSelect={transition}
          labelText="Select Client"
          placeholder="Select Client"
          wrapperStyle="max-w-full"
          defaultValue={getValues("clientId")}
          errorMessage={errors.clientId?.message}
          elementRenderer={() => {
            return clients?.map(({ id, institution }, index) => {
              return (
                <GetSelectItem
                  key={index}
                  value={String(id)}
                  label={institution}
                />
              );
            });
          }}
          onChange={(value) => {
            setValue("clientId", value, {
              shouldValidate: true,
            });
          }}
        />
        {watchInstitution.length > 0 && (
          <SelectElement
            key={getRandomUUID()}
            disbaleSelect={transition || areInstitutionsLoading}
            labelText={`Select  Service`}
            placeholder="Select Service"
            wrapperStyle="max-w-full"
            defaultValue={getValues("service")}
            errorMessage={errors.service?.message}
            elementRenderer={() => {
              return institutions?.services?.map(
                ({ id, serviceName }, index) => {
                  return (
                    <GetSelectItem
                      key={index}
                      value={String(id)}
                      label={serviceName}
                    />
                  );
                },
              );
            }}
            onChange={(value) => {
              setValue("service", value, {
                shouldValidate: true,
              });
            }}
          />
        )}

        {getValues("service") && (
          <SelectElement
            key={getRandomUUID()}
            disbaleSelect={transition}
            labelText={`Select Sub Service`}
            placeholder="Select Sub Service"
            wrapperStyle="max-w-full"
            defaultValue={getValues("subService")}
            errorMessage={errors.subService?.message}
            elementRenderer={() => {
              return computeSubServices?.map(({ id, name }, index) => {
                return (
                  <GetSelectItem value={String(id)} label={name} key={index} />
                );
              });
            }}
            onChange={(value) => {
              setValue("subService", value, {
                shouldValidate: true,
              });
            }}
          />
        )}

        {/* agreement */}
        {getValues("subService") && (
          <SelectElement
            key={getRandomUUID()}
            disbaleSelect={transition}
            labelText={`Select Sub Service Agreement`}
            placeholder="Select Agreement"
            wrapperStyle="max-w-full"
            defaultValue={getValues("agreement")}
            errorMessage={errors.agreement?.message}
            elementRenderer={() => {
              return agreements?.data?.map(
                ({ id, createdAt, base, subServiceId }, index) => {
                  const service = computeSubServices?.find(
                    (each) => each.id === subServiceId,
                  );
                  const dateFormatted = formatDate(createdAt ?? "");
                  const labelValue = `${service?.name} with amount of $ ${base}. date: ${dateFormatted}.`;
                  return (
                    <GetSelectItem
                      value={String(id)}
                      label={labelValue}
                      key={index}
                    />
                  );
                },
              );
            }}
            onChange={(value) => {
              setValue("agreement", value, {
                shouldValidate: true,
              });

              const agreement = agreements?.data?.find(
                (eachOne) => eachOne.id === value,
              );
              setValue("totalAmount", String(agreement?.base), {
                shouldValidate: true,
              });
              setValue("discount", agreement?.discount?.toString() || "0", {
                shouldValidate: true,
              });
            }}
          />
        )}

        <TextInput
          disbaled
          prefixValue="$"
          paddingLeft="30px"
          labelId="totalAmount"
          placeholder="Enter the amount"
          labelText="Total Amount"
          otherProps={{ ...register("totalAmount") }}
          errorMessage={errors.totalAmount?.message}
          wrapperStyle="max-w-full"
        />
        <TextInput
          disbaled={
            transition || !getValues("totalAmount") || !!errors.totalAmount
          }
          paddingLeft="30px"
          labelId="discount"
          placeholder="0.0"
          labelText="Discount (eg. 0.1 for 10%)"
          otherProps={{ ...register("discount") }}
          errorMessage={errors.discount?.message}
          wrapperStyle="max-w-full"
        />
        <TextInput
          disbaled={transition}
          prefixValue=""
          paddingLeft="30px"
          labelId="tax"
          placeholder="0"
          errorMessage={errors.tax?.message}
          labelText="Tax amount. Enter 0 if there is not tax "
          otherProps={{ ...register("tax") }}
          wrapperStyle="max-w-full"
        />

        <SelectElement
          key={getRandomUUID()}
          disbaleSelect={transition}
          labelText="Select Tax Type (Pick 'None' incase of no tax)"
          placeholder="Select Type"
          wrapperStyle="max-w-full"
          defaultValue={getValues("taxtType")}
          errorMessage={errors.taxtType?.message}
          elements={[Taxs[0], Taxs?.at(-1) || ""]}
          onChange={(value) => {
            setValue("taxtType", value, {
              shouldValidate: true,
            });
          }}
        />

        <TextInput
          disbaled
          prefixValue="$"
          paddingLeft="30px"
          labelId="discountedValue"
          placeholder="0"
          labelText={`Total after Discount of  ${getValues("discount")} including Tax`}
          otherProps={{
            value: discountedValue.toFixed(2),
            readOnly: true,
          }}
          wrapperStyle="max-w-full"
        />

        <TextInput
          disbaled={transition}
          prefixValue="$"
          paddingLeft="30px"
          labelId="amountNow"
          placeholder="0"
          labelText="Amount To Pay Now"
          otherProps={{
            ...register("amountPaid"),
          }}
          errorMessage={errors.amountPaid?.message}
          wrapperStyle="max-w-full"
        />

        <TextInput
          disbaled
          prefixValue="$"
          paddingLeft="30px"
          labelId="finalValue"
          placeholder="0"
          labelText="Amount remaining to pay"
          otherProps={{ value: finalValue.toFixed(2), readOnly: true }}
          wrapperStyle="max-w-full"
        />
        <SelectElement
          key={getRandomUUID()}
          disbaleSelect={transition}
          labelText="Select Payment Status"
          placeholder="Select Payment Status"
          wrapperStyle="max-w-full"
          defaultValue={getValues("status")}
          errorMessage={errors.status?.message}
          elements={INCOME_STATUS}
          onChange={(value) => {
            setValue("status", value, {
              shouldValidate: true,
            });
          }}
        />

        <SelectElement
          key={getRandomUUID()}
          disbaleSelect={transition}
          labelText="Select Payment Method"
          placeholder="Select Payment Method"
          wrapperStyle="max-w-full"
          defaultValue={getValues("method")}
          errorMessage={errors.method?.message}
          elements={PAYMENT_METHODS}
          onChange={(value) => {
            setValue("method", value, {
              shouldValidate: true,
            });
          }}
        />

        <SelectElement
          key={getRandomUUID()}
          disbaleSelect={transition}
          labelText="Select Income Type"
          placeholder="Select Type"
          wrapperStyle="max-w-full"
          defaultValue={getValues("incomeType")}
          errorMessage={errors.incomeType?.message}
          elements={INCOME_TYEPS}
          onChange={(value) => {
            setValue("incomeType", value, {
              shouldValidate: true,
            });
          }}
        />
      </div>
      {getValues("incomeType") === INCOME_TYEPS.at(-1) && (
        <div className="flex h-full min-h-[50px] w-full max-w-[min(800px,100%)] flex-col gap-[20px] lg:flex-row">
          <TextInput
            disbaled={transition}
            labelId="customIncome"
            wrapperStyle="max-w-full "
            labelText="Describe the Custom Income"
            placeholder="Your custom Income Name"
            otherProps={{ ...register("customInput") }}
            errorMessage={errors.customInput?.message}
          />
        </div>
      )}

      <div className="flex h-full w-full gap-[30px]">
        <DatePicker
          disbaled={transition}
          wrapperClasses="max-w-full"
          date={getValues("createdAt")}
          labelText="Select Creation Date"
          errorMessage={errors.createdAt?.message}
          setDate={(date) => {
            setValue("createdAt", date, { shouldValidate: true });
          }}
        />
        <DatePicker
          disbaled={
            transition ||
            !getValues("status") ||
            !INCOME_STATUS.slice(1).includes(getValues("status"))
          }
          wrapperClasses="max-w-full"
          date={getValues("duetoDate")}
          errorMessage={errors.duetoDate?.message}
          labelText="Select Date that Client Will pay"
          setDate={(date) => {
            setValue("duetoDate", date, { shouldValidate: true });
          }}
        />
      </div>
      <div className="flex w-full flex-col gap-[10px]">
        <TextInputWithTaxtArea
          labelId="notes"
          labelText="Add description / Notes "
          placeholder="Enter Notes if any"
          errorMessage={errors.notes?.message}
          otherProps={{ ...register("notes") }}
          wrapperStyle="max-w-full"
          inputStyle="h-[40px]  rounded-[20px]"
        />
      </div>

      <div className="flex w-full items-center justify-center gap-[20px]">
        {transition ? (
          <Loader />
        ) : (
          <ButtonBuilder htmlType="submit" type={"normal"}>
            Add Income
          </ButtonBuilder>
        )}
      </div>
    </form>
  );
}
