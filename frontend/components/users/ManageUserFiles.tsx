"use client";

import {
  deleteUserFileById,
  getUserUploadedFiles,
} from "@/lib/actions/user.action";
import { Trash } from "lucide-react";

import { UserFiles } from "@/lib/schema";
import { useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { mutate } from "swr";
import { CollapsibleComponent } from "../Shared/CollapsableComponent";
import { Button } from "../ui/button";

interface Props {
  userId: string;
}

function resolveUserFileUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
  return `${apiUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

export default function ManageUserFiles({ userId }: Props) {
  const [transition, startTransition] = useTransition();

  const { data: userFiles } = useSWR(["userFiles", userId], () =>
    getUserUploadedFiles(userId),
  );

  function handleDeleteFile(fileId: string, filePath: string) {
    startTransition(async () => {
      const result = await deleteUserFileById({
        userId,
        fileId,
        filePath,
      });
      if (result?.success) {
        toast.success("Successfully deleted the file.");
        mutate(["userFiles", userId]);
        return;
      }
      toast.error(
        result?.errors?.message || "Failed to delete the file. Try again.",
      );
    });
  }
  return (
    <CollapsibleComponent triggerDescription="Manage Uploaded PDF Files">
      {userFiles?.data && userFiles.data?.length > 0 ? (
        <div className="space-y-3.5">
          {userFiles.data.map((file: UserFiles, idx: number) => (
            <div
              key={file.id ?? idx}
              className="flex flex-col justify-between border-b border-black/10 pb-[10px] sm:flex-row sm:items-center"
            >
              <a
                href={resolveUserFileUrl(file.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline transition hover:text-blue-800"
              >
                {file.name}
                <span className="ml-2 text-sm text-gray-500">
                  ({(file.fileSize / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </a>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleDeleteFile(file.id, file.url)}
                  disabled={transition}
                  className="bg-secondary-100 cursor-pointer text-white"
                >
                  <Trash />
                </Button>
                <span className="mt-2 text-sm text-gray-500 sm:mt-0">
                  PDF file
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <h3 className="text-dark-gray mx-auto w-fit font-medium">
          No PDF files have been uploaded for this user.
        </h3>
      )}
    </CollapsibleComponent>
  );
}
