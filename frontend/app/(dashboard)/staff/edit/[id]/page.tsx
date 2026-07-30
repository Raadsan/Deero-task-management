import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import UserForm from "@/components/users/UsersForm";
import { getUserById } from "@/lib/apis/userApi";
import { ROUTES } from "@/lib/constants";
import { User } from "@/lib/schema";
import { PageParams } from "@/lib/types";
import { notFound } from "next/navigation";

export default async function EditEmployeePage({ params }: PageParams) {
  const { id } = await params;
  const result = await getUserById(id);

  if (!result.success || !result.data) notFound();

  return (
    <ManagementPageShell title="Edit Staff">
      <PageBreadcrumb links={[{ title: "Staff", link: ROUTES.users }]} />
      <UserForm formType="edit" data={result.data as User} />
    </ManagementPageShell>
  );
}
