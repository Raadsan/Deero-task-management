import { redirect } from "next/navigation";

export default function BranchLoginRedirectPage() {
  redirect("/auth/login");
}
