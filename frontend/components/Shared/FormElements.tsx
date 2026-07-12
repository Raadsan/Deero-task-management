"use client";

import { cn, computeFontSize } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { ReactNode, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import FormatErrorText from "./FormatErrorText";
import PickTheDate from "./PickTheDate";

interface Props<T> {
  labelText?: string;
  defaultValue?: string;
  otherProps?: T;
  disbaled?: boolean;
  placeholder: string;
  labelId: string;
  errorMessage?: string;
  invalid?: boolean;
  wrapperStyle?: string;
  inputStyle?: string;
  type?: string;
  showEyeIcon?: boolean;
  compact?: boolean;
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps<T>
  extends Omit<Props<T>, "labelId" | "defaultValue" | "otherProps"> {
  onChange: (value: string) => void;
  elementRenderer?: () => ReactNode;
  elements?: Array<string>;
  options?: SelectOption[];
  elementChecker?: (value: string) => boolean;
  disbaleSelect?: boolean;
  defaultValue?: string;
  value?: string;
  invalid?: boolean;
  otherProps?: Record<any, any>;
  compact?: boolean;
}

function formatSelectLabel(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

interface DatePickerProps<T>
  extends Pick<Props<T>, "disbaled" | "errorMessage" | "compact" | "invalid"> {
  date?: Date;
  setDate: (date: Date) => void;
  labelText: string;
  wrapperClasses?: string;
  showTimePicker?: boolean;
}

const compactInvalidFieldClass =
  "border-red-500 focus:border-red-500 focus:ring-red-500/20";

const compactInputFieldClass =
  "h-10 w-full rounded-md border border-zinc-200 px-3 text-sm font-normal text-zinc-800 placeholder:font-normal placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-zinc-100";

const compactSelectTriggerClass =
  "h-10 min-h-0 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-normal text-zinc-800 shadow-none hover:bg-zinc-50 focus:border-primary focus:ring-2 focus:ring-primary/10 [&_[data-slot=select-value]]:font-normal [&_[data-slot=select-value]]:text-zinc-800 data-[placeholder]:text-zinc-400 data-[placeholder]:[&_[data-slot=select-value]]:font-normal";

const compactTextareaClass =
  "min-h-[96px] w-full resize-none rounded-md border border-zinc-200 px-3 py-2.5 text-sm font-normal text-zinc-800 placeholder:font-normal placeholder:text-zinc-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-zinc-100";

const compactDateTriggerClass =
  "h-10 min-h-0 w-full justify-start rounded-md border border-zinc-200 px-3 py-0 text-sm font-normal text-zinc-800 shadow-none hover:bg-zinc-50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/10 disabled:bg-zinc-100";
export function PhoneInput<T>({
  labelText,
  defaultValue,
  otherProps,
  placeholder,
  disbaled,
  labelId,
  errorMessage,
  inputStyle,
  type,
  compact,
}: Props<T>) {
  return (
    <div className={cn("h-fit w-full max-w-[min(800px,100%)] space-y-2", compact && "max-w-none space-y-1.5")}>
      <label
        htmlFor={labelId}
        style={compact ? undefined : { fontSize: computeFontSize(17) }}
        className={cn(
          "appLyInterFont text-dark-gray flex w-full flex-col font-normal",
          compact ? "gap-1.5 text-sm font-medium text-zinc-700" : "gap-3",
        )}
      >
        {labelText}
        <div
          className={cn(
            "relative flex h-[50px] w-full rounded-md outline outline-black/10",
            compact && "h-10 outline-none",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 left-0 z-20 -translate-y-[50%] transform px-2.5 font-normal text-black/50",
              compact && "text-sm text-zinc-500",
            )}
          >
            +252
          </span>
          <input
            type={type}
            id={labelId}
            {...otherProps}
            disabled={disbaled}
            placeholder={placeholder}
            defaultValue={defaultValue}
            className={cn(
              compact
                ? cn(compactInputFieldClass, "pl-[70px]")
                : "focus:outline-dark-red absolute inset-0 h-full w-full rounded-[inherit] pl-[70px] text-[1.3rem] outline-black/50 placeholder:text-gray-400 focus:outline-2 disabled:cursor-not-allowed disabled:bg-gray-200",
              inputStyle,
            )}
          />
        </div>
      </label>
      {errorMessage && <FormatErrorText message={errorMessage} />}
    </div>
  );
}

export function TextInput<T>({
  defaultValue,
  labelText,
  otherProps,
  placeholder,
  disbaled,
  labelId,
  inputStyle,
  errorMessage,
  prefixValue,
  paddingLeft,
  showEyeIcon,
  type,
  wrapperStyle,
  compact,
  invalid,
}: Props<T> & {
  prefixValue?: string;
  paddingLeft?: string;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const resolvedType = showEyeIcon
    ? passwordVisible
      ? "text"
      : "password"
    : type;

  return (
    <div className={cn("h-fit w-full max-w-[min(800px,100%)] space-y-2", wrapperStyle, compact && "max-w-none space-y-1.5")}>
      <label
        htmlFor={labelId}
        style={compact ? undefined : { fontSize: computeFontSize(17) }}
        className={cn(
          "text-dark-gray w-full font-normal",
          compact && "text-sm font-medium text-zinc-700",
        )}
      >
        {labelText}
      </label>
      <div className={cn("relative min-h-[50px] w-full rounded-md", compact && "min-h-0")}>
        {prefixValue && (
          <span className={cn(
            "absolute top-1/2 left-2.5 -translate-y-[50%] transform text-[1.3rem] text-gray-400",
            compact && "text-sm",
          )}>
            {prefixValue}
          </span>
        )}
        <input
          type={resolvedType}
          style={
            compact
              ? {
                  paddingLeft: paddingLeft ?? "12px",
                  paddingRight: showEyeIcon ? "2.75rem" : undefined,
                }
              : {
                  paddingLeft: paddingLeft ?? "20px",
                  paddingRight: showEyeIcon ? "3rem" : undefined,
                }
          }
          autoComplete={"on"}
          id={labelId}
          defaultValue={defaultValue}
          disabled={disbaled}
          placeholder={placeholder}
          {...otherProps}
          className={cn(
            compact
              ? cn(compactInputFieldClass, invalid && compactInvalidFieldClass)
              : cn(
                  "focus:outline-dark-red absolute inset-0 overflow-hidden rounded-[inherit] text-[1.3rem] text-wrap border border-black/10 placeholder:text-gray-400 focus:outline-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-700",
                  invalid && "border-red-500 focus:outline-red-500",
                ),
            inputStyle,
          )}
        />
        {showEyeIcon && (
          <button
            type="button"
            disabled={disbaled}
            onClick={() => setPasswordVisible((value) => !value)}
            className={cn(
              "absolute top-1/2 right-3 z-10 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none disabled:cursor-not-allowed",
              compact && "right-2.5",
            )}
            aria-label={passwordVisible ? "Hide password" : "Show password"}
          >
            {passwordVisible ? (
              <EyeOff className={cn("size-5", compact && "size-4")} />
            ) : (
              <Eye className={cn("size-5", compact && "size-4")} />
            )}
          </button>
        )}
      </div>
      {errorMessage && <FormatErrorText message={errorMessage} />}
    </div>
  );
}

export function SelectElement<T>({
  defaultValue,
  labelText,
  errorMessage,
  onChange,
  elementChecker,
  elementRenderer,
  disbaled,
  wrapperStyle,
  elements,
  options,
  otherProps,
  placeholder,
  disbaleSelect,
  value,
  compact,
  invalid,
}: SelectProps<T>) {
  const selectOptions =
    options?.length
      ? options
      : (elements?.map((item) => ({
          value: item,
          label: formatSelectLabel(item),
        })) ?? []);

  const selectedValue = value ?? defaultValue;

  return (
    <div
      className={cn("h-fit w-full max-w-[min(800px,100%)] space-y-2 p-0", wrapperStyle, compact && "max-w-none space-y-1.5")}
    >
      {labelText && (
        <p className={cn("text-dark-gray font-medium", compact && "text-sm font-medium text-zinc-700")}>
          {labelText}
        </p>
      )}
      <Select
        {...otherProps}
        value={selectedValue || undefined}
        disabled={disbaleSelect}
        onValueChange={(nextValue) => onChange(nextValue)}
      >
        <SelectTrigger
          className={cn(
            "min-h-[50px] w-full rounded-md border border-black/10 bg-white transition-colors hover:bg-zinc-50",
            compact && compactSelectTriggerClass,
            invalid && (compact ? compactInvalidFieldClass : "border-red-500"),
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width)] rounded-md border border-zinc-200 bg-white p-1 shadow-md">
          {elementRenderer && elementRenderer()}
          {selectOptions.map((option) => (
            <GetSelectItem
              key={option.value}
              otherProps={{
                disbaled,
                disabled: elementChecker ? !elementChecker(option.value) : false,
              }}
              value={option.value}
              label={option.label}
            />
          ))}
        </SelectContent>
      </Select>
      {errorMessage && <FormatErrorText message={errorMessage} />}
    </div>
  );
}

export function TextInputWithTaxtArea<T>({
  placeholder,
  labelId,
  labelText,
  disbaled,
  otherProps,
  errorMessage,
  wrapperStyle,
  inputStyle,
  compact,
  invalid,
}: Props<T>) {
  return (
    <div
      className={cn(
        "h-fit w-full max-w-[min(800px,100%)] space-y-2",
        wrapperStyle,
        compact && "max-w-none space-y-1.5",
      )}
    >
      <label
        htmlFor={labelId}
        style={compact ? undefined : { fontSize: computeFontSize(17) }}
        className={cn(
          "appLyInterFont text-dark-gray flex w-full flex-col font-normal",
          compact ? "gap-1.5 text-sm font-medium text-zinc-700" : "gap-3",
        )}
      >
        {labelText}
        <textarea
          {...otherProps}
          id={labelId}
          cols={10}
          rows={compact ? 4 : 5}
          disabled={disbaled}
          placeholder={placeholder}
          className={cn(
            compact
              ? cn(compactTextareaClass, invalid && compactInvalidFieldClass)
              : cn(
                  "focus:outline-dark-red min-h-[100px] w-full resize-none rounded-md border border-black/10 pt-5 pl-[21px] placeholder:text-gray-400 focus:outline-2 disabled:cursor-not-allowed disabled:bg-gray-200",
                  invalid && "border-red-500 focus:outline-red-500",
                ),
            inputStyle,
          )}
        />
        {errorMessage && <FormatErrorText message={errorMessage} />}
      </label>
    </div>
  );
}

export function DatePicker<T>({
  disbaled,
  errorMessage,
  date,
  labelText,
  wrapperClasses,
  setDate,
  showTimePicker,
  compact,
  invalid,
}: DatePickerProps<T>) {
  return (
    <div
      className={cn(
        "h-fit w-full max-w-[min(800px,100%)] space-y-2",
        wrapperClasses,
        compact && "max-w-none space-y-1.5",
      )}
    >
      <p className={cn("text-dark-gray font-medium", compact && "text-sm font-medium text-zinc-700")}>
        {labelText}
      </p>
      <PickTheDate
        disbale={disbaled}
        date={date}
        setDate={setDate}
        showTimePicker={showTimePicker}
        classNames={cn(
          compact ? compactDateTriggerClass : undefined,
          invalid && (compact ? compactInvalidFieldClass : "border-red-500"),
        )}
      />
      {errorMessage && <FormatErrorText message={errorMessage} />}
    </div>
  );
}

export function GetSelectItem({
  className,
  label,
  value,
  otherProps,
}: {
  className?: string;
  value: string;
  label: string;
  otherProps?: any;
}) {
  return (
    <SelectItem
      {...otherProps}
      className={cn(
        "data-[state=checked]:bg-dark-red focus:bg-secondary-100/60 focus:text-white",
        className,
      )}
      value={value}
    >
      {label}
    </SelectItem>
  );
}
