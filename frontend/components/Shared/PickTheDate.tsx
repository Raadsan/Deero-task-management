import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "../ui/button";

interface Props {
  date?: Date;
  disbale?: boolean;
  setDate: (date: Date) => void;
  classNames?: string;
  showTimePicker?: boolean;
}
export default function PickTheDate({
  date,
  disbale,
  classNames,
  setDate,
  showTimePicker,
}: Props) {
  const [month, setMonth] = useState<Date | undefined>(date);
  const [time, setTime] = useState<string>(
    date
      ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
      : "09:00",
  );

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    const [hours, minutes] = time.split(":").map(Number);
    const composed = new Date(selectedDate);
    composed.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    setDate(composed);
  };

  const handleTimeChange = (value: string) => {
    setTime(value);
    const [hours, minutes] = value.split(":").map(Number);
    const baseDate = date ? new Date(date) : new Date();
    baseDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    setDate(baseDate);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          disabled={disbale}
          variant={"outline"}
          data-empty={!date}
          className={cn(
            "data-[empty=true]:text-muted-foreground min-h-full w-full justify-start border border-black/10 py-[20px] text-left font-normal disabled:cursor-not-allowed disabled:bg-gray-300",
            classNames,
          )}
        >
          <CalendarIcon />
          {date
            ? format(date, showTimePicker ? "PPP p" : "PPP")
            : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          "shadow-large w-full overflow-hidden border-0 bg-white p-0",
        )}
        align="end"
        alignOffset={-8}
        sideOffset={10}
      >
        <div className="p-2">
          <Calendar
            mode="single"
            selected={date}
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            onSelect={handleDateSelect}
          />
          {showTimePicker && (
            <div className="px-3 pb-2">
              <label className="mb-2 block text-sm text-gray-700">Time</label>
              <input
                type="time"
                value={time}
                disabled={disbale}
                onChange={(event) => handleTimeChange(event.target.value)}
                className="h-10 w-full rounded-md border border-black/10 px-3 text-sm"
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
