"use client";

import {
  accountingDialogXWideClass,
  accountingToast,
  btnFormCancel,
  btnFormSubmit,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
} from "@/lib/accounting-ui";
import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Calculator,
  Gift,
  Eye,
  Edit3,
  Check,
  Building2,
  Calendar,
  Phone,
  Mail,
  User,
  Hash,
  Layers,
  FileText,
  Loader2,
} from "lucide-react";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import { getAllServices } from "@/lib/apis/serviceApi";
import { accountingCustomerApi } from "@/lib/api/accounting/receivables/customerApi";
import { documentTemplateApi, type DocumentTemplate } from "@/lib/api/documentTemplateApi";
import { useBranchTheme } from "@/components/branding/BranchThemeProvider";
import { resolveBranchLogoUrl } from "@/lib/portfolio-branding";
import axiosClient from "@/lib/apis/axios";
import A4QuotationSheet from "./A4QuotationSheet";

interface ClientOption {
  id: string;
  institution: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

interface PaymentMethodItem {
  id: string;
  label: string;
  value: string;
}

interface ServiceItem {
  id: string;
  /** Lines that share a service-type picker / package checklist */
  group_id: string;
  service_type: string;
  /** Catalog sub-service / package id when known */
  package_id: string | null;
  package_name: string;
  description: string;
  quantity: number;
  rate: number;
  is_free: boolean;
  /**
   * Legacy quotations stored multiple packages as one combined rate.
   * Preserve as-is until the user edits package selection.
   */
  legacy_combined?: boolean;
  selected_subservice_ids?: string[];
}

function newLineId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newGroupId() {
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyServiceLine(partial?: Partial<ServiceItem>): ServiceItem {
  return {
    id: newLineId(),
    group_id: newGroupId(),
    service_type: "",
    package_id: null,
    package_name: "",
    description: "",
    quantity: 1,
    rate: 0,
    is_free: false,
    ...partial,
  };
}

function packageDescription(sub: { name?: string; description?: string }, fallbackService?: string) {
  const name = String(sub?.name || "Package").trim();
  const detail = String(sub?.description || "Effective implementation and delivery.").trim();
  return `${name}: ${detail || `${fallbackService || "Service"} delivery.`}`;
}

function money2(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotation?: Quotation | null;
  onSuccess: () => void;
  initialClientId?: string;
}

function generateDefaultQuotationNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `#DADVQT${year.toString().slice(-2)}${month}${rand.toString().slice(-2)}`;
}

export default function QuotationModal({ open, onOpenChange, quotation, onSuccess, initialClientId }: Props) {
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedPartner, setSelectedPartner] = useState("");
  const { primaryColor, secondaryColor, name: branchName, logoUrl: branchLogoUrl } = useBranchTheme();
  const isRaadsan = Boolean(branchName?.toLowerCase().includes("raadsan") || primaryColor?.toLowerCase() === "#0166d2");
  const brandPrimary = isRaadsan ? (primaryColor || "#0166d2") : (primaryColor || "#6e0002");
  const brandSecondary = isRaadsan ? (secondaryColor || "#fdc210") : (secondaryColor || "#ea580c");
  const brandLogo = resolveBranchLogoUrl(branchLogoUrl) || (isRaadsan ? "/logo-02.png" : "/deero-logo.png");

  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const currentTemplate = useMemo(() => {
    if (selectedTemplateId) {
      const found = availableTemplates.find((t) => t.id === selectedTemplateId);
      if (found) return found;
    }
    return availableTemplates.find((t) => t.is_default) || availableTemplates[0] || null;
  }, [availableTemplates, selectedTemplateId]);

  // Header fields
  const [clientId, setClientId] = useState(initialClientId || "");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [contactPerson, setContactPerson] = useState("");
  const [quotationNo, setQuotationNo] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [quotationTo, setQuotationTo] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED" | "CONVERTED">("DRAFT");

  // Items — one package = one line item
  const [lines, setLines] = useState<ServiceItem[]>([emptyServiceLine({ id: "item-1", group_id: "grp-1" })]);

  // VAT & Totals
  const [includeVat, setIncludeVat] = useState(true);
  const [vatPercent, setVatPercent] = useState<number>(5);

  // Payment Structure & Method
  const [paymentAdvance, setPaymentAdvance] = useState("70% of charge paid in advance.");
  const [paymentCompletion, setPaymentCompletion] = useState("30% of charge paid after the project Completion");
  const [nbText, setNbText] = useState("NB: the advance amount should be paid when you get the invoice.");

  // Dynamic payment methods (add/remove)
  const defaultPaymentMethods: PaymentMethodItem[] = [
    { id: "pm-1", label: "SomBank", value: "1001572624" },
    { id: "pm-2", label: "Premier Bank", value: "020602086001" },
    { id: "pm-3", label: "Salaam Bank", value: "36122269" },
    { id: "pm-4", label: "IBS Bank", value: "59676" },
    { id: "pm-5", label: "EVC-Plus", value: "0618553839" },
    { id: "pm-6", label: "E-DAHAB", value: "0628553566" },
  ];
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(defaultPaymentMethods);

  useEffect(() => {
    if (open) {
      // Fetch CRM clients list
      axiosClient
        .get("/clients/basic")
        .then((res) => {
          if (res.data?.data) setClients(res.data.data);
        })
        .catch(() => {});

      // Fetch Accounting customers list
      accountingCustomerApi
        .getAll()
        .then((res: any) => {
          if (Array.isArray(res)) setCustomers(res);
          else if (res?.data && Array.isArray(res.data)) setCustomers(res.data);
        })
        .catch(() => {});

      // Fetch all quotation templates
      documentTemplateApi
        .getAll("quotation")
        .then((templates) => {
          if (Array.isArray(templates) && templates.length > 0) {
            setAvailableTemplates(templates);
            setSelectedTemplateId((prev) => prev || templates.find((t) => t.is_default)?.id || templates[0]?.id);
          }
        })
        .catch(() => {});

      // Fetch services catalog
      getAllServices()
        .then((res) => {
          if (res?.data) {
            setAvailableServices(res.data);
          }
        })
        .catch(() => {});

      if (quotation) {
        setClientId(quotation.client_id || "");
        setCustomerId(quotation.customer_id || null);
        if (quotation.customer_id) {
          setSelectedPartner(`customer:${quotation.customer_id}`);
        } else if (quotation.client_id) {
          setSelectedPartner(`client:${quotation.client_id}`);
        } else {
          setSelectedPartner("");
        }

        setQuotationNo(quotation.quotation_number || "");
        setDate(quotation.date ? quotation.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
        setValidUntil(quotation.valid_until ? quotation.valid_until.slice(0, 10) : "");
        setStatus(quotation.status);

        // Try parsing rich metadata from notes
        let parsedNotes: any = null;
        if (quotation.notes) {
          try {
            parsedNotes = JSON.parse(quotation.notes);
          } catch {
            parsedNotes = null;
          }
        }

        if (parsedNotes) {
          setContactPerson(parsedNotes.contact_person || quotation.client?.contactPerson || quotation.customer?.name || "");
          setContactEmail(parsedNotes.contact_email || quotation.client?.email || quotation.customer?.email || "");
          setQuotationTo(parsedNotes.quotation_to || quotation.client?.institution || quotation.customer?.name || "");
          setContactPhone(parsedNotes.contact_phone || quotation.client?.phone || quotation.customer?.phone || "");
          setVatPercent(parsedNotes.vat_percent !== undefined ? Number(parsedNotes.vat_percent) : 5);
          setPaymentAdvance(parsedNotes.payment_advance || "70% of charge paid in advance.");
          setPaymentCompletion(parsedNotes.payment_completion || "30% of charge paid after the project Completion");
          setNbText(parsedNotes.nb || "NB: the advance amount should be paid when you get the invoice.");
          if (Array.isArray(parsedNotes.payment_methods) && parsedNotes.payment_methods.length > 0) {
            setPaymentMethods(parsedNotes.payment_methods.map((pm: any, i: number) => ({
              id: pm.id || `pm-${i}-${Date.now()}`,
              label: pm.label || "",
              value: pm.value || "",
            })));
          } else {
            // Legacy fallback: read old individual fields
            const legacyMethods: PaymentMethodItem[] = [];
            if (parsedNotes.bank1_name || parsedNotes.premier_bank) legacyMethods.push({ id: "pm-1", label: parsedNotes.bank1_name || "Premier Bank", value: parsedNotes.premier_bank || "020602086001" });
            if (parsedNotes.bank2_name || parsedNotes.salaam_bank) legacyMethods.push({ id: "pm-2", label: parsedNotes.bank2_name || "Salaam Bank", value: parsedNotes.salaam_bank || "36122269" });
            if (parsedNotes.bank3_name || parsedNotes.ibs_bank) legacyMethods.push({ id: "pm-3", label: parsedNotes.bank3_name || "IBS Bank", value: parsedNotes.ibs_bank || "59676" });
            if (parsedNotes.mobile1_name || parsedNotes.evc_plus) legacyMethods.push({ id: "pm-4", label: parsedNotes.mobile1_name || "EVC-Plus", value: parsedNotes.evc_plus || "0618553839" });
            if (parsedNotes.mobile2_name || parsedNotes.edahab) legacyMethods.push({ id: "pm-5", label: parsedNotes.mobile2_name || "E-DAHAB", value: parsedNotes.edahab || "0628553566" });
            if (legacyMethods.length > 0) setPaymentMethods(legacyMethods);
            else setPaymentMethods(defaultPaymentMethods);
          }
          if (parsedNotes.template_id) {
            setSelectedTemplateId(Number(parsedNotes.template_id));
          }

          if (Array.isArray(parsedNotes.items) && parsedNotes.items.length > 0) {
            const mapped: ServiceItem[] = [];
            parsedNotes.items.forEach((it: any, idx: number) => {
              const subIds = Array.isArray(it.selected_subservice_ids)
                ? it.selected_subservice_ids.map(String)
                : [];
              const hasPackageId = it.package_id != null && String(it.package_id).trim() !== "";
              const isLegacyCombined = !hasPackageId && subIds.length > 1;

              if (isLegacyCombined) {
                // Preserve historical combined package/rate rows as-is.
                mapped.push({
                  id: `item-${idx}-${Date.now()}`,
                  group_id: `grp-legacy-${idx}-${Date.now()}`,
                  service_type: it.service_type || "Service",
                  package_id: null,
                  package_name: it.package_name || it.service_type || "Combined packages",
                  description: it.description || "",
                  quantity: Math.max(1, Number(it.qty || it.quantity || 1)),
                  rate: Math.max(0, Number(it.rate || 0)),
                  is_free: Boolean(it.is_free || Number(it.rate || 0) === 0),
                  legacy_combined: true,
                  selected_subservice_ids: subIds,
                });
                return;
              }

              const packageId = hasPackageId
                ? String(it.package_id)
                : subIds.length === 1
                  ? String(subIds[0])
                  : null;
              mapped.push({
                id: `item-${idx}-${Date.now()}`,
                group_id: it.group_id || `grp-${idx}-${Date.now()}`,
                service_type: it.service_type || "Service",
                package_id: packageId,
                package_name: it.package_name || "",
                description: it.description || "",
                quantity: Math.max(1, Number(it.qty || it.quantity || 1)),
                rate: Math.max(0, Number(it.rate || 0)),
                is_free: Boolean(it.is_free || Number(it.rate || 0) === 0),
              });
            });

            // If items were saved without group_id, group by service_type for the picker UI
            const serviceGroupMap = new Map<string, string>();
            const withGroups = mapped.map((line, idx) => {
              if (line.legacy_combined) return line;
              const rawGroup = parsedNotes.items[idx]?.group_id;
              if (rawGroup) return { ...line, group_id: String(rawGroup) };
              const existing = serviceGroupMap.get(line.service_type);
              if (existing) return { ...line, group_id: existing };
              const gid = `grp-load-${idx}-${Date.now()}`;
              serviceGroupMap.set(line.service_type, gid);
              return { ...line, group_id: gid };
            });

            setLines(withGroups.length ? withGroups : [emptyServiceLine()]);
          }
        } else {
          // Fallback to quotation fields
          setContactPerson(quotation.client?.contactPerson || quotation.customer?.name || "");
          setContactEmail(quotation.client?.email || quotation.customer?.email || "");
          setQuotationTo(quotation.client?.institution || quotation.customer?.name || "");
          setContactPhone(quotation.client?.phone || quotation.customer?.phone || "");
          setPaymentAdvance("70% of charge paid in advance.");
          setPaymentCompletion("30% of charge paid after the project Completion");
          setNbText("NB: the advance amount should be paid when you get the invoice.");
          setPaymentMethods(defaultPaymentMethods);

          if (quotation.lines && quotation.lines.length > 0) {
            setLines(
              quotation.lines.map((l, idx) =>
                emptyServiceLine({
                  id: `item-${idx}-${Date.now()}`,
                  group_id: `grp-${idx}-${Date.now()}`,
                  service_type: l.products?.name || "Service",
                  package_id: null,
                  package_name: "",
                  description: l.description,
                  quantity: Math.max(1, Number(l.quantity || 1)),
                  rate: Math.max(0, Number(l.unit_price || 0)),
                  is_free: Number(l.unit_price) === 0,
                })
              )
            );
          }
        }
      } else {
        // Reset for new creation - start with empty textboxes
        setClientId(initialClientId || "");
        setCustomerId(null);
        setSelectedPartner(initialClientId ? `client:${initialClientId}` : "");
        setContactPerson("");
        setQuotationNo(generateDefaultQuotationNo());
        setContactEmail("");
        setQuotationTo("");
        setContactPhone("");
        setDate(new Date().toISOString().slice(0, 10));
        const defaultValid = new Date();
        defaultValid.setDate(defaultValid.getDate() + 30);
        setValidUntil(defaultValid.toISOString().slice(0, 10));
        setStatus("DRAFT");
        setVatPercent(5);
        setIncludeVat(true);
        setPaymentAdvance("70% of charge paid in advance.");
        setPaymentCompletion("30% of charge paid after the project Completion");
        setNbText("NB: the advance amount should be paid when you get the invoice.");
        setPaymentMethods(defaultPaymentMethods);
        setLines([emptyServiceLine({ id: "item-1", group_id: "grp-1" })]);
      }
      setActiveTab("form");
    }
  }, [open, quotation, initialClientId]);

  // Handle partner (CRM Client or Accounting Customer) selection
  const handlePartnerChange = (val: string) => {
    setSelectedPartner(val);
    if (!val) {
      setClientId("");
      setCustomerId(null);
      return;
    }
    if (val.startsWith("client:")) {
      const id = val.replace("client:", "");
      setClientId(id);
      setCustomerId(null);
      const client = clients.find((c) => c.id === id);
      if (client) {
        setQuotationTo(client.institution || "");
        if (client.contactPerson) setContactPerson(client.contactPerson);
        if (client.email) setContactEmail(client.email);
        if (client.phone) setContactPhone(client.phone);
      }
    } else if (val.startsWith("customer:")) {
      const id = Number(val.replace("customer:", ""));
      setCustomerId(id);
      const cust = customers.find((c: any) => c.id === id);
      if (cust) {
        setClientId(cust.clientId || "");
        setQuotationTo(cust.name || "");
        setContactPerson(cust.name || "");
        if (cust.email) setContactEmail(cust.email);
        if (cust.phone) setContactPhone(cust.phone);
      }
    }
  };

  // Line item handlers — one package = one line item
  const lineGroups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, ServiceItem[]>();
    lines.forEach((line) => {
      if (!map.has(line.group_id)) {
        order.push(line.group_id);
        map.set(line.group_id, []);
      }
      map.get(line.group_id)!.push(line);
    });
    return order.map((groupId) => ({ groupId, items: map.get(groupId)! }));
  }, [lines]);

  const handleAddLine = () => {
    setLines((current) => [...current, emptyServiceLine()]);
  };

  const handleRemoveGroup = (groupId: string) => {
    setLines((current) => {
      const remaining = current.filter((line) => line.group_id !== groupId);
      return remaining.length ? remaining : [emptyServiceLine()];
    });
  };

  const handleRemovePackageLine = (lineId: string) => {
    setLines((current) => {
      const target = current.find((line) => line.id === lineId);
      if (!target) return current;
      const groupItems = current.filter((line) => line.group_id === target.group_id);
      if (groupItems.length <= 1) {
        // Keep the service group, clear the package selection
        return current.map((line) =>
          line.id === lineId
            ? {
                ...line,
                package_id: null,
                package_name: "",
                description: line.service_type
                  ? `1. ${line.service_type}: Comprehensive service delivery.`
                  : "",
                quantity: 1,
                rate: 0,
                is_free: false,
                legacy_combined: false,
                selected_subservice_ids: [],
              }
            : line
        );
      }
      const remaining = current.filter((line) => line.id !== lineId);
      return remaining.length ? remaining : [emptyServiceLine()];
    });
  };

  const handleServiceSelect = (groupId: string, serviceName: string) => {
    const found = availableServices.find((s) => s.serviceName === serviceName);
    setLines((current) => {
      const groupItems = current.filter((line) => line.group_id === groupId);
      const others = current.filter((line) => line.group_id !== groupId);

      if (found && Array.isArray(found.subService) && found.subService.length > 0) {
        const firstSub = found.subService[0];
        const seed = emptyServiceLine({
          id: groupItems[0]?.id || newLineId(),
          group_id: groupId,
          service_type: serviceName,
          package_id: String(firstSub.id),
          package_name: String(firstSub.name || ""),
          description: packageDescription(firstSub, serviceName),
          quantity: 1,
          rate: Number(firstSub.price || 0),
          is_free: false,
        });
        return [...others, seed];
      }

      const seed = emptyServiceLine({
        id: groupItems[0]?.id || newLineId(),
        group_id: groupId,
        service_type: serviceName,
        package_id: null,
        package_name: "",
        description: `1. ${serviceName}: Comprehensive service delivery.`,
        quantity: 1,
        rate: 0,
        is_free: false,
      });
      return [...others, seed];
    });
  };

  const handleToggleSubService = (groupId: string, subService: any) => {
    const subId = String(subService.id);
    setLines((current) => {
      const groupItems = current.filter((line) => line.group_id === groupId);
      if (!groupItems.length) return current;
      const serviceType = groupItems[0].service_type;
      const others = current.filter((line) => line.group_id !== groupId);

      // Editing a legacy combined row: convert to split package lines based on new selection
      const legacy = groupItems.some((line) => line.legacy_combined);
      const selectedIds = new Set(
        legacy
          ? (groupItems[0].selected_subservice_ids || []).map(String)
          : groupItems.map((line) => line.package_id).filter(Boolean).map(String)
      );

      if (selectedIds.has(subId)) {
        selectedIds.delete(subId);
      } else {
        selectedIds.add(subId);
      }

      const foundService = availableServices.find((s) => s.serviceName === serviceType);
      const catalog = Array.isArray(foundService?.subService) ? foundService.subService : [];

      if (selectedIds.size === 0) {
        const blank = emptyServiceLine({
          id: groupItems[0].id,
          group_id: groupId,
          service_type: serviceType,
          package_id: null,
          package_name: "",
          description: serviceType ? `1. ${serviceType}: Comprehensive service delivery.` : "",
          quantity: 1,
          rate: 0,
          is_free: false,
        });
        return [...others, blank];
      }

      const nextGroupLines: ServiceItem[] = [];
      Array.from(selectedIds).forEach((id) => {
        const sub = catalog.find((s: any) => String(s.id) === id) || (String(subService.id) === id ? subService : null);
        const existing = groupItems.find((line) => !line.legacy_combined && String(line.package_id) === id);
        if (existing) {
          nextGroupLines.push(existing);
          return;
        }
        nextGroupLines.push(
          emptyServiceLine({
            group_id: groupId,
            service_type: serviceType,
            package_id: id,
            package_name: String(sub?.name || "Package"),
            description: packageDescription(sub || { name: "Package" }, serviceType),
            quantity: 1,
            rate: Math.max(0, Number(sub?.price || 0)),
            is_free: false,
          })
        );
      });

      return [...others, ...nextGroupLines];
    });
  };

  const handleToggleFree = (lineId: string) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        const isNowFree = !line.is_free;
        return { ...line, is_free: isNowFree, rate: isNowFree ? 0 : line.rate };
      })
    );
  };

  const handlePackageFieldChange = (lineId: string, field: "quantity" | "rate" | "description" | "package_name", value: any) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        if (field === "quantity") {
          const qty = Math.max(1, Number(value) || 1);
          return { ...line, quantity: qty };
        }
        if (field === "rate") {
          return { ...line, rate: Math.max(0, Number(value) || 0), is_free: false };
        }
        return { ...line, [field]: value };
      })
    );
  };

  const handleGroupServiceNameChange = (groupId: string, serviceName: string) => {
    setLines((current) =>
      current.map((line) => (line.group_id === groupId ? { ...line, service_type: serviceName } : line))
    );
  };

  // Calculations — VAT from final package subtotal
  const totals = useMemo(() => {
    let subtotal = 0;
    lines.forEach((l) => {
      if (!l.is_free) {
        const qty = Math.max(1, Number(l.quantity || 1));
        const rate = Math.max(0, Number(l.rate || 0));
        subtotal += qty * rate;
      }
    });
    subtotal = money2(subtotal);
    const taxAmount = includeVat ? money2((subtotal * (Number(vatPercent) || 0)) / 100) : 0;
    const grandTotal = money2(subtotal + taxAmount);
    return { subtotal, taxAmount, grandTotal };
  }, [lines, vatPercent, includeVat]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      accountingToast("Please add at least one item", "error");
      return;
    }

    for (const line of lines) {
      if (!String(line.service_type || "").trim()) {
        accountingToast("Each line needs a service type", "error");
        return;
      }
      if (!(Number(line.quantity) > 0)) {
        accountingToast(`Quantity must be greater than 0 for ${line.package_name || line.service_type}`, "error");
        return;
      }
      if (Number(line.rate) < 0) {
        accountingToast(`Rate cannot be negative for ${line.package_name || line.service_type}`, "error");
        return;
      }
      const expected = money2(Number(line.quantity) * Number(line.is_free ? 0 : line.rate));
      const actual = money2(Number(line.quantity) * Number(line.is_free ? 0 : line.rate));
      if (Math.abs(expected - actual) > 0.001) {
        accountingToast("Amount must equal Quantity × Rate", "error");
        return;
      }
    }

    // Prevent duplicate package lines within the same service group
    for (const group of lineGroups) {
      const ids = group.items.map((item) => item.package_id).filter(Boolean);
      if (new Set(ids).size !== ids.length) {
        accountingToast("Duplicate package lines are not allowed in the same service", "error");
        return;
      }
    }

    const linesTotal = money2(
      lines.reduce((sum, line) => sum + (line.is_free ? 0 : Number(line.quantity) * Number(line.rate)), 0)
    );
    if (Math.abs(linesTotal - totals.subtotal) > 0.01) {
      accountingToast("Subtotal must equal the sum of all package amounts", "error");
      return;
    }

    try {
      setLoading(true);

      const metadata = {
        template_id: currentTemplate?.id,
        template_name: currentTemplate?.name,
        contact_person: contactPerson,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        quotation_to: quotationTo,
        vat_percent: includeVat ? vatPercent : 0,
        payment_advance: paymentAdvance,
        payment_completion: paymentCompletion,
        nb: nbText,
        payment_methods: paymentMethods,
        items: lines.map((l) => ({
          group_id: l.group_id,
          service_type: l.service_type,
          package_id: l.package_id,
          package_name: l.package_name || null,
          selected_subservice_ids: l.legacy_combined
            ? l.selected_subservice_ids || []
            : l.package_id
              ? [l.package_id]
              : [],
          description: l.description,
          qty: l.quantity,
          quantity: l.quantity,
          rate: l.is_free ? 0 : l.rate,
          is_free: l.is_free,
          amount: l.is_free ? 0 : money2(l.quantity * l.rate),
          legacy_combined: Boolean(l.legacy_combined),
        })),
      };

      const payload = {
        client_id: clientId || null,
        customer_id: customerId ? Number(customerId) : null,
        quotation_to: quotationTo.trim(),
        client_name: quotationTo.trim(),
        contact_person: contactPerson.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        quotation_number: quotationNo.trim(),
        date,
        valid_until: validUntil || null,
        status,
        subtotal: totals.subtotal,
        tax: totals.taxAmount,
        total: totals.grandTotal,
        vat_percent: includeVat ? Number(vatPercent) || 0 : 0,
        notes: JSON.stringify(metadata),
        terms: `${paymentAdvance} | ${paymentCompletion}`,
        lines: lines.map((l, idx) => {
          const title = l.package_name || l.service_type || "Service Item";
          const detail = l.description || "";
          const description = (
            l.service_type && l.package_name
              ? `${l.service_type} — ${title}${detail ? `: ${detail}` : ""}`
              : detail || title
          ).slice(0, 255);
          return {
            sequence: (idx + 1) * 10,
            description,
            quantity: Math.max(1, Number(l.quantity || 1)),
            unit_price: l.is_free ? 0 : Math.max(0, Number(l.rate || 0)),
            discount_percent: 0,
            tax_id: null,
          };
        }),
      };

      if (quotation) {
        await quotationApi.update(quotation.id, payload as any);
        accountingToast("Quotation updated successfully");
      } else {
        await quotationApi.create(payload as any);
        accountingToast("Quotation created successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      accountingToast(err?.response?.data?.message || err.message || "Failed to save quotation", "error");
    } finally {
      setLoading(false);
    }
  };

  const formattedDisplayDate = useMemo(() => {
    try {
      if (!date) return "";
      const d = new Date(date);
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return date;
    }
  }, [date]);

  // If the template has custom HTML, interpolate placeholders with current form data
  const previewHtml = useMemo(() => {
    if (!currentTemplate?.html_content) return null;
    let html = currentTemplate.html_content;
    const itemsTableHtml = lines
      .map(
        (l, i) => {
          const title = l.package_name || l.service_type;
          const subtitle = l.package_name && l.service_type ? l.service_type : "";
          return `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;"><strong>${i + 1}. ${title}</strong>${subtitle ? `<div style="color:#64748b;font-size:11px;">${subtitle}</div>` : ""}<br/><span style="color:#64748b;font-size:12px;white-space:pre-wrap;">${l.description}</span></td>
          <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;">${l.quantity}</td>
          <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e2e8f0;font-size:13px;">${l.is_free ? "Free" : `$${Number(l.rate).toFixed(2)}`}</td>
          <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;">${l.is_free ? "Free" : `$${money2(l.quantity * l.rate).toFixed(2)}`}</td>
        </tr>`;
        }
      )
      .join("");
    const replacements: Record<string, string> = {
      company_name: branchName || "Company",
      company_address: "",
      client_name: quotationTo || "Client / Company",
      client_email: contactEmail || "—",
      client_phone: contactPhone || "—",
      contact_person: contactPerson || "—",
      quotation_number: quotationNo || "#DADVQT...",
      quotation_date: formattedDisplayDate,
      quotation_valid_until: validUntil || "—",
      items: itemsTableHtml,
      subtotal: `$${totals.subtotal.toFixed(2)}`,
      tax: `$${totals.taxAmount.toFixed(2)}`,
      total: `$${totals.grandTotal.toFixed(2)}`,
      discount: "$0.00",
      notes: nbText,
      payment_terms: `${paymentAdvance} ${paymentCompletion}`,
      terms: "Payment upon receipt.",
    };
    for (const [k, v] of Object.entries(replacements)) {
      html = html.replace(new RegExp(`{{${k}}}`, "g"), v);
    }
    return html;
  }, [
    currentTemplate?.html_content,
    branchName,
    quotationTo,
    contactEmail,
    contactPhone,
    contactPerson,
    quotationNo,
    formattedDisplayDate,
    validUntil,
    lines,
    totals,
    nbText,
    paymentAdvance,
    paymentCompletion,
  ]);

  // Generate live PDF stamped on real template paper whenever preview tab is active
  useEffect(() => {
    let active = true;
    if (!open || activeTab !== "preview") return;

    if (currentTemplate?.file_url && currentTemplate.file_url.toLowerCase().endsWith(".pdf")) {
      const timer = setTimeout(async () => {
        try {
          setPreviewPdfLoading(true);
          setPreviewError(null);
          const blob = await documentTemplateApi.previewPdf({
            templateId: currentTemplate.id,
            contactPerson,
            quotationNo,
            contactEmail,
            quotationTo,
            contactPhone,
            date: formattedDisplayDate,
            validUntil,
            items: lines.map((l) => ({
              service_type: l.package_name || l.service_type,
              package_name: l.package_name || null,
              description: l.description,
              qty: l.quantity,
              rate: l.is_free ? 0 : l.rate,
              is_free: l.is_free,
              amount: l.is_free ? 0 : money2(l.quantity * l.rate),
            })),
            subtotal: totals.subtotal,
            tax: totals.taxAmount,
            grandTotal: totals.grandTotal,
            vatPercent: includeVat ? vatPercent : 0,
            paymentAdvance,
            paymentCompletion,
            nb: nbText,
          });

          if (!active) return;
          const url = URL.createObjectURL(blob);
          setPreviewPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        } catch (err: any) {
          if (!active) return;
          console.error("Failed to generate preview PDF:", err);
          setPreviewError(err?.response?.data?.message || err?.message || "Failed to load template preview");
        } finally {
          if (active) setPreviewPdfLoading(false);
        }
      }, 250);

      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setPreviewPdfLoading(false);
    }
  }, [
    open,
    activeTab,
    currentTemplate?.id,
    currentTemplate?.file_url,
    contactPerson,
    quotationNo,
    contactEmail,
    quotationTo,
    contactPhone,
    formattedDisplayDate,
    validUntil,
    lines,
    totals,
    includeVat,
    vatPercent,
    paymentAdvance,
    paymentCompletion,
    nbText,
  ]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${accountingDialogXWideClass} max-w-5xl p-0 overflow-hidden`}>
        <DialogHeader className={`${configDialogHeaderClass} px-6 py-4 flex flex-row items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Calculator className="size-5" style={{ color: brandSecondary }} />
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {quotation
                ? `Edit Quotation (${quotation.quotation_number})`
                : "Create Quotation"}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            {availableTemplates.length > 0 && (
              <div className="flex items-center bg-zinc-100/90 border border-zinc-200 px-2 py-1 rounded-lg">
                <select
                  value={currentTemplate?.id ?? ""}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-zinc-800 outline-none cursor-pointer"
                >
                  {availableTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.is_default ? "★" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "form" ? "bg-white text-zinc-900 shadow-sm font-bold" : "text-zinc-600 hover:text-zinc-900"
                }`}
                style={activeTab === "form" ? { color: brandSecondary } : undefined}
              >
                <Edit3 className="size-3.5" /> Edit Form
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTab === "preview" ? "bg-white text-zinc-900 shadow-sm font-bold" : "text-zinc-600 hover:text-zinc-900"
                }`}
                style={activeTab === "preview" ? { color: brandSecondary } : undefined}
              >
                <Eye className="size-3.5" /> Template Preview
              </button>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col max-h-[82vh]">
          <div className={`${configDialogBodyClass} px-6 py-5 overflow-y-auto space-y-6 flex-1`}>
            {activeTab === "form" ? (
              <>
                {/* 1. Header Information Section (Matches Orange/Maroon Box in Document) */}
                <div className="bg-gradient-to-r from-orange-50/50 to-amber-50/30 p-4 rounded-xl border border-orange-200/70 space-y-4">
                  <div className="flex items-center justify-between border-b border-orange-200/60 pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#6e0002] flex items-center gap-1.5">
                      <Building2 className="size-4 text-[#ea580c]" /> Document Header Information
                    </h3>
                    <span className="text-[11px] font-bold text-white bg-[#ea580c] px-3 py-1 rounded-full shadow-sm">
                      Deero Agency Official Format
                    </span>
                  </div>

                  {/* Client & Customer Select & Quick Auto-fill */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    <div className="md:col-span-2">
                      <Label className="text-xs font-semibold text-zinc-700">
                        Select Client / Customer (Auto-fills info)
                      </Label>
                      <select
                        value={selectedPartner}
                        onChange={(e) => handlePartnerChange(e.target.value)}
                        className="w-full h-9 px-3 mt-1 rounded-md border border-zinc-200 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ea580c]/30"
                      >
                        <option value="">-- Choose Existing Client or Customer (or type manually) --</option>
                        {clients.length > 0 && (
                          <optgroup label="🏢 CRM Clients">
                            {clients.map((c) => (
                              <option key={`client-${c.id}`} value={`client:${c.id}`}>
                                {c.institution} {c.contactPerson ? `(${c.contactPerson})` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {customers.length > 0 && (
                          <optgroup label="💼 Accounting Customers">
                            {customers.map((cust) => (
                              <option key={`cust-${cust.id}`} value={`customer:${cust.id}`}>
                                {cust.name} {cust.email ? `(${cust.email})` : ""}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-zinc-700 flex items-center gap-1">
                        <Hash className="size-3 text-[#ea580c]" /> Quotation No *
                      </Label>
                      <Input
                        value={quotationNo}
                        onChange={(e) => setQuotationNo(e.target.value)}
                        placeholder="e.g. #DADVQT2618"
                        required
                        className="h-9 mt-1 text-xs font-bold text-[#ea580c]"
                      />
                    </div>
                  </div>

                  {/* 2-Column Exact Grid fields from Template */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Left Column: Maroon Header Fields */}
                    <div className="space-y-3 p-3 rounded-lg bg-white/90 border border-zinc-200 shadow-sm">
                      <div className="text-[11px] font-bold text-[#6e0002] uppercase tracking-wide border-b pb-1">
                        Contact Person & Phone
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
                          <User className="size-3 text-[#6e0002]" /> Contact Person
                        </Label>
                        <Input
                          value={contactPerson}
                          onChange={(e) => setContactPerson(e.target.value)}
                          placeholder="e.g. Contact Person Name"
                          className="h-8 mt-1 text-xs font-semibold text-zinc-800"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
                          <Mail className="size-3 text-[#6e0002]" /> Contact Email
                        </Label>
                        <Input
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="e.g. info@client.com (optional)"
                          className="h-8 mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
                          <Phone className="size-3 text-[#6e0002]" /> Contact Phone
                        </Label>
                        <Input
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="e.g. +252 61..."
                          className="h-8 mt-1 text-xs font-semibold text-zinc-800"
                        />
                      </div>
                    </div>

                    {/* Right Column: Orange Header Fields */}
                    <div className="space-y-3 p-3 rounded-lg bg-white/90 border border-zinc-200 shadow-sm">
                      <div className="text-[11px] font-bold text-[#ea580c] uppercase tracking-wide border-b pb-1">
                        Quotation To & Date
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
                          <Building2 className="size-3 text-[#ea580c]" /> Quotation To (Company / Institution)
                        </Label>
                        <Input
                          value={quotationTo}
                          onChange={(e) => setQuotationTo(e.target.value)}
                          placeholder="Gacanta ku qor ama dooro client..."
                          className="h-8 mt-1 text-xs font-bold text-zinc-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs font-semibold text-zinc-600 flex items-center gap-1">
                            <Calendar className="size-3 text-[#ea580c]" /> Date *
                          </Label>
                          <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            className="h-8 mt-1 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-zinc-600">Valid Until</Label>
                          <Input
                            type="date"
                            value={validUntil}
                            onChange={(e) => setValidUntil(e.target.value)}
                            className="h-8 mt-1 text-xs"
                          />
                        </div>
                      </div>
                      <div className="text-[11px] text-zinc-500 font-medium pt-1">
                        Display Date: <span className="font-semibold text-zinc-800">{formattedDisplayDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Services & Packages — one package = one line item */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-1.5">
                        <Layers className="size-4 text-[#ea580c]" /> Services & Item(s) Breakdown
                      </h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Select packages under a service type. Each package gets its own quantity and rate.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddLine}
                      className="h-8 text-xs font-semibold text-[#ea580c] border-orange-300 hover:bg-orange-50 gap-1.5"
                    >
                      <Plus className="size-3.5" /> Add Service Row
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {lineGroups.map((group, groupIdx) => {
                      const head = group.items[0];
                      const matchedService = availableServices.find((s) => s.serviceName === head.service_type);
                      const selectedPackageIds = new Set(
                        head.legacy_combined
                          ? (head.selected_subservice_ids || []).map(String)
                          : group.items.map((item) => item.package_id).filter(Boolean).map(String)
                      );
                      const groupSubtotal = money2(
                        group.items.reduce(
                          (sum, item) => sum + (item.is_free ? 0 : Number(item.quantity) * Number(item.rate)),
                          0
                        )
                      );

                      return (
                        <div
                          key={group.groupId}
                          className="border border-zinc-200 rounded-xl p-4 bg-white shadow-sm hover:border-orange-300 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex size-6 items-center justify-center rounded-full bg-[#ea580c] text-white font-bold text-xs shrink-0">
                              {groupIdx + 1}
                            </span>

                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs font-semibold text-zinc-600">Service Type *</Label>
                                <div className="flex gap-2 mt-1">
                                  <select
                                    value={
                                      availableServices.some((s) => s.serviceName === head.service_type)
                                        ? head.service_type
                                        : "__CUSTOM__"
                                    }
                                    onChange={(e) => {
                                      if (e.target.value === "__CUSTOM__") {
                                        handleGroupServiceNameChange(group.groupId, "");
                                      } else {
                                        handleServiceSelect(group.groupId, e.target.value);
                                      }
                                    }}
                                    className="w-full h-8 px-2.5 rounded-md border border-zinc-200 bg-zinc-50/70 text-xs font-semibold text-zinc-800"
                                  >
                                    <option value="__CUSTOM__">✍️ Custom Service (Gacanta ku qor)</option>
                                    {availableServices.map((s) => (
                                      <option key={s.id} value={s.serviceName}>
                                        {s.serviceName}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <Label className="text-xs font-semibold text-zinc-600">
                                  Service Name (Display Title) *
                                </Label>
                                <Input
                                  value={head.service_type}
                                  onChange={(e) => handleGroupServiceNameChange(group.groupId, e.target.value)}
                                  placeholder="e.g. Web Services"
                                  required
                                  className="h-8 mt-1 text-xs font-bold"
                                />
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveGroup(group.groupId)}
                              disabled={lineGroups.length === 1}
                              title="Delete service group"
                              className="text-zinc-400 hover:text-red-600 disabled:opacity-25 transition-colors p-1"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>

                          {matchedService && Array.isArray(matchedService.subService) && matchedService.subService.length > 0 && (
                            <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 space-y-1.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                                Sub-services (Click to include / exclude):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {matchedService.subService.map((sub: any) => {
                                  const isChecked = selectedPackageIds.has(String(sub.id));
                                  return (
                                    <button
                                      key={sub.id}
                                      type="button"
                                      onClick={() => handleToggleSubService(group.groupId, sub)}
                                      className={`text-xs px-2.5 py-1 rounded-md font-medium border flex items-center gap-1.5 transition-all ${
                                        isChecked
                                          ? "bg-[#ea580c] text-white border-orange-600 shadow-sm font-semibold"
                                          : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                                      }`}
                                    >
                                      {isChecked && <Check className="size-3 stroke-[3]" />}
                                      <span>{sub.name}</span>
                                      {sub.price != null && (
                                        <span className={`text-[10px] ${isChecked ? "text-white font-bold" : "text-zinc-400"}`}>
                                          (${sub.price})
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                              {head.legacy_combined && (
                                <p className="text-[10px] text-amber-700 mt-1">
                                  Legacy combined package row. Changing package selection will split into separate line items.
                                </p>
                              )}
                            </div>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-zinc-600">Selected Packages</Label>
                              <span className="text-[11px] font-semibold text-zinc-500">
                                Group subtotal: ${groupSubtotal.toFixed(2)}
                              </span>
                            </div>

                            {group.items.map((line) => {
                              const amount = line.is_free ? 0 : money2(Number(line.quantity) * Number(line.rate));
                              const title = line.package_name || line.service_type || "Custom package";
                              return (
                                <div
                                  key={line.id}
                                  className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-zinc-900 truncate">{title}</p>
                                      {line.package_name && line.service_type ? (
                                        <p className="text-[10px] text-zinc-500">{line.service_type}</p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePackageLine(line.id)}
                                      title="Remove package"
                                      className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>

                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <Label className="text-[11px] font-semibold text-zinc-600">Description *</Label>
                                      <span className="text-[10px] text-zinc-400">Editable per package</span>
                                    </div>
                                    <textarea
                                      rows={2}
                                      value={line.description}
                                      onChange={(e) => handlePackageFieldChange(line.id, "description", e.target.value)}
                                      required
                                      className="w-full p-2 rounded-md border border-zinc-200 text-xs text-zinc-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#ea580c]/20"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                                    <div>
                                      <Label className="text-[11px] font-semibold text-zinc-600">Quantity (Qty)</Label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={line.quantity}
                                        onChange={(e) =>
                                          handlePackageFieldChange(line.id, "quantity", Math.max(1, Number(e.target.value)))
                                        }
                                        required
                                        className="h-8 mt-1 text-center text-xs font-bold"
                                      />
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between">
                                        <Label className="text-[11px] font-semibold text-zinc-600">Rate / Price ($)</Label>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleFree(line.id)}
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                            line.is_free
                                              ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                                              : "bg-white text-zinc-600 border-zinc-300 hover:text-emerald-700"
                                          }`}
                                        >
                                          {line.is_free ? "✓ Free" : "Mark Free"}
                                        </button>
                                      </div>
                                      {line.is_free ? (
                                        <div className="h-8 mt-1 flex items-center justify-center bg-emerald-600 border border-emerald-700 text-white font-bold text-xs rounded-md shadow-sm">
                                          <Gift className="size-3.5 mr-1 text-white" /> Free
                                        </div>
                                      ) : (
                                        <Input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={line.rate}
                                          onChange={(e) => handlePackageFieldChange(line.id, "rate", Number(e.target.value))}
                                          required
                                          className="h-8 mt-1 text-right text-xs font-bold"
                                        />
                                      )}
                                    </div>

                                    <div>
                                      <Label className="text-[11px] font-semibold text-zinc-600">Amount</Label>
                                      <div className="h-8 mt-1 flex items-center justify-center font-bold text-xs rounded-md bg-white border border-zinc-200 text-zinc-800">
                                        {line.is_free ? (
                                          <span className="text-emerald-700 font-bold">Free</span>
                                        ) : (
                                          <span>${amount.toFixed(2)}</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex justify-end items-center">
                                      <span
                                        className={`text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm ${
                                          line.is_free
                                            ? "bg-emerald-600 text-white font-bold"
                                            : "bg-[#ea580c] text-white font-bold"
                                        }`}
                                      >
                                        {line.is_free ? "Complementary Item" : `$${amount.toFixed(2)}`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Payment Structure & Payment Method (Side-by-Side / Garab dhig) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                  {/* Left: Payment Structure & Notes */}
                  <div className="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <h4 className="font-bold text-xs text-[#6e0002] uppercase tracking-wider border-b pb-2">
                      Payment Structure & Notes
                    </h4>
                    <div>
                      <Label className="text-xs font-semibold text-zinc-600">Payment Structure (Advance)</Label>
                      <Input
                        value={paymentAdvance}
                        onChange={(e) => setPaymentAdvance(e.target.value)}
                        placeholder="e.g. 70% of charge paid in advance."
                        className="h-8 mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-zinc-600">Payment Structure (Completion)</Label>
                      <Input
                        value={paymentCompletion}
                        onChange={(e) => setPaymentCompletion(e.target.value)}
                        placeholder="e.g. 30% of charge paid after the project Completion"
                        className="h-8 mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-zinc-600">NB / Disclaimer</Label>
                      <Input
                        value={nbText}
                        onChange={(e) => setNbText(e.target.value)}
                        placeholder="e.g. NB: the advance amount should be paid when you get the invoice."
                        className="h-8 mt-1 text-xs"
                      />
                    </div>
                  </div>

                  {/* Right: Payment Method (Banks & Mobile Money) — Dynamic */}
                  <div className="space-y-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-bold text-xs text-[#ea580c] uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-[#ea580c]" /> Payment Method
                      </h4>
                      <button
                        type="button"
                        onClick={() => setPaymentMethods([...paymentMethods, { id: `pm-${Date.now()}`, label: "", value: "" }])}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#ea580c] hover:text-orange-700 transition-colors"
                      >
                        <Plus className="size-3" /> Add
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {paymentMethods.map((pm, pmIdx) => (
                        <div key={pm.id} className="relative group">
                          <Input
                            value={pm.label}
                            onChange={(e) => {
                              const updated = [...paymentMethods];
                              updated[pmIdx] = { ...updated[pmIdx], label: e.target.value };
                              setPaymentMethods(updated);
                            }}
                            placeholder="Bank / Mobile Name"
                            className="h-6 text-[11px] font-semibold text-[#6e0002] border-dashed border-zinc-300 bg-transparent px-1 focus:bg-white pr-6"
                          />
                          {paymentMethods.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== pmIdx))}
                              className="absolute top-0 right-0 p-0.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                          <Input
                            value={pm.value}
                            onChange={(e) => {
                              const updated = [...paymentMethods];
                              updated[pmIdx] = { ...updated[pmIdx], value: e.target.value };
                              setPaymentMethods(updated);
                            }}
                            placeholder="Account Number"
                            className="h-8 mt-1 text-xs font-medium"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Financial Summary (Moved Below / Hoos geey) */}
                <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm mt-3">
                  <div className="flex items-center justify-between border-b pb-2 mb-3">
                    <h4 className="font-bold text-xs text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="size-4 text-[#ea580c]" /> Financial Summary
                    </h4>
                    <label className="text-xs font-semibold text-zinc-700 flex items-center gap-2 cursor-pointer bg-zinc-50 px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={includeVat}
                        onChange={(e) => setIncludeVat(e.target.checked)}
                        className="size-3.5 rounded text-[#ea580c] focus:ring-[#ea580c]"
                      />
                      Apply VAT
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                    <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-100 flex justify-between items-center">
                      <span className="font-semibold text-xs text-zinc-600">Subtotal:</span>
                      <span className="font-bold text-base text-zinc-900">${totals.subtotal.toFixed(2)}</span>
                    </div>

                    <div className="bg-orange-50/70 p-3 rounded-lg border border-orange-100 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-zinc-700">VAT:</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            disabled={!includeVat}
                            value={vatPercent}
                            onChange={(e) => setVatPercent(Number(e.target.value))}
                            className="w-14 h-7 text-xs text-center font-bold px-1 disabled:opacity-50"
                          />
                          <span className="font-bold text-xs text-zinc-600">%</span>
                        </div>
                      </div>
                      <span className="font-bold text-base text-[#6e0002]">${includeVat ? totals.taxAmount.toFixed(2) : "0.00"}</span>
                    </div>

                    <div className="bg-[#ea580c] text-white p-3 rounded-lg font-bold flex justify-between items-center shadow-sm">
                      <span className="text-xs uppercase tracking-wide">Grand Total:</span>
                      <span className="text-lg font-extrabold">${totals.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 text-[11px] text-zinc-500 text-right">
                    * Subtotal ${totals.subtotal.toFixed(2)} + VAT {includeVat ? `${vatPercent}%` : "0%"} (${totals.taxAmount.toFixed(2)}) = ${totals.grandTotal.toFixed(2)}
                  </div>
                </div>
              </>
            ) : (
              /* Live Authentic A4 Template Preview with Dynamic Straight Service Rows */
              <div className="bg-zinc-100/70 p-4 rounded-xl flex flex-col items-center min-h-[500px]">
                <A4QuotationSheet
                  contactPerson={contactPerson}
                  quotationNo={quotationNo}
                  contactEmail={contactEmail}
                  quotationTo={quotationTo}
                  contactPhone={contactPhone}
                  date={formattedDisplayDate}
                  lines={lines}
                  subtotal={totals.subtotal}
                  vatPercent={includeVat ? vatPercent : 0}
                  taxAmount={totals.taxAmount}
                  grandTotal={totals.grandTotal}
                  paymentAdvance={paymentAdvance}
                  paymentCompletion={paymentCompletion}
                  nbText={nbText}
                  paymentMethods={paymentMethods}
                  brandPrimary={brandPrimary}
                  brandSecondary={brandSecondary}
                  brandLogo={brandLogo}
                  onBackToEdit={() => setActiveTab("form")}
                />
              </div>
            )}
          </div>

          <DialogFooter className={`${configDialogFooterClass} px-6 pt-5 pb-9 sm:pb-9 bg-zinc-50 border-t`}>
            <div className="flex justify-between items-center w-full">
              <div className="text-xs text-zinc-600 font-medium">
                Grand Total: <span className="font-extrabold text-[#ea580c] text-sm">${totals.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className={`${btnFormCancel} px-5 py-2.5 h-10 text-xs font-semibold`}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className={`${btnFormSubmit} bg-[#ea580c] hover:bg-orange-700 text-white font-bold px-7 py-2.5 h-10 text-xs shadow-md`}
                >
                  {loading ? "Saving..." : quotation ? "Update Quotation" : "Save Quotation"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
