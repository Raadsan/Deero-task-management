import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  triggerClassess: string;
  triggerText?: string;
  openDialog?: boolean;
  setIsOpenDialog?: (value: boolean) => void;
}
export default function ShowDialog({
  title,
  description,
  children,
  triggerClassess,
  openDialog,
  triggerText,
  setIsOpenDialog,
}: Props) {
  return (
    <Dialog open={openDialog} onOpenChange={setIsOpenDialog}>
      <DialogTrigger className={`${triggerClassess}`}>
        {triggerText ?? "Delete"}
      </DialogTrigger>
      <DialogContent className="shadow-large diaglogFadeIn data-[state=closed]:diaglogFadeOut data-[state=open]:diaglogFadeIn min-h-[200px] border-0 bg-white px-[40px] py-[20px]">
        <DialogHeader>
          <DialogTitle className="border-b border-black/10 pb-[10px] font-bold">
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
