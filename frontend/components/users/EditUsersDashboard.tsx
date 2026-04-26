"use client";

import { getUserById } from "@/lib/actions/user.action";
import { getRandomUUID } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { UserProfileFormSkeletonLoader } from "../Shared/Loader";
import SwitchBetweenButtons from "../Shared/SwitchBetweenButtons";
import EditUserAdvancedForm from "./EditUserAdvancedForm";
import UserForm from "./UsersForm";

export default function EditUsersDashboard() {
  const [showBasicForm, setShowBasicForm] = useState(true);
  const params = useParams();
  const userId = String(params.id);

  const { data: userDataById, isLoading } = useSWR("getUserById", () =>
    getUserById(userId),
  );

  if (isLoading) return <UserProfileFormSkeletonLoader />;

  return (
    <section className="flex w-full flex-col gap-[20px] py-3">
      <SwitchBetweenButtons
        buttonOneDisplayText="Show Basic Form"
        buttonTwoDisplayText="Advanced User Editing"
        showBasicForm={showBasicForm}
        buttonTwoOnClick={() => setShowBasicForm(false)}
        buttonOneOnClick={() => setShowBasicForm(true)}
      />
      {showBasicForm ? (
        <UserForm
          formType={"edit"}
          key={"Edit User Form" + getRandomUUID()}
          data={userDataById?.data}
        />
      ) : (
        <EditUserAdvancedForm data={userDataById?.data} />
      )}
    </section>
  );
}
