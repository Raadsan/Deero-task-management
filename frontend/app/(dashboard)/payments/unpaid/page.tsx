import { redirect } from "next/navigation";

export default function UnpaidPaymentsRedirect() {
  redirect("/payments/paid");
}
