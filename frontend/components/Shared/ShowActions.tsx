import { authClient } from "@/lib/auth-client";
import { TableType } from "@/lib/types";
import { formatTexts } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import DeleteAction from "./DeleteAction";
import { actionBtnEdit } from "@/lib/dashboard-ui";
import { Button } from "../ui/button";

interface Props {
  tableType: TableType;
  deleteActionKeyId: string;
  buttonInfo: Array<{
    btnText: string;
    href: string;
  }>;
}
export default function ShowActions({
  tableType,
  buttonInfo,
  deleteActionKeyId,
}: Props) {
  const session = authClient.useSession();
  const description = formatTexts({
    type: tableType,
    formatType: "description",
  });

  const dialog = formatTexts({
    type: tableType,
    formatType: "diaglog",
  });

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {buttonInfo.map(({ btnText, href }, index) => (
        <Button
          key={index}
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            actionBtnEdit,
            "h-8 px-2.5 text-[11px] font-semibold uppercase tracking-wide",
          )}
        >
          <Link href={href}>{btnText}</Link>
        </Button>
      ))}
      {session.data?.user.role !== "user" && (
        <DeleteAction
          key={deleteActionKeyId + new Date().getTime()}
          dialogTitle={dialog}
          idToDelete={deleteActionKeyId}
          typeOfDataToDelete={tableType === "my-tasks" ? "tasks" : tableType}
          description={description}
        />
      )}
    </div>
  );
}
