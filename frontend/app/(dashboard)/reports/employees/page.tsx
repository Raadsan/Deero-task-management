import { redirect } from "next/navigation";

export default function EmployeesReportRedirectPage() {
  redirect("/reports/users");
}
