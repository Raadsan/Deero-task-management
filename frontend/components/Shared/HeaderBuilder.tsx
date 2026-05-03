import { cn, computeFontSize } from "@/lib/utils";
import Link from "next/link";
import { ReactNode } from "react";
import ButtonBuilder from "./ButtonBuilder";

interface Props {
  headerText: string;
  buttonText?: string;
  showBlurLine: boolean;
  link?: string;
  showButton?: boolean;
  classNames?: string;
  children?: ReactNode;
}
export default function HeaderBuilder({
  headerText,
  showBlurLine,
  buttonText,
  showButton,
  classNames,
  link,
  children,
}: Props) {
  return (
    <div
      className={cn(
        "flex h-fit w-full items-center justify-between",
        classNames,
      )}
    >
      <h2
        style={{
          fontSize: computeFontSize(32),
        }}
        className="translate-y-[6px] transform self-end font-medium"
      >
        {headerText}
      </h2>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-[10px]">
          {children}
          {showButton && (
            <Link href={link ?? ""}>
              <ButtonBuilder type={"normal"}>{buttonText}</ButtonBuilder>
            </Link>
          )}
        </div>
      </div>

      {showBlurLine && (
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-black/20 blur-[2px]" />
      )}
    </div>
  );
}
