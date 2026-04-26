"use client";
import { getAllClients } from "@/lib/actions/client.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { AllClients } from "@/lib/types";
import useSWR from "swr";
import { GeneralTableSkeletonLoader } from "../Shared/Loader";
import TableRenderer from "../Shared/TableRenderer";
import { clientsColumns } from "../ui/columns";

export default function ClientsTable() {
  const { isLoading, data: clients } = useSWR(
    SWR_CACH_KEYS.clients.key,
    getAllClients,
  );

  if (isLoading) return <GeneralTableSkeletonLoader />;

  return (
    <TableRenderer
      tableType="clients"
      columns={clientsColumns}
      data={(clients?.data as AllClients[]) ?? []}
    />
  );
}
