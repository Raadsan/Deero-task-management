import { authClient } from "@/lib/auth-client";
import { TableType } from "@/lib/types";
import { formatTexts } from "@/lib/utils";
import Link from "next/link";
import DeleteAction from "./DeleteAction";

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
    <div className="flex items-start gap-2.5">
      {buttonInfo.map(({ btnText, href }, index) => {
        return (
          <Link key={index} href={href}>
            <button className="to-secondary-200 cursor-pointer rounded-[3px] bg-linear-to-br from-orange-200 px-3 py-[4px] font-normal text-white">
              {btnText}
            </button>
          </Link>
        );
      })}
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
