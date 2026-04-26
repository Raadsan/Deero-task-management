"use client";
import { deleteClientById } from "@/lib/actions/client.action";
import { deleteTransaction } from "@/lib/actions/payment.action";
import { deleteTask } from "@/lib/actions/task.action";
import { deleteUserById } from "@/lib/actions/user.action";
import { authClient } from "@/lib/auth-client";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { StateType, TableType } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";
import ButtonBuilder from "./ButtonBuilder";
import Loader from "./Loader";
import ShowDialog from "./ShowDialog";

interface Props {
  description: string;
  dialogTitle: string;
  typeOfDataToDelete: TableType;
  idToDelete: string;
}
export default function DeleteAction({
  description,
  dialogTitle,
  typeOfDataToDelete,
  idToDelete,
}: Props) {
  const [{ state }, setIsDeleting] = useState<StateType>({ state: "yet" });
  const [openDialog, setOpenDialog] = useState<boolean | undefined>(undefined);
  const { mutate } = useSWRConfig();
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const toggleDialog = (value: boolean | undefined) => {
    setOpenDialog(value);
  };

  const user = authClient.useSession().data?.user;

  async function handleDeleteAction() {
    // delete user.
    if (typeOfDataToDelete === "users" && idToDelete) {
      if (user?.id === idToDelete) {
        return toast.error("You cannot delete your account.");
      }

      setIsDeleting({ state: "inprogres" });
      toggleDialog(true);
      const { success, errors } = await deleteUserById({
        userId: idToDelete,
      });
      setIsDeleting({ state: "done" });
      setIsDeleting({ state: "yet" });
      if (success) {
        toast.success("Successfully Delete user.");
        mutate(SWR_CACH_KEYS.users.key);
      } else {
        toast.error(errors?.message ?? "Failed to Delete User. try again");
      }

      toggleDialog(false);
    }

    // delete client
    else if (typeOfDataToDelete === "clients" && idToDelete) {
      setIsDeleting({ state: "inprogres" });
      toggleDialog(true);

      const result = await deleteClientById(idToDelete);
      setIsDeleting({ state: "done" });
      setIsDeleting({ state: "yet" });

      if (result.success) {
        toast.success("Successfully Deleted The Client");

        // revalidate so that it will re-fetch latest data.
        mutate(SWR_CACH_KEYS.clients.key);
      } else {
        toast.error(
          result.errors?.message ||
            "Failed To Delete The Client. pleas try again.",
        );
      }
      toggleDialog(false);
    }

    // delete task
    else if (typeOfDataToDelete === "tasks" && idToDelete) {
      if (user?.role === "user") {
        toast.error("OOH!. you are not authorized to delete tasks.");
        return;
      }

      setIsDeleting({ state: "inprogres" });
      const result = await deleteTask(idToDelete);
      setIsDeleting({ state: "done" });
      setIsDeleting({ state: "yet" });

      if (result.success) {
        toast.success("Successfully Deleted The Task");
        mutate(SWR_CACH_KEYS.tasks.key);
        mutate(SWR_CACH_KEYS.myTasks.key);
      } else {
        toast.error(
          result.errors?.message ||
            "Failed To Delete The Task. pleas try again.",
        );
      }
      toggleDialog(false);
    }

    // delete income  by id
    else if (typeOfDataToDelete === "incomes" && idToDelete) {
      setIsDeleting({ state: "inprogres" });
      const result = await deleteTransaction({
        transactionId: idToDelete,
      });

      setIsDeleting({ state: "done" });
      setIsDeleting({ state: "yet" });

      if (result.success) {
        toast.success("Successfully Deleted Income");
        mutate([SWR_CACH_KEYS.income.key, startDate ?? "", endDate ?? ""]);
      } else {
        toast.error(
          result.errors?.message ||
            "Failed To Delete The Income. pleas try again.",
        );
      }

      toggleDialog(false);
    }

    // delete expense by id
    else if (typeOfDataToDelete === "expenses" && idToDelete) {
      setIsDeleting({ state: "inprogres" });
      const result = await deleteTransaction({
        transactionId: idToDelete,
      });
      setIsDeleting({ state: "done" });
      setIsDeleting({ state: "yet" });

      if (result.success) {
        toast.success("Successfully Deleted Expense");
        mutate([SWR_CACH_KEYS.expense.key, startDate ?? "", endDate ?? ""]);
      } else {
        toast.error(
          result.errors?.message ||
            "Failed To Delete Expense. pleas try again.",
        );
      }
      toggleDialog(false);
    }
  }

  return (
    <ShowDialog
      openDialog={openDialog}
      triggerClassess=" cursor-pointer rounded-[3px]  px-[6px] py-[4px] font-normal text-white bg-rose-600 px-3"
      title={dialogTitle}
      description={description}
    >
      <div className="flex items-center justify-center gap-[20px]">
        {state === "inprogres" && <Loader />}
        {state !== "inprogres" && (
          <ButtonBuilder type="close">close</ButtonBuilder>
        )}
        {state === "yet" && (
          <ButtonBuilder
            classNames="text-white"
            onClick={handleDeleteAction}
            type="normal"
          >
            Confirm
          </ButtonBuilder>
        )}
      </div>
    </ShowDialog>
  );
}
