"use client";

import { getAllUsers } from "@/lib/actions/user.action";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
            className={cn(
              "cursor-pointer rounded-[10px] border border-black/30 bg-gray-50 px-3 py-2 text-black hover:opacity-90",
            )}
          >
            Generate Salary Report
          </Button>
        </Link>
      ) : null}

      <Link href={ROUTES.createUser}>
        <Button
          className={cn(
            "via-dark-red to-secondary-100 cursor-pointer rounded-[10px] border border-none bg-linear-to-r from-orange-200 px-3 py-2 text-white hover:opacity-90",
          )}
        >
          Create User
        </Button>
      </Link>
    </>
  );
}
