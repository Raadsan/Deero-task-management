"use client";

import { getUserSalaryDetails } from "@/lib/actions/payment.action";
import { RefreshCw } from "lucide-react";

import useSWR, { useSWRConfig } from "swr";
import { ClientFormSkeleton } from "../Shared/Loader";
import { Button } from "../ui/button";
import PayDept from "./PayDept";

interface Props {
  userId: string;
}

export default function UserSalaryDetails({ userId }: Props) {
  const {
    data: userData,
    isValidating,
    isLoading,
  } = useSWR(["userDetialsData"], () => getUserSalaryDetails(userId));

  const { mutate } = useSWRConfig();

  if (isLoading) return <ClientFormSkeleton />;
  else if (!userData) {
    return (
      <div className="h-full w-full px-4 pt-5 pb-3">
        <p>No salary details available.</p>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full space-y-3.5 px-4 pt-5 pb-3">
      <Button
        onClick={() => mutate(["userDetialsData"])}
        className="absolute top-3 right-3.5 cursor-pointer rounded-[12px] bg-amber-600 p-2 px-2 text-white"
      >
        Refersh
        <RefreshCw />
      </Button>
      {userData.data?.map((salaryData, index) => {
        const sum = salaryData?.detials.reduce((prev, current) => {
          return prev + current.paidAmount;
        }, 0);
        const taxValue = Number.parseFloat(salaryData.tax) || 0;
        const totalValueAfterTax = salaryData?.totalAmount - taxValue || 0;
        const pendingAmount = totalValueAfterTax - (sum || 0);

        return (
          <div key={index} className="mt-[100px] w-full">
            <div className="space-y-6">
              <div className="relative rounded-[15px] border border-black/10 bg-white p-4">
                <div className="flex w-full gap-4">
                  {isValidating ? (
                    <span className="mb-2 inline-block rounded-md bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800">
                      Refetching the new data...
                    </span>
                  ) : (
                    <span className="mb-2 inline-block rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                      Your data is up to date
                    </span>
                  )}

                  <div className="flex w-fit flex-col gap-1">
                    <p className="text-lg text-gray-400">
                      Created At: {salaryData?.createdAt}
                    </p>
                  </div>
                  <h3 className="text-lg text-green-700">
                    Total Value After Tax: ${totalValueAfterTax} |
                  </h3>
                  <h3 className="text-dark-red text-lg">
                    Payable Salary: ${pendingAmount}
                  </h3>
                  <div className="ml-auto">
                    {salaryData?.status !== "Paid" && (
                      <PayDept
                        transactionId={salaryData?.salaryId!}
                        pendingAmount={String(pendingAmount)}
                        type={"salary"}
                      />
                    )}
                  </div>
                </div>

                <table className="mb-4 min-w-full divide-y divide-gray-200">
                  <tbody>
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Status</td>
                      <td className="py-2">
                        <span
                          className={
                            "rounded px-2 py-1 text-xs font-semibold " +
                            (salaryData?.status === "Paid"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-orange-600")
                          }
                        >
                          {salaryData?.status?.toUpperCase() || "N/A"}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Due To Date</td>
                      <td className="py-2">{salaryData?.dueToDate ?? "N/A"}</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Total Amount</td>
                      <td className="py-2">
                        ${salaryData?.totalAmount || "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Tax</td>
                      <td className="py-2">
                        {salaryData?.tax
                          ? `${salaryData.tax} (${salaryData.taxType})`
                          : "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 font-semibold">
                        Payment Method
                      </td>
                      <td className="py-2">{salaryData?.method || "N/A"}</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Receiver Name</td>
                      <td className="py-2">
                        {salaryData?.recieverName || "N/A"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Registered By</td>
                      <td className="py-2">
                        {salaryData?.registeredBy || "N/A"}
                      </td>
                    </tr>
                    {salaryData?.notes && (
                      <tr>
                        <td className="py-2 pr-3 align-top font-semibold">
                          Notes
                        </td>
                        <td className="py-2">{salaryData.notes}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Paid Details */}
                {salaryData?.detials && salaryData.detials.length > 0 && (
                  <div className="mt-4 border-t border-black/10">
                    <div className="text-dark-red mb-2 text-lg font-semibold">
                      Paid Details
                    </div>
                    <table className="w-full divide-y divide-gray-100">
                      <thead>
                        <tr>
                          <th className="px-1 py-2 text-left text-xs font-semibold text-gray-700">
                            Paid Amount
                          </th>
                          <th className="px-1 py-2 text-left text-xs font-semibold text-gray-700">
                            Paid At
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaryData.detials.map((d: any, dIdx: number) => (
                          <tr key={dIdx}>
                            <td className="px-1 py-2">
                              <span className="font-bold">${d.paidAmount}</span>
                            </td>
                            <td className="px-1 py-2">{d.paidAt ?? "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
