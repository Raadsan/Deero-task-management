"use client";

import { ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Props {
  triggerDescription: string;
  children: React.ReactNode;
}
export function CollapsibleComponent({ children, triggerDescription }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="isolate flex h-fit w-full flex-col gap-2 rounded-[10px] border border-black/10 bg-white px-3 pt-[6px] pb-[10px]"
    >
      <div className="flex h-[60px] items-center justify-between gap-4 border-b border-black/2 px-4">
        <p className="line-clamp-1 font-medium">{triggerDescription}</p>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 cursor-pointer">
            <ChevronsUpDown className="hover:text-dark-red scale-[1.3] cursor-pointer transition-colors duration-300 ease-out" />
            <span className="sr-only">Toggle</span>
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="flex flex-col gap-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
