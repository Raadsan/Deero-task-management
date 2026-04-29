import { listCurrentUserSessions } from "@/lib/actions/user.action";
import { authClient } from "@/lib/auth-client";
import { User, UserRole } from "@/lib/schema";
import {
  computeFontSize,
  dateDifferenceInMilliSeconds,
  formatDate,
  getRandomUUID,
} from "@/lib/utils";
import { AdvancedEditUserSchema } from "@/lib/validations";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import useSWR from "swr";
import z from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import { CollapsibleComponent } from "../Shared/CollapsableComponent";
import FormatErrorText from "../Shared/FormatErrorText";
import { SelectElement, TextInput } from "../Shared/FormElements";
import { Switch } from "../ui/switch";
import ManageUserFiles from "./ManageUserFiles";
import RevokeSessions from "./RevokeSessions";
import SessionRenderer from "./SesssionRenderer";

interface Props {
  data: User | undefined;
}
export default function EditUserAdvancedForm({ data }: Props) {
  const { data: userSessionsResult } = useSWR("userSessions", () =>
    listCurrentUserSessions({ userId: data?.id! }),
  );

  const userSessions = userSessionsResult?.data;
  const {
    handleSubmit,
    register,
    setValue,
    getValues,
    watch,
    setError,
    formState: { errors },
  } = useForm<z.infer<typeof AdvancedEditUserSchema>>({
    defaultValues: {
      role: data?.role
        ? data?.role == "admin"
          ? "admin"
          : data?.role === "superadmin"
            ? "superadmin"
            : "user"
        : undefined,
      banExpires: dateDifferenceInMilliSeconds(data?.banExpires),
      banned: data?.banned ?? false,
      banReason: data?.banReason ?? "",
      password: "",
    },
    resolver: standardSchemaResolver(AdvancedEditUserSchema),
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const activeUserRole = authClient.useSession().data?.user.role;
  const roles =
    activeUserRole === "admin"
      ? ["admin", "user"]
      : ["admin", "user", "manager"];

  async function handleFormSubmit(
    formData: z.infer<typeof AdvancedEditUserSchema>,
  ) {
    // changing user password
    if (formData.password) {
      if (formData.password.length < 6) {
        return setError(
          "password",
          {
            message: "Passwrod should be 6 characters minimum",
          },
          {
            shouldFocus: true,
          },
        );
      }
      await authClient.admin.setUserPassword({
        userId: data?.id!,
        newPassword: formData.password,
        fetchOptions: {
          onRequest() {
            setIsProcessing(true);
          },
          onResponse() {
            setIsProcessing(false);
          },
          onSuccess() {
            toast.success(
              "Succesfully Changed User's Password & he can login with this new password",
            );
            router.refresh();
          },
          onError(context) {
            toast.error(
              context.error.message || "failed Changing User's Password",
            );
          },
        },
      });
    }

    // changing user's Role
    if (formData.role.toLowerCase() !== data?.role.toLowerCase()) {
      await authClient.admin.setRole({
        userId: data?.id!,
        role: formData.role.toLowerCase() as UserRole,
        fetchOptions: {
          onRequest() {
            setIsProcessing(true);
          },
          onResponse() {
            setIsProcessing(false);
          },
          onSuccess() {
            toast.success("Succesfully Changed User's Role ");
            router.refresh();
          },
          onError(context) {
            toast.error(
              context.error.message || "failed Changing User's Password",
            );
          },
        },
      });
    }

    // banning user.
    if (formData.banned === true && !!data?.banned !== true) {
      if (!formData.banReason) {
        return setError(
          "banReason",
          {
            message: "Please describe why are banning " + data?.name,
          },
          {
            shouldFocus: true,
          },
        );
      }
      let banExpires: undefined | number = undefined;

      banExpires = 60 * 60 * 24 * Number(formData.banExpires);
      await authClient.admin.banUser({
        userId: data?.id,
        banExpiresIn: banExpires === 0 ? undefined : banExpires,
        banReason: formData.banReason,
        fetchOptions: {
          onRequest() {
            setIsProcessing(true);
          },
          onResponse() {
            setIsProcessing(false);
          },
          onSuccess() {
            if (banExpires) {
              toast.success(
                "Sucessfully Banned " +
                  data?.name +
                  "For" +
                  formData.banExpires +
                  `${(formData.banExpires?.length ?? 0 > 1) ? " Days" : " Day"}`,
              );
            } else {
              toast.success("Succesfully Banned " + data?.name + " Forever");
            }
            router.refresh();
          },
          onError(context) {
            toast.error(
              context.error.message || "failed To ban this User! try again",
            );
          },
        },
      });
    }

    if (formData.banned === false && !!data?.banned !== false) {
      await authClient.admin.unbanUser({
        userId: data.id,
        fetchOptions: {
          onRequest() {
            setIsProcessing(true);
          },
          onResponse() {
            setIsProcessing(false);
          },
          onSuccess() {
            toast.success("Succesfully Unbanned " + data?.name);
            router.refresh();
          },
          onError(context) {
            toast.error(
              context.error.message || "failed To unban this User! try again",
            );
          },
        },
      });
    }
  }

  return (
    <section className="min-h-screen w-full space-y-3.5">
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="grid h-full max-h-fit w-full grid-cols-1 gap-[40px] md:grid-cols-2"
      >
        <TextInput
          type="text"
          disbaled={isProcessing}
          labelId="password"
          labelText=""
          placeholder="Enter New Password"
          errorMessage={errors.password?.message}
          otherProps={{ ...register("password") }}
        />

        <SelectElement
          key={getRandomUUID()}
          defaultValue={getValues("role")}
          errorMessage={errors.role?.message}
          onChange={(value) =>
            setValue("role", value as UserRole, { shouldValidate: true })
          }
          elements={roles}
          labelText={""}
          placeholder={"Select Role"}
        />

        <div className="col-span-2 h-fit w-full">
          <CollapsibleComponent triggerDescription="Manage banning and unbanning Users">
            {/* banned state */}
            <div className="flex items-center justify-between space-x-2 rounded-[10px] border border-black/4 bg-white px-4 py-3 shadow-sm">
              <label>{"You are Sure to Ban This User :" + data?.name}</label>
              <Switch
                defaultChecked={getValues("banned")}
                onCheckedChange={(value) => {
                  setValue("banned", value, {
                    shouldValidate: true,
                  });
                }}
              />
            </div>
            {!!data?.banned === false && (
              <>
                {/* ban reason */}
                <label
                  htmlFor="banReason"
                  style={{
                    fontSize: computeFontSize(22),
                  }}
                  className="appLyInterFont text-dark-gray mt-[20px] flex w-full flex-col gap-[12px] font-normal"
                >
                  Reason for banning
                  <input
                    type="text"
                    id="banReason"
                    {...register("banReason")}
                    defaultValue={getValues("banReason")}
                    placeholder="Enter the reason for banning"
                    className="placeholder:text-light-gray focus:outline-dark-red h-[54px] w-full rounded-[6px] pl-[21px] outline outline-black/50 focus:outline-2"
                  />
                  {errors.banReason?.message && (
                    <FormatErrorText message={errors.banReason.message} />
                  )}
                </label>
                {/* ban expiration */}
                <label
                  htmlFor="banExpirationDate"
                  style={{
                    fontSize: computeFontSize(22),
                  }}
                  className="appLyInterFont text-dark-gray mt-[20px] flex w-full flex-col gap-[12px] font-normal"
                >
                  Expiration Date For the Ban In days( 0 means banning
                  indefinitely)
                  <input
                    type="text"
                    defaultValue={getValues("banExpires")}
                    {...register("banExpires")}
                    id="banExpirationDate"
                    placeholder="Enter ban expiration date in days"
                    className="placeholder:text-light-gray focus:outline-dark-red h-[54px] w-full rounded-[6px] pl-[21px] outline outline-black/50 focus:outline-2"
                  />
                  {errors.banExpires?.message && (
                    <FormatErrorText message={errors.banExpires.message} />
                  )}
                </label>
              </>
            )}
          </CollapsibleComponent>
        </div>
        <div className="col-span-2 mt-[20px] flex w-full items-center justify-end gap-[20px]">
          {isProcessing ? (
            <Loader />
          ) : (
            <ButtonBuilder
              htmlType="submit"
              classNames="text-white"
              type="normal"
            >
              Save Changes
            </ButtonBuilder>
          )}
        </div>
      </form>
      <div className="border-top col-span-2 mt-[40px] h-fit w-full border-black/10">
        <CollapsibleComponent triggerDescription="Manage User Sessions">
          {userSessions?.map((each, index) => {
            return (
              <div className="space-y-3.5" key={index}>
                <div className="flex w-full items-center justify-between border-b border-black/20 pb-[10px]">
                  <h3 className="text-xl font-medium">Session: {index + 1}</h3>
                  <RevokeSessions
                    sessionTokenId={each.token}
                    buttonText="Revoke This Session"
                    revokeType={"OneSessonOfUser"}
                  />
                </div>
                <SessionRenderer label={"UserId"} value={each.userId} />
                <SessionRenderer
                  label={"CreatedAt"}
                  value={formatDate(each.createdAt) ?? ""}
                />
                <SessionRenderer
                  label={"UpdatedAt"}
                  value={formatDate(each.updatedAt) ?? ""}
                />
                <SessionRenderer label={"Sesssion Token"} value={each.token} />
              </div>
            );
          })}
          {userSessions && userSessions?.length > 1 && (
            <div className="mt-2.5 ml-auto">
              <RevokeSessions
                sessionTokenId={""}
                buttonText="Revoke This Session"
                revokeType={"OneSessonOfUser"}
              />
            </div>
          )}
          {userSessions?.length === 0 && (
            <h3 className="text-dark-gray mx-auto w-fit font-medium">
              No Active Session is Avalaible for this User.
            </h3>
          )}
        </CollapsibleComponent>
      </div>

      <div className="border-top col-span-2 mt-[40px] h-fit w-full border-black/10">
        <ManageUserFiles userId={data?.id!} />
      </div>
    </section>
  );
}
