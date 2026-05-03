import { capitalizeName, computeFontSize } from "@/lib/utils";

import { getUserSession } from "@/lib/actions/auth.action";
import { Bell } from "lucide-react";

export default async function UserAvator() {
  const { data } = await getUserSession();

  const nameUppercased = capitalizeName(data?.user.name ?? "");
  return (
    <article className="w-fit flex h-fit gap-[10px]">
      <div className="bg-white border-gray-100 flex min-w-[220px] items-center gap-[15px] rounded-xl border-[1px] p-4 shadow-sm">
        {data?.user.image ? (
          <Bell className="h-5 w-5 text-gray-400" />
        ) : (
          <div className="flex h-[45px] w-[45px] items-center justify-center rounded-full border border-gray-200 bg-white">
            <span className="text-lg font-bold text-gray-900">
              {data?.user.name
                ? data.user.name.substring(0, 1).toUpperCase()
                : "U"}
            </span>
          </div>
        )}

        <div className="flex flex-col">
          <p
            style={{
              fontSize: computeFontSize(15),
            }}
            className="text-gray-900 line-clamp-1 font-bold leading-tight"
          >
            {nameUppercased || "User Name"}
          </p>
          <p
            style={{
              fontSize: computeFontSize(12),
            }}
            className="text-[#2B3674] font-black mt-1 leading-none uppercase tracking-tight"
          >
            Role: {data?.user.role.toUpperCase()}
          </p>
        </div>
      </div>
    </article>
  );
}
