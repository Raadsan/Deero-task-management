"use client";

import { getAllClients } from "@/lib/actions/client.action";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { btnCreatePage } from "@/lib/dashboard-ui";
import { AllClients } from "@/lib/types";
import Link from "next/link";
import useSWR from "swr";
import { GeneralTableSkeletonLoader } from "../Shared/Loader";
import TableRenderer from "../Shared/TableRenderer";
import { Button } from "../ui/button";
import { clientsColumns } from "../ui/columns";

export default function ClientsTable() {
  const { isLoading, data: clients } = useSWR(
    SWR_CACH_KEYS.clients.key,
    getAllClients,
  );

  if (isLoading) return <GeneralTableSkeletonLoader />;

  return (
    <TableRenderer
      title="Clients management"
      toolbar={
        <Link href={ROUTES.createClient}>
          <Button className={btnCreatePage}>Create Client</Button>
        </Link>
      }
      tableType="clients"
      columns={clientsColumns}
      data={(clients?.data as AllClients[]) ?? []}
    />
  );
}
