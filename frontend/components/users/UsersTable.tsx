"use client";
import { getAllUsers } from "@/lib/actions/user.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { User } from "@/lib/types";
import useSWR from "swr";
import { GeneralTableSkeletonLoader } from "../Shared/Loader";
import TableRenderer from "../Shared/TableRenderer";
import UsersHeaderButtons from "../users/UsersHeaderButtons";
import { usersColumns } from "../ui/columns";

export default function UsersTable() {
  const { isLoading, data: users } = useSWR(
    SWR_CACH_KEYS.users.key,
    getAllUsers,
  );
  if (isLoading) return <GeneralTableSkeletonLoader />;

  return (
    <TableRenderer
      title="Users management"
      toolbar={<UsersHeaderButtons />}
      tableType="users"
      columns={usersColumns}
      data={(users?.data as User[]) ?? []}
    />
  );
}
