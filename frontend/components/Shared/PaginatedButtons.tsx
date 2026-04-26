"use client";

import { computeFontSize } from "@/lib/utils";

interface Props {
  text: string;
  disable: boolean;
  onClick: () => void;
}

export default function PaginatedButton({ text, disable, onClick }: Props) {
  function handOnClick() {
    onClick();
  }

  return (
    <button
      disabled={disable}
      style={{
        fontSize: computeFontSize(14),
      }}
      className="hover:bg-dark-red cursor-pointer rounded-[4px] border-[.5px] border-black/25 px-[11px] py-[6px] font-normal text-black transition-[background-color_color] duration-500 ease-out hover:text-white disabled:cursor-no-drop disabled:bg-gray-500 disabled:text-white/60"
      onClick={handOnClick}
    >
      {text}
    </button>
  );
}
