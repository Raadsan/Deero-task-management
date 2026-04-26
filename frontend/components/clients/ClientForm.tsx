"use client";

import { ClientSchema } from "@/lib/validations";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import Loader from "../Shared/Loader";

import {
  addAnotherService,
  createClient,
  editBasicClientInfo,
  getCustomSubServices,
} from "@/lib/actions/client.action";
import { DEERO_SERVICES, DEERO_SOURCES, ROUTES } from "@/lib/constants";
import { Client } from "@/lib/types";
import {
  computeFontSize,
  formatDate,
  getRandomUUID,
  getSubServices,
} from "@/lib/utils";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import toast from "react-hot-toast";
import useSWR from "swr";
import {
  DatePicker,
  PhoneInput,
  SelectElement,
  TextInput,
  TextInputWithTaxtArea,
} from "../Shared/FormElements";
import { SelectItem } from "../ui/select";

interface Props {
  formType: "edit" | "create" | "addService";
  currentClient?: Client;
}
export default function ClientForm({ formType, currentClient }: Props) {
  const computeTheDate =
    formType == "create" || formType === "addService"
      ? new Date()
      : formatDate(currentClient?.createdAt ?? "");

  const {
    handleSubmit,
    register,
    setValue,
    getValues,
    reset,
    watch,
    setError,
    formState: { errors },
  } = useForm<z.infer<typeof ClientSchema>>({
    defaultValues: {
      institution: currentClient?.institution,
      email: currentClient?.email ?? "",
      phone: currentClient?.phone ?? "",
      service: currentClient?.service?.[0]?.serviceName ?? "",
      subService: "",
      customSubServiceInput: "",
      discount: currentClient?.discount?.toString() ?? "0",
      customSubServiceSelect: "",
      source: currentClient?.source ?? "",
      base: undefined,
      description: undefined,
      createdAt:
        typeof computeTheDate === "string"
          ? new Date(computeTheDate)
          : (computeTheDate ?? undefined),
    },
    resolver: standardSchemaResolver(ClientSchema),
  });

  const [transition, startTransition] = useTransition();
  const router = useRouter();

  const { data } = useSWR("clientCustomSubService", getCustomSubServices);

  const customSubServices = data?.data;
  const watchService = watch("service");
  const watchDiscount = watch("discount");
  const watchBaseValue = watch("base");

  const parseDiscount = Number.parseFloat(watchDiscount) || 0;
  const parseBase = Number.parseFloat(watchBaseValue) || 0;
  const totalAfterDiscount = parseBase - parseBase * parseDiscount;

  const subCategories = getSubServices(watchService);

  function handleSubmitForm(data: z.infer<typeof ClientSchema>) {
    if (!data.service) {
      toast.error("Please select Service from the Dropdown");
      return;
    }
    if (data.service === DEERO_SERVICES.at(-1)) {
      if (
        !getValues("customSubServiceInput") &&
        !getValues("customSubServiceSelect")
      ) {
        toast.error(
          "Please write custom Name or select from prevously Created Customs",
        );
        return;
      }
    }
    if (
      formType !== "edit" &&
      data.service !== DEERO_SERVICES.at(-1) &&
      !data.subService
    ) {
      toast.error("Please select Sub Service from the list.");
      return;
    }

    if (!data.subService) {
      if (data.customSubServiceInput?.length) {
        data.subService = data.customSubServiceInput;
      } else {
        data.subService = data.customSubServiceSelect;
      }
    }

    startTransition(async () => {
      if (formType === "create") {
        const { errors, success } = await createClient({
          institution: data.institution,
          phone: data.phone,
          email: data.email,
          source: data.source!,
          serviceName: data.service!,
          subServiceName: data.subService!,
          base: parseFloat(data.base),
          description: data.description,
          discount: Number.parseFloat(data.discount) || 0,
        });
        if (success && !errors) {
          toast.success("Successfully Created Client");
          router.push(ROUTES.clients);
          return;
        }
        toast.error(errors?.message || "Failed to Create Client");
      } else if (formType === "edit") {
        const result = await editBasicClientInfo({
          clientId: String(currentClient?.id!),
          newData: {
            institution: data.institution,
            phone: data.phone,
            email: data.email,
            source: data.source!,
          },
        });

        if (result.success) {
          toast.success("Successfully Edited Client");
          return;
        }
        toast.error(result?.errors?.message || "Failed to Edit Client");
      } else if (formType === "addService") {
        if (!data.service) {
          return setError("service", {
            type: "manual",
            message: "Service is required",
          });
        }

        if (!data.subService) {
          return setError("subService", {
            type: "manual",
            message: "subService is required",
          });
        }

        const addServiceResult = await addAnotherService({
          clientId: String(currentClient?.id),
          newService: data.service!,
          newSubService: data.subService!,
          base: parseFloat(data.base),
          description: data.description,
          discount: Number.parseFloat(data.discount) || 0,
        });

        if (addServiceResult?.success) {
          toast.success("Succesfully Added Another Service.");
          router.push(ROUTES.clients);
          return;
        }
        toast.error(
          addServiceResult.errors?.message ||
            "Faield to Add Another Serivec! please try again.",
        );
      }
    });
  }

  useEffect(function () {
    reset();
  }, []);

  return (
    <form
      onSubmit={handleSubmit(handleSubmitForm)}
      className="flex w-full flex-col items-center gap-y-[20px] not-last:justify-center"
    >
      <TextInput
        disbaled={formType === "addService"}
        labelId="institution"
        labelText="Write Client Name"
        placeholder="Write the Client Name"
        defaultValue={getValues("institution")}
        otherProps={{ ...register("institution") }}
        errorMessage={errors.institution?.message}
      />

      {/* select service Category */}
      {(formType === "create" || formType === "addService") && (
        <>
          <SelectElement
            key={getRandomUUID()}
            labelText="Select Service"
            placeholder="Select Service Category"
            defaultValue={getValues("service")}
            errorMessage={errors.service?.message}
            elements={DEERO_SERVICES}
            onChange={(value) => {
              setValue("service", value, {
                shouldValidate: true,
              });
            }}
          />
        </>
      )}

      {(formType === "create" || formType === "addService") &&
        getValues("service") === DEERO_SERVICES.at(-1) && (
          <div className="flex h-full min-h-[50px] w-full max-w-[min(800px,100%)] flex-col gap-[20px] lg:flex-row">
            <TextInput
              disbaled={transition}
              labelId="customService"
              wrapperStyle="max-w-full"
              labelText="Describe the Custom Service"
              placeholder="Your custom Service Name"
              otherProps={{ ...register("customSubServiceInput") }}
              errorMessage={errors.customSubServiceInput?.message}
            />
            {customSubServices && (
              <>
                <div className="text-dark-gray mx-auto my-auto h-fit w-fit translate-y-[50%] transform italic lg:mx-0">
                  OR
                </div>
                <SelectElement
                  key={getRandomUUID()}
                  wrapperStyle="w-full"
                  labelText="Select From Previously Created Customs"
                  placeholder="Select Custom Service"
                  defaultValue={getValues("customSubServiceSelect")}
                  errorMessage={errors.customSubServiceSelect?.message}
                  elementRenderer={() => {
                    return customSubServices.map(({ id, name }) => {
                      return (
                        <SelectItem
                          style={{
                            fontSize: computeFontSize(14),
                          }}
                          className="focus:bg-dark-red font-light text-black focus:text-white"
                          key={id}
                          value={name}
                        >
                          {name}
                        </SelectItem>
                      );
                    });
                  }}
                  onChange={(value) => {
                    setValue("customSubServiceSelect", value, {
                      shouldValidate: true,
                    });
                  }}
                />
              </>
            )}
          </div>
        )}
      {formType !== "edit" &&
        getValues("service") &&
        getValues("service") !== DEERO_SERVICES.at(-1) && (
          <SelectElement
            key={getRandomUUID()}
            elementChecker={(value: string) => {
              return (
                currentClient?.service.some(
                  (each) =>
                    each.serviceName.toLowerCase() === value.toLowerCase(),
                ) ?? false
              );
            }}
            labelText="Select Sub Service"
            placeholder="Select Sub Category"
            defaultValue={getValues("subService")}
            errorMessage={errors.subService?.message}
            elements={subCategories}
            onChange={(value) => {
              setValue("subService", value, {
                shouldValidate: true,
              });
            }}
          />
        )}
      {formType === "create" && (
        <SelectElement
          key={getRandomUUID()}
          labelText="Select The Source"
          placeholder="Select The Source"
          defaultValue={getValues("source")}
          errorMessage={errors.source?.message}
          elements={DEERO_SOURCES}
          onChange={(value) => {
            setValue("source", value, {
              shouldValidate: true,
            });
          }}
        />
      )}
      {formType !== "edit" && (
        <TextInput
          labelId="base"
          disbaled={transition}
          labelText="Enter the Agreement base(in USD $)"
          placeholder="200"
          otherProps={{ ...register("base") }}
          errorMessage={errors.base?.message}
        />
      )}
      <TextInput
        labelId="discount"
        disbaled={transition}
        labelText={`Enter the Discount ( After Discount : ${totalAfterDiscount})`}
        placeholder="0.0"
        otherProps={{ ...register("discount") }}
        errorMessage={errors.discount?.message}
      />

      <TextInput
        labelId="email"
        disbaled={formType === "addService"}
        labelText="Email Address"
        placeholder="username@gmail.com"
        otherProps={{ ...register("email") }}
        errorMessage={errors.email?.message}
      />
      <PhoneInput
        labelText="Client Phone Number (e.g 612343434)"
        placeholder="Your phone number"
        disbaled={formType === "addService"}
        labelId="phone"
        otherProps={{ ...register("phone") }}
        errorMessage={errors.phone?.message}
      />
      <DatePicker
        labelText="Select Created Date"
        disbaled={transition}
        date={getValues("createdAt")}
        errorMessage={errors.createdAt?.message}
        setDate={(date: Date) => {
          setValue("createdAt", date, { shouldValidate: true });
        }}
      />

      {formType !== "edit" && (
        <TextInputWithTaxtArea
          labelId="description"
          disbaled={transition}
          labelText="Enter The detailas"
          placeholder="Your Description will be here ...."
          otherProps={{ ...register("description") }}
          errorMessage={errors.description?.message}
        />
      )}

      <div className="mt-[60px] flex w-full items-center justify-center gap-[20px]">
        {transition ? (
          <Loader />
        ) : (
          <ButtonBuilder
            htmlType="submit"
            classNames="text-white"
            type="normal"
          >
            {formType === "edit"
              ? "Save Changes"
              : formType === "addService"
                ? "Add Service"
                : "Create Client"}
          </ButtonBuilder>
        )}
      </div>
    </form>
  );
}
