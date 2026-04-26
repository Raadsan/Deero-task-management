"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
interface Props {
  value: string;
}
export default function CopyTextButton({ value }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="group cursor-pointer"
      onClick={() => {
        setCopied(true);
        window.navigator.clipboard.writeText(value);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      }}
    >
      {copied ? (
        <Check className="text-green-500" />
      ) : (
        <Copy className="group-hover:text-dark-red" />
      )}
    </button>
  );
}
