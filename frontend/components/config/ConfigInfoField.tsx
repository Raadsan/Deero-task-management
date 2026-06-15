import { cn } from "@/lib/utils";
import { configInfoFieldClass, configInfoLabelClass } from "./config-dialog-styles";

type Props = {
  label: string;
  value: React.ReactNode;
  className?: string;
};

export default function ConfigInfoField({ label, value, className }: Props) {
  return (
    <div className={cn(configInfoFieldClass, className)}>
      <p className={configInfoLabelClass}>{label}</p>
      <div className="mt-1 text-sm font-medium text-zinc-800">{value}</div>
    </div>
  );
}
