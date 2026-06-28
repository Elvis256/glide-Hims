import { MODULE_DETAILS, ALL_MODULE_OPTIONS, HARDWARE_IDS, formatMoney } from './quotation-constants';
import type { QuoteLine, CompanyInfo } from './useQuotationForm';

interface Props {
  company: CompanyInfo;
  clientName: string;
  clientOrganization: string;
  clientContact: string;
  quotationNumber: string;
  issueDate: string;
  validUntil: string;
  currency: string;
  billingInterval: string;
  seats: number;
  deploymentType: string;
  lines: QuoteLine[];
  notes: string;
  subtotal: number;
  trainingAmount: number;
  baseSubtotal: number;
  discountAmt: number;
  afterDiscount: number;
  discountPercent: number;
  discountFixedMinor: number;
  vatAmount: number;
  vatRatePercent: number;
  whtAmount: number;
  whtRatePercent: number;
  total: number;
  includeTraining: boolean;
  includeVat: boolean;
  deductWht: boolean;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

function discountLabel(pct: number, fixed: number, currency: string) {
  const parts: string[] = [];
  if (pct > 0) parts.push(`${pct}%`);
  if (fixed > 0) parts.push(formatMoney(fixed, currency));
  return parts.length > 0 ? `Discount (${parts.join(' + ')})` : 'Discount';
}

/* Reusable section header printed at the top of each major section */
function SectionHeader({ title, quotationNumber }: { title: string; quotationNumber: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
      <h3 className="text-base font-bold text-blue-900 uppercase tracking-wider">{title}</h3>
      <span className="text-xs text-slate-500">Quote Reference: {quotationNumber}</span>
    </div>
  );
}

export default function QuotationPrintProposal({
  company, clientName, clientOrganization, clientContact, quotationNumber, issueDate, validUntil,
  currency, billingInterval, seats, deploymentType, lines, notes,
  subtotal, trainingAmount, baseSubtotal, discountAmt, afterDiscount,
  discountPercent, discountFixedMinor, vatAmount, vatRatePercent, whtAmount, whtRatePercent, total,
  includeTraining, includeVat, deductWht,
}: Props) {
  const softwareLines = lines.filter((l) => !HARDWARE_IDS.has(l.moduleId));
  const hardwareLines = lines.filter((l) => HARDWARE_IDS.has(l.moduleId));
  const displayName = clientOrganization || clientName || 'Hospital Partner';
  const validDays = (() => {
    try {
      const diff = Math.ceil((new Date(validUntil).getTime() - new Date(issueDate).getTime()) / 86400000);
      return diff > 0 ? diff : 14;
    } catch { return 14; }
  })();
  const detailedModules = lines.filter((l) => l.moduleId && MODULE_DETAILS[l.moduleId]);

  return (
    <>
      <div className="hidden print:block print-proposal text-slate-900 bg-white font-sans max-w-[210mm] mx-auto p-10 leading-relaxed text-sm">

        {/* ================================================================ */}
        {/* PAGE 1: COVER LETTER (fixed full page)                          */}
        {/* ================================================================ */}
        <div className="print-page-cover min-h-[285mm] flex flex-col justify-between pb-8">
          <div>
            {/* Header bar */}
            <div className="flex items-start justify-between border-b-2 border-blue-900 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-12 h-12 text-blue-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="6" strokeWidth="2" />
                  <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-blue-900 uppercase">{company.legalName}</h1>
                  <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Healthcare Systems Division</p>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-600 leading-normal">
                <p className="font-bold text-slate-800">{company.legalName.toUpperCase()}</p>
                {company.address && <p>{company.address}</p>}
                {company.phone && <p>Tel: {company.phone}</p>}
                {company.email && <p>Email: {company.email}{company.website ? ` | Web: ${company.website}` : ''}</p>}
                {company.taxId && <p className="text-[10px] text-slate-400 mt-0.5">TIN: {company.taxId}</p>}
              </div>
            </div>

            {/* Proposal header box */}
            <div className="bg-slate-50 border-l-4 border-blue-900 p-6 rounded-r-lg mb-8">
              <span className="text-xs font-semibold tracking-wider text-blue-900 uppercase">Commercial Proposal & Bid</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">GLIDE-HIMS HOSPITAL MANAGEMENT INFORMATION SYSTEM</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4 text-xs">
                <div>
                  <span className="text-slate-500">Prepared For:</span>
                  <p className="font-bold text-slate-800 text-sm mt-0.5">{displayName}</p>
                  {clientOrganization && clientName && clientOrganization !== clientName && (
                    <p className="text-slate-600">Attn: {clientName}</p>
                  )}
                  <p className="text-slate-600">{clientContact || 'Administration Department'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Proposal Metadata:</span>
                  <p className="text-slate-700 mt-0.5"><span className="font-semibold">Quote Ref:</span> {quotationNumber}</p>
                  <p className="text-slate-700"><span className="font-semibold">Issue Date:</span> {fmtDate(issueDate)}</p>
                  <p className="text-slate-700"><span className="font-semibold">Valid Until:</span> {fmtDate(validUntil)}</p>
                  <p className="text-slate-700"><span className="font-semibold">Billing:</span> {billingInterval === 'annual' ? 'Annual' : 'Monthly'} &middot; {seats} seat{seats !== 1 ? 's' : ''}</p>
                  <p className="text-slate-700"><span className="font-semibold">Deployment:</span> {deploymentType === 'standalone' ? 'On-Premise' : 'Hybrid (Cloud + Local)'}</p>
                </div>
              </div>
            </div>

            {/* Cover letter body */}
            <div className="space-y-4 text-[13px] leading-relaxed text-slate-800">
              <p className="font-semibold">Dear Management Team,</p>
              <p>
                We are pleased to submit this proposal for the deployment of <strong>Glide-HIMS (Hospital Management Information System)</strong> at <strong>{displayName}</strong>.
                In Uganda's rapidly evolving healthcare ecosystem, operational efficiency, financial transparency, and precise clinical records are paramount to achieving outstanding patient outcomes and ensuring institutional sustainability.
              </p>
              <p>
                Glide-HIMS is an enterprise-grade solution built by <strong>{company.legalName}</strong> specifically to meet the clinical and administrative needs of local and regional medical facilities.
                Our solution is offline-resilient, meaning that your doctors, pharmacies, and billing desks continue to operate seamlessly even during internet outages, synchronizing immediately when connectivity is restored.
              </p>
              <p>Furthermore, Glide-HIMS is fully integrated with Ugandan statutory systems:</p>
              <ul className="list-disc pl-5 space-y-1.5 font-medium text-slate-700">
                <li><strong className="text-blue-900">URA EFRIS Compliance:</strong> Automatically generates e-invoices and fiscal receipt values to comply with local tax laws.</li>
                <li><strong className="text-blue-900">DHIS2 MoH Integration:</strong> Outputs weekly HMIS 105 and monthly HMIS 108 report sheets directly for submission to the Ministry of Health.</li>
                <li><strong className="text-blue-900">Patient Biometric Registry:</strong> Integrates with national ID databases or direct fingerprint validation to eliminate duplicates and secure clinical files.</li>
              </ul>

              {/* Scope overview */}
              <div className="bg-blue-50/80 border border-blue-100 rounded-lg p-4 mt-2">
                <p className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Proposal Scope Overview</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-extrabold text-blue-900">{softwareLines.length}</p>
                    <p className="text-[11px] text-slate-600">Software Modules</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-blue-900">{hardwareLines.length}</p>
                    <p className="text-[11px] text-slate-600">Hardware Items</p>
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-blue-900">{formatMoney(total, currency)}</p>
                    <p className="text-[11px] text-slate-600">Total Investment</p>
                  </div>
                </div>
              </div>

              <p>We look forward to partnering with your institution to transform your clinical operations and establish a secure digital record system.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end border-t border-slate-100 pt-6 mt-auto">
            <div>
              <p className="text-xs text-slate-500">Prepared by:</p>
              <p className="font-semibold text-slate-800">{company.legalName}</p>
              <p className="text-xs text-slate-500 font-mono">
                {company.email}{company.phone ? ` · ${company.phone}` : ''}
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-400">Cover Letter</div>
          </div>
        </div>

        <div className="page-break" />

        {/* ================================================================ */}
        {/* SECTION A: FINANCIAL QUOTE (flows across pages naturally)        */}
        {/* ================================================================ */}
        <div className="pb-8 pt-4">
          <SectionHeader title="Section A: Scope of Modules & Financial Quote" quotationNumber={quotationNumber} />

          <p className="text-xs text-slate-600 mb-4 leading-normal">
            Below is the comprehensive list of licensing, system modules, integrations, and hardware requested for implementation.
          </p>

          {/* Software modules table */}
          {softwareLines.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Software Modules & Integrations</p>
              <table className="w-full text-left border-collapse text-xs mb-4">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-100 text-slate-700">
                    <th className="py-2 px-2 font-semibold w-8 text-center">#</th>
                    <th className="py-2 px-3 font-semibold">Module / Item & Description</th>
                    <th className="py-2 px-2 font-semibold text-center w-12">Qty</th>
                    <th className="py-2 px-3 font-semibold text-right w-28">Unit Price</th>
                    <th className="py-2 px-3 font-semibold text-right w-32">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {softwareLines.map((line, i) => (
                    <tr key={line.id} className="border-b border-slate-200">
                      <td className="py-2.5 px-2 text-center text-slate-400 text-[10px]">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">{line.moduleId ? ALL_MODULE_OPTIONS.find((o) => o.id === line.moduleId)?.label : 'Custom Service'}</p>
                        {line.description && line.description !== (ALL_MODULE_OPTIONS.find((o) => o.id === line.moduleId)?.label || '') && (
                          <p className="text-slate-500 mt-0.5 text-[10px] whitespace-pre-line leading-relaxed">{line.description}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-800">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-800">{formatMoney(line.unitPrice, currency)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatMoney(line.quantity * line.unitPrice, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Hardware table */}
          {hardwareLines.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 mt-4">Recommended Hardware & Peripherals</p>
              <table className="w-full text-left border-collapse text-xs mb-4">
                <thead>
                  <tr className="border-b-2 border-amber-300 bg-amber-50 text-slate-700">
                    <th className="py-2 px-2 font-semibold w-8 text-center">#</th>
                    <th className="py-2 px-3 font-semibold">Hardware Item</th>
                    <th className="py-2 px-2 font-semibold text-center w-12">Qty</th>
                    <th className="py-2 px-3 font-semibold text-right w-28">Unit Price</th>
                    <th className="py-2 px-3 font-semibold text-right w-32">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {hardwareLines.map((line, i) => (
                    <tr key={line.id} className="border-b border-slate-200">
                      <td className="py-2.5 px-2 text-center text-slate-400 text-[10px]">{i + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">{ALL_MODULE_OPTIONS.find((o) => o.id === line.moduleId)?.label || line.description}</p>
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-800">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right text-slate-800">{formatMoney(line.unitPrice, currency)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatMoney(line.quantity * line.unitPrice, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Financial summary box — avoid page break inside */}
          <div className="mt-6 flex justify-end page-break-inside-avoid">
            <div className="w-[340px] border border-slate-300 rounded-lg overflow-hidden text-xs">
              <div className="bg-slate-800 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest">Financial Summary</div>
              <div className="p-4 space-y-2 text-slate-700 bg-slate-50">
                <div className="flex justify-between">
                  <span className="text-slate-500">Modules Subtotal:</span>
                  <span className="font-semibold">{formatMoney(subtotal, currency)}</span>
                </div>
                {includeTraining && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Implementation & Training (15%):</span>
                      <span className="font-semibold">{formatMoney(trainingAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 font-medium">
                      <span className="text-slate-800">Base Subtotal:</span>
                      <span className="font-semibold text-slate-900">{formatMoney(baseSubtotal, currency)}</span>
                    </div>
                  </>
                )}
                {discountAmt > 0 && (
                  <>
                    <div className="flex justify-between text-red-700 border-t border-dashed border-slate-200 pt-1.5">
                      <span>Less: {discountLabel(discountPercent, discountFixedMinor, currency)}</span>
                      <span className="font-semibold">-{formatMoney(discountAmt, currency)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-800">After Discount:</span>
                      <span className="font-semibold text-slate-900">{formatMoney(afterDiscount, currency)}</span>
                    </div>
                  </>
                )}
                {includeVat && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">VAT ({vatRatePercent}%):</span>
                    <span className="font-semibold">{formatMoney(vatAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-slate-300 pt-2.5 text-sm font-extrabold text-slate-900">
                  <span>Gross Proposal Total:</span>
                  <span>{formatMoney(afterDiscount + vatAmount, currency)}</span>
                </div>
                {deductWht && (
                  <>
                    <div className="flex justify-between text-rose-700 pt-1 border-t border-dashed border-slate-300">
                      <span>Less: {whtRatePercent}% WHT Deduction:</span>
                      <span className="font-semibold">-{formatMoney(whtAmount, currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold text-emerald-800 pt-2 border-t-2 border-emerald-400">
                      <span>Net Payable Amount:</span>
                      <span>{formatMoney(total, currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {notes && (
            <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50 page-break-inside-avoid">
              <h4 className="text-xs font-bold text-slate-800 mb-1">Additional Project Notes & Custom Instructions:</h4>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{notes}</p>
            </div>
          )}

          <div className="flex justify-between items-end border-t border-slate-100 pt-6 mt-8">
            <p className="text-[10px] text-slate-400">All prices are in {currency}. Exclusive of external network provider fees unless stated otherwise.</p>
            <div className="text-right text-[11px] text-slate-400">Section A: Financial Proposal</div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SECTION B: MODULE CAPABILITIES (flows across as many pages)      */}
        {/* ================================================================ */}
        {detailedModules.length > 0 && (
          <>
            <div className="page-break" />
            <div className="pb-8 pt-4">
              <SectionHeader title="Section B: System Modules Functionality & Business Impact" quotationNumber={quotationNumber} />
              <p className="text-xs text-slate-600 mb-6 leading-normal">
                The following sections outline the detailed capabilities and anticipated business value for each of the {detailedModules.length} selected system modules:
              </p>
              <div className="space-y-6">
                {detailedModules.map((line) => {
                  const detail = MODULE_DETAILS[line.moduleId];
                  return (
                    <div key={line.id} className="border-b border-slate-100 pb-5 last:border-0 page-break-inside-avoid">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-900" />
                        {detail.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{detail.desc}</p>
                      <div className="mt-2.5 grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Key Features & Scope:</span>
                          <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px] mt-1">
                            {detail.capabilities.map((cap, i) => <li key={i}>{cap}</li>)}
                          </ul>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/50 rounded-lg p-3">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Anticipated Business Impact:</span>
                          <p className="text-slate-700 italic text-[11px] leading-relaxed mt-1">{detail.impact}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-end border-t border-slate-100 pt-6 mt-8">
                <p className="text-[10px] text-slate-400 font-semibold">Glide-HIMS Functional Scope Specification</p>
                <div className="text-right text-[11px] text-slate-400">Section B: Module Functional Scope</div>
              </div>
            </div>
          </>
        )}

        <div className="page-break" />

        {/* ================================================================ */}
        {/* SECTION C: TERMS & SIGN-OFF (flows naturally)                   */}
        {/* ================================================================ */}
        <div className="pb-8 pt-4">
          <SectionHeader title="Section C: Implementation Milestones & Terms" quotationNumber={quotationNumber} />

          <div className="grid grid-cols-2 gap-8 text-xs text-slate-700">
            <div className="space-y-4">
              <div className="page-break-inside-avoid">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">1. Deployment Milestones</h4>
                <ul className="space-y-2.5 list-none pl-0">
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 bg-blue-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-semibold text-slate-800">Initial Setup & Base System (50%)</p>
                      <p className="text-slate-500 mt-0.5">Database setup, server configuration, and baseline module deployment within 7 days of deposit.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 bg-blue-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-semibold text-slate-800">Customization & User Training (30%)</p>
                      <p className="text-slate-500 mt-0.5">Departmental workflow customization, template styling, and intensive training for staff.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 bg-blue-900 text-white rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</span>
                    <div>
                      <p className="font-semibold text-slate-800">Go-Live & Support Handover (20%)</p>
                      <p className="text-slate-500 mt-0.5">Final data migration validation, on-site launch assistance, and official project handover.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="page-break-inside-avoid">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">2. SLA & Maintenance Agreement</h4>
                <p className="leading-relaxed text-slate-600">
                  {company.legalName} provides <strong>90 days of complimentary support</strong> post-deployment.
                  Thereafter, a Service Level Agreement (SLA) contract will take effect at <strong>15% of the total software licensing value annually</strong>, billed quarterly.
                  The SLA covers routine security updates, remote support, database checkups, and statutory compliance changes.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="page-break-inside-avoid">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">3. Invoicing & Inbound Payments</h4>
                <p className="leading-relaxed text-slate-600">
                  Milestone invoicing terms apply. Standard pro-forma and commercial invoices will be generated at each phase.
                  Official bank transfer details (Stanbic Bank Uganda) and Mobile Money billing collection codes will be provided directly on the invoice documents at the time of billing.
                  Deployments and licenses provisioning are triggered upon receipt of payments.
                </p>
              </div>
              <div className="page-break-inside-avoid">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">4. Additional Terms</h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>This quote is valid for exactly <strong>{validDays} calendar days</strong> from the date of issue.</li>
                  <li>Delivery timeline is 4-6 weeks from initial 50% payment clearance.</li>
                  <li>Hardware components carry a 12-month manufacturer warranty.</li>
                  <li>All software licensing is billed <strong>{billingInterval === 'annual' ? 'annually' : 'monthly'}</strong> per the selected billing interval.</li>
                  <li>License covers up to <strong>{seats} concurrent user seat{seats !== 1 ? 's' : ''}</strong>. Additional seats may be purchased separately.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Dual signature block — avoid page break inside */}
          <div className="mt-12 page-break-inside-avoid">
            <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-6 text-xs uppercase tracking-wider text-center">Acceptance & Authorization</h4>
            <div className="grid grid-cols-2 gap-12 text-xs mt-4">
              <div className="border border-slate-200 rounded-lg p-4 space-y-3.5 relative min-h-[140px] flex flex-col justify-between">
                <span className="absolute top-2 right-2 text-[10px] font-bold text-blue-900 tracking-wider bg-blue-50 px-2 py-0.5 rounded">PROVIDER</span>
                <div className="space-y-1">
                  <p className="text-slate-500">For and on behalf of:</p>
                  <p className="font-bold text-slate-800">{company.legalName}</p>
                  {company.taxId && <p className="text-[10px] text-slate-400">TIN: {company.taxId}</p>}
                </div>
                <div className="border-t border-dashed border-slate-300 pt-2 mt-4 space-y-1.5">
                  <p className="text-slate-500 font-mono text-[10px]">Authorized Signature & Stamp</p>
                  <div className="h-6" />
                  <div className="flex justify-between text-[11px] text-slate-600 border-t border-slate-100 pt-1">
                    <span>Name: ________________</span>
                    <span>Date: ________________</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 space-y-3.5 relative min-h-[140px] flex flex-col justify-between">
                <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-800 tracking-wider bg-emerald-50 px-2 py-0.5 rounded">CLIENT ACCEPTANCE</span>
                <div className="space-y-1">
                  <p className="text-slate-500">For and on behalf of:</p>
                  <p className="font-bold text-slate-800">{displayName}</p>
                </div>
                <div className="border-t border-dashed border-slate-300 pt-2 mt-4 space-y-1.5">
                  <p className="text-slate-500 font-mono text-[10px]">Authorized Signature & Stamp</p>
                  <div className="h-6" />
                  <div className="flex justify-between text-[11px] text-slate-600 border-t border-slate-100 pt-1">
                    <span>Name: ________________</span>
                    <span>Date: ________________</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-slate-100 pt-6 mt-8">
            <p className="text-[10px] text-slate-400">Glide-HIMS is a registered product of {company.legalName}.</p>
            <div className="text-right text-[11px] text-slate-400 font-semibold">Section C: Implementation & Terms</div>
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media screen {
          .print-proposal { display: none !important; }
        }
        @media print {
          .print\\:hidden { display: none !important; }
          .print-proposal { display: block !important; }
          body {
            background: white !important;
            color: #111827 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page { size: A4 portrait; margin: 15mm; }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
            height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>
    </>
  );
}
