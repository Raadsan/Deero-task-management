import PayDept from "@/components/payments/PayDept";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { getIncomeTransactonDetails } from "@/lib/actions/payment.action";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import Link from "next/link";
import { Suspense } from "react";

export default function TransactionDetailsPage({ params }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText={"Transaction Details Page"}
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
          <TransactionDetailsWrapper params={params} />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}

async function TransactionDetailsWrapper({
  params,
}: {
  params: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { data: details } = await getIncomeTransactonDetails(id);

  return (
    <section className="h-full w-full px-3 py-6">
      <div className="mb-8 flex items-center gap-6 rounded-[10px] border border-black/4 bg-white p-6 shadow-sm">
        <div className="text-dark-red flex size-16 items-center justify-center rounded-full bg-gray-200 text-3xl font-bold">
          {details?.clientName.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-xl font-semibold text-gray-800">
            {details?.clientName} |
            <span className="text-dark-red ms-1.5">
              Total Dept : ${details?.totalDept.toFixed(2)}
            </span>
          </div>
          <div className="text-sm text-gray-500">Source:{details?.source}</div>
        </div>
      </div>

      <div className="space-y-8">
        {details?.services.map(
          ({ category, categoryTotalDept, subCategories }, index) => (
            <div
              key={index}
              className="rounded-[10px] border border-black/10 px-4 py-3"
            >
              <h2 className="mb-4 text-2xl font-bold text-blue-800">
                {category} |
                <span className="text-dark-red ms-1.5">
                  Cateogry Dept: ${categoryTotalDept.toFixed(2)}
                </span>
              </h2>
              <div className="space-y-6">
                {subCategories.map(
                  ({ name, transactions, ...rest }, subIndex) => {
                    const total = transactions.reduce((prev, current) => {
                      return prev + Number(current.paidAmount);
                    }, 0);
                    const pendingAmount = (rest.subTotal ?? 0) - total;
                    return (
                      <div
                        key={subIndex}
                        className="rounded-lg border border-black/3 bg-gray-50/10 p-4 shadow-sm/10"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="mb-2 text-lg font-semibold text-gray-700">
                            {name}
                          </h3>
                          <div className="py-2">
                            {rest.status !== "Paid" ? (
                              <PayDept
                                type="income"
                                transactionId={
                                  transactions.at(0)?.incomeTransactionId ?? ""
                                }
                                pendingAmount={pendingAmount.toFixed(2)}
                              />
                            ) : (
                              "Paid ✅"
                            )}
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="w-full">
                              <tr className="border-b border-black/20 px-3 py-2 text-gray-600">
                                <th className="py-2 text-left font-medium">
                                  Agreement Date
                                </th>
                                <th className="py-2 text-left font-medium">
                                  Base
                                </th>
                                <th className="py-2 text-left font-medium">
                                  Discount
                                </th>
                                <th className="py-2 text-left font-medium">
                                  After Discount
                                </th>
                                <th className="py-2 text-left font-medium">
                                  Tax
                                </th>
                                <th className="py-2 text-left font-medium">
                                  Sub total
                                </th>

                                <th className="py-2 text-left font-medium">
                                  Pending
                                </th>
                                <th className="py-2 text-left font-medium">
                                  Due to Date
                                </th>

                                <th className="py-2 text-left font-medium">
                                  Status
                                </th>
                                <th className="py-2 text-left font-medium">
                                  Method
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-black/10 last:border-0">
                                <td className="py-2">{rest.createdAt}</td>
                                <td className="py-2">${rest.totalAmount}</td>

                                <td className="py-2">
                                  ${rest.discount} means{" "}
                                  {parseFloat(rest.discount ?? "0") * 100}%
                                </td>
                                <td className="py-2">
                                  ${(rest.subTotal ?? 0) - rest.taxValue}
                                </td>
                                <td className="py-2">
                                  {rest.taxType} | ${rest.taxValue}
                                </td>
                                <td className="py-2">${rest.subTotal}</td>
                                <td className="py-2">
                                  ${pendingAmount.toFixed(2)}
                                </td>
                                <td className="py-2">
                                  {rest.dueToDate ?? "No Pending"}
                                </td>
                                <td className="py-2">
                                  {rest.status === "Paid" ? (
                                    <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                                      Paid
                                    </span>
                                  ) : rest.status === "Partially Paid" ? (
                                    <span className="inline-block rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                                      Partially Paid
                                    </span>
                                  ) : (
                                    <span className="inline-block rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                                      Unpaid
                                    </span>
                                  )}
                                </td>
                                <td className="py-2">{rest.method}</td>
                              </tr>
                              {transactions.map((eachOne, tIndex) => {
                                return (
                                  <tr
                                    key={tIndex}
                                    className="w-full border-b border-black/10 bg-gray-50 last:border-0"
                                  >
                                    <td className="py-2" colSpan={11}>
                                      <span className="flex items-center space-x-4 text-sm text-gray-700 italic">
                                        <span className="font-semibold text-green-700">
                                          Paid at:
                                        </span>
                                        <span className="">
                                          {eachOne.paidAgain || "-"}
                                        </span>
                                        <span className="mx-2 text-gray-400">
                                          |
                                        </span>
                                        <span className="font-semibold text-blue-800">
                                          Amount:
                                        </span>
                                        <span className="">
                                          {eachOne.paidAmount
                                            ? `$${eachOne.paidAmount}`
                                            : "-"}
                                        </span>
                                      </span>
                                    </td>
                                    <td className="w-[200px]">
                                      <Link
                                        href={ROUTES.createInvoice(
                                          eachOne.incomeTransactionId,
                                          "income",
                                          eachOne.id,
                                          eachOne.paidAgain ?? "",
                                        )}
                                        className="bg-dark-red min-w-[300px] cursor-pointer rounded-[10px] px-3 py-2 text-white shadow-none"
                                      >
                                        Print
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
