import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default function CreateClientPage() {
  redirect(ROUTES.clients);
}
