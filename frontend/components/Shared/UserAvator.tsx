import { capitalizeName, computeFontSize } from "@/lib/utils";

import { getUserSession } from "@/lib/actions/auth.action";
import { Bell } from "lucide-react";

export default async function UserAvator() {
  const { data } = await getUserSession();

  const nameUppercased = capitalizeName(data?.user.name ?? "");
  return (
    <article className="w-fi max-w-w-[300px] flex h-fit gap-[20px]">
      <div className="border-light flex grow gap-[10.07px] rounded-[8.19] border-[1.02px] p-[7.8px]">
        {data?.user.image ? (
          <Bell />
        ) : (
          <div className="flex h-[40px] w-[40px] items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
            <span className="text-xl text-black">
              {data?.user.name
                ? data.user.name.substring(0, 1).toUpperCase()
                : "U"}
            </span>
          </div>
        )}

        <div className="flex flex-col">
          <p
            style={{
              fontSize: computeFontSize(15.24),
            }}
            className="text-foreground line-clamp-1 font-medium"
          >
            {nameUppercased || "User Name"}
          </p>
          <p
            style={{
              fontSize: computeFontSize(17.24),
            }}
            className="text-secondary font-bold"
          >
            Role: {data?.user.role.toUpperCase()}
          </p>
        </div>
      </div>
    </article>
  );
}
