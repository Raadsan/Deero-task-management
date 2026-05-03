"use client";

import { deleteClientAgreement, editClientService } from "@/lib/actions/client.action";
import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
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
  const [subServiceName, setSubServiceName] = useState(defaultValue);
  const [baseValue, setBaseValue] = useState(base.toString());
  const [desc, setDesc] = useState(description || "");

  function handleUpdate() {
    startTransition(async () => {
      const result = await editClientService({
        agreementId,
        clientId: String(params.id),
        base: parseFloat(baseValue),
        description: desc,
        subServiceName,
      });
      if (result.success) {
        toast.success("Successfully Updated!!");
        return;
      }
      toast.error(
        result.errors?.message || "Failed to Update. try again",
      );
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClientAgreement({
        agreementId,
        clientId: String(params.id),
      });
      if (result.success) {
        toast.success("Successfully Deleted!!");
        return;
      }
      toast.error(
        result.errors?.message || "Failed to Delete. try again",
      );
    });
  }

  return (
    <div className="space-y-4 rounded-[10px] border border-black/10 px-5 py-5 shadow-sm bg-white">
      <div className="flex w-full items-end gap-5">
        <TextInput
          labelText="Service Category Name"
          defaultValue={subServiceName}
          onChange={(e) => setSubServiceName(e.target.value)}
          labelId={labelId}
          placeholder={placeholder}
          wrapperStyle="flex-1"
        />
        <TextInput
          labelText="Amount (USD $)"
          defaultValue={baseValue}
          onChange={(e) => setBaseValue(e.target.value)}
          labelId={`${labelId}-base`}
          placeholder="0.00"
          wrapperStyle="w-[150px]"
        />
        <div className="flex gap-2">
          <Button
            disabled={transition}
            onClick={(e) => {
              e.preventDefault();
              handleUpdate();
            }}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Update
          </Button>
          <Button
            disabled={transition}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete
          </Button>
        </div>
      </div>
      
      <TextInput
        labelText="Agreement Description"
        defaultValue={desc}
        onChange={(e) => setDesc(e.target.value)}
        labelId={`${labelId}-desc`}
        placeholder="Enter description..."
        wrapperStyle="w-full"
      />

      <div className="flex flex-wrap gap-x-10 gap-y-2 pt-2 text-sm text-gray-600 border-t border-gray-100 mt-2 pt-4">
        <p>Used: <strong>{count} {count > 1 ? "times" : "time"}</strong></p>
        <p>Current Rate: <strong>${base}</strong></p>
        <p>Agreed on: <strong>{createdAt}</strong></p>
      </div>
    </div>
  );
}
