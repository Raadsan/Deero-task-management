"use client";

import { cn, computeFontSize } from "@/lib/utils";
import { ReactNode } from "react";

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
  wrapperStyle?: string;
  inputStyle?: string;
  type?: string;
  showEyeIcon?: boolean;
}

interface SelectProps<T>
  extends Omit<Props<T>, "labelId" | "defaultValue" | "otherProps"> {
  onChange: (value: string) => void;
  elementRenderer?: () => ReactNode;
  elements?: Array<string>;
  elementChecker?: (value: string) => boolean;
  disbaleSelect?: boolean;
  defaultValue?: string;
  value?: { value: string; label: string };
  otherProps?: Record<any, any>;
}

interface DatePickerProps<T>
  extends Pick<Props<T>, "disbaled" | "errorMessage"> {
  date?: Date;
  setDate: (date: Date) => void;
  labelText: string;
  wrapperClasses?: string;
  showTimePicker?: boolean;
}
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
}: Props<T>) {
  return (
    <div className="h-fit w-full max-w-[min(800px,100%)] space-y-2">
      <label
        htmlFor={labelId}
        style={{
          fontSize: computeFontSize(17),
        }}
        className="appLyInterFont text-dark-gray max flex min-w-[min(800px,100%)] flex-col gap-3 font-normal"
      >
        {labelText}
        <div className="relative flex h-[50px] w-full rounded-md py-5 outline outline-black/10">
          <span className="absolute top-1/2 left-0 z-20 -translate-y-[50%] transform px-2.5 font-bold text-black/50">
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
              "focus:outline-dark-red absolute inset-0 h-full w-full rounded-[inherit] pl-[70px] text-[1.3rem] outline-black/50 placeholder:text-gray-400 focus:outline-2 disabled:cursor-not-allowed disabled:bg-gray-200",
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
}: Props<T> & {
  prefixValue?: string;
  paddingLeft?: string;
}) {
  return (
    <div className="flex h-fit w-full max-w-[min(800px,100%)] flex-col gap-2">
      <label
        htmlFor={labelId}
        style={{
          fontSize: computeFontSize(17),
        }}
        className="text-dark-gray w-full font-normal"
      >
        {labelText}
      </label>
      <div className="relative min-h-[50px] w-full rounded-md">
        {prefixValue && (
          <span className="absolute top-1/2 left-2.5 -translate-y-[50%] transform text-[1.3rem] text-gray-400">
            {prefixValue}
          </span>
        )}
        <input
          type={type}
          style={{
            paddingLeft: paddingLeft ?? "20px",
          }}
          autoComplete={"on"}
          id={labelId}
          defaultValue={defaultValue}
          disabled={disbaled}
          placeholder={placeholder}
          {...otherProps}
          className={cn(
            "focus:outline-dark-red absolute inset-0 overflow-hidden rounded-[inherit] text-[1.3rem] text-wrap outline outline-black/10 placeholder:text-gray-400 focus:outline-2 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-700",
            inputStyle,
          )}
        />
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
  otherProps,
  placeholder,
  disbaleSelect,
}: SelectProps<T>) {
  return (
    <div
      className={cn("h-fit w-[min(800px,100%)] space-y-2 p-0", wrapperStyle)}
    >
      {labelText && <p className="text-dark-gray font-medium">{labelText}</p>}
      <Select
        {...otherProps}
        defaultValue={defaultValue}
        disabled={disbaleSelect}
        onValueChange={(e) => onChange(e)}
      >
        <SelectTrigger className="min-h-[50px] w-full rounded-md border border-black/10 transition-colors hover:bg-red-50">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="w-full space-y-3.5 rounded-[10px] bg-white shadow-sm">
          {elementRenderer && elementRenderer()}
          {elements?.length
            ? elements?.map((value, index) => {
                return (
                  <GetSelectItem
                    otherProps={{
                      disbaled,
                    }}
                    key={index}
                    value={value}
                    label={value}
                  />
                );
              })
            : null}
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
}: Props<T>) {
  return (
    <div
      className={cn(
        "h-fit w-full max-w-[min(800px,100%)] space-y-2",
        wrapperStyle,
      )}
    >
      <label
        htmlFor={labelId}
        style={{
          fontSize: computeFontSize(17),
        }}
        className="appLyInterFont text-dark-gray flex w-full flex-col gap-3 font-normal"
      >
        {labelText}
        <textarea
          {...otherProps}
          id={labelId}
          cols={10}
          rows={5}
          disabled={disbaled}
          placeholder={placeholder}
          className={cn(
            "focus:outline-dark-red min-h-[100px] w-full resize-none rounded-md pt-5 pl-[21px] outline outline-black/10 placeholder:text-gray-400 focus:outline-2 disabled:cursor-not-allowed disabled:bg-gray-200",
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
}: DatePickerProps<T>) {
  return (
    <div
      className={cn(
        "h-fit w-full max-w-[min(800px,100%)] space-y-2",
        wrapperClasses,
      )}
    >
      <p className="text-dark-gray font-medium">{labelText}</p>
      <PickTheDate
        disbale={disbaled}
        date={date}
        setDate={setDate}
        showTimePicker={showTimePicker}
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
