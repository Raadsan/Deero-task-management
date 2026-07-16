"use client";

import {
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
} from "@/components/config/config-dialog-styles";
import { Button } from "@/components/ui/button";
import {
  addAnotherService,
  createClient,
  editBasicClientInfo,
  getClientById,
  getClientsForForm,
  getCustomSubServices,
} from "@/lib/actions/client.action";
import { getAllServices } from "@/lib/actions/service.action";
import { getTaskFormBranchOptions } from "@/lib/actions/shared.action";
import { createContract, ContractFilePayload } from "@/lib/actions/contract.action";
import {
  clearClientCreateDraft,
  readClientCreateDraft,
  writeClientCreateDraft,
} from "@/lib/client-create-draft";
import {
  CLIENT_TYPE_OPTIONS,
  ClientType,
  RECURRENCE_TYPE_OPTIONS,
  clientTypeLabel,
} from "@/lib/client-types";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";
import Loader from "../Shared/Loader";

const CUSTOM_SERVICE = "Custom Service";

type FlowMode = "new" | "existing";

type Props = {
  onSuccess?: () => void;
  onCancel?: () => void;
  draftClientId?: string;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-medium text-zinc-700">{children}</label>
  );
}

function fileToContractPayload(file: File): Promise<ContractFilePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      data: String(reader.result),
      fileSize: file.size,
    });
    reader.onerror = () => reject(new Error("Could not read contract document"));
    reader.readAsDataURL(file);
  });
}

export default function ClientCreateWizard({ onSuccess, onCancel, draftClientId: initialDraftId }: Props) {
  const { mutate } = useSWRConfig();
  const [pending, startTransition] = useTransition();

  const [flowMode, setFlowMode] = useState<FlowMode | null>(initialDraftId ? "new" : null);
  const [step, setStep] = useState(1);
  const [draftClientId, setDraftClientId] = useState<string | undefined>(initialDraftId);

  const [clientType, setClientType] = useState<ClientType>("ONE_TIME");
  const [institution, setInstitution] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [portfolioId, setBranchId] = useState("");

  const [includeService, setIncludeService] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [subServiceName, setSubServiceName] = useState("");
  const [customSubService, setCustomSubService] = useState("");
  const [base, setBase] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [serviceDescription, setServiceDescription] = useState("");
  const [contractFeatures, setContractFeatures] = useState<Array<{
    name: string; quantity: number; frequency: string; description: string;
  }>>([]);
  const [editingFeatures, setEditingFeatures] = useState(false);

  const [includeContract, setIncludeContract] = useState(false);
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [contractTerms, setContractTerms] = useState("");
  const [contractFile, setContractFile] = useState<File | null>(null);

  const [includeSchedule, setIncludeSchedule] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("WEEKLY");
  const [scheduleStartDate, setScheduleStartDate] = useState("");

  const [localDraftLoaded, setLocalDraftLoaded] = useState(false);

  const [clientSearch, setClientSearch] = useState("");
  const [existingClientId, setExistingClientId] = useState("");

  const { data: branchRes } = useSWR("client-wizard-portfolios", getTaskFormBranchOptions);
  const portfolios = useMemo(
    () => (branchRes?.data?.portfolios ?? []).filter((b) => Boolean(b?.id && b?.name)),
    [branchRes?.data?.portfolios],
  );
  const singleBranch = branchRes?.data?.singleBranch ?? false;

  const { data: clientsRes } = useSWR(
    flowMode === "existing" ? "client-wizard-clients" : null,
    getClientsForForm,
  );
  const allClients = useMemo(
    () => (clientsRes?.data ?? []).filter((c) => Boolean(c?.id)),
    [clientsRes?.data],
  );

  const { data: servicesRes } = useSWR(
    portfolioId ? ["client-wizard-services", portfolioId] : null,
    ([, id]) => getAllServices({ portfolioId: id }),
  );
  const branchServices = useMemo(
    () => (servicesRes?.data ?? []).filter((s) => Boolean(s?.serviceName)),
    [servicesRes?.data],
  );
  const availableServices = useMemo(
    () => branchServices.filter((service) =>
      clientType === "MANAGED_RECURRING"
        ? service.serviceType === "SUBSCRIPTION"
        : service.serviceType !== "SUBSCRIPTION"),
    [branchServices, clientType],
  );

  const selectedService = availableServices.find((s) => s.serviceName === serviceName);
  const detectedClientType: ClientType =
    selectedService?.serviceType === "SUBSCRIPTION" ? "MANAGED_RECURRING" : "ONE_TIME";

  useEffect(() => {
    if (!selectedService) return;
    setClientType(detectedClientType);
    if (detectedClientType === "ONE_TIME") setIncludeSchedule(false);
  }, [selectedService?.id, detectedClientType]);
  const customSubServiceId =
    serviceName === CUSTOM_SERVICE ? selectedService?.id : undefined;

  const { data: customSubsRes } = useSWR(
    customSubServiceId ? ["client-wizard-custom-subs", customSubServiceId] : null,
    ([, serviceId]) => getCustomSubServices(serviceId),
  );

  const subServiceOptions = useMemo(() => {
    if (serviceName === CUSTOM_SERVICE) return [];
    return (
      selectedService?.subService
        ?.map((s) => s?.name)
        .filter((name): name is string => Boolean(name)) ?? []
    );
  }, [selectedService, serviceName]);

  useEffect(() => {
    const selectedPackage = selectedService?.subService?.find(
      (item) => item.name === subServiceName,
    );
    if (!selectedPackage) return;
    setBase(String(selectedPackage.price ?? 0));
    setContractFeatures((selectedPackage.features ?? []).map((feature) => ({
      name: feature, quantity: 1, frequency: "", description: "",
    })));
    setEditingFeatures(false);
  }, [selectedService?.id, subServiceName]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter(
      (c) =>
        c?.institution?.toLowerCase().includes(q) ||
        c?.phone?.includes(q) ||
        (c?.email ?? "").toLowerCase().includes(q),
    );
  }, [allClients, clientSearch]);

  const totalSteps = flowMode === "existing" ? 3 : 4;

  const { data: draftClientRes } = useSWR(
    draftClientId ? ["client-wizard-draft", draftClientId] : null,
    () => getClientById(draftClientId!),
  );

  useEffect(() => {
    if (!draftClientId || !draftClientRes?.data) return;
    const c = draftClientRes.data as unknown as Record<string, unknown>;
    setClientType((c.clientType as ClientType) ?? "ONE_TIME");
    setInstitution(String(c.institution ?? ""));
    const rawPhone = String(c.phone ?? "");
    setPhone(rawPhone.startsWith("DRAFT") ? "" : rawPhone);
    const rawEmail = String(c.email ?? "");
    setEmail(rawEmail.includes("@deero.internal") ? "" : rawEmail);
    setSource(String(c.source ?? ""));
    setBranchId(String(c.portfolioId ?? ""));
    if (c.contractStartDate) {
      setIncludeContract(true);
      setContractStartDate(String(c.contractStartDate).slice(0, 10));
    }
    if (c.contractEndDate) {
      setContractEndDate(String(c.contractEndDate).slice(0, 10));
    }
    if (c.monthlyBudget) setMonthlyBudget(String(c.monthlyBudget));
    setFlowMode("new");
    setStep(3);
  }, [draftClientId, draftClientRes?.data]);

  useEffect(() => {
    if (localDraftLoaded || initialDraftId || flowMode !== null) return;
    const saved = readClientCreateDraft();
    if (!saved) {
      setLocalDraftLoaded(true);
      return;
    }
    setClientType((saved.clientType as ClientType) ?? "ONE_TIME");
    setInstitution(saved.institution ?? "");
    setPhone(saved.phone ?? "");
    setEmail(saved.email ?? "");
    setSource(saved.source ?? "");
    setBranchId(saved.portfolioId ?? "");
    setIncludeService(saved.includeService ?? false);
    setServiceName(saved.serviceName ?? "");
    setSubServiceName(saved.subServiceName ?? "");
    setCustomSubService(saved.customSubService ?? "");
    setBase(saved.base ?? "0");
    setDiscount(saved.discount ?? "0");
    setServiceDescription(saved.serviceDescription ?? "");
    setIncludeContract(saved.includeContract ?? false);
    setContractStartDate(saved.contractStartDate ?? "");
    setContractEndDate(saved.contractEndDate ?? "");
    setMonthlyBudget(saved.monthlyBudget ?? "");
    setIncludeSchedule(saved.includeSchedule ?? false);
    setScheduleName(saved.scheduleName ?? "");
    setRecurrenceType(saved.recurrenceType ?? "WEEKLY");
    setScheduleStartDate(saved.scheduleStartDate ?? "");
    setDraftClientId(saved.draftClientId);
    setStep(saved.step || 1);
    setFlowMode("new");
    setLocalDraftLoaded(true);
  }, [flowMode, initialDraftId, localDraftLoaded]);

  useEffect(() => {
    if (branchRes?.data?.defaultBranchId && !portfolioId) {
      setBranchId(branchRes.data.defaultBranchId);
    }
  }, [branchRes?.data?.defaultBranchId, portfolioId]);

  function persistLocalDraft(nextStep = step) {
    writeClientCreateDraft({
      clientType,
      institution,
      phone,
      email,
      source,
      portfolioId,
      includeService,
      serviceName,
      subServiceName,
      customSubService,
      base,
      discount,
      serviceDescription,
      includeContract,
      contractStartDate,
      contractEndDate,
      monthlyBudget,
      includeSchedule,
      scheduleName,
      recurrenceType,
      scheduleStartDate,
      draftClientId,
      step: nextStep,
    });
  }

  function resetFlow(mode: FlowMode) {
    setFlowMode(mode);
    setStep(1);
  }

  function validateStep(): boolean {
    if (flowMode === "existing") {
      if (step === 1 && !existingClientId) {
        toast.error("Select an existing client");
        return false;
      }
      if (step === 2) {
        if (!portfolioId) {
          toast.error("Select a portfolio");
          return false;
        }
        if (!serviceName) {
          toast.error("Select a service");
          return false;
        }
        const sub =
          serviceName === CUSTOM_SERVICE ? customSubService : subServiceName;
        if (!sub) {
          toast.error("Select or enter a sub-service");
          return false;
        }
      }
      return true;
    }

    if (step === 1 && !clientType) {
      toast.error("Select a client type");
      return false;
    }
    if (step === 2) {
      if (!institution.trim()) {
        toast.error("Client name is required");
        return false;
      }
      if (!phone.trim() || phone.length < 9) {
        toast.error("Valid phone is required");
        return false;
      }
      if (!source.trim()) {
        toast.error("Source is required");
        return false;
      }
      if (!portfolioId) {
        toast.error("Select a portfolio");
        return false;
      }
    }
    if (step === 3) {
      if (includeService) {
        if (!serviceName) {
          toast.error("Select a service");
          return false;
        }
        const sub =
          serviceName === CUSTOM_SERVICE ? customSubService : subServiceName;
        if (!sub) {
          toast.error("Select or enter a sub-service");
          return false;
        }
      }
      if (includeSchedule && clientType === "MANAGED_RECURRING" && !scheduleName.trim()) {
        toast.error("Schedule name is required when schedule is enabled");
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, totalSteps));
  }

  function goBack() {
    if (step === 1) {
      setFlowMode(null);
      return;
    }
    setStep((s) => s - 1);
  }

  function submitExisting() {
    if (!validateStep()) return;
    const sub =
      serviceName === CUSTOM_SERVICE ? customSubService : subServiceName;

    startTransition(async () => {
      const result = await addAnotherService({
        clientId: existingClientId,
        newService: serviceName,
        newSubService: sub,
        base: parseFloat(base) || 0,
        description: serviceDescription,
        discount: (parseFloat(discount) || 0) / 100,
        contractFeatures,
        portfolioId,
        serviceStatus: "pending",
      });
      if (result.success) {
        if (includeContract) {
          const file = contractFile ? await fileToContractPayload(contractFile) : undefined;
          const contract = await createContract({
            clientId: existingClientId,
            startDate: contractStartDate || undefined,
            endDate: contractEndDate || undefined,
            totalAmount: Number(base) * (1 - (Number(discount) || 0) / 100),
            status: "ACTIVE",
            file,
          });
          if (!contract.success) {
            toast.error(contract.errors?.message ?? "Service saved, but contract failed");
            return;
          }
        }
        toast.success("Service added to client");
        await mutate(SWR_CACH_KEYS.clients.key);
        onSuccess?.();
        return;
      }
      toast.error(result.errors?.message ?? "Failed to add service");
    });
  }

  function buildPayload(isDraft: boolean): Parameters<typeof createClient>[0] {
    const payload: Parameters<typeof createClient>[0] = {
      institution: institution.trim() || (isDraft ? "Draft client" : ""),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      source: source.trim() || (isDraft ? "Draft" : ""),
      clientType,
      portfolioId,
      isDraft,
    };

    if (includeContract) {
      payload.contractStartDate = contractStartDate || undefined;
      payload.contractEndDate = contractEndDate || undefined;
      payload.monthlyBudget = monthlyBudget ? Number(monthlyBudget) : undefined;
    }

    if (includeService && serviceName) {
      const sub =
        serviceName === CUSTOM_SERVICE ? customSubService : subServiceName;
      payload.serviceName = serviceName;
      payload.subServiceName = sub;
      payload.base = parseFloat(base) || 0;
      payload.discount = (parseFloat(discount) || 0) / 100;
      payload.contractFeatures = contractFeatures;
      payload.description = serviceDescription;
    }

    if (includeSchedule && clientType === "MANAGED_RECURRING" && scheduleName.trim()) {
      payload.schedule = {
        name: scheduleName.trim(),
        recurrenceType,
        contentType: "VIDEO",
        startDate: scheduleStartDate || new Date().toISOString().slice(0, 10),
        steps: [],
      };
    }

    return payload;
  }

  async function attachExtrasAfterSave(clientId: string) {
    if (includeService && serviceName && draftClientId) {
      const sub =
        serviceName === CUSTOM_SERVICE ? customSubService : subServiceName;
      await addAnotherService({
        clientId,
        newService: serviceName,
        newSubService: sub,
        base: parseFloat(base) || 0,
        description: serviceDescription,
        discount: (parseFloat(discount) || 0) / 100,
        contractFeatures,
        portfolioId,
        serviceStatus: "pending",
      });
    }
  }

  function saveDraft() {
    persistLocalDraft(step);
    startTransition(async () => {
      const payload = buildPayload(true);

      if (draftClientId) {
        const result = await editBasicClientInfo({
          clientId: draftClientId,
          newData: {
            institution: payload.institution,
            phone: payload.phone,
            email: payload.email,
            source: payload.source,
            clientType: payload.clientType,
            portfolioId: payload.portfolioId,
            contractStartDate: payload.contractStartDate,
            contractEndDate: payload.contractEndDate,
            monthlyBudget: payload.monthlyBudget,
            isDraft: true,
          },
        });
        if (!result.success) {
          toast.error(result.errors?.message ?? "Failed to save draft");
          return;
        }
        toast.success("Draft saved — continue anytime from Clients list");
        await mutate(SWR_CACH_KEYS.clients.key);
        onSuccess?.();
        return;
      }

      const result = await createClient(payload);
      if (!result.success) {
        toast.error(result.errors?.message ?? "Failed to save draft");
        return;
      }
      const clientId = (result.data as { client?: { id?: string } })?.client?.id;
      if (includeContract && clientId) {
        const file = contractFile ? await fileToContractPayload(contractFile) : undefined;
        const contract = await createContract({
          clientId,
          startDate: contractStartDate || undefined,
          endDate: contractEndDate || undefined,
          totalAmount: Number(base) * (1 - (Number(discount) || 0) / 100),
          status: "ACTIVE",
          file,
        });
        if (!contract.success) {
          toast.error(contract.errors?.message ?? "Client saved, but contract failed");
          return;
        }
      }
      const id = (result.data as { client?: { id?: string } })?.client?.id
        ?? (result.data as { id?: string })?.id;
      if (id) setDraftClientId(id);
      clearClientCreateDraft();
      toast.success("Draft saved — continue from Clients list");
      await mutate(SWR_CACH_KEYS.clients.key);
      onSuccess?.();
    });
  }

  function submitNew() {
    if (!validateStep()) return;
    clearClientCreateDraft();

    startTransition(async () => {
      const payload = buildPayload(false);

      if (draftClientId) {
        const result = await editBasicClientInfo({
          clientId: draftClientId,
          newData: {
            institution: payload.institution,
            phone: payload.phone,
            email: payload.email,
            source: payload.source,
            clientType: payload.clientType,
            portfolioId: payload.portfolioId,
            contractStartDate: payload.contractStartDate,
            contractEndDate: payload.contractEndDate,
            monthlyBudget: payload.monthlyBudget,
            isDraft: false,
          },
        });
        if (!result.success) {
          toast.error(result.errors?.message ?? "Failed to create client");
          return;
        }
        await attachExtrasAfterSave(draftClientId);
        if (includeContract) {
          const file = contractFile ? await fileToContractPayload(contractFile) : undefined;
          const contract = await createContract({
            clientId: draftClientId,
            startDate: contractStartDate || undefined,
            endDate: contractEndDate || undefined,
            totalAmount: Number(base) * (1 - (Number(discount) || 0) / 100),
            status: "ACTIVE",
            file,
          });
          if (!contract.success) {
            toast.error(contract.errors?.message ?? "Client saved, but contract failed");
            return;
          }
        }
        toast.success("Client created successfully");
        await mutate(SWR_CACH_KEYS.clients.key);
        onSuccess?.();
        return;
      }

      const result = await createClient(payload);
      if (!result.success) {
        toast.error(result.errors?.message ?? "Failed to create client");
        return;
      }
      toast.success("Client created successfully");
      await mutate(SWR_CACH_KEYS.clients.key);
      onSuccess?.();
    });
  }

  if (!flowMode) {
    return (
      <div className={cn(configDialogBodyClass, "space-y-4")}>
        <p className="text-sm text-zinc-600">How would you like to start?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => resetFlow("new")}
            className="rounded-xl border-2 border-zinc-200 bg-white p-5 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <p className="font-semibold text-zinc-900">New client</p>
            <p className="mt-1 text-sm text-zinc-500">
              Single job, regular, or scheduled client.
            </p>
          </button>
          <button
            type="button"
            onClick={() => resetFlow("existing")}
            className="rounded-xl border-2 border-zinc-200 bg-white p-5 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <p className="font-semibold text-zinc-900">Existing client</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add another service agreement to a client already in the system.
            </p>
          </button>
        </div>
        {onCancel ? (
          <div className={configDialogFooterClass}>
            <Button type="button" variant="outline" onClick={onCancel} className={btnFormCancel}>
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-zinc-100 px-6 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-700">
            {flowMode === "new" ? "New client" : "Existing client"} — Step {step} of{" "}
            {totalSteps}
          </span>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-8 rounded-full",
                  i + 1 <= step ? "bg-primary" : "bg-zinc-200",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={configDialogBodyClass}>
        {flowMode === "new" && step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-600">Choose the service workflow</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setClientType("ONE_TIME")}
                className={cn("rounded-xl border-2 p-5 text-left", clientType === "ONE_TIME" ? "border-primary bg-primary/5" : "border-zinc-200")}>
                <p className="font-semibold">Single Job</p>
                <p className="mt-1 text-sm text-zinc-500">All one-time services except Digital Marketing.</p>
              </button>
              <button type="button" onClick={() => setClientType("MANAGED_RECURRING")}
                className={cn("rounded-xl border-2 p-5 text-left", clientType === "MANAGED_RECURRING" ? "border-primary bg-primary/5" : "border-zinc-200")}>
                <p className="font-semibold">Subscription</p>
                <p className="mt-1 text-sm text-zinc-500">Digital Marketing packages and recurring work.</p>
              </button>
            </div>
          </div>
        ) : null}

        {flowMode === "new" && step === 2 ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              Fill in the basics now. Address, contract, and schedule can be added later when you edit the client.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Client name *</FieldLabel>
              <input
                className={configCompactInputClass}
                value={institution ?? ""}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Client / institution name"
              />
            </div>
            <div>
              <FieldLabel>Phone *</FieldLabel>
              <input
                className={configCompactInputClass}
                value={phone ?? ""}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="612345678"
              />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <input
                type="email"
                className={configCompactInputClass}
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Source *</FieldLabel>
              <select
                className={configCompactSelectClass}
                value={source ?? ""}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Select source</option>
                {["Social Media", "Referral", "Website", "Direct", "Other"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Portfolio *</FieldLabel>
              <select
                className={configCompactSelectClass}
                value={portfolioId ?? ""}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={singleBranch}
              >
                <option value="">Select portfolio</option>
                {portfolios.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            </div>
          </div>
        ) : null}

        {flowMode === "new" && step === 3 ? (
          <div className="space-y-5">
            <div className="hidden">
              <p className="mb-2 font-semibold text-zinc-800">Summary</p>
              <div className="grid gap-1 sm:grid-cols-2">
                <p><span className="text-zinc-500">Type:</span> {clientTypeLabel(clientType)}</p>
                <p><span className="text-zinc-500">Name:</span> {institution || "—"}</p>
                <p><span className="text-zinc-500">Phone:</span> {phone || "—"}</p>
                <p><span className="text-zinc-500">Email:</span> {email || "—"}</p>
                <p><span className="text-zinc-500">Source:</span> {source || "—"}</p>
                <p><span className="text-zinc-500">Portfolio:</span> {portfolios.find((b) => b.id === portfolioId)?.name ?? "—"}</p>
              </div>
            </div>

            <p className="text-sm text-zinc-500">
              Service, contract, and schedule are optional — skip any section you do not need yet.
            </p>

            <ServiceFields
              includeService={includeService}
              setIncludeService={setIncludeService}
              serviceName={serviceName}
              setServiceName={setServiceName}
              subServiceName={subServiceName}
              setSubServiceName={setSubServiceName}
              customSubService={customSubService}
              setCustomSubService={setCustomSubService}
              base={base}
              setBase={setBase}
              discount={discount}
              setDiscount={setDiscount}
              serviceDescription={serviceDescription}
              setServiceDescription={setServiceDescription}
              branchServices={availableServices}
              subServiceOptions={subServiceOptions}
              customSubs={customSubsRes?.data ?? []}
              featureEditor={subServiceName ? (
                <PackageFeatureEditor features={contractFeatures} setFeatures={setContractFeatures}
                  editing={editingFeatures} setEditing={setEditingFeatures} />
              ) : null}
            />

            {false && includeService && subServiceName ? (
              <div className="-mt-5 rounded-b-xl border border-t-0 border-zinc-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900">Package feature summary</p>
                    <p className="text-xs text-zinc-500">This is an editable copy for this client only.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingFeatures((value) => !value)}>
                    {editingFeatures ? "Done" : "Edit features"}
                  </Button>
                </div>
                <div className="space-y-3">
                  {contractFeatures.map((feature, index) => (
                    <div key={index} className="flex gap-2 rounded-lg bg-zinc-50 p-2">
                      {editingFeatures ? (
                        <>
                          <input className={configCompactInputClass} value={feature.name} onChange={(e) => setContractFeatures((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                          <Button type="button" variant="ghost" className="shrink-0 text-red-500" onClick={() => setContractFeatures((items) => items.filter((_, i) => i !== index))}></Button>
                        </>
                      ) : (
                        <p className="sm:col-span-4"><Check className="mr-2 inline size-4 text-primary" />{feature.name}  Qty {feature.quantity}{feature.frequency ? `  ${feature.frequency}` : ""}</p>
                      )}
                    </div>
                  ))}
                  {editingFeatures ? <Button type="button" variant="outline" onClick={() => setContractFeatures((items) => [...items, { name: "", quantity: 1, frequency: "", description: "" }])}>+ Add Feature</Button> : null}
                </div>
              </div>
            ) : null}

            {includeService ? (
              <div className="space-y-3 rounded-lg border border-zinc-100 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={includeContract}
                    onChange={(e) => setIncludeContract(e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                  Contract &amp; payment (optional)
                </label>
                {includeContract ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Contract start</FieldLabel>
                      <input type="date" className={configCompactInputClass} value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel>Contract end</FieldLabel>
                      <input type="date" className={configCompactInputClass} value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
                    </div>
                    <div>
                      <FieldLabel>Contract document</FieldLabel>
                      <input type="file" accept=".pdf,image/*" className={configCompactInputClass}
                        onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} />
                      {contractFile ? <p className="mt-1 text-xs text-zinc-500">{contractFile.name}</p> : null}
                    </div>
                    <div className="hidden">
                      <FieldLabel>Contract number</FieldLabel>
                      <input className={configCompactInputClass} value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} placeholder="Auto-generated if empty" />
                    </div>
                    <div className="hidden">
                      <FieldLabel>Terms &amp; conditions</FieldLabel>
                      <textarea className={cn(configCompactInputClass, "min-h-20 py-2")} value={contractTerms} onChange={(e) => setContractTerms(e.target.value)} />
                    </div>
                    <div className="hidden">
                      <FieldLabel>Contract document (PDF or image, max 5MB)</FieldLabel>
                      <input type="file" accept=".pdf,image/*" className={configCompactInputClass}
                        onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} />
                      {contractFile ? <p className="mt-1 text-xs text-zinc-500">{contractFile.name}</p> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {false && clientType === "MANAGED_RECURRING" ? (
              <div className="space-y-3 rounded-lg border border-zinc-100 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={includeSchedule}
                    onChange={(e) => setIncludeSchedule(e.target.checked)}
                    className="size-4 rounded accent-primary"
                  />
                  Recurring schedule (optional — skip if not ready)
                </label>
                {includeSchedule ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <FieldLabel>Schedule name</FieldLabel>
                      <input className={configCompactInputClass} value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="e.g. Weekly content" />
                    </div>
                    <div>
                      <FieldLabel>Recurrence</FieldLabel>
                      <select className={configCompactSelectClass} value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)}>
                        {RECURRENCE_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel>Start date</FieldLabel>
                      <input type="date" className={configCompactInputClass} value={scheduleStartDate} onChange={(e) => setScheduleStartDate(e.target.value)} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {flowMode === "existing" && step === 1 ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                className={cn(configCompactInputClass, "pl-9")}
                placeholder="Search by name, phone, or email..."
                value={clientSearch ?? ""}
                onChange={(e) => setClientSearch(e.target.value)}
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-zinc-100">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setExistingClientId(String(client.id))}
                  className={cn(
                    "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-zinc-50",
                    existingClientId === String(client.id) && "bg-primary/10",
                  )}
                >
                  <span className="font-medium text-zinc-900">{client.institution}</span>
                  <span className="text-zinc-500">{client.phone}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {flowMode === "existing" && step === 2 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setClientType("ONE_TIME")}
                className={cn("rounded-xl border-2 p-4 text-left", clientType === "ONE_TIME" ? "border-primary bg-primary/5" : "border-zinc-200")}>
                <p className="font-semibold">Single Job</p>
                <p className="text-xs text-zinc-500">One-time services</p>
              </button>
              <button type="button" onClick={() => setClientType("MANAGED_RECURRING")}
                className={cn("rounded-xl border-2 p-4 text-left", clientType === "MANAGED_RECURRING" ? "border-primary bg-primary/5" : "border-zinc-200")}>
                <p className="font-semibold">Subscription</p>
                <p className="text-xs text-zinc-500">Digital Marketing only</p>
              </button>
            </div>
            <div>
              <FieldLabel>Portfolio *</FieldLabel>
              <select
                className={configCompactSelectClass}
                value={portfolioId ?? ""}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={singleBranch}
              >
                <option value="">Select portfolio</option>
                {portfolios.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <ServiceFields
              includeService
              setIncludeService={() => {}}
              hideToggle
              serviceName={serviceName}
              setServiceName={setServiceName}
              subServiceName={subServiceName}
              setSubServiceName={setSubServiceName}
              customSubService={customSubService}
              setCustomSubService={setCustomSubService}
              base={base}
              setBase={setBase}
              discount={discount}
              setDiscount={setDiscount}
              serviceDescription={serviceDescription}
              setServiceDescription={setServiceDescription}
              branchServices={availableServices}
              subServiceOptions={subServiceOptions}
              customSubs={customSubsRes?.data ?? []}
              featureEditor={subServiceName ? (
                <PackageFeatureEditor features={contractFeatures} setFeatures={setContractFeatures}
                  editing={editingFeatures} setEditing={setEditingFeatures} />
              ) : null}
            />
            {false && subServiceName && contractFeatures.length ? (
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="mb-3 flex justify-between">
                  <p className="font-semibold">Client package features</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingFeatures((value) => !value)}>{editingFeatures ? "Done" : "Edit"}</Button>
                </div>
                <div className="space-y-2">
                  {contractFeatures.map((feature, index) => editingFeatures ? (
                    <div key={index} className="flex gap-2">
                      <input className={configCompactInputClass} value={feature.name} onChange={(e) => setContractFeatures((items) => items.map((item, i) => i === index ? {...item, name: e.target.value} : item))} />
                      <Button type="button" variant="ghost" className="text-red-500" onClick={() => setContractFeatures((items) => items.filter((_, i) => i !== index))}></Button>
                    </div>
                  ) : <p key={index} className="text-sm"><Check className="mr-2 inline size-4 text-primary" />{feature.name}  Qty {feature.quantity}</p>)}
                  {editingFeatures ? <Button type="button" variant="outline" onClick={() => setContractFeatures((items) => [...items, {name: "", quantity: 1, frequency: "", description: ""}])}>+ Add Feature</Button> : null}
                </div>
              </div>
            ) : null}
            <div className="rounded-xl border border-zinc-200 p-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={includeContract} onChange={(e) => setIncludeContract(e.target.checked)} className="size-4 accent-primary" />
                Create contract and upload document
              </label>
              {includeContract ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input className="hidden" value={contractNumber} readOnly />
                  <input type="date" className={configCompactInputClass} value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} />
                  <input type="date" className={configCompactInputClass} value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
                  <input type="file" accept=".pdf,image/*" className={configCompactInputClass} onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} />
                  <textarea className="hidden" value={contractTerms} readOnly />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {((flowMode === "new" && step === 4) || (flowMode === "existing" && step === 3)) ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
              <h3 className="mb-3 text-lg font-semibold text-zinc-900">Review client &amp; service</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-zinc-500">Client:</span> {flowMode === "new" ? institution : filteredClients.find((client) => String(client.id) === existingClientId)?.institution}</p>
                <p><span className="text-zinc-500">Job type:</span> {clientType === "MANAGED_RECURRING" ? "Subscription" : "Single Job"}</p>
                <p><span className="text-zinc-500">Service:</span> {serviceName}</p>
                <p><span className="text-zinc-500">Package:</span> {subServiceName || customSubService}</p>
                <p><span className="text-zinc-500">Original amount:</span> ${(Number(base) || 0).toFixed(2)}</p>
                <p><span className="text-zinc-500">Discount:</span> {Number(discount) || 0}%</p>
                <p className="font-semibold text-primary"><span className="text-zinc-500">Final amount:</span> ${((Number(base) || 0) * (1 - (Number(discount) || 0) / 100)).toFixed(2)}</p>
                <p><span className="text-zinc-500">Features:</span> {contractFeatures.length}</p>
              </div>
            </div>
            {includeContract ? (
              <div className="rounded-xl border border-zinc-200 p-5">
                <FieldLabel>Contract document (PDF or image, max 5MB)</FieldLabel>
                <input type="file" accept=".pdf,image/*" className={configCompactInputClass}
                  onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} />
                <p className="mt-2 text-xs text-zinc-500">
                  Contract number is generated automatically. {contractFile ? `Selected: ${contractFile.name}` : "You can upload the document later from Contracts."}
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-zinc-200 p-5">
              <p className="font-semibold">Client package features</p>
              <ul className="mt-3 space-y-2">
                {contractFeatures.map((feature, index) => <li key={index} className="rounded-lg bg-zinc-50 p-3 text-sm"><Check className="mr-2 inline size-4 text-primary" />{feature.name}  Qty {feature.quantity}{feature.frequency ? `  ${feature.frequency}` : ""}</li>)}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className={configDialogFooterClass}>
        <Button
          type="button"
          variant="outline"
          onClick={step === 1 && onCancel ? onCancel : goBack}
          disabled={pending}
          className={btnFormCancel}
        >
          <ChevronLeft className="mr-1 size-4" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        {step < totalSteps ? (
          <div className="flex gap-2">
            {flowMode === "new" && step >= 2 ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={saveDraft}
              >
                Save draft
              </Button>
            ) : null}
            <Button type="button" onClick={goNext} className={btnFormSubmit}>
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {flowMode === "new" ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={saveDraft}
              >
                Save draft
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={flowMode === "existing" ? submitExisting : submitNew}
              disabled={pending}
              className={btnFormSubmit}
            >
              {pending ? <Loader /> : flowMode === "existing" ? "Add service" : "Create client"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PackageFeatureEditor({
  features, setFeatures, editing, setEditing,
}: {
  features: Array<{ name: string; quantity: number; frequency: string; description: string }>;
  setFeatures: React.Dispatch<React.SetStateAction<Array<{ name: string; quantity: number; frequency: string; description: string }>>>;
  editing: boolean;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  if (!features.length && !editing) return null;
  return (
    <div className="border-t border-zinc-200 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <div><p className="font-semibold text-zinc-900">Package features</p><p className="text-xs text-zinc-500">Editable copy for this client only.</p></div>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing((value) => !value)}>{editing ? "Done" : "Edit features"}</Button>
      </div>
      <div className="space-y-2">
        {features.map((feature, index) => editing ? (
          <div key={index} className="flex items-center gap-2">
            <input className={configCompactInputClass} value={feature.name ?? ""} onChange={(e) => setFeatures((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
            <button type="button" className="rounded p-2 text-red-500 hover:bg-red-50" aria-label="Remove feature" onClick={() => setFeatures((items) => items.filter((_, i) => i !== index))}><X className="size-4" /></button>
          </div>
        ) : <p key={index} className="flex items-start gap-2 text-sm text-zinc-600"><Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /><span>{feature.name}</span></p>)}
        {editing ? <Button type="button" variant="outline" size="sm" onClick={() => setFeatures((items) => [...items, { name: "", quantity: 1, frequency: "", description: "" }])}>+ Add Feature</Button> : null}
      </div>
    </div>
  );
}

function ServiceFields({
  includeService,
  setIncludeService,
  hideToggle,
  serviceName,
  setServiceName,
  subServiceName,
  setSubServiceName,
  customSubService,
  setCustomSubService,
  base,
  setBase,
  discount,
  setDiscount,
  serviceDescription,
  setServiceDescription,
  branchServices,
  subServiceOptions,
  customSubs,
  featureEditor,
}: {
  includeService: boolean;
  setIncludeService: (v: boolean) => void;
  hideToggle?: boolean;
  serviceName: string;
  setServiceName: (v: string) => void;
  subServiceName: string;
  setSubServiceName: (v: string) => void;
  customSubService: string;
  setCustomSubService: (v: string) => void;
  base: string;
  setBase: (v: string) => void;
  discount: string;
  setDiscount: (v: string) => void;
  serviceDescription: string;
  setServiceDescription: (v: string) => void;
  branchServices: Array<{ serviceName: string; subService?: Array<{ name: string }> }>;
  subServiceOptions: string[];
  customSubs: Array<{ name: string }>;
  featureEditor?: React.ReactNode;
}) {
  const serviceOptions = [
    ...new Set(branchServices.map((s) => s.serviceName)),
    CUSTOM_SERVICE,
  ];

  if (!hideToggle) {
    return (
      <div className="space-y-3 rounded-lg border border-zinc-100 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            type="checkbox"
            checked={includeService}
            onChange={(e) => setIncludeService(e.target.checked)}
            className="size-4 rounded accent-primary"
          />
          Include service agreement (optional — portfolio services)
        </label>
        {includeService ? (
          <>
          <ServiceFieldsInner
            serviceName={serviceName}
            setServiceName={setServiceName}
            subServiceName={subServiceName}
            setSubServiceName={setSubServiceName}
            customSubService={customSubService}
            setCustomSubService={setCustomSubService}
            base={base}
            setBase={setBase}
            discount={discount}
            setDiscount={setDiscount}
            serviceDescription={serviceDescription}
            setServiceDescription={setServiceDescription}
            serviceOptions={serviceOptions}
            subServiceOptions={subServiceOptions}
            customSubs={customSubs}
          />
          {featureEditor}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <ServiceFieldsInner
      serviceName={serviceName}
      setServiceName={setServiceName}
      subServiceName={subServiceName}
      setSubServiceName={setSubServiceName}
      customSubService={customSubService}
      setCustomSubService={setCustomSubService}
      base={base}
      setBase={setBase}
      discount={discount}
      setDiscount={setDiscount}
      serviceDescription={serviceDescription}
      setServiceDescription={setServiceDescription}
      serviceOptions={serviceOptions}
      subServiceOptions={subServiceOptions}
      customSubs={customSubs}
    />
    {featureEditor}
    </div>
  );
}

function ServiceFieldsInner({
  serviceName,
  setServiceName,
  subServiceName,
  setSubServiceName,
  customSubService,
  setCustomSubService,
  base,
  setBase,
  discount,
  setDiscount,
  serviceDescription,
  setServiceDescription,
  serviceOptions,
  subServiceOptions,
  customSubs,
}: {
  serviceName: string;
  setServiceName: (v: string) => void;
  subServiceName: string;
  setSubServiceName: (v: string) => void;
  customSubService: string;
  setCustomSubService: (v: string) => void;
  base: string;
  setBase: (v: string) => void;
  discount: string;
  setDiscount: (v: string) => void;
  serviceDescription: string;
  setServiceDescription: (v: string) => void;
  serviceOptions: string[];
  subServiceOptions: string[];
  customSubs: Array<{ name: string }>;
}) {
  const originalAmount = Number(base) || 0;
  const discountValue = Math.min(Math.max(Number(discount) || 0, 0), 100);
  const discountAmount = originalAmount * (discountValue / 100);
  const finalAmount = originalAmount - discountAmount;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <FieldLabel>Service *</FieldLabel>
        <select
          className={configCompactSelectClass}
          value={serviceName ?? ""}
          onChange={(e) => {
            setServiceName(e.target.value);
            setSubServiceName("");
            setCustomSubService("");
          }}
        >
          <option value="">Select service</option>
          {serviceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {serviceName && serviceName !== CUSTOM_SERVICE ? (
        <div>
          <FieldLabel>Sub-service *</FieldLabel>
          <select
            className={configCompactSelectClass}
            value={subServiceName ?? ""}
            onChange={(e) => setSubServiceName(e.target.value)}
          >
            <option value="">Select sub-service</option>
            {subServiceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {serviceName === CUSTOM_SERVICE ? (
        <div className="sm:col-span-2">
          <FieldLabel>Custom sub-service *</FieldLabel>
          <input
            className={configCompactInputClass}
            value={customSubService ?? ""}
            onChange={(e) => setCustomSubService(e.target.value)}
            list="custom-subs-list"
          />
          <datalist id="custom-subs-list">
            {customSubs.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
        </div>
      ) : null}
      <div>
        <FieldLabel>Amount ($)</FieldLabel>
        <input
          className={configCompactInputClass}
          value={base ?? ""}
          onChange={(e) => setBase(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel>Discount (%)</FieldLabel>
        <input
          type="number"
          min="0"
          max="100"
          placeholder="e.g. 10"
          className={configCompactInputClass}
          value={discount ?? ""}
          onChange={(e) => setDiscount(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-sm sm:col-span-2 sm:grid-cols-4">
        <p><span className="block text-xs text-zinc-500">Original</span><strong>${originalAmount.toFixed(2)}</strong></p>
        <p><span className="block text-xs text-zinc-500">Discount</span><strong>{discountValue.toFixed(1)}%</strong></p>
        <p><span className="block text-xs text-zinc-500">Discount amount</span><strong>${discountAmount.toFixed(2)}</strong></p>
        <p><span className="block text-xs text-zinc-500">Final total</span><strong className="text-primary">${finalAmount.toFixed(2)}</strong></p>
      </div>
      <div className="sm:col-span-2">
        <FieldLabel>Description</FieldLabel>
        <input
          className={configCompactInputClass}
          value={serviceDescription ?? ""}
          onChange={(e) => setServiceDescription(e.target.value)}
        />
      </div>
    </div>
  );
}
