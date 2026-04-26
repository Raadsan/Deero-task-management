"use client";

import {
  EXPENSE_STATUS,
  EXPENSE_TYPES,
  PAYMENT_METHODS,
} from "@/lib/constants";

import { Expense } from "@/lib/generated/prisma";
import { ExpenseSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import {
  DatePicker,
  SelectElement,
  TextInput,
  TextInputWithTaxtArea,
} from "../Shared/FormElements";

import { createExpenseTransaction } from "@/lib/actions/payment.action";
import { getRandomUUID } from "@/lib/utils";
import ButtonBuilder from "../Shared/ButtonBuilder";
import Loader from "../Shared/Loader";

interface Props {
  expenses?: Expense[];
}

export default function ExpenseForm({ expenses = [] }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      totalAmount: "",
      amountPaid: "",
      expenseType: "",
      method: "",
      status: "",
      customInput: "",
      createdAt: new Date(),
      duetoDate: undefined,
      notes: "",
    },
    mode: "onChange",
    resolver: standardSchemaResolver(ExpenseSchema),
  });

  const [transition, startTransition] = useTransition();

  const router = useRouter();

  const watchTotal = watch("totalAmount");

  const amountPaid = watch("amountPaid");

  const parsedTotal = parseFloat(watchTotal) || 0;

  const parsedAmountPaidNow = parseFloat(amountPaid) || 0;

  const totalValueWithTax = parsedTotal;
  const finalValue = totalValueWithTax - parsedAmountPaidNow;

  const filteredExpenses = [
    ...new Set([
      ...expenses?.map((each) => each.expenseType),
      ...EXPENSE_TYPES,
    ]),
  ];

  useEffect(() => {
    reset();
  }, []);

  function handleFormSubmit(data: z.infer<typeof ExpenseSchema>) {
    if (EXPENSE_STATUS.slice(1).includes(data.status) && !data.duetoDate) {
      return toast.error("Due to Date is required");
    } else if (
      EXPENSE_STATUS.at(0) === data.status &&
      parsedAmountPaidNow !== totalValueWithTax
    ) {
      return toast.error(
        "For paid status, the amount you are paying must be same as total.",
      );
    } else if (
      EXPENSE_STATUS.at(1) === data.status &&
      parsedAmountPaidNow >= totalValueWithTax
    ) {
      return toast.error(
        "For partially Paid status, the amount you are paying must be less than total amount after discount.",
      );
    } else if (
      EXPENSE_STATUS.at(-1) === data.status &&
      parsedAmountPaidNow !== 0
    ) {
      return toast.error(
        "For unpaid status, the amount you are paying must be 0.",
      );
    }

    startTransition(async () => {
      const result = await createExpenseTransaction({
        notes: data.notes ?? "",
        status: data.status,
        method: data.method,
        createdAt: data.createdAt,
        expenseCategoryName: data.expenseType,
        duetoDate: data.duetoDate ?? null,
        amountPaid: Number(data.amountPaid),
        totalAmount: Number(data.totalAmount),
      });
      if (result.success) {
        toast.success("Successfully Created Expense");
        reset();
        return router.back();
      }
      toast.error(
        result?.errors?.message ?? "OOh! Failed to Create expense. try again!",
      );
    });
  }


  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="shado-sm flex min-h-[600px] w-full flex-col gap-[40px] border border-gray-100 px-[10px] py-[20px]"
    >
      <div className="grid w-full grid-cols-1 gap-[20px] md:grid-cols-2 lg:grid-cols-3">
        <TextInput
          disbaled={transition}
          prefixValue="$"
          paddingLeft="30px"
          labelId="totalAmount"
          placeholder="0"
          labelText="Total Amount"
          otherProps={{ ...register("totalAmount") }}
          errorMessage={errors.totalAmount?.message}
          wrapperStyle="max-w-full"
        />

        <TextInput
          disbaled={transition}
          prefixValue="$"
          paddingLeft="30px"
          labelId="amountNow"
          placeholder="0"
          labelText="Amount To pay now"
          otherProps={{ ...register("amountPaid") }}
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
          elements={EXPENSE_STATUS}
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
          labelText="Select Expense Type"
          placeholder="Select Type"
          wrapperStyle="max-w-full"
          defaultValue={getValues("expenseType")}
          errorMessage={errors.expenseType?.message}
          elements={filteredExpenses}
          onChange={(value) => {
            setValue("expenseType", value, {
              shouldValidate: true,
            });
          }}
        />
        {getValues("expenseType") === EXPENSE_TYPES.at(-1) && (
          <TextInput
            disbaled={transition}
            labelId="customExpense"
            wrapperStyle="max-w-full "
            labelText="Name the Custom Expense"
            placeholder="Your custom Expense Name"
            otherProps={{ ...register("customInput") }}
            errorMessage={errors.customInput?.message}
          />
        )}

        <DatePicker
          disbaled={transition}
          wrapperClasses="max-w-full"
          date={getValues("createdAt")}
          labelText="Select Date"
          errorMessage={errors.createdAt?.message}
          setDate={(date) => {
            setValue("createdAt", date, { shouldValidate: true });
          }}
        />

        <DatePicker
          disbaled={
            transition || !EXPENSE_STATUS.slice(1).includes(getValues("status"))
          }
          wrapperClasses="max-w-full"
          date={getValues("duetoDate")}
          errorMessage={errors.duetoDate?.message}
          labelText="Select Date that Deero Will pay it"
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
            Add Expense
          </ButtonBuilder>
        )}
      </div>
    </form>
  );
}
