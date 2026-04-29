"use client";

import { payUserSalary } from "@/lib/actions/payment.action";
import { authClient } from "@/lib/auth-client";
import { EXPENSE_STATUS, PAYMENT_METHODS, Taxs } from "@/lib/constants";
import { User } from "@/lib/schema";
import { formatDate } from "@/lib/utils";
import { SalarySchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import z from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import {
  DatePicker,
  SelectElement,
  TextInput,
  TextInputWithTaxtArea,
} from "../Shared/FormElements";
import Loader from "../Shared/Loader";

interface Props {
  user?: User;
}
export default function SalaryForm({ user }: Props) {
  const {
    handleSubmit,
    getValues,
    register,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: standardSchemaResolver(SalarySchema),
    defaultValues: {
      createdAt: new Date(),
      totalAmount: user?.salary ?? "",
    },
  });

  const [transition, startTransition] = useTransition();

  const watchTax = watch("tax");
  const watchTotal = watch("totalAmount");
  const watchAmountPaid = watch("amountPaid");
  const session = authClient.useSession().data?.user;

  const parseTax = parseFloat(watchTax) || 0;
  const parseTotal = parseFloat(watchTotal) || 0;
  const parseAmountPaid = parseFloat(watchAmountPaid) || 0;
  const totalAfterTax = parseTotal - parseTax;
  const finalValue = totalAfterTax - parseAmountPaid;

  async function handleSalaryPayment(data: z.infer<typeof SalarySchema>) {
    if (EXPENSE_STATUS.slice(1).includes(data.status) && !data.duetoDate) {
      return toast.error("Due to Date is required");
    } else if (
      EXPENSE_STATUS.at(0) === data.status &&
      parseAmountPaid !== totalAfterTax
    ) {
      return toast.error(
        "For paid status, the amount you are paying must be same as total.",
      );
    } else if (
      EXPENSE_STATUS.at(1) === data.status &&
      parseAmountPaid >= totalAfterTax
    ) {
      return toast.error(
        "For partially Paid status, the amount you are paying must be less than total amount after Tax.",
      );
    } else if (EXPENSE_STATUS.at(-1) === data.status && parseAmountPaid !== 0) {
      return toast.error(
        "For unpaid status, the amount you are paying must be 0.",
      );
    }
    startTransition(async function () {
      const result = await payUserSalary({
        ...data,
        recieceverId: user?.id!,
      });
      if (result.success) {
        toast.success("Succesfully Paid The Salary");
        reset();
        return;
      }
      console.log(result.errors);
      toast.error("Failed to pay the salary. Please try again");
    });
  }

  return (
    <form
      onSubmit={handleSubmit(handleSalaryPayment)}
      className="flex min-h-[600px] w-full flex-col gap-10 border border-gray-100 px-5 py-5 shadow-sm"
    >
      <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-full mb-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Note: Please review all fields carefully before submitting the
          payment. If tax does not apply, enter 0 and select &quot;None&quot; as
          the tax type. You as
          <span className="ms-0.5 me-1.5 text-lg font-bold">
            {session?.name}
          </span>
          are paying Salary of
          <span className="ms-1.5 me-1.5 text-lg font-bold">{user?.name}</span>
          at {formatDate(new Date(), true)}
        </div>
        <TextInput
          disbaled={!!getValues("totalAmount")}
          prefixValue="$"
          paddingLeft="30px"
          labelId="totalAmount"
          placeholder="Enter the amount"
          labelText="Total Amount (user salary is pre-loaded)"
          otherProps={{ ...register("totalAmount") }}
          errorMessage={errors.totalAmount?.message}
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
          disbaleSelect={transition}
          labelText="Select Tax Type (Pick 'None' for  zero tax)"
          placeholder="Select Type"
          wrapperStyle="max-w-full"
          defaultValue={getValues("taxtType")}
          errorMessage={errors.taxtType?.message}
          elements={Taxs.slice(1)}
          onChange={(value) => {
            setValue("taxtType", value, {
              shouldValidate: true,
            });
          }}
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
          otherProps={{
            value: Number.isNaN(finalValue) ? 0 : finalValue.toFixed(3),
            readOnly: true,
          }}
          wrapperStyle="max-w-full"
        />
        <SelectElement
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
      </div>

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
            !EXPENSE_STATUS.slice(1).includes(getValues("status"))
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
      <div className="flex w-full flex-col gap-2.5">
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
      <div className="flex w-full items-center justify-center gap-2.5">
        {transition ? (
          <Loader />
        ) : (
          <ButtonBuilder htmlType="submit" type={"normal"}>
            Pay
          </ButtonBuilder>
        )}
      </div>
    </form>
  );
}
