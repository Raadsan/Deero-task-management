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
        toast.error("You can select upto 5 Documents at the time.");
        return;
      }

      setFiles(Array.from(ref.current.files));
    }
  }

  async function saveFiles() {
    if (files && files.length > 0) {
      for (const file of files) {
        // check if it is more than 1MB then reject it.
        if (file.size > 1024 * 1024) {
          toast.error(`"${file.name}" exceeds 1MB size limit.`);
          return;
        }
      }
      const result = await saveUserFiles({
        files: files,
        userId,
      });
      if (result.success) {
        toast.success("Successfully Upload the Documents");
        setFiles(null);
        return;
      }
      toast.error(
        result.errors?.message ??
          "Failed to upload the Documents. please try again",
      );
    }
  }
  function resetSelectedFiles() {
    if (files && files.length > 0) {
      setFiles(null);
    }
  }
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div
        onClick={transition ? () => {} : () => ref.current?.click()}
        className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-all hover:border-gray-400 hover:bg-gray-100"
      >
        <input
          ref={ref}
          type="file"
          accept=".pdf"
          multiple
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <Upload className="mb-4 text-4xl text-gray-400" />
        <p className="text-sm text-gray-500">PDF files only (max 5 files)</p>
      </div>

      {/* File List */}
      {files && files.length > 0 && (
        <div className="w-full space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Selected Files:
          </h3>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex items-center gap-2">
                {true ? (
                  <Check className="text-green-500" size={20} />
                ) : (
                  <Upload className="text-gray-400" size={20} />
                )}
                <span className="text-sm text-gray-700">{file.name}</span>
              </div>
              <span className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {transition && (
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Uploading...</span>
            <span className="font-medium text-gray-700">{40}%</span>
          </div>
          <Progress value={20} className="h-2" />
        </div>
      )}

      {/* {uploadComplete && (
        <div className="w-full rounded-md border border-green-200 bg-green-50 p-3">
          <div className="flex items-center gap-2 text-green-700">
            <Check className="text-green-500" size={20} />
            <span className="text-sm font-medium">
              Upload completed successfully!
            </span>
          </div>
          {uploadedUrls.length > 0 && (
            <div className="mt-2 space-y-1">
              {uploadedUrls.map((url, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-green-600 hover:underline"
                >
                  {url}
                </a>
              ))}
            </div>
          )}
        </div>
      )} */}

      {/* Action Buttons */}
      <div className="flex w-full gap-2">
        {files && files.length > 0 && !transition && (
          <Button
            onClick={saveFiles}
            disabled={transition}
            className="bg-secondary-200 flex-1 cursor-pointer text-white"
          >
            {transition ? "Uploading..." : `Upload ${files.length} file(s)`}
          </Button>
        )}
        {((files && files.length > 0) || transition) && (
          <Button
            onClick={resetSelectedFiles}
            variant="outline"
            className="flex-1"
          >
            <X className="mr-2" size={16} />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
