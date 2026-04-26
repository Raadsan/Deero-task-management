"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "../ui/button";

export default function TransactionView() {
  const [buttonTOShow, setButtonTOShow] = useState(1);
  const toggle = (value: number) => setButtonTOShow(value);
  return (
    <section className="h-full w-full space-y-2.5">
      <div className="flex w-full items-center justify-between border-t border-black/12 pt-10">
        <Button
          onClick={() => toggle(1)}
          className={cn(
            "w-[100px] cursor-pointer rounded-[10px] border border-black/10 bg-white px-3 py-2 text-black shadow-sm",
            buttonTOShow === 1 && "bg-dark-red text-white",
          )}
        >
          Details
        </Button>
        <Button
          onClick={() => toggle(2)}
          className={cn(
            "w-[100px] cursor-pointer rounded-[10px] border border-black/10 bg-white px-3 py-2 text-black shadow-sm",
            buttonTOShow === 2 && "bg-dark-red text-white",
          )}
        >
          Edit
        </Button>
      </div>
    </section>
  );
}
