import { cn, computeFontSize } from "@/lib/utils";

interface Props {
  message: String;
  classNames?: string;
}
export default function FormatErrorText({ message, classNames }: Props) {
  return (
    <p
      style={{
        fontSize: computeFontSize(15),
      }}
      className={cn("mt-[4px] text-red-400", classNames)}
    >
      {message}
    </p>
  );
}
