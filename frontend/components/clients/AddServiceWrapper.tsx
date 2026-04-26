import { getClientById } from "@/lib/actions/client.action";
import ClientForm from "./ClientForm";

interface Props {
  params: Promise<Record<string, string>>;
}

export default async function AddServiceWrapper({ params }: Props) {
  const { id } = await params;
  const result = await getClientById(id);

  return <ClientForm formType="addService" currentClient={result.data} />;
}
