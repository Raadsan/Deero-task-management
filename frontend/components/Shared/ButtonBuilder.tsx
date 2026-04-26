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
      className={`via-secondary-100 to-secondary-100 hover:from-seondary-200 hover:via-secondary-100 to min-w-[150px] cursor-pointer rounded-[8px] border border-none border-black/25 bg-linear-to-l from-orange-200 px-[22px] py-[10px] text-white duration-300 will-change-[colors] hover:bg-linear-to-r hover:to-orange-100 hover:duration-500`}
    >
      {children}
    </button>
  );
}
