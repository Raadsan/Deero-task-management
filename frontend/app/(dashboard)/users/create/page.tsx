import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default function CreateUserPage() {
  redirect(ROUTES.users);
}
