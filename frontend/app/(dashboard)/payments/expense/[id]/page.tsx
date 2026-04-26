import PayDept from "@/components/payments/PayDept";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { getExpenseTransactionDetials } from "@/lib/actions/payment.action";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function ExpenseTransactionDetailsPage({ params }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg ">
      <HeaderBuilder
        classNames="text-white"
        headerText={"Register Expense"}
        showBlurLine={false}
      />
      <div className="size-full">
        <PageBreadcrumb
          links={[
            {
              title: "Payment",
              link: ROUTES.payments,
            },
          ]}
        />

        <Suspense fallback={<ClientFormSkeleton />}>
          <ExpenseDetails params={params} />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}

async function ExpenseDetails({
  params,
}: {
  params: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { data } = await getExpenseTransactionDetials({ agreementId: id });

  if (!data) {
    return (
      <section className="flex h-full w-full items-center justify-center px-3 py-3">
        <span className="text-gray-500">No data found.</span>
      </section>
    );
  }

  const statusClass = (() => {
    switch (data.status) {
      case "Paid":
        return "bg-green-500 text-white";
      case "Unpaid(Payable)":
        return "bg-orange-500 text-white";
      case "Partially Paid":
      case "Partially Paid4":
        return "bg-yellow-600 text-white";
      default:
        return "bg-gray-200 text-black";
    }
  })();

  return (
    <section className="flex h-full w-full flex-col gap-6 px-4 py-6 text-black">
      <div className="flex flex-col justify-between gap-2 rounded-[10px] border border-black/10 px-3 py-2 md:flex-row md:items-center">
        <div>
          <h2 className="text-dark-red mb-1 text-xl font-bold">
            Expense Details
          </h2>
          <div className="text-sm text-gray-500">
            <span className="font-semibold">Paid At:&nbsp;</span>
            {data.paidAt || "-"}
          </div>
        </div>
        <div className="rounded-lg bg-white/10 px-5 py-2">
          <span className="text-lg font-semibold">Base:</span>{" "}
          <span className="text-dark-red text-lg">${data.base ?? "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 justify-items-center gap-5 rounded-lg p-4 md:grid-cols-6">
        <div>
          <div className="mb-1 text-xs uppercase">Expense Type</div>
          <div className="text-md font-medium">{data.expenseType}</div>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase">Registered By</div>
          <div className="text-md font-medium">{data.registeredBy}</div>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase">Method</div>
          <div className="text-md font-medium">{data.method}</div>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase">Status</div>
          <div
            className={cn(
              "text-md w-fit rounded-[5px] p-2 font-medium",
              statusClass,
            )}
          >
            {data.status}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase">Total Dept</div>
          <div className="text-md bg-dark-red w-fit rounded-[10px] px-2 py-2 font-bold text-white">
            ${data.totalDept}
          </div>
        </div>
        <div className="flex w-fit items-center">
          {data.status !== "Paid" && (
            <PayDept
              transactionId={data.id}
              pendingAmount={data.totalDept}
              type="expense"
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border-t border-black/10 bg-white/10 px-4 py-3">
        <div className="mb-1 text-xs uppercase">Description</div>
        <div className="text-md">{data.description || "-"}</div>
      </div>

      <div>
        <h3 className="text-dark-red mb-2 text-lg font-semibold">
          Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full overflow-hidden rounded-lg text-left text-sm">
            <thead>
              <tr className="bg-dark-red text-white">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Paid At</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Print Invoice</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-center text-gray-300"
                  >
                    No transactions found
                  </td>
                </tr>
              )}
              {data.transactions.map((t, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? "bg-gray-200" : "bg-gray-300"}
                >
                  <td className="px-4 py-2 font-medium">{idx + 1}</td>
                  <td className="px-4 py-2">{t.paidAt || "-"}</td>
                  <td className="px-4 py-2">${t.amount}</td>
                  <td className="w-[200px]">
                    <Link
                      href={ROUTES.createInvoice(
                        t.transactionId,
                        "expense",
                        t.id,
                        t.paidAt ?? "",
                      )}
                      className="bg-dark-red min-w-[300px] cursor-pointer rounded-[10px] px-3 py-2 text-white shadow-none"
                    >
                      Print
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
