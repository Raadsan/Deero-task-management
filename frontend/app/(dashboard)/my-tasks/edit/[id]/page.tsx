import { ROUTES } from "@/lib/constants";
import { redirect } from "next/navigation";

export default function EditMyTaskPage() {
  redirect(ROUTES["my-tasks"]);
}
