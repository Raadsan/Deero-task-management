"use client";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "../ui/button";

export default function PaymentHeaderButtons() {
  return (
    <div className="mb-[30px] ml-auto flex w-fit gap-[10px]">
      <Link
        href={ROUTES.paymentReport}
        className={cn(
          "cursor-pointer rounded-[10px] border border-black/30 bg-gray-50 px-3 py-2 text-black hover:opacity-90",
        )}
      >
        Report
      </Link>

      <Link href={ROUTES.income}>
        <Button
          className={cn(
            "cursor-pointer rounded-[10px] border border-black/30 bg-gray-50 px-3 py-2 text-black hover:opacity-90",
          )}
        >
          Register Income
        </Button>
      </Link>
      <Link href={ROUTES.expense}>
        <Button
          className={cn(
            "via-dark-red to-secondary-100 cursor-pointer rounded-[10px] border border-none bg-linear-to-r from-orange-200 px-3 py-2 text-white hover:opacity-90",
          )}
        >
          Register Expense
        </Button>
      </Link>
    </div>
  );
}
