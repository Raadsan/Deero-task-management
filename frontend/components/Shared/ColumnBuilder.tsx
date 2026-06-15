import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface Props {
  children: ReactNode[] | ReactNode;
  headerClassNames?: string;
}

export default function ColumnBuilder({ children, headerClassNames }: Props) {
  return (
    <div className="flex h-full w-full flex-col gap-6">
      {Array.isArray(children) ? (
        <>
          {children.at(0) && (
            <div
              className={cn(
                "flex w-full shrink-0 items-center justify-end gap-4",
                headerClassNames,
              )}
            >
              {children.at(0)}
            </div>
          )}
          <div className="w-full shrink-0 grow">{children.at(1)}</div>
        </>
      ) : (
        <div className="w-full shrink-0 grow">{children}</div>
      )}
    </div>
  );
}
