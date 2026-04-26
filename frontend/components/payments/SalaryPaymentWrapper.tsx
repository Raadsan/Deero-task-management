import { getUserById } from "@/lib/actions/user.action";
import SalaryDetailsAndForm from "./SalaryDetailsAndForm";

interface Props {
  params: Promise<Record<string, string>>;
}

export default async function SalaryPaymentWrapper({ params }: Props) {
  const { id } = await params;
  const { data: user } = await getUserById(id);
  return <SalaryDetailsAndForm user={user} />;
}
