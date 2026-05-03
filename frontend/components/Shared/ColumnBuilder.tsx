import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { SidebarTrigger } from "../ui/sidebar";

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
              "relative flex min-h-[120px] w-full shrink-0 items-center-safe py-2.5 pr-[30px] pl-[20px] gap-[20px]",
              headerClassNames,
            )}
          >
            <SidebarTrigger className="relative top-0 ml-0 scale-125" />
            <div className="flex flex-1 items-center justify-end">
               {children.at(0)}
            </div>
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
