"use client";

import { getAllClients } from "@/lib/apis/clientApi";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { btnCreatePage } from "@/lib/dashboard-ui";
import { AllClients } from "@/lib/types";
import Link from "next/link";
import useSWR from "swr";
import TableRenderer from "../Shared/TableRenderer";
import { Button } from "../ui/button";
import { clientsColumns } from "../ui/columns";

export default function ClientsTable() {
  const { isLoading, data: clients } = useSWR(
    SWR_CACH_KEYS.clients.key,
    getAllClients,
  );

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
      data={isLoading ? [] : ((clients?.data as AllClients[]) ?? [])}
    />
  );
}
