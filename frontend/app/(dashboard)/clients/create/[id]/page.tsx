import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default function AddServicePage() {
  redirect(ROUTES.clients);
}
