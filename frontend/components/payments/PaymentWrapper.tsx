import { getPaymentClients } from "@/lib/actions/client.action";
import { getAllExpenses, getAllIncomes } from "@/lib/actions/payment.action";

import ExpenseForm from "./ExpenseForm";
import IncomeForm from "./IncomeForm";

interface Props {
  type: "income" | "expense";
  searchParams?: Promise<Record<string, string>>;
}
export default async function PaymentWrapper({ type, searchParams }: Props) {
  if (type === "expense") {
    const { data: allExpenses } = await getAllExpenses();
    return <ExpenseForm expenses={allExpenses} />;
  }

  if (searchParams && type == "income") {
    const { page = 1, pageSize = 10 } = await searchParams;
    const { data: clients } = await getPaymentClients({
      page: Number(page) ?? 1,
      pageSize: Number(pageSize) ?? 10,
    });

    const { data: incomes } = await getAllIncomes();

    return <IncomeForm formType="create" clients={clients} incomes={incomes} />;
  }
}
