"use client";

import { getAllTasks } from "@/lib/actions/task.action";
import { getAllUsers } from "@/lib/actions/user.action";
import { ROUTES } from "@/lib/constants";
import { updateUrlWithQueryParams } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { GetSelectItem, SelectElement } from "../Shared/FormElements";
import { UserSkelton } from "../Shared/Loader";

export default function UserTaskReport() {
  const router = useRouter();
  const searchParmas = useSearchParams();
  const userId = searchParmas.get("userId") ?? "";

  const { isLoading, data: users } = useSWR("usersToReport", getAllUsers);
  const { data: tasks } = useSWR("taskstable", getAllTasks);

  if (isLoading) return <UserSkelton />;

  return (
    <>
      {tasks?.data?.length && userId ? (
        <Link
          href={ROUTES.taskReport(userId)}
          className="flex items-center rounded bg-green-600 px-3 text-white"
        >
          Download
        </Link>
      ) : null}

      <SelectElement
        onChange={(value) => {
          if (value) {
            const newUrl = updateUrlWithQueryParams({
              maps: [
                {
                  key: "userId",
                  value: value,
                },
              ],
            });
            router.push(newUrl, { scroll: false });
          }
        }}
        placeholder={"Select User"}
        elementRenderer={() => {
          return users?.data?.map(({ name, id }, index) => {
            return <GetSelectItem key={index} value={id} label={name} />;
          });
        }}
      />
    </>
  );
}
