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
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const iconMap: Record<string, any> = {
  website: LaptopMinimalCheck,
  referral: Users,
  social: Heart,
  "online ads": Globe2,
  "online search": Search,
  "office location": MapPinHouse,
};

export default function Sources() {
  const { isLoading, data: sourcesData } = useSWR(
    "clientSources",
    getClientSourcesInfo,
  );

  if (isLoading) return <ClientSourcesSkeletonLoader />;

  return (
    <Card className="w-full border-none shadow-md">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Client Acquisition Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex w-full flex-wrap gap-6 justify-start">
          {sourcesData?.data &&
            sourcesData.data?.map(({ source, numberOfClients }, index) => {
              const lowerSource = source.toLowerCase();
              let Icon = CalendarArrowUp;

              for (const [key, value] of Object.entries(iconMap)) {
                if (lowerSource.includes(key)) {
                  Icon = value;
                  break;
                }
              }

              return (
                <div
                  key={index}
                  className="flex items-center gap-4 min-w-[200px] p-4 rounded-lg bg-gray-50 transition-colors hover:bg-gray-100"
                >
                  <div className="flex-shrink-0 rounded-full bg-white p-2.5 text-blue-600 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-600">
                      {source}
                    </h4>
                    <p className="text-2xl font-bold text-gray-900">
                      {numberOfClients}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
