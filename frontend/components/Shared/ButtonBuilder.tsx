import { ReactNode } from "react";
import { DialogClose } from "../ui/dialog";

interface Props {
  children?: ReactNode;
  type: "normal" | "close";
  onClick?: () => void;
  classNames?: string;
  disabled?: boolean;
  htmlType?: "button" | "submit" | "reset";
}
export default function ButtonBuilder({
  onClick,
  children,
  type,
  disabled,
  htmlType = "button",
}: Props) {
  if (type === "close") {
    return (
      <DialogClose
        className={`cursor-pointer rounded-[4px] border border-black/25 bg-white px-[10px] py-[5px] text-black`}
      >
        {children}
      </DialogClose>
    );
  }

  return (
    <button
      type={htmlType}
      disabled={disabled}
      onClick={onClick ?? undefined}
      className={`btn-brand min-w-[150px] cursor-pointer rounded-[8px] border border-none px-[22px] py-[10px] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
