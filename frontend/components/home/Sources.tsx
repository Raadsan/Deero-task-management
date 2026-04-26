"use client";
import { getClientSourcesInfo } from "@/lib/actions/client.action";
import {
  CalendarArrowUp,
  Globe2,
  Heart,
  LaptopMinimalCheck,
  MapPinHouse,
  Search,
  Users,
} from "lucide-react";
import useSWR from "swr";
import { ClientSourcesSkeletonLoader } from "../Shared/Loader";

export default function Sources() {
  const { isLoading, data: sourcesData } = useSWR(
    "clientSources",
    getClientSourcesInfo,
  );

  if (isLoading) return <ClientSourcesSkeletonLoader />;
  return (
    <section className="flex w-full max-w-7xl flex-col gap-[30px] border-t border-black/10 px-4 py-3">
      <h2 className="ml-[50px] text-2xl font-bold">
        Different Sources of DEERO Clinets
      </h2>
      <div className="flex w-full flex-wrap justify-center gap-4">
        {sourcesData?.data &&
          sourcesData.data?.map(({ source, numberOfClients }, index) => {
            const getSourceIcon = (sourceName: string) => {
              const lowerSource = sourceName.toLowerCase();

              if (lowerSource.includes("website")) {
                return <LaptopMinimalCheck className="h-5 w-5" />;
              } else if (lowerSource.includes("referral")) {
                return <Users className="h-5 w-5" />;
              } else if (lowerSource.includes("social")) {
                return <Heart className="h-5 w-5" />;
              } else if (lowerSource.includes("online ads")) {
                return <Globe2 className="size-5" />;
              } else if (lowerSource.includes("online search")) {
                return <Search className="h-5 w-5" />;
              } else if (lowerSource.includes("office location")) {
                return <MapPinHouse className="h-5 w-5" />;
              }

              return <CalendarArrowUp className="size-5" />;
            };

            return (
              <div
                key={index}
                className="flex min-w-[140px] flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex-shrink-0 rounded-lg bg-blue-50 p-2 text-blue-600">
                  {getSourceIcon(source)}
                </div>
                <div className="flex flex-col">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {source}
                  </h4>
                  <p className="text-center text-lg font-bold text-blue-600">
                    {numberOfClients}
                  </p>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
