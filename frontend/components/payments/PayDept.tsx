"use client";

import { payIncomeExpenseDept } from "@/lib/actions/payment.action";
import { useParams } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import toast from "react-hot-toast";
import ShowDialog from "../Shared/ShowDialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface Props {
  pendingAmount?: string;
  transactionId: string;
  type: "income" | "expense" | "salary";
}

export default function PayDept({ transactionId, type, pendingAmount }: Props) {
  const [open, setIsOpen] = useState<boolean | undefined>(undefined);
  const [amount, setAmount] = useState(pendingAmount);
  const [transition, startTransition] = useTransition();
  const params = useParams();
  const toggle = (value: boolean | undefined) => setIsOpen(value);

  async function handlePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!amount) {
      toast.error("Please Enter the Amount");
      return;
    }

    const parseValue = Number.parseFloat(amount);
    const parsePending = Number.parseFloat(pendingAmount ?? "0");
    if (Number.isNaN(parseValue) || parseValue <= 0) {
      toast.error("Please Enter Valid Amount like 300 or 400 without letters.");
      return;
    }
    if (parseValue > parsePending) {
      toast.error(
        `Please You cannot pay more than pending amount: ${pendingAmount} `,
      );
      return;
    }

    toggle(true);
    startTransition(async () => {
      const result = await payIncomeExpenseDept({
        currentAmount: String(parseValue),
        transactionId: transactionId,
        paramsId: String(params.id),
        isFullyPaid: parseValue === parsePending,
        type,
      });
      setAmount("0");
      if (result.success) {
        toast.success("Succesfully Paid the Dept.");
        toggle(undefined);
        return;
      }
      toast.error("Failed to pay the amount. please try again.");
      toggle(undefined);
    });
  }

  return (
    <ShowDialog
      title={"Pay the Amount"}
      triggerText="Pay"
      openDialog={open}
      children={
        <form
          onSubmit={handlePayment}
          className="flex h-fit w-full gap-3 px-4 py-2"
        >
          <Input
            disabled={transition}
            defaultValue={pendingAmount}
            onChange={(e) => setAmount(e.target.value)}
            className="focus:ring-dark-red rounded-[20px] border border-black/20 bg-white px-2 py-4 text-lg shadow-sm focus:ring-1"
            placeholder="Enter the amount"
          />
          <Button className="bg-dark-red cursor-pointer rounded-[10px] px-2 py-1 text-white">
            {transition ? "Paying...." : "Pay Now"}
          </Button>
        </form>
      }
      triggerClassess={
        "bg-dark-red text-white px-2 cursor-pointer rounded-md  py-3"
      }
    />
  );
}
