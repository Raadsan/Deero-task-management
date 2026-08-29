import toast from "react-hot-toast";
import {
  btnFormCancel,
  btnFormSubmit,
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderSubtitleClass,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";
import {
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  configTextareaClass,
} from "@/components/config/config-dialog-styles";

export {
  btnFormCancel,
  btnFormSubmit,
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderSubtitleClass,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  configTextareaClass,
};

export function accountingToast(message: string, type: "success" | "error" = "success") {
  if (type === "error") toast.error(message);
  else toast.success(message);
}

export const accountingDialogClass = `${configDialogShellClass} sm:max-w-3xl`;
export const accountingDialogWideClass = `${configDialogShellClass} sm:max-w-4xl`;
export const accountingDialogXWideClass = `${configDialogShellClass} sm:max-w-5xl`;
export const accountingDialogFormClass = `${configDialogShellClass} sm:max-w-5xl`;
export const accountingDialogFormWideClass = `${configDialogShellClass} sm:max-w-6xl`;

export const accountingFormFieldClass = configCompactInputClass;
export const accountingFormSelectClass = configCompactSelectClass;
export const accountingFormTextareaClass = configTextareaClass;

export const accountingDeleteBtnClass =
  "h-10 min-w-[100px] rounded-md bg-red-600 px-6 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50";
