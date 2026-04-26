"use client";

import { updateUserData } from "@/lib/actions/user.action";
import { authClient } from "@/lib/auth-client";
import { DEPARTMENTS } from "@/lib/constants";
import { formatDate, getRandomUUID } from "@/lib/utils";
import { EditUserDataSchema } from "@/lib/validations";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import { SelectElement, TextInput } from "../Shared/FormElements";
import Loader from "../Shared/Loader";

export default function EditUserProfile() {
  const user = authClient.useSession().data?.user;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<z.infer<typeof EditUserDataSchema>>({
    defaultValues: {
      name: user?.name,
      department: user?.department ?? "",
    },
  });
  const [transition, startTransition] = useTransition();
  const router = useRouter();

  function handlFormSubmit(data: z.infer<typeof EditUserDataSchema>) {
    if (
      user?.name.toLowerCase() === data.name.toLowerCase() &&
      user?.department === data.department
    ) {
      toast.error("You have not changed anything");
      return;
    }
    startTransition(async () => {
      const result = await updateUserData({
        name: data.name,
        department: data.department,
        id: user?.id,
      });

      if (result.success) {
        toast.success("Sucesfully updated User Data");
        router.refresh();
      } else {
        toast.error("Failed to Update User data! try again");
      }
    });
  }

  return (
    <form
      key={"user profile " + getRandomUUID()}
      onSubmit={handleSubmit(handlFormSubmit)}
      className="mx-auto flex h-full w-full max-w-3xl flex-col gap-[24px]"
    >
      <TextInput
        labelId="name"
        labelText="User Name"
        placeholder="User Name"
        defaultValue={user?.name}
        disbaled={transition}
        errorMessage={errors.name?.message}
        otherProps={{ ...register("name") }}
      />

      <TextInput
        labelId="email"
        labelText="User Email"
        placeholder="username@gmail.com"
        defaultValue={user?.email}
        disbaled
      />
      <SelectElement
        disbaleSelect={transition}
        labelText="Department"
        placeholder="Select Department"
        defaultValue={user?.department}
        elements={DEPARTMENTS}
        errorMessage={errors.department?.message}
        onChange={(value) => {
          setValue("department", value, { shouldValidate: true });
        }}
      />

      <TextInput
        labelId="createdAt"
        labelText="Created Date"
        placeholder=""
        defaultValue={formatDate(user?.createdAt ?? "")}
        disbaled
      />
      <TextInput
        labelId="updatedAt"
        labelText="Updated Date"
        placeholder=""
        defaultValue={formatDate(user?.updatedAt ?? "")}
        disbaled
      />

      {!transition ? (
        <ButtonBuilder
          htmlType="submit"
          disabled={transition}
          classNames="text-white  w-[100px] mx-auto"
          type="normal"
        >
          Save Changes
        </ButtonBuilder>
      ) : (
        <Loader />
      )}
    </form>
  );
}
