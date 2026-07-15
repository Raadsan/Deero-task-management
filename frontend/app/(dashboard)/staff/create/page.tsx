import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import UserForm from "@/components/users/UsersForm";
import { ROUTES } from "@/lib/constants";

export default function CreateEmployeePage() {
  return (
    <ManagementPageShell title="Add Staff">
      <PageBreadcrumb links={[{ title: "Staff", link: ROUTES.users }]} />
      <UserForm formType="create" data={undefined} />
    </ManagementPageShell>
  );
}
