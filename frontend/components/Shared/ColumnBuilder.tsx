import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface Props {
  children: ReactNode[] | ReactNode;
  headerClassNames?: string;
}

export default function ColumnBuilder({ children, headerClassNames }: Props) {
  return (
    <div className="flex h-full min-h-screen w-full flex-col gap-[30px]">
      {Array.isArray(children) ? (
        <>
          <div
            className={cn(
              "relative flex min-h-[100.82px] w-full shrink-0 items-center-safe py-2.5 pr-[30px] pl-[100px]",
              headerClassNames,
            )}
          >
            {children.at(0)}
          </div>
          <div className="w-full shrink-0 grow px-[30px] pb-[100px]">
            {children.at(1)}
          </div>
        </>
      ) : (
        <div className="w-full shrink-0 grow px-[30px] pb-[100px]">
          {children}
        </div>
      )}
    </div>
  );
}
