"use client";

import { deleteClientAgreement } from "@/lib/actions/client.action";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { TextInput } from "../Shared/FormElements";
import { Button } from "../ui/button";

interface Props {
  defaultValue: string;
  labelId: string;
  placeholder: string;
  categoryId: string;
  subServiceId: string;
  count: number;
  base: number;
  description?: string;
  createdAt: string;
  agreementId: string;
}

export default function EditClientCategory({
  defaultValue,
  labelId,
  placeholder,
  agreementId,
  description,
  createdAt,
  subServiceId,
  base,
  count,
}: Props) {
  const [transition, startTransition] = useTransition();

  const params = useParams();

  function handleformSubmit() {
    startTransition(async () => {
      const result = await deleteClientAgreement({
        agreementId,
        clientId: String(params.id),
        subServiceId,
      });
      if (result.success) {
        toast.success("Successfully Deleted!!");
        return;
      }
      toast.error(
        result.errors?.message || "OOh! Failed to Delete it. try again",
      );
    });
  }

  return (
    <div className="space-y-2 rounded-[10px] border border-black/10 px-5 py-3 shadow-sm">
      <form className="flex w-full items-center justify-between gap-5">
        <TextInput
          labelText="Current Sub category"
          defaultValue={defaultValue}
          labelId={labelId}
          disbaled
          placeholder={placeholder}
        />
        <div className="flex h-full items-center justify-center pt-3">
          <Button
            name="delete"
            disabled={transition}
            onClick={(e) => {
              e.preventDefault();
              handleformSubmit();
            }}
            className="bg-dark-red cursor-pointer text-white"
          >
            Delete
          </Button>
        </div>
      </form>
      <p className="text-dark-gray text-[1.1rem] font-normal">
        This client used this package {count} {count > 1 ? "Times" : "time"}
      </p>
      <p className="text-dark-gray text-[1.1rem] font-normal">
        Amount agreed upon: $ {base}.
      </p>
      <p className="text-dark-gray text-[1.1rem] font-normal">
        Agreement Date: {createdAt}.
      </p>
      <p className="text-[1.1rem] font-normal text-black/80">
        Description:
        <span className="text-dark-gray italic">{description}</span>
      </p>
    </div>
  );
}
