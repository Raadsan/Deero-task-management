"use client";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Button } from "../ui/button";

interface Props {
  links: Array<{
    title: string;
    link: string;
  }>;
}

export default function PageBreadcrumb({ links }: Props) {
  const router = useRouter();

  return (
    <Breadcrumb className="mb-[20px]">
      <BreadcrumbList>
        {links.map(({ title }, index) => {
          return (
            <Fragment key={index}>
              <BreadcrumbItem className="bannerGradinetBg rounded-tl-2xl rounded-bl-2xl border px-2 py-1 font-medium text-white shadow-sm transition-colors duration-300 ease-out hover:bg-green-400 hover:text-white">
                <BreadcrumbLink asChild>
                  <Button
                    onClick={() => {
                      router.back();
                    }}
                    className="cursor-pointer bg-transparent hover:text-white"
                  >
                    {title}
                  </Button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {links.length > 1 && index !== links.length - 1 && (
                <BreadcrumbSeparator />
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
