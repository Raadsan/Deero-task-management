"use client";

import { ClientSchema } from "@/lib/validations";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import ButtonBuilder from "../Shared/ButtonBuilder";
import Loader from "../Shared/Loader";

import {
  addAnotherService,
  createClient,
  editBasicClientInfo,
  editClientService,
  getClientsForForm,
  getCustomSubServices,
} from "@/lib/actions/client.action";
import { getAllServices } from "@/lib/actions/service.action";
import { getTaskFormBranchOptions } from "@/lib/actions/shared.action";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { Client } from "@/lib/types";
import {
  cn,
  computeFontSize,
  formatDate,
} from "@/lib/utils";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";
import {
  DatePicker,
  GetSelectItem,
  PhoneInput,
  SelectElement,
  TextInput,
  TextInputWithTaxtArea,
} from "../Shared/FormElements";
import { SelectItem } from "../ui/select";
import { Button } from "../ui/button";
import { Search } from "lucide-react";

const CUSTOM_SERVICE = "Custom Service";
const EMPTY_ARRAY: never[] = [];

type ClientMode = "existing" | "new";

type ClientAgreementForm = {
  agreementId: string;
  serviceName: string;
  subServiceName: string;
  serviceStatus: "pending" | "completed";
  portfolioId?: string | null;
  base?: number;
  description?: string;
  discount?: number;
  createdAt?: string;
  rawCreatedAt?: string;
};

function getAgreementSubServiceName(
  agreement: ClientAgreementForm,
  client?: Client,
) {
  if (agreement.subServiceName) return agreement.subServiceName;
  const linked = client?.subServices?.find(
    (item) => item.agreementId === agreement.agreementId,
  );
  return linked?.name ?? "";
}

interface Props {
  formType: "edit" | "create" | "addService";
  currentClient?: Client;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ClientForm({
  formType,
  currentClient,
  onSuccess,
  onCancel,
}: Props) {
  const isModal = Boolean(onSuccess || onCancel);
  const fieldCompact = isModal;
  const isCreateFlow = formType === "create";
  const isEditFlow = formType === "edit";
  const showServiceFlow =
    formType === "create" || formType === "addService" || formType === "edit";
  const computeTheDate =
    formType == "create" || formType === "addService"
      ? new Date()
      : formatDate(currentClient?.createdAt ?? "");

  type ClientFormValues = z.infer<typeof ClientSchema>;

  const serviceAgreements = useMemo(() => {
    return (
      (currentClient as Client & { serviceAgreements?: ClientAgreementForm[] })
        ?.serviceAgreements ?? []
    );
  }, [currentClient]);

  const {
    handleSubmit,
    register,
    setValue,
    getValues,
    reset,
    watch,
    setError,
    formState: { errors, touchedFields },
  } = useForm<ClientFormValues>({
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
      base: "0",
      description: undefined,
      serviceStatus: "pending",
      createdAt:
        typeof computeTheDate === "string"
          ? new Date(computeTheDate)
          : (computeTheDate ?? undefined),
    },
    resolver: standardSchemaResolver(ClientSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  function fieldError(field: keyof z.infer<typeof ClientSchema>) {
    return touchedFields[field] ? errors[field]?.message : undefined;
  }

  const [transition, startTransition] = useTransition();
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const [clientMode, setClientMode] = useState<ClientMode>("new");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedExistingClientId, setSelectedExistingClientId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [editingAgreementId, setEditingAgreementId] = useState("");
  const hydratedAgreementRef = useRef<string | null>(null);

  useEffect(() => {
    hydratedAgreementRef.current = null;
  }, [currentClient?.id]);

  const { data: branchOptionsRes } = useSWR(
    showServiceFlow ? "client-form-portfolios" : null,
    getTaskFormBranchOptions,
  );
  const branchOptions = branchOptionsRes?.data?.portfolios ?? EMPTY_ARRAY;
  const singleBranch = branchOptionsRes?.data?.singleBranch ?? false;

  const { data: clientsRes } = useSWR(
    isCreateFlow ? "client-form-clients" : null,
    getClientsForForm,
  );
  const allClients = clientsRes?.data ?? EMPTY_ARRAY;

  const { data: branchServicesRes, isLoading: isLoadingBranchServices } = useSWR(
    selectedBranchId ? ["client-portfolio-services", selectedBranchId] : null,
    () => getAllServices({ portfolioId: selectedBranchId }),
  );

  const branchServices = branchServicesRes?.data ?? EMPTY_ARRAY;

  const watchService = watch("service");
  const watchDiscount = watch("discount");
  const watchBaseValue = watch("base");
  const watchSubService = watch("subService");
  const watchServiceStatus = watch("serviceStatus");

  const activeEditAgreement = useMemo(() => {
    if (!isEditFlow || !editingAgreementId) return undefined;
    return serviceAgreements.find(
      (item) => item.agreementId === editingAgreementId,
    );
  }, [isEditFlow, editingAgreementId, serviceAgreements]);

  const savedEditSubService = useMemo(() => {
    if (!activeEditAgreement) return "";
    return getAgreementSubServiceName(activeEditAgreement, currentClient);
  }, [activeEditAgreement, currentClient]);

  const serviceOptions = useMemo(() => {
    const savedService = activeEditAgreement?.serviceName ?? "";
    if (!selectedBranchId) {
      return savedService ? [savedService] : [];
    }
    const fromBranch = [
      ...new Set(branchServices.map((service) => service.serviceName)),
    ];
    const currentService = watchService || savedService;
    if (currentService && !fromBranch.includes(currentService)) {
      return [currentService, ...fromBranch];
    }
    return fromBranch;
  }, [
    branchServices,
    selectedBranchId,
    watchService,
    activeEditAgreement?.serviceName,
  ]);

  const selectedServiceRecord = useMemo(() => {
    return branchServices.find((service) => service.serviceName === watchService);
  }, [branchServices, watchService]);

  const { data: customSubServicesRes } = useSWR(
    watchService === CUSTOM_SERVICE && selectedServiceRecord?.id
      ? ["client-custom-subs", selectedServiceRecord.id]
      : null,
    () => getCustomSubServices(selectedServiceRecord!.id),
  );
  const customSubServices = customSubServicesRes?.data;

  const subCategories = useMemo(() => {
    const seed = watchSubService || savedEditSubService;
    if (!selectedBranchId) {
      return seed ? [seed] : [];
    }
    if (selectedServiceRecord?.subService?.length) {
      const names = selectedServiceRecord.subService.map((sub) => sub.name);
      if (seed && !names.includes(seed)) {
        return [seed, ...names];
      }
      return names;
    }
    return seed ? [seed] : [];
  }, [selectedServiceRecord, watchSubService, savedEditSubService, selectedBranchId]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return allClients;
    return allClients.filter(
      (client) =>
        client.institution.toLowerCase().includes(query) ||
        client.phone.includes(query) ||
        (client.email ?? "").toLowerCase().includes(query),
    );
  }, [allClients, clientSearch]);

  const selectedExistingClient = allClients.find(
    (client) => String(client.id) === selectedExistingClientId,
  );

  const selectedBranchName =
    branchOptions.find((portfolio) => portfolio.id === selectedBranchId)?.name ?? "";

  const parseDiscount = Number.parseFloat(watchDiscount) || 0;
  const parseBase = Number.parseFloat(watchBaseValue) || 0;
  const totalAfterDiscount = parseBase - parseBase * parseDiscount;

  useEffect(() => {
    if (!showServiceFlow || isEditFlow) return;
    if (branchOptionsRes?.data?.defaultBranchId) {
      setSelectedBranchId(branchOptionsRes.data.defaultBranchId);
    }
  }, [showServiceFlow, isEditFlow, branchOptionsRes?.data?.defaultBranchId]);

  useEffect(() => {
    if (!isEditFlow || !currentClient?.id || !serviceAgreements.length) return;
    setEditingAgreementId((prev) => prev || serviceAgreements[0].agreementId);
  }, [isEditFlow, currentClient?.id, serviceAgreements.length, serviceAgreements[0]?.agreementId]);

  useEffect(() => {
    if (!isEditFlow || !currentClient || !editingAgreementId) return;

    const agreement = serviceAgreements.find(
      (item) => item.agreementId === editingAgreementId,
    );
    if (!agreement) return;

    if (hydratedAgreementRef.current === editingAgreementId) return;
    hydratedAgreementRef.current = editingAgreementId;

    const createdAtValue = agreement.rawCreatedAt
      ? new Date(agreement.rawCreatedAt)
      : currentClient.createdAt
        ? new Date(currentClient.createdAt)
        : new Date();

    const portfolioId =
      agreement.portfolioId ??
      (currentClient.service?.[0] as { portfolioId?: string } | undefined)?.portfolioId ??
      branchOptionsRes?.data?.defaultBranchId ??
      "";

    const subServiceName = getAgreementSubServiceName(agreement, currentClient);
    const isCustomService = agreement.serviceName === CUSTOM_SERVICE;

    setSelectedBranchId(portfolioId);

    reset({
      institution: currentClient.institution ?? "",
      email: currentClient.email ?? "",
      phone: currentClient.phone ?? "",
      source: currentClient.source ?? "",
      discount: String(agreement.discount ?? currentClient.discount ?? 0),
      service: agreement.serviceName ?? "",
      subService: isCustomService ? "" : subServiceName,
      base: String(agreement.base ?? 0),
      description: agreement.description ?? "",
      serviceStatus: agreement.serviceStatus ?? "pending",
      createdAt: createdAtValue,
      customSubServiceInput: isCustomService ? subServiceName : "",
      customSubServiceSelect: "",
    });
  }, [
    isEditFlow,
    currentClient,
    editingAgreementId,
    serviceAgreements,
    branchOptionsRes?.data?.defaultBranchId,
    reset,
  ]);

  useEffect(() => {
    if (!isEditFlow || !activeEditAgreement || isLoadingBranchServices) return;

    const subServiceName = getAgreementSubServiceName(
      activeEditAgreement,
      currentClient,
    );
    if (!subServiceName) return;

    if (watchService === CUSTOM_SERVICE) {
      const current = getValues("customSubServiceInput");
      if (current === subServiceName) return;
      setValue("customSubServiceInput", subServiceName, { shouldValidate: false });
      return;
    }

    const current = getValues("subService");
    if (current === subServiceName) return;
    setValue("subService", subServiceName, { shouldValidate: false });
  }, [
    isEditFlow,
    activeEditAgreement,
    isLoadingBranchServices,
    branchServices,
    currentClient?.id,
    watchService,
    setValue,
    getValues,
  ]);

  useEffect(() => {
    if (!selectedExistingClient) return;
    const institution = getValues("institution");
    const phone = getValues("phone");
    const email = getValues("email");
    if (institution !== selectedExistingClient.institution) {
      setValue("institution", selectedExistingClient.institution, {
        shouldValidate: true,
      });
    }
    if (phone !== selectedExistingClient.phone) {
      setValue("phone", selectedExistingClient.phone, { shouldValidate: true });
    }
    if (email !== (selectedExistingClient.email ?? "")) {
      setValue("email", selectedExistingClient.email ?? "", {
        shouldValidate: true,
      });
    }
  }, [selectedExistingClientId, selectedExistingClient, setValue, getValues]);

  function handleClientModeChange(mode: ClientMode) {
    setClientMode(mode);
    setClientSearch("");
    setSelectedExistingClientId("");
    if (mode === "new") {
      setValue("institution", "", { shouldValidate: true });
      setValue("phone", "", { shouldValidate: true });
      setValue("email", "", { shouldValidate: true });
    }
  }

  function handleBranchChange(branchName: string) {
    const portfolio = branchOptions.find((item) => item.name === branchName);
    const nextBranchId = portfolio?.id ?? "";
    setSelectedBranchId(nextBranchId);
    if (isEditFlow) return;
    setValue("service", "", { shouldValidate: true });
    setValue("subService", "", { shouldValidate: true });
    setValue("customSubServiceInput", "", { shouldValidate: true });
    setValue("customSubServiceSelect", "", { shouldValidate: true });
  }

  function handleServiceChange(value: string) {
    const previousService = getValues("service");
    setValue("service", value, { shouldValidate: true });
    if (isEditFlow && value === previousService) return;
    setValue("subService", "", { shouldValidate: true });
    setValue("customSubServiceInput", "", { shouldValidate: true });
    setValue("customSubServiceSelect", "", { shouldValidate: true });
  }

  function resolveSubService(data: z.infer<typeof ClientSchema>) {
    if (data.subService) return data.subService;
    if (data.customSubServiceInput?.length) return data.customSubServiceInput;
    return data.customSubServiceSelect ?? "";
  }

  function handleSubmitForm(data: z.infer<typeof ClientSchema>) {
    if (showServiceFlow && !selectedBranchId) {
      toast.error("Please select a portfolio first");
      return;
    }

    if (isCreateFlow && clientMode === "existing" && !selectedExistingClientId) {
      toast.error("Please search and select an existing client");
      return;
    }

    if (!data.service) {
      toast.error("Please select a service");
      return;
    }

    if (data.service === CUSTOM_SERVICE) {
      if (!getValues("customSubServiceInput") && !getValues("customSubServiceSelect")) {
        toast.error(
          "Please write a custom name or select from previously created customs",
        );
        return;
      }
    } else if (!data.subService) {
      toast.error("Please select a sub-service");
      return;
    }

    if (isCreateFlow && !data.source?.trim()) {
      toast.error("Please enter the client source");
      return;
    }

    const subServiceName = resolveSubService(data);
    const agreementPayload = {
      serviceName: data.service!,
      subServiceName,
      base: parseFloat(data.base),
      description: data.description,
      discount: Number.parseFloat(data.discount) || 0,
      portfolioId: selectedBranchId,
      createdAt: data.createdAt,
      serviceStatus: data.serviceStatus ?? "pending",
    };

    startTransition(async () => {
      if (formType === "create") {
        if (clientMode === "existing" && selectedExistingClientId) {
          const addServiceResult = await addAnotherService({
            clientId: selectedExistingClientId,
            newService: agreementPayload.serviceName,
            newSubService: agreementPayload.subServiceName,
            ...agreementPayload,
          });

          if (addServiceResult?.success) {
            toast.success("Successfully added service for existing client");
            await mutate(SWR_CACH_KEYS.clients.key);
            if (onSuccess) {
              onSuccess();
              return;
            }
            router.push(ROUTES.clients);
            return;
          }
          toast.error(
            addServiceResult.errors?.message ||
              "Failed to add service for existing client",
          );
          return;
        }

        const clientName = data.institution?.trim() || `Client ${data.phone}`;

        const { errors: createErrors, success } = await createClient({
          institution: clientName,
          phone: data.phone,
          email: data.email?.trim() || undefined,
          source: data.source!,
          ...agreementPayload,
        });
        if (success && !createErrors) {
          toast.success("Successfully created client");
          await mutate(SWR_CACH_KEYS.clients.key);
          if (onSuccess) {
            onSuccess();
            return;
          }
          router.push(ROUTES.clients);
          return;
        }
        toast.error(createErrors?.message || "Failed to create client");
      } else if (formType === "edit") {
        if (!editingAgreementId) {
          toast.error("No service agreement found to update");
          return;
        }

        const basicResult = await editBasicClientInfo({
          clientId: String(currentClient?.id!),
          newData: {
            institution: data.institution?.trim() || `Client ${data.phone}`,
            phone: data.phone,
            email: data.email,
            source: data.source ?? "",
            createdAt: data.createdAt,
          },
        });

        if (!basicResult.success) {
          toast.error(basicResult?.errors?.message || "Failed to edit client");
          return;
        }

        const agreementResult = await editClientService({
          agreementId: editingAgreementId,
          clientId: String(currentClient?.id!),
          serviceName: data.service!,
          subServiceName,
          portfolioId: selectedBranchId,
          base: parseFloat(data.base),
          description: data.description ?? "",
          discount: Number.parseFloat(data.discount) || 0,
          serviceStatus: data.serviceStatus ?? "pending",
          createdAt: data.createdAt,
        });

        if (agreementResult.success) {
          toast.success("Successfully edited client");
          await mutate(SWR_CACH_KEYS.clients.key);
          if (onSuccess) {
            onSuccess();
            return;
          }
          router.push(ROUTES.clients);
          return;
        }
        toast.error(
          agreementResult?.errors?.message || "Failed to update service agreement",
        );
      } else if (formType === "addService") {
        if (!data.service) {
          return setError("service", {
            type: "manual",
            message: "Service is required",
          });
        }

        if (!subServiceName) {
          return setError("subService", {
            type: "manual",
            message: "Sub-service is required",
          });
        }

        const addServiceResult = await addAnotherService({
          clientId: String(currentClient?.id),
          newService: data.service!,
          newSubService: subServiceName,
          ...agreementPayload,
        });

        if (addServiceResult?.success) {
          toast.success("Successfully added another service");
          router.push(ROUTES.clients);
          return;
        }
        toast.error(
          addServiceResult.errors?.message ||
            "Failed to add another service. Please try again.",
        );
      }
    });
  }

  const showClientDetails =
    (isCreateFlow &&
      (clientMode === "new" ||
        (clientMode === "existing" && Boolean(selectedExistingClientId)))) ||
    isEditFlow;

  const lockClientIdentity =
    isCreateFlow &&
    clientMode === "existing" &&
    Boolean(selectedExistingClientId);

  return (
    <form
      onSubmit={handleSubmit(handleSubmitForm)}
      className={cn(
        "flex w-full flex-col",
        isModal
          ? "min-h-0 flex-1 overflow-hidden"
          : "items-center gap-y-[20px] not-last:justify-center",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col",
          isModal
            ? "min-h-0 flex-1 gap-4 overflow-y-auto px-6 pt-5"
            : "items-center gap-y-[20px]",
        )}
      >
        {isCreateFlow && (
          <div className="w-full max-w-[min(800px,100%)] space-y-3">
            <p className="text-sm font-medium text-zinc-700">Client type</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={clientMode === "new" ? "default" : "outline"}
                className="h-9"
                onClick={() => handleClientModeChange("new")}
              >
                New client
              </Button>
              <Button
                type="button"
                variant={clientMode === "existing" ? "default" : "outline"}
                className="h-9"
                onClick={() => handleClientModeChange("existing")}
              >
                Existing client
              </Button>
            </div>
          </div>
        )}

        {isCreateFlow && clientMode === "existing" && (
          <div className="w-full max-w-[min(800px,100%)] space-y-3">
            <p className="text-sm font-medium text-zinc-700">Search client</p>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search by name, phone, or email..."
                className="h-10 w-full rounded-md border border-zinc-200 bg-white pr-3 pl-9 text-sm text-zinc-700 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-200 bg-white">
              {filteredClients.length === 0 ? (
                <p className="px-3 py-4 text-sm text-zinc-500">No clients found</p>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedExistingClientId(String(client.id))}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-zinc-100 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-zinc-50",
                      selectedExistingClientId === String(client.id) && "bg-primary/5",
                    )}
                  >
                    <span className="font-medium text-zinc-800">
                      {client.institution}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {client.phone}
                      {client.email ? ` · ${client.email}` : ""}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {isEditFlow && serviceAgreements.length > 1 && (
          <SelectElement
            labelText="Service agreement"
            placeholder="Select agreement to edit"
            value={
              serviceAgreements.find((item) => item.agreementId === editingAgreementId)
                ? `${serviceAgreements.find((item) => item.agreementId === editingAgreementId)?.serviceName} — ${serviceAgreements.find((item) => item.agreementId === editingAgreementId)?.subServiceName}`
                : ""
            }
            disbaleSelect={transition}
            compact={fieldCompact}
            elementRenderer={() =>
              serviceAgreements.map((agreement) => (
                <GetSelectItem
                  key={agreement.agreementId}
                  value={`${agreement.serviceName} — ${agreement.subServiceName}`}
                  label={`${agreement.serviceName} — ${agreement.subServiceName}`}
                />
              ))
            }
            onChange={(value) => {
              const agreement = serviceAgreements.find(
                (item) =>
                  `${item.serviceName} — ${item.subServiceName}` === value,
              );
              if (agreement) {
                setEditingAgreementId(agreement.agreementId);
              }
            }}
          />
        )}

        {showServiceFlow && (
          <SelectElement
            labelText="Portfolio"
            placeholder="Select portfolio first"
            value={selectedBranchName}
            disbaleSelect={transition || singleBranch}
            compact={fieldCompact}
            elementRenderer={() =>
              branchOptions.map((portfolio) => (
                <GetSelectItem key={portfolio.id} value={portfolio.name} label={portfolio.name} />
              ))
            }
            onChange={handleBranchChange}
          />
        )}

        {showClientDetails && (
          <>
            <TextInput
              disbaled={lockClientIdentity}
              labelId="institution"
              labelText="Client name"
              placeholder="Write the client name"
              defaultValue={getValues("institution")}
              otherProps={{ ...register("institution") }}
              errorMessage={fieldError("institution")}
              compact={fieldCompact}
            />

            <PhoneInput
              labelText="Client phone number"
              placeholder="612343434"
              disbaled={lockClientIdentity}
              labelId="phone"
              otherProps={{ ...register("phone") }}
              errorMessage={fieldError("phone")}
              compact={fieldCompact}
            />
          </>
        )}

        {showServiceFlow && (
          <SelectElement
            labelText="Service"
            placeholder={
              !selectedBranchId
                ? "Select portfolio first"
                : isLoadingBranchServices
                  ? "Loading portfolio services..."
                  : serviceOptions.length
                    ? "Select service"
                    : "No services found for this portfolio"
            }
            value={watchService}
            disbaleSelect={
              !selectedBranchId || transition || isLoadingBranchServices
            }
            errorMessage={fieldError("service")}
            elements={serviceOptions}
            compact={fieldCompact}
            onChange={handleServiceChange}
          />
        )}

        {showServiceFlow && watchService === CUSTOM_SERVICE && (
            <div className="flex h-full min-h-[50px] w-full max-w-[min(800px,100%)] flex-col gap-[20px] lg:flex-row">
              <TextInput
                disbaled={transition}
                labelId="customService"
                wrapperStyle="max-w-full"
                labelText="Describe the custom service"
                placeholder="Your custom service name"
                otherProps={{ ...register("customSubServiceInput") }}
                errorMessage={fieldError("customSubServiceInput")}
                compact={fieldCompact}
              />
              {customSubServices && customSubServices.length > 0 && (
                <>
                  <div className="text-dark-gray mx-auto my-auto h-fit w-fit translate-y-[50%] transform italic lg:mx-0">
                    OR
                  </div>
                  <SelectElement
                    wrapperStyle="w-full"
                    labelText="Select from previously created customs"
                    placeholder="Select custom service"
                    value={watch("customSubServiceSelect")}
                    errorMessage={fieldError("customSubServiceSelect")}
                    compact={fieldCompact}
                    elementRenderer={() =>
                      customSubServices.map(({ id, name }) => (
                        <SelectItem
                          style={{ fontSize: computeFontSize(14) }}
                          className="focus:bg-dark-red font-light text-black focus:text-white"
                          key={id}
                          value={name}
                        >
                          {name}
                        </SelectItem>
                      ))
                    }
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

        {showServiceFlow && watchService && watchService !== CUSTOM_SERVICE && (
            <SelectElement
              key={`sub-service-${editingAgreementId || "new"}-${subCategories.join("|")}`}
              elementChecker={(value: string) => {
                if (formType !== "addService") return true;
                return (
                  currentClient?.service.some(
                    (each) =>
                      each.serviceName.toLowerCase() === value.toLowerCase(),
                  ) ?? false
                );
              }}
            labelText="Sub-service"
            placeholder={
              !selectedBranchId
                ? "Select portfolio first"
                : !watchService
                  ? "Select service first"
                  : subCategories.length
                    ? "Select sub-service"
                    : "No sub-services for this service"
            }
            value={watchSubService || savedEditSubService}
            disbaleSelect={
              !watchService ||
              transition ||
              (!subCategories.length && !watchSubService && !savedEditSubService)
            }
              errorMessage={fieldError("subService")}
              elements={subCategories}
              compact={fieldCompact}
              onChange={(value) => {
                setValue("subService", value, { shouldValidate: true });
              }}
            />
          )}

        {showServiceFlow && (
          <SelectElement
            labelText="Service status"
            placeholder="Select status"
            value={watchServiceStatus ?? "pending"}
            disbaleSelect={transition}
            compact={fieldCompact}
            elements={["pending", "completed"]}
            onChange={(value) => {
              setValue("serviceStatus", value as "pending" | "completed", {
                shouldValidate: true,
              });
            }}
          />
        )}

        {(isCreateFlow || isEditFlow) && (
          <TextInput
            labelId="source"
            disbaled={transition}
            labelText="Client source"
            placeholder={
              isCreateFlow
                ? "e.g. Referral, Social Media, Walk-in..."
                : "Client source"
            }
            otherProps={{ ...register("source") }}
            errorMessage={fieldError("source")}
            compact={fieldCompact}
          />
        )}

        {showServiceFlow && (
          <div className="grid w-full max-w-[min(800px,100%)] grid-cols-1 gap-4 sm:grid-cols-3">
            <TextInput
              labelId="base"
              disbaled={transition}
              labelText="Service amount (USD)"
              placeholder="200"
              otherProps={{ ...register("base") }}
              errorMessage={fieldError("base")}
              compact={fieldCompact}
            />
            <TextInput
              labelId="discount"
              disbaled={transition}
              labelText="Discount (0–1)"
              placeholder="0"
              otherProps={{ ...register("discount") }}
              errorMessage={fieldError("discount")}
              compact={fieldCompact}
            />
            <TextInput
              key={totalAfterDiscount.toFixed(2)}
              labelId="netAmount"
              disbaled
              labelText="Net amount (USD)"
              placeholder="0"
              defaultValue={Number.isFinite(totalAfterDiscount) ? totalAfterDiscount.toFixed(2) : "0"}
              otherProps={{ readOnly: true }}
              compact={fieldCompact}
            />
          </div>
        )}

        {(isCreateFlow && clientMode === "new") || isEditFlow ? (
          <TextInput
            labelId="email"
            disbaled={transition}
            labelText="Email (optional)"
            placeholder="company@example.com"
            otherProps={{ ...register("email") }}
            errorMessage={fieldError("email")}
            compact={fieldCompact}
          />
        ) : null}

        <DatePicker
          labelText="Date"
          disbaled={transition}
          date={watch("createdAt")}
          errorMessage={fieldError("createdAt")}
          compact={fieldCompact}
          setDate={(date: Date) => {
            setValue("createdAt", date, { shouldValidate: true });
          }}
        />

        {showServiceFlow && (
          <TextInputWithTaxtArea
            labelId="description"
            disbaled={transition}
            labelText="Description"
            placeholder="Agreement details..."
            otherProps={{ ...register("description") }}
            errorMessage={fieldError("description")}
            compact={isModal}
          />
        )}
      </div>

      <div
        className={cn(
          "flex w-full items-center gap-3",
          isModal
            ? "shrink-0 justify-end border-t border-zinc-100 bg-white px-6 py-4"
            : "mt-[60px] justify-center",
        )}
      >
        {transition ? (
          <Loader />
        ) : (
          <>
            {isModal && onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className={btnFormCancel}
              >
                Cancel
              </Button>
            )}
            {isModal ? (
              <Button type="submit" className={btnFormSubmit}>
                {formType === "edit"
                  ? "Save"
                  : formType === "addService"
                    ? "Add service"
                    : clientMode === "existing"
                      ? "Add service"
                      : "Create client"}
              </Button>
            ) : (
              <ButtonBuilder
                htmlType="submit"
                classNames="text-white"
                type="normal"
              >
                {formType === "edit"
                  ? "Save changes"
                  : formType === "addService"
                    ? "Add service"
                    : clientMode === "existing"
                      ? "Add service"
                      : "Create client"}
              </ButtonBuilder>
            )}
          </>
        )}
      </div>
    </form>
  );
}
