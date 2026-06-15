import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default function EditUserPage() {
  redirect(ROUTES.users);
}
