import { getClientReport } from "@/lib/apis/clientApi";

import { getTasksReport } from "@/lib/apis/taskApi";
import { getUsersSalariesReport } from "@/lib/apis/userApi";
import PrintInvoice from "../invoice/PrintInvoice";

interface Props {
  type: "userTasks" | "clients" | "users" | "expense" | "income" | "invoice";
  params?: Promise<Record<string, string>>;
}

export default async function ReportWrapper({ type, params }: Props) {
  if (type === "userTasks" && params) {
    const { id } = await params;
    const { data: reports } = await getTasksReport({
      userIdForTaskReport: id,
    });
    return (
      <PrintInvoice type={type} description={""} items={reports?.tasks ?? []} />
    );
  } else if (type === "clients") {
    const { data: clients } = await getClientReport();
    return (
      <PrintInvoice
        type={type}
        description={clients?.description ?? ""}
        items={clients?.items ?? []}
        headerInfo={clients?.headerInfo}
      />
    );
  } else if (type === "users") {
    const { data: clients } = await getUsersSalariesReport();
    return (
      <PrintInvoice
        type={type}
        description={clients?.description ?? ""}
        items={clients?.items ?? []}
        headerInfo={clients?.headerInfo}
      />
    );
  }

  return (
    <PrintInvoice
      type={type}
      description={""}
      items={[]}
      headerInfo={undefined}
    />
  );
}
