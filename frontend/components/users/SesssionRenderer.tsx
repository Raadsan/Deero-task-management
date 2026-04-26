"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function SessionRenderer({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [isCopied, setIsCopied] = useState(false);
  return (
    <div className="flex h-fit w-full items-center gap-[40px]">
      <label className="text-dark-gray min-w-[200px] font-medium">
        {label}
      </label>
      <div className="relative h-[60px] w-full grow overflow-hidden rounded-[10px] pl-[21px] outline outline-black/50">
        <input
          type="text"
          defaultValue={value}
          disabled={true}
          className="absolute inset-0 h-full w-full px-[20px] disabled:bg-gray-200"
        />
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setIsCopied(true);
            setTimeout(() => {
              setIsCopied(false);
            }, 3000);
          }}
        >
          {isCopied ? (
            <Check className="absolute top-1/2 right-[20px] -translate-y-[50%] text-green-500" />
          ) : (
            <Copy className="hover:text-primary absolute top-1/2 right-[20px] -translate-y-[50%] scale-[1.1] transform transition-colors duration-300 ease-out hover:scale-[1.2]" />
          )}
        </button>
      </div>
    </div>
  );
}
