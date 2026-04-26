"use client";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

interface Props {
  buttonOneDisplayText: string;
  buttonTwoDisplayText: string;
  buttonOneOnClick: () => void;
  buttonTwoOnClick: () => void;
  showBasicForm: boolean;
}
export default function SwitchBetweenButtons({
  buttonOneDisplayText,
  buttonTwoDisplayText,
  buttonOneOnClick,
  buttonTwoOnClick,
  showBasicForm,
}: Props) {
  return (
    <div className="flex w-full items-center justify-between border-b border-black/10 px-10 pb-3">
      <Button
        onClick={buttonOneOnClick}
        className={cn(
          "cursor-pointer rounded-[10px] border border-black/20 bg-white py-2 text-black",
          showBasicForm ? "bg-dark-red border-dark-red text-white" : "",
        )}
      >
        {buttonOneDisplayText}
      </Button>
      <Button
        onClick={buttonTwoOnClick}
        className={cn(
          "cursor-pointer rounded-[10px] border border-black/20 bg-white py-2 text-black",
          !showBasicForm ? "bg-dark-red border-dark-red text-white" : "",
        )}
      >
        {buttonTwoDisplayText}
      </Button>
    </div>
  );
}
