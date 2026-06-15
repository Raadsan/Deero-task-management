"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { saveUserFiles } from "@/lib/actions/user.action";
import { Check, Upload, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";

interface Props {
  userId: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadFile({ userId }: Props) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [transition, startTransition] = useTransition();
  const ref = useRef<HTMLInputElement | null>(null);

  function handleFileUpload() {
    if (
      ref.current !== null &&
      ref.current.files &&
      ref.current.files.length > 0
    ) {
      if (ref.current.files.length > 5) {
        toast.error("You can select up to 5 documents at a time.");
        return;
      }

      setFiles(Array.from(ref.current.files));
    }
  }

  function saveFiles() {
    if (!files || files.length === 0) return;

    for (const file of files) {
      if (file.size > 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 1MB size limit.`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const payload = await Promise.all(
          files.map(async (file) => ({
            name: file.name,
            fileSize: file.size,
            data: await readFileAsDataUrl(file),
          })),
        );

        const result = await saveUserFiles({
          files: payload,
          userId,
        });

        if (result.success) {
          toast.success("Documents uploaded successfully");
          setFiles(null);
          if (ref.current) ref.current.value = "";
          return;
        }

        toast.error(
          result.errors?.message ??
            "Failed to upload the documents. Please try again.",
        );
      } catch {
        toast.error("Failed to upload the documents. Please try again.");
      }
    });
  }

  function resetSelectedFiles() {
    setFiles(null);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div
        onClick={transition ? undefined : () => ref.current?.click()}
        className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-gray-400 hover:bg-gray-100"
      >
        <input
          ref={ref}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <Upload className="mb-4 text-4xl text-gray-400" />
        <p className="text-sm text-gray-500">PDF files only (max 5 files, 1MB each)</p>
      </div>

      {files && files.length > 0 && (
        <div className="w-full space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Selected Files:</h3>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex items-center gap-2">
                <Check className="text-green-500" size={20} />
                <span className="text-sm text-gray-700">{file.name}</span>
              </div>
              <span className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </span>
            </div>
          ))}
        </div>
      )}

      {transition && (
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Uploading...</span>
          </div>
          <Progress value={60} className="h-2" />
        </div>
      )}

      <div className="flex w-full gap-2">
        {files && files.length > 0 && !transition && (
          <Button
            onClick={saveFiles}
            disabled={transition}
            className="bg-secondary-200 flex-1 cursor-pointer text-white"
          >
            Upload {files.length} file(s)
          </Button>
        )}
        {((files && files.length > 0) || transition) && (
          <Button
            onClick={resetSelectedFiles}
            variant="outline"
            className="flex-1"
            disabled={transition}
          >
            <X className="mr-2" size={16} />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
