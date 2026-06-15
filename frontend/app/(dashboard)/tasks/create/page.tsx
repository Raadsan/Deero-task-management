import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default function CreateTaskPage() {
  redirect(ROUTES.tasks);
}
