import ClientsTable from "@/components/clients/ClientsTable";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function ClientsPage() {
  return (
    <ColumnBuilder>
      <HeaderBuilder
        link={ROUTES.createClient}
        showBlurLine
        headerText="Clients Management"
        buttonText=" + Create Client"
      >
        <Link href={ROUTES.createClient}>
          <Button
            className={cn(
              "via-dark-red to-secondary-100 cursor-pointer rounded-[10px] border border-none bg-linear-to-r from-orange-200 px-3 py-2 text-white hover:opacity-90",
            )}
          >
            Create Client
          </Button>
        </Link>
      </HeaderBuilder>
      <div className="flex w-full shrink-0 grow flex-col">
        <Suspense fallback={<GeneralTableSkeletonLoader />}>
          <ClientsTable />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
