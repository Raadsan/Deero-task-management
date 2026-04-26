"use client";

import { cn, deleteQueryParams, updateUrlWithQueryParams } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Button } from "../ui/button";
import { DatePicker } from "./FormElements";

interface Props {
  classNames?: string;
}

export default function PageDatePicker({ classNames }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentStartDate = searchParams.get("startDate");
  const currentEndDate = searchParams.get("endDate");

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [startDate, setStartDate] = useState<Date | undefined>(
    currentStartDate ? new Date(currentStartDate) : undefined,
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    currentEndDate ? new Date(currentEndDate) : undefined,
  );

  if (!isMounted) {
    // Return a placeholder matching the flex layout to prevent layout shift
    return <div className={cn("flex w-fit items-center gap-[30px] h-[80px]", classNames)}></div>;
  }

  return (
    <div className={cn("flex w-fit items-center gap-[30px]", classNames)}>
      <DatePicker
        date={startDate}
        setDate={(date) => {
          if (endDate && date.getTime() > endDate.getTime()) {
            toast.error("Start Date should be less than End Date");
            return;
          }
          setStartDate(date);
          const newUrl = updateUrlWithQueryParams({
            maps: [
              {
                value: date.toISOString(),
                key: "startDate",
              },
            ],
          });
          router.push(newUrl, { scroll: false });
        }}
        labelText="Select Start Date"
        wrapperClasses="w-fit"
      />
      <DatePicker
        date={endDate}
        setDate={(date) => {
          if (startDate && date.getTime() <= startDate.getTime()) {
            toast.error("End Date should be Greater than Start Date");
            return;
          }
          setEndDate(date);
          const newUrl = updateUrlWithQueryParams({
            maps: [
              {
                value: date.toISOString(),
                key: "endDate",
              },
            ],
          });
          router.push(newUrl, { scroll: false });
        }}
        labelText="Select End Date"
        wrapperClasses="w-fit"
      />
      <div className="flex flex-col gap-3 text-white">
        <p className="text-dark-gray font-medium">Clear Date filters</p>
        <Button
          onClick={() => {
            if (endDate || startDate) {
              (setStartDate(undefined), setEndDate(undefined));
              const newUrl = deleteQueryParams(["startDate", "endDate"]);
              router.replace(newUrl, { scroll: false });
            }
          }}
          className="bannerGradinetBg border border-black/10 py-4"
        >
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
