"use client";

import { getAllUsers } from "@/lib/actions/user.action";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { btnCreatePage } from "@/lib/dashboard-ui";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "../ui/button";

export default function UsersHeaderButtons() {
  const { data: users } = useSWR(SWR_CACH_KEYS.users.key, getAllUsers);

  return (
    <>
      {users?.data?.length ? (
        <Link href={ROUTES.userSalaryReport}>
          <Button
            variant="outline"
            className="h-9 rounded-md border-zinc-200 px-4 text-sm font-medium"
          >
            Salary Report
          </Button>
        </Link>
      ) : null}

      <Link href={ROUTES.createUser}>
        <Button className={btnCreatePage}>Create User</Button>
      </Link>
    </>
  );
}
