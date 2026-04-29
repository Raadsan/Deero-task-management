"use client";

import { User } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "../ui/button";
import SalaryForm from "./SalaryForm";
import UserSalaryDetails from "./UserSalaryDetails";
interface Props {
  user?: User;
}
export default function SalaryDetailsAndForm({ user }: Props) {
  const [type, setType] = useState<"form" | "details">("form");
  return (
    <section className="h-full w-full space-y-1.5 border-t border-black/22 pt-4">
      <div className="flex w-full items-center justify-between">
        <Button
          onClick={() => setType("form")}
          className={cn(
            "rounded-[10px] border border-black/10 bg-white px-3 py-2 text-black",
            type === "form" && "cursor-pointer bg-slate-800 text-white",
          )}
        >
          Form
        </Button>
        <Button
          onClick={() => setType("details")}
          className={cn(
            "rounded-[10px] border border-black/10 bg-white px-3 py-2 text-black",
            type === "details" && "cursor-pointer bg-slate-800 text-white",
          )}
        >
          Details
        </Button>
      </div>
      {type === "form" && <SalaryForm user={user} />}
      {type === "details" && <UserSalaryDetails userId={user?.id!} />}
    </section>
  );
}
