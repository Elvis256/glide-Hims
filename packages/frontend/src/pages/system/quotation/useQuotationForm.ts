import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../../services/api';
import {
  MODULE_CATALOG, DEFAULT_PRICES, HARDWARE_IDS, ALL_MODULE_OPTIONS,
  PRESET_PACKAGES, formatMoney,
} from './quotation-constants';
import type { Quotation, QuotationRevision, CatalogItem } from '../saas/_shared';
import { unwrap } from '../saas/_shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteLine {
  id: string;
  moduleId: string;
  catalogItemId?: string;
  description: string;
  unitPrice: number;
  quantity: number;
  category: string;
}

export interface QuotationFormState {
  clientName: string;
  clientOrganization: string;
  clientEmail: string;
  clientPhone: string;
  clientCountry: string;
  currency: string;
  billingInterval: string;
  seats: number;
  includeVat: boolean;
  vatRatePercent: number;
  deductWht: boolean;
  whtRatePercent: number;
  discountPercent: number;
  discountFixedMinor: number;
  validUntil: string;
  notes: string;
  internalNotes: string;
  leadId: string;
  planId: string;
}

export interface CompanyInfo {
  legalName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
}

function createLine(): QuoteLine {
  return { id: crypto.randomUUID(), moduleId: '', description: '', unitPrice: 0, quantity: 1, category: 'module' };
}

function buildExpiryIso(days = 14) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuotationForm(id: string | undefined) {
  const navigate = useNavigate();
  const isNew = id === 'new';

  // Remote data
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [catalogPrices, setCatalogPrices] = useState<Record<string, number>>({});
  const [company, setCompany] = useState<CompanyInfo>({
    legalName: 'Your Company Name', address: '', phone: '', email: '', website: '', taxId: '',
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState<QuotationFormState>({
    clientName: '', clientOrganization: '', clientEmail: '', clientPhone: '', clientCountry: '',
    currency: 'UGX', billingInterval: 'monthly', seats: 1,
    includeVat: true, vatRatePercent: 18, deductWht: false, whtRatePercent: 6,
    discountPercent: 0, discountFixedMinor: 0,
    validUntil: buildExpiryIso(), notes: '', internalNotes: '', leadId: '', planId: '',
  });
  const [lines, setLines] = useState<QuoteLine[]>([createLine()]);
  const [includeTraining, setIncludeTraining] = useState(false);
  const [tab, setTab] = useState<'details' | 'revisions'>('details');

  // -----------------------------------------------------------------------
  // Loaders
  // -----------------------------------------------------------------------

  useEffect(() => {
    api.get('/saas-revenue/billing-settings').then((res) => {
      const d = res.data;
      if (d) {
        setCompany({
          legalName: d.legalName || d.companyName || 'Your Company Name',
          address: [d.addressLine1, d.addressLine2, d.city, d.country].filter(Boolean).join(', '),
          phone: d.phone || '', email: d.email || '', website: d.website || '', taxId: d.taxId || '',
        });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/saas-revenue/price-catalog').then((res) => {
      const items = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
      const priceMap: Record<string, number> = {};
      items.forEach((item: any) => {
        if (item.code && item.unitPrice != null) priceMap[item.code] = Number(item.unitPrice);
      });
      if (Object.keys(priceMap).length > 0) setCatalogPrices(priceMap);
    }).catch(() => {});
  }, []);

  const loadQuotation = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const r = await api.get(`/saas-revenue/quotations/${id}`);
      const q = unwrap<Quotation>(r);
      setQuotation(q);
      setForm({
        clientName: q.clientName,
        clientOrganization: q.clientOrganization || '',
        clientEmail: q.clientEmail || '',
        clientPhone: q.clientPhone || '',
        clientCountry: q.clientCountry || '',
        currency: q.currency,
        billingInterval: q.billingInterval,
        seats: q.seats,
        includeVat: q.includeVat,
        vatRatePercent: parseFloat(q.vatRatePercent as any) || 18,
        deductWht: q.deductWht,
        whtRatePercent: parseFloat(q.whtRatePercent as any) || 6,
        discountPercent: parseFloat(q.discountPercent as any) || 0,
        discountFixedMinor: q.discountFixedMinor,
        validUntil: q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : '',
        notes: q.notes || '',
        internalNotes: q.internalNotes || '',
        leadId: q.leadId || '',
        planId: q.planId || '',
      });
      const currentRev = q.revisions?.find((r) => r.revisionNumber === q.currentRevisionNumber);
      if (currentRev) {
        // Detect training line item
        const trainingIdx = currentRev.lineItems.findIndex(
          (l) => l.category === 'training' || l.description?.toLowerCase().includes('training fee'),
        );
        if (trainingIdx >= 0) setIncludeTraining(true);

        const editableItems = currentRev.lineItems
          .filter((_, i) => i !== trainingIdx || trainingIdx < 0)
          .map((l) => ({
            id: crypto.randomUUID(),
            catalogItemId: l.catalogItemId || undefined,
            moduleId: l.moduleId || '',
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPriceMinor,
            category: l.category,
          }));
        setLines(editableItems.length > 0 ? editableItems : [createLine()]);
      }
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { loadQuotation(); }, [loadQuotation]);

  // -----------------------------------------------------------------------
  // Price resolution
  // -----------------------------------------------------------------------

  const resolvePrice = useCallback(
    (moduleId: string) => catalogPrices[moduleId] ?? DEFAULT_PRICES[moduleId] ?? 0,
    [catalogPrices],
  );

  // -----------------------------------------------------------------------
  // Computed totals
  // -----------------------------------------------------------------------

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [lines],
  );
  const trainingAmount = useMemo(
    () => (includeTraining ? Math.round(subtotal * 0.15) : 0),
    [subtotal, includeTraining],
  );
  const baseSubtotal = subtotal + trainingAmount;

  const discountAmt = useMemo(
    () => Math.round(baseSubtotal * (form.discountPercent || 0) / 100) + (form.discountFixedMinor || 0),
    [baseSubtotal, form.discountPercent, form.discountFixedMinor],
  );
  const afterDiscount = baseSubtotal - discountAmt;
  const vatAmount = useMemo(
    () => (form.includeVat ? Math.round(afterDiscount * form.vatRatePercent / 100) : 0),
    [afterDiscount, form.includeVat, form.vatRatePercent],
  );
  const whtAmount = useMemo(
    () => (form.deductWht ? Math.round(afterDiscount * form.whtRatePercent / 100) : 0),
    [afterDiscount, form.deductWht, form.whtRatePercent],
  );
  const total = afterDiscount + vatAmount - whtAmount;

  const selectedModuleIds = useMemo(
    () => new Set(lines.map((l) => l.moduleId).filter(Boolean)),
    [lines],
  );

  // -----------------------------------------------------------------------
  // Hardware suggestions
  // -----------------------------------------------------------------------

  const hardwareSuggestions = useMemo(() => {
    const suggestions: Array<{ id: string; label: string; reason: string; price: number }> = [];
    if (selectedModuleIds.has('patients') && !selectedModuleIds.has('secugen_scanner')) {
      suggestions.push({ id: 'secugen_scanner', label: 'SecuGen Hamster Pro 20 Fingerprint Reader', reason: 'Required for biometric patient registration & duplicate detection.', price: 450000 });
    }
    if ((selectedModuleIds.has('billing') || selectedModuleIds.has('pharmacy') || selectedModuleIds.has('wholesale')) && !selectedModuleIds.has('thermal_printer')) {
      suggestions.push({ id: 'thermal_printer', label: '80mm Thermal Receipt Printer', reason: 'Required for printing payment receipts & POS sales.', price: 350000 });
    }
    if ((selectedModuleIds.has('billing') || selectedModuleIds.has('pharmacy') || selectedModuleIds.has('wholesale')) && !selectedModuleIds.has('barcode_scanner')) {
      suggestions.push({ id: 'barcode_scanner', label: 'USB Handheld Barcode Scanner', reason: 'Recommended for rapid drug dispensing & inventory stock-taking.', price: 150000 });
    }
    if (selectedModuleIds.has('lab') && !selectedModuleIds.has('label_printer')) {
      suggestions.push({ id: 'label_printer', label: 'Barcode Label Printer (Xprinter)', reason: 'Required for labeling laboratory tubes and blood samples.', price: 450000 });
    }
    return suggestions;
  }, [selectedModuleIds]);

  // -----------------------------------------------------------------------
  // Line-item mutations
  // -----------------------------------------------------------------------

  const updateLine = (lineId: string, patch: Partial<QuoteLine>) => {
    setLines((cur) => cur.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines((cur) => [...cur, createLine()]);

  const removeLine = (lineId: string) => setLines((cur) => cur.filter((l) => l.id !== lineId));

  const applyModuleToLine = (lineId: string, moduleId: string) => {
    const label = ALL_MODULE_OPTIONS.find((o) => o.id === moduleId)?.label || '';
    setLines((cur) => cur.map((l) => {
      if (l.id !== lineId) return l;
      return { ...l, moduleId, description: label || l.description, unitPrice: l.unitPrice || resolvePrice(moduleId), category: HARDWARE_IDS.has(moduleId) ? 'hardware' : 'module' };
    }));
  };

  const addQuotedModule = (moduleId: string) => {
    const isHardware = HARDWARE_IDS.has(moduleId);
    setLines((cur) => {
      const filtered = (cur.length === 1 && !cur[0].moduleId && !cur[0].description) ? [] : cur;
      const existingIdx = filtered.findIndex((l) => l.moduleId === moduleId);
      if (existingIdx > -1) {
        if (isHardware) {
          toast.success(`Incremented quantity for ${ALL_MODULE_OPTIONS.find((o) => o.id === moduleId)?.label}`);
          return filtered.map((l, i) => (i === existingIdx ? { ...l, quantity: l.quantity + 1 } : l));
        }
        toast.error('This module is already added to the quotation.');
        return filtered;
      }
      const label = ALL_MODULE_OPTIONS.find((o) => o.id === moduleId)?.label || '';
      toast.success(`Added ${label} to quotation`);
      return [...filtered, { ...createLine(), moduleId, description: label, unitPrice: resolvePrice(moduleId), quantity: 1, category: isHardware ? 'hardware' : 'module' }];
    });
  };

  const applyPresetPackage = (packType: keyof typeof PRESET_PACKAGES) => {
    const moduleIds = PRESET_PACKAGES[packType];
    const newLines = moduleIds.map((moduleId) => {
      const label = ALL_MODULE_OPTIONS.find((o) => o.id === moduleId)?.label || '';
      return { ...createLine(), moduleId, description: label, unitPrice: resolvePrice(moduleId), quantity: 1, category: 'module' as string };
    });
    setLines(newLines);
    toast.success(`${packType.charAt(0).toUpperCase() + packType.slice(1)} package presets loaded!`);
  };

  // -----------------------------------------------------------------------
  // Build payload for API (injects training line if toggled)
  // -----------------------------------------------------------------------

  const buildPayload = () => {
    const apiLines = lines.map((l) => ({
      catalogItemId: l.catalogItemId, moduleId: l.moduleId || undefined,
      description: l.description, quantity: l.quantity,
      unitPriceMinor: l.unitPrice, category: l.category || 'module',
    }));
    if (includeTraining) {
      apiLines.push({
        catalogItemId: undefined, moduleId: undefined,
        description: 'Implementation & Training Fee (15%)',
        quantity: 1, unitPriceMinor: Math.round(subtotal * 0.15),
        category: 'training',
      });
    }
    return { ...form, lineItems: apiLines };
  };

  // -----------------------------------------------------------------------
  // CRUD actions
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const r = await api.post('/saas-revenue/quotations', payload);
        const q = unwrap<Quotation>(r);
        toast.success('Quotation created');
        navigate(`/system/quotations/${q.id}`, { replace: true });
      } else {
        await api.put(`/saas-revenue/quotations/${id}`, payload);
        toast.success('Quotation updated');
        loadQuotation();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleAction = async (action: 'send' | 'accept' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this quotation?`)) return;
    setSaving(true);
    try {
      if (action === 'reject') {
        const reason = prompt('Rejection reason (optional):') || '';
        await api.post(`/saas-revenue/quotations/${id}/${action}`, { reason });
      } else {
        await api.post(`/saas-revenue/quotations/${id}/${action}`);
      }
      toast.success(`Quotation ${action === 'send' ? 'sent' : action === 'accept' ? 'accepted' : 'rejected'}`);
      loadQuotation();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action}`);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this quotation?')) return;
    await api.delete(`/saas-revenue/quotations/${id}`);
    toast.success('Quotation deleted');
    navigate('/system/quotations', { replace: true });
  };

  const handleNewRevision = async () => {
    const changeNotes = prompt('Change notes for new revision:') || '';
    setSaving(true);
    try {
      const payload = buildPayload();
      await api.post(`/saas-revenue/quotations/${id}/revisions`, {
        lineItems: payload.lineItems,
        changeNotes,
      });
      toast.success('New revision created');
      loadQuotation();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create revision');
    } finally { setSaving(false); }
  };

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const isDraft = !quotation || quotation.status === 'draft';
  const isEditable = isNew || isDraft;

  return {
    // State
    isNew, quotation, loading, saving, form, setForm, lines, tab, setTab,
    includeTraining, setIncludeTraining, company, catalogPrices,
    // Computed
    subtotal, trainingAmount, baseSubtotal, discountAmt, afterDiscount,
    vatAmount, whtAmount, total, selectedModuleIds, hardwareSuggestions,
    isDraft, isEditable,
    // Actions
    updateLine, addLine, removeLine, applyModuleToLine, addQuotedModule,
    applyPresetPackage, handleSave, handleAction, handleDelete, handleNewRevision,
    resolvePrice, formatMoney,
  };
}
