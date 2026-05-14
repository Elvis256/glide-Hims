import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  Download,
  Printer,
  Loader2,
  AlertCircle,
  Activity,
  Baby,
  Heart,
  Pill,
  FlaskConical,
  Users,
  UserPlus,
  UserCheck,
  BedDouble,
  LogOut,
  Skull,
  ExternalLink,
  ArrowUpCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { printService } from '../../lib/print';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiagnosisChapter {
  chapter: string;
  chapterName: string;
  male_0_28d: number; female_0_28d: number;
  male_29d_4y: number; female_29d_4y: number;
  male_5_12y: number; female_5_12y: number;
  male_13_19y: number; female_13_19y: number;
  male_20_59y: number; female_20_59y: number;
  male_60plus: number; female_60plus: number;
  total: number;
}

interface TopDiagnosis {
  code: string; name: string; count: number; percentage: number;
}

interface LabCategory {
  category: string; totalTests: number; positiveOrAbnormal: number;
}

interface TopMedicine {
  name: string; quantity: number; unit: string;
}

interface HMIS105Data {
  facilityName: string;
  reportMonth: string;
  sections: {
    opdDiagnoses: {
      byChapter: DiagnosisChapter[];
      topDiagnoses: TopDiagnosis[];
      totalOPDCases: number;
    };
    laboratory: {
      byCategory: LabCategory[];
      totalTests: number;
    };
    pharmacy: {
      topMedicines: TopMedicine[];
      totalPrescriptions: number;
      stockOutDays: number;
    };
    maternalHealth: {
      ancFirstVisits: number; ancReturnVisits: number;
      normalDeliveries: number; caesareanDeliveries: number;
      liveBirths: number; stillBirths: number;
      maternalDeaths: number;
    };
    summary: {
      totalOPDAttendance: number; newPatients: number; returnPatients: number;
      totalAdmissions: number; totalDischarges: number;
      totalDeaths: number; referralsOut: number;
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function sumChapterRow(row: DiagnosisChapter): number {
  return (
    row.male_0_28d + row.female_0_28d +
    row.male_29d_4y + row.female_29d_4y +
    row.male_5_12y + row.female_5_12y +
    row.male_13_19y + row.female_13_19y +
    row.male_20_59y + row.female_20_59y +
    row.male_60plus + row.female_60plus
  );
}

function totalColumn(chapters: DiagnosisChapter[], key: keyof DiagnosisChapter): number {
  return chapters.reduce((sum, c) => sum + (Number(c[key]) || 0), 0);
}

// ---------------------------------------------------------------------------
// Backend → Frontend normalizer
// ---------------------------------------------------------------------------
//
// The /analytics/hmis-105 endpoint returns a flat sectionA..sectionE shape
// that does not match the nested `sections.opdDiagnoses / laboratory /
// pharmacy / maternalHealth / summary` shape the page was built around.
// This adapter bridges the two so the page renders without crashing while
// the BE response is still also useful as-is for the DHIS2 push integration.

const ICD10_CHAPTER_NAMES: Record<string, string> = {
  A: 'A — Certain infectious & parasitic diseases',
  B: 'B — Certain infectious & parasitic diseases',
  C: 'C — Neoplasms',
  D: 'D — Diseases of the blood / immune system',
  E: 'E — Endocrine, nutritional & metabolic',
  F: 'F — Mental & behavioural disorders',
  G: 'G — Diseases of the nervous system',
  H: 'H — Eye, ear & adnexa',
  I: 'I — Diseases of the circulatory system',
  J: 'J — Diseases of the respiratory system',
  K: 'K — Diseases of the digestive system',
  L: 'L — Diseases of the skin & subcutaneous tissue',
  M: 'M — Diseases of the musculoskeletal system',
  N: 'N — Diseases of the genitourinary system',
  O: 'O — Pregnancy, childbirth & puerperium',
  P: 'P — Conditions originating in the perinatal period',
  Q: 'Q — Congenital malformations',
  R: 'R — Symptoms, signs & abnormal findings',
  S: 'S — Injury, poisoning, external causes',
  T: 'T — Injury, poisoning, external causes',
  V: 'V — External causes of morbidity',
  W: 'W — External causes of morbidity',
  X: 'X — External causes of morbidity',
  Y: 'Y — External causes of morbidity',
  Z: 'Z — Factors influencing health status',
  '?': '? — Unclassified',
};

interface BackendChapter {
  chapter: string;
  totalCount: number;
  ageSexBreakdown?: Record<string, { M?: number; F?: number }>;
}

function flattenChapter(c: BackendChapter): DiagnosisChapter {
  const ab = c.ageSexBreakdown || {};
  const get = (band: string, sex: 'M' | 'F') => Number(ab[band]?.[sex] || 0);
  return {
    chapter: c.chapter,
    chapterName: ICD10_CHAPTER_NAMES[c.chapter] || c.chapter,
    male_0_28d: get('0-28d', 'M'),
    female_0_28d: get('0-28d', 'F'),
    male_29d_4y: get('29d-4y', 'M'),
    female_29d_4y: get('29d-4y', 'F'),
    male_5_12y: get('5-12y', 'M'),
    female_5_12y: get('5-12y', 'F'),
    male_13_19y: get('13-19y', 'M'),
    female_13_19y: get('13-19y', 'F'),
    male_20_59y: get('20-59y', 'M'),
    female_20_59y: get('20-59y', 'F'),
    male_60plus: get('60+', 'M'),
    female_60plus: get('60+', 'F'),
    total: Number(c.totalCount || 0),
  };
}

function normalizeHmis105(raw: any, month: number, year: number): HMIS105Data {
  // Already in FE shape (forward-compatible if BE is changed later)
  if (raw && raw.sections && raw.sections.opdDiagnoses) {
    return raw as HMIS105Data;
  }

  const sectionA = raw?.sectionA || {};
  const sectionB = raw?.sectionB || {};
  const sectionC = raw?.sectionC || {};
  const sectionD = raw?.sectionD || {};
  const sectionE = raw?.sectionE || {};

  const byChapter: DiagnosisChapter[] = Array.isArray(sectionA.diagnosisByChapter)
    ? sectionA.diagnosisByChapter.map(flattenChapter)
    : [];
  const totalOPDCases = byChapter.reduce((s, c) => s + c.total, 0);

  const topDiagnoses: TopDiagnosis[] = Array.isArray(sectionA.top20Diagnoses)
    ? sectionA.top20Diagnoses.map((d: any) => ({
        code: d.code || '',
        name: d.diagnosis || d.name || d.code || 'Unknown',
        count: Number(d.totalCount || d.count || 0),
        percentage:
          totalOPDCases > 0
            ? Number(((Number(d.totalCount || d.count || 0) / totalOPDCases) * 100).toFixed(1))
            : 0,
      }))
    : [];

  const labByCategory: LabCategory[] = Array.isArray(sectionB.byCategory)
    ? sectionB.byCategory.map((c: any) => ({
        category: c.category || 'Uncategorised',
        totalTests: Number(c.totalResults ?? c.totalSamples ?? 0),
        positiveOrAbnormal: Number(c.positiveAbnormal ?? 0),
      }))
    : [];

  const topMedicines: TopMedicine[] = Array.isArray(sectionC.top20Medicines)
    ? sectionC.top20Medicines.map((m: any) => ({
        name: m.drugName || m.name || m.drugCode || 'Unknown',
        quantity: Number(m.totalDispensed ?? m.quantity ?? 0),
        unit: m.unit || '',
      }))
    : [];
  const stockOutDays = Array.isArray(sectionC.stockOutItems)
    ? sectionC.stockOutItems.reduce((s: number, x: any) => s + Number(x.stockoutDays || 0), 0)
    : 0;

  const deliveries = sectionD.deliveries || {};
  const birth = sectionD.birthOutcomes || {};

  const facilityNameRaw = raw?.facilityName || (typeof raw?.facility === 'string' ? '' : raw?.facility?.name) || '';

  return {
    facilityName: facilityNameRaw || 'This Facility',
    reportMonth: `${MONTHS[Math.max(0, Math.min(11, month - 1))]} ${year}`,
    sections: {
      opdDiagnoses: { byChapter, topDiagnoses, totalOPDCases },
      laboratory: {
        byCategory: labByCategory,
        totalTests: Number(sectionB.totalResults ?? sectionB.totalSamples ?? 0),
      },
      pharmacy: {
        topMedicines,
        totalPrescriptions: Number(sectionC.prescriptionsFilled ?? sectionC.prescriptionsTotal ?? 0),
        stockOutDays,
      },
      maternalHealth: {
        ancFirstVisits: Number(sectionD.ancFirstVisits || 0),
        ancReturnVisits: Number(sectionD.ancReturnVisits || 0),
        normalDeliveries: Number(deliveries.svd || 0) + Number(deliveries.assisted || 0),
        caesareanDeliveries: Number(deliveries.caesarean || 0),
        liveBirths: Number(birth.live_birth || 0),
        stillBirths: Number(birth.stillbirth || 0),
        maternalDeaths: 0, // not surfaced by the backend response yet
      },
      summary: {
        totalOPDAttendance: Number(sectionE.totalOPDAttendance || 0),
        newPatients: Number(sectionE.newVisits || 0),
        returnPatients: Number(sectionE.returnVisits || 0),
        totalAdmissions: Number(sectionE.totalAdmissions || 0),
        totalDischarges: Number(sectionE.totalDischarges || 0),
        totalDeaths: Number(sectionE.deaths || 0),
        referralsOut: Number(sectionE.referralsOut || 0),
      },
    },
  };
}

/** Build a DHIS2-compatible CSV export. */
function buildDHIS2Csv(data: HMIS105Data, orgUnit: string, period: string): string {
  const lines: string[] = ['dataElement,period,orgUnit,value'];

  const { sections } = data;
  // OPD diagnoses by chapter age/sex
  for (const ch of sections.opdDiagnoses.byChapter) {
    const prefix = `OPD_${ch.chapter.replace(/[^A-Z0-9]/gi, '_')}`;
    lines.push(`${prefix}_MALE_0_28D,${period},${orgUnit},${ch.male_0_28d}`);
    lines.push(`${prefix}_FEMALE_0_28D,${period},${orgUnit},${ch.female_0_28d}`);
    lines.push(`${prefix}_MALE_29D_4Y,${period},${orgUnit},${ch.male_29d_4y}`);
    lines.push(`${prefix}_FEMALE_29D_4Y,${period},${orgUnit},${ch.female_29d_4y}`);
    lines.push(`${prefix}_MALE_5_12Y,${period},${orgUnit},${ch.male_5_12y}`);
    lines.push(`${prefix}_FEMALE_5_12Y,${period},${orgUnit},${ch.female_5_12y}`);
    lines.push(`${prefix}_MALE_13_19Y,${period},${orgUnit},${ch.male_13_19y}`);
    lines.push(`${prefix}_FEMALE_13_19Y,${period},${orgUnit},${ch.female_13_19y}`);
    lines.push(`${prefix}_MALE_20_59Y,${period},${orgUnit},${ch.male_20_59y}`);
    lines.push(`${prefix}_FEMALE_20_59Y,${period},${orgUnit},${ch.female_20_59y}`);
    lines.push(`${prefix}_MALE_60PLUS,${period},${orgUnit},${ch.male_60plus}`);
    lines.push(`${prefix}_FEMALE_60PLUS,${period},${orgUnit},${ch.female_60plus}`);
  }

  // Lab
  for (const cat of sections.laboratory.byCategory) {
    const key = cat.category.replace(/[^A-Z0-9]/gi, '_').toUpperCase();
    lines.push(`LAB_${key}_TESTS,${period},${orgUnit},${cat.totalTests}`);
    lines.push(`LAB_${key}_POSITIVE,${period},${orgUnit},${cat.positiveOrAbnormal}`);
  }

  // Pharmacy
  lines.push(`PHARMACY_TOTAL_PRESCRIPTIONS,${period},${orgUnit},${sections.pharmacy.totalPrescriptions}`);
  lines.push(`PHARMACY_STOCKOUT_DAYS,${period},${orgUnit},${sections.pharmacy.stockOutDays}`);

  // Maternal
  const mh = sections.maternalHealth;
  lines.push(`MCH_ANC_FIRST_VISIT,${period},${orgUnit},${mh.ancFirstVisits}`);
  lines.push(`MCH_ANC_RETURN_VISIT,${period},${orgUnit},${mh.ancReturnVisits}`);
  lines.push(`MCH_NORMAL_DELIVERIES,${period},${orgUnit},${mh.normalDeliveries}`);
  lines.push(`MCH_CAESAREAN_DELIVERIES,${period},${orgUnit},${mh.caesareanDeliveries}`);
  lines.push(`MCH_LIVE_BIRTHS,${period},${orgUnit},${mh.liveBirths}`);
  lines.push(`MCH_STILL_BIRTHS,${period},${orgUnit},${mh.stillBirths}`);
  lines.push(`MCH_MATERNAL_DEATHS,${period},${orgUnit},${mh.maternalDeaths}`);

  // Summary
  const s = sections.summary;
  lines.push(`OPD_NEW_ATTENDANCE,${period},${orgUnit},${s.newPatients}`);
  lines.push(`OPD_RETURN_ATTENDANCE,${period},${orgUnit},${s.returnPatients}`);
  lines.push(`OPD_TOTAL_ATTENDANCE,${period},${orgUnit},${s.totalOPDAttendance}`);
  lines.push(`IPD_ADMISSIONS,${period},${orgUnit},${s.totalAdmissions}`);
  lines.push(`IPD_DISCHARGES,${period},${orgUnit},${s.totalDischarges}`);
  lines.push(`DEATHS_TOTAL,${period},${orgUnit},${s.totalDeaths}`);
  lines.push(`REFERRALS_OUT,${period},${orgUnit},${s.referralsOut}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HMIS105ReportPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [enabled, setEnabled] = useState(false);
  const facilityId = useFacilityId();

  const { data, isLoading, error, refetch } = useQuery<HMIS105Data>({
    queryKey: ['hmis-105', month, year, facilityId],
    queryFn: async () => {
      const res = await api.get('/analytics/hmis-105', {
        params: { month, year, facilityId },
      });
      return normalizeHmis105(res.data, month, year);
    },
    enabled,
  });

  const handleGenerate = () => {
    setEnabled(true);
    if (enabled) refetch();
  };

  const handleExportCsv = () => {
    if (!data) return;
    const period = `${year}${String(month).padStart(2, '0')}`;
    const csv = buildDHIS2Csv(data, facilityId, period);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HMIS105_${data.facilityName.replace(/\s+/g, '_')}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const el = document.getElementById('hmis105-report-content');
    if (!el) return;
    printService.printDocument(el.innerHTML, {
      title: `HMIS 105 — ${data?.reportMonth ?? ''}`,
    });
  };

  // DHIS2 push integration
  const { data: dhis2Config } = useQuery({
    queryKey: ['dhis2-config-check'],
    queryFn: async () => {
      try {
        const res = await api.get('/integrations/dhis2/config');
        return res.data as { enabled: boolean; orgUnitId: string };
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const dhis2PushMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/integrations/dhis2/push-hmis105', { month, year, facilityId });
      return res.data;
    },
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success(`DHIS2 push complete — Imported: ${result.imported}, Updated: ${result.updated}`);
      } else {
        toast.error(`DHIS2 push had issues: ${result.conflicts?.[0] || 'Unknown error'}`);
      }
    },
    onError: () => toast.error('Failed to push data to DHIS2'),
  });

  const dhis2Ready = dhis2Config?.enabled && dhis2Config?.orgUnitId;

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        to="/reports"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Reports Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HMIS 105 — Monthly OPD Summary</h1>
          <p className="text-gray-600">Uganda standard monthly outpatient department report</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data && (
            <>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              {dhis2Ready && (
                <button
                  onClick={() => dhis2PushMutation.mutate()}
                  disabled={dhis2PushMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {dhis2PushMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4" />
                  )}
                  Push to DHIS2
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <div className="flex items-center gap-2">
            <label htmlFor="hmis-month" className="text-sm font-medium text-gray-700">
              Month:
            </label>
            <select
              id="hmis-month"
              value={month}
              onChange={(e) => { setMonth(Number(e.target.value)); setEnabled(false); }}
              className="rounded-lg border-gray-300 shadow-sm text-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="hmis-year" className="text-sm font-medium text-gray-700">
              Year:
            </label>
            <input
              id="hmis-year"
              type="number"
              min={2020}
              max={2099}
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setEnabled(false); }}
              className="w-24 rounded-lg border-gray-300 shadow-sm text-sm px-3 py-2 border focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Generate Report
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">Generating HMIS 105 report…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-red-800">Failed to generate report</h3>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-sm font-medium text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Report Content */}
      {data && !isLoading && (
        <div id="hmis105-report-content" className="space-y-8">
          {/* Report Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-lg font-bold text-gray-900">{data.facilityName}</h2>
            <p className="text-sm text-gray-600">
              HMIS 105 — Monthly OPD Summary for <span className="font-semibold">{data.reportMonth}</span>
            </p>
          </div>

          {/* Section A: OPD Diagnoses */}
          <SectionOPDDiagnoses diagnoses={data.sections.opdDiagnoses} />

          {/* Section B: Laboratory */}
          <SectionLaboratory lab={data.sections.laboratory} />

          {/* Section C: Pharmacy */}
          <SectionPharmacy pharmacy={data.sections.pharmacy} />

          {/* Section D: Maternal Health */}
          <SectionMaternalHealth maternal={data.sections.maternalHealth} />

          {/* Section E: Summary Statistics */}
          <SectionSummary summary={data.sections.summary} />
        </div>
      )}

      {/* Empty state */}
      {!data && !isLoading && !error && (
        <div className="text-center py-16 text-gray-400">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a month and year, then click <strong>Generate Report</strong>.</p>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Section Components
// ===========================================================================

// ---------- A: OPD Diagnoses ----------

function SectionOPDDiagnoses({ diagnoses }: { diagnoses: HMIS105Data['sections']['opdDiagnoses'] }) {
  const chapters = diagnoses.byChapter;

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-blue-100 text-blue-700 text-xs font-bold">A</span>
        OPD Diagnoses by ICD-10 Chapter
      </h3>

      {/* Wide table with horizontal scroll */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50">
            <tr>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">Chapter</th>
              <th rowSpan={2} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b min-w-[160px]">Chapter Name</th>
              <th colSpan={2} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase border-b border-l">0-28 d</th>
              <th colSpan={2} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase border-b border-l">29d-4y</th>
              <th colSpan={2} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase border-b border-l">5-12y</th>
              <th colSpan={2} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase border-b border-l">13-19y</th>
              <th colSpan={2} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase border-b border-l">20-59y</th>
              <th colSpan={2} className="px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase border-b border-l">60+</th>
              <th rowSpan={2} className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase border-b border-l">Total</th>
            </tr>
            <tr>
              {['M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F', 'M', 'F'].map((g, i) => (
                <th key={i} className={`px-2 py-1 text-center text-xs font-medium border-b ${i % 2 === 0 ? 'border-l text-blue-600' : 'text-pink-600'}`}>
                  {g}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {chapters.map((ch, idx) => (
              <tr key={ch.chapter} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-medium text-gray-900">{ch.chapter}</td>
                <td className="px-3 py-2 text-gray-700">{ch.chapterName}</td>
                <td className="px-2 py-2 text-center border-l">{ch.male_0_28d || '—'}</td>
                <td className="px-2 py-2 text-center">{ch.female_0_28d || '—'}</td>
                <td className="px-2 py-2 text-center border-l">{ch.male_29d_4y || '—'}</td>
                <td className="px-2 py-2 text-center">{ch.female_29d_4y || '—'}</td>
                <td className="px-2 py-2 text-center border-l">{ch.male_5_12y || '—'}</td>
                <td className="px-2 py-2 text-center">{ch.female_5_12y || '—'}</td>
                <td className="px-2 py-2 text-center border-l">{ch.male_13_19y || '—'}</td>
                <td className="px-2 py-2 text-center">{ch.female_13_19y || '—'}</td>
                <td className="px-2 py-2 text-center border-l">{ch.male_20_59y || '—'}</td>
                <td className="px-2 py-2 text-center">{ch.female_20_59y || '—'}</td>
                <td className="px-2 py-2 text-center border-l">{ch.male_60plus || '—'}</td>
                <td className="px-2 py-2 text-center">{ch.female_60plus || '—'}</td>
                <td className="px-3 py-2 text-right font-semibold border-l">{ch.total || sumChapterRow(ch)}</td>
              </tr>
            ))}
            {/* Total row */}
            <tr className="bg-blue-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>TOTAL</td>
              <td className="px-2 py-2 text-center border-l">{totalColumn(chapters, 'male_0_28d')}</td>
              <td className="px-2 py-2 text-center">{totalColumn(chapters, 'female_0_28d')}</td>
              <td className="px-2 py-2 text-center border-l">{totalColumn(chapters, 'male_29d_4y')}</td>
              <td className="px-2 py-2 text-center">{totalColumn(chapters, 'female_29d_4y')}</td>
              <td className="px-2 py-2 text-center border-l">{totalColumn(chapters, 'male_5_12y')}</td>
              <td className="px-2 py-2 text-center">{totalColumn(chapters, 'female_5_12y')}</td>
              <td className="px-2 py-2 text-center border-l">{totalColumn(chapters, 'male_13_19y')}</td>
              <td className="px-2 py-2 text-center">{totalColumn(chapters, 'female_13_19y')}</td>
              <td className="px-2 py-2 text-center border-l">{totalColumn(chapters, 'male_20_59y')}</td>
              <td className="px-2 py-2 text-center">{totalColumn(chapters, 'female_20_59y')}</td>
              <td className="px-2 py-2 text-center border-l">{totalColumn(chapters, 'male_60plus')}</td>
              <td className="px-2 py-2 text-center">{totalColumn(chapters, 'female_60plus')}</td>
              <td className="px-3 py-2 text-right border-l">{diagnoses.totalOPDCases}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Top 20 Diagnoses */}
      {diagnoses.topDiagnoses.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Top 20 Diagnoses</h4>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ICD Code</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Diagnosis</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cases</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {diagnoses.topDiagnoses.map((d, i) => (
                  <tr key={d.code} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">{d.code}</td>
                    <td className="px-4 py-2 text-gray-900">{d.name}</td>
                    <td className="px-4 py-2 text-right font-medium">{d.count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${Math.min(d.percentage, 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-xs text-gray-600 text-right">{d.percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- B: Laboratory ----------

function SectionLaboratory({ lab }: { lab: HMIS105Data['sections']['laboratory'] }) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-purple-100 text-purple-700 text-xs font-bold">B</span>
        Laboratory Summary
      </h3>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tests Performed</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Positive / Abnormal</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lab.byCategory.map((cat, i) => {
              const rate = cat.totalTests > 0 ? ((cat.positiveOrAbnormal / cat.totalTests) * 100) : 0;
              return (
                <tr key={cat.category} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 text-gray-900 font-medium">{cat.category}</td>
                  <td className="px-4 py-2 text-right">{cat.totalTests.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{cat.positiveOrAbnormal.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{rate.toFixed(1)}%</td>
                </tr>
              );
            })}
            {/* Total */}
            <tr className="bg-purple-50 font-semibold">
              <td className="px-4 py-2">TOTAL</td>
              <td className="px-4 py-2 text-right">{lab.totalTests.toLocaleString()}</td>
              <td className="px-4 py-2 text-right">
                {lab.byCategory.reduce((s, c) => s + c.positiveOrAbnormal, 0).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right">
                {lab.totalTests > 0
                  ? ((lab.byCategory.reduce((s, c) => s + c.positiveOrAbnormal, 0) / lab.totalTests) * 100).toFixed(1) + '%'
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- C: Pharmacy ----------

function SectionPharmacy({ pharmacy }: { pharmacy: HMIS105Data['sections']['pharmacy'] }) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-green-100 text-green-700 text-xs font-bold">C</span>
        Pharmacy
      </h3>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <StatCard icon={Pill} label="Total Prescriptions" value={pharmacy.totalPrescriptions.toLocaleString()} color="green" />
        <StatCard icon={AlertCircle} label="Stock-Out Days" value={pharmacy.stockOutDays.toString()} color={pharmacy.stockOutDays > 0 ? 'red' : 'green'} />
      </div>

      {/* Top medicines */}
      {pharmacy.topMedicines.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <div className="px-4 py-3 border-b">
            <h4 className="text-sm font-semibold text-gray-700">Top 20 Medicines Dispensed</h4>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pharmacy.topMedicines.map((med, i) => (
                <tr key={med.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2 text-gray-900">{med.name}</td>
                  <td className="px-4 py-2 text-right font-medium">{med.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-600">{med.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------- D: Maternal Health ----------

function SectionMaternalHealth({ maternal }: { maternal: HMIS105Data['sections']['maternalHealth'] }) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-pink-100 text-pink-700 text-xs font-bold">D</span>
        Maternal Health
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={Heart} label="ANC 1st Visit" value={maternal.ancFirstVisits.toLocaleString()} color="pink" />
        <StatCard icon={Heart} label="ANC Return" value={maternal.ancReturnVisits.toLocaleString()} color="pink" />
        <StatCard icon={Baby} label="Normal Deliveries" value={maternal.normalDeliveries.toLocaleString()} color="blue" />
        <StatCard icon={Activity} label="C-Section" value={maternal.caesareanDeliveries.toLocaleString()} color="orange" />
        <StatCard icon={Baby} label="Live Births" value={maternal.liveBirths.toLocaleString()} color="green" />
        <StatCard icon={Baby} label="Still Births" value={maternal.stillBirths.toLocaleString()} color="yellow" />
        <StatCard icon={Skull} label="Maternal Deaths" value={maternal.maternalDeaths.toLocaleString()} color="red" />
      </div>
    </section>
  );
}

// ---------- E: Summary ----------

function SectionSummary({ summary }: { summary: HMIS105Data['sections']['summary'] }) {
  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">E</span>
        Summary Statistics
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total OPD Attendance" value={summary.totalOPDAttendance.toLocaleString()} color="blue" />
        <StatCard icon={UserPlus} label="New Patients" value={summary.newPatients.toLocaleString()} color="green" />
        <StatCard icon={UserCheck} label="Return Patients" value={summary.returnPatients.toLocaleString()} color="purple" />
        <StatCard icon={BedDouble} label="Admissions" value={summary.totalAdmissions.toLocaleString()} color="indigo" />
        <StatCard icon={LogOut} label="Discharges" value={summary.totalDischarges.toLocaleString()} color="teal" />
        <StatCard icon={Skull} label="Deaths" value={summary.totalDeaths.toLocaleString()} color="red" />
        <StatCard icon={ExternalLink} label="Referrals Out" value={summary.referralsOut.toLocaleString()} color="orange" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared stat card
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  blue:   { bg: 'bg-blue-100',   icon: 'text-blue-600' },
  green:  { bg: 'bg-green-100',  icon: 'text-green-600' },
  red:    { bg: 'bg-red-100',    icon: 'text-red-600' },
  pink:   { bg: 'bg-pink-100',   icon: 'text-pink-600' },
  purple: { bg: 'bg-purple-100', icon: 'text-purple-600' },
  orange: { bg: 'bg-orange-100', icon: 'text-orange-600' },
  yellow: { bg: 'bg-yellow-100', icon: 'text-yellow-600' },
  indigo: { bg: 'bg-indigo-100', icon: 'text-indigo-600' },
  teal:   { bg: 'bg-teal-100',   icon: 'text-teal-600' },
};

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
