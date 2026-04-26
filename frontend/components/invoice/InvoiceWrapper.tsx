import { getInvoiceInfo } from "@/lib/actions/payment.action";
import { use } from "react";
import PrintInvoice from "./PrintInvoice";

interface Props {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}
export default function InvoiceWrapper({ params, searchParams }: Props) {
  const { id } = use(params);
  const { type, detailsId, createdAt } = use(searchParams);

  const { data: invoiceData } = use(
    getInvoiceInfo({
      transactionId: id,
      type: type as "income" | "expense",
      detailsId: detailsId,
      createdAt: createdAt,
    }),
  );

  const items = invoiceData?.items || [];
  const description = invoiceData?.description;
  const headerInfo = invoiceData?.headerInfo;

  return (
    <PrintInvoice
      type="invoice"
      description={description ?? ""}
      items={items}
      headerInfo={headerInfo ?? undefined}
    />
  );
}
