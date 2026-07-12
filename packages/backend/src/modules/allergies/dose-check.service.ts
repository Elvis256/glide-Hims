import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { Vital } from '../../database/entities/vital.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DrugClassification } from '../../database/entities/drug-classification.entity';
import { Item } from '../../database/entities/inventory.entity';
import { SafetyAlert } from '../../database/entities/prescription-safety-override.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface DoseCheckLine {
  drugId?: string;
  drugName: string;
  dose?: string;
  frequency?: string;
}

export interface DoseCheckInput {
  patientId?: string;
  tenantId?: string;
  lines: DoseCheckLine[];
}

interface ParsedDose {
  amount: number;
  unit: string;
}

const MASS_UNITS: Record<string, number> = {
  mg: 1,
  g: 1000,
  gram: 1000,
  grams: 1000,
  mcg: 0.001,
  ug: 0.001,
  µg: 0.001,
};

const VOLUME_UNITS: Record<string, number> = {
  ml: 1,
  cc: 1,
  l: 1000,
};

const OTHER_UNITS = new Set([
  'iu',
  'unit',
  'units',
  'u',
  'puff',
  'puffs',
  'drop',
  'drops',
  'tab',
  'tabs',
  'cap',
  'caps',
]);

/** Parse strings like "500 mg", "1g", "2.5ml", "1000 IU". */
export function parseDose(raw?: string): ParsedDose | null {
  if (!raw) return null;
  const m = raw
    .toLowerCase()
    .replace(/,/g, '.')
    .match(/([\d.]+)\s*([a-zµ]+)/);
  if (!m) return null;
  const amount = Number(m[1]);
  const unit = m[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, unit };
}

/** Convert parsed dose → comparable amount in target unit (mg or ml or raw). */
export function normalizeDose(
  dose: ParsedDose,
  targetUnit?: string,
): { amount: number; unit: string } | null {
  const t = (targetUnit || '').toLowerCase().trim();
  if (MASS_UNITS[dose.unit] != null) {
    const mg = dose.amount * MASS_UNITS[dose.unit];
    if (!t || MASS_UNITS[t] != null) {
      return { amount: mg / MASS_UNITS[t || 'mg'], unit: t || 'mg' };
    }
    return { amount: mg, unit: 'mg' };
  }
  if (VOLUME_UNITS[dose.unit] != null) {
    const ml = dose.amount * VOLUME_UNITS[dose.unit];
    if (!t || VOLUME_UNITS[t] != null) {
      return { amount: ml / VOLUME_UNITS[t || 'ml'], unit: t || 'ml' };
    }
    return { amount: ml, unit: 'ml' };
  }
  if (OTHER_UNITS.has(dose.unit)) {
    if (!t || t === dose.unit) return { amount: dose.amount, unit: dose.unit };
    return null;
  }
  return null;
}

/** Map common dosing-frequency abbreviations → administrations per 24 h. */
export function frequencyToPerDay(freq?: string): number | null {
  if (!freq) return null;
  const f = freq.trim().toLowerCase().replace(/\./g, '');
  // Q-N-H pattern (every N hours)
  const qh = f.match(/^q\s*(\d+)\s*h$/);
  if (qh) {
    const h = Number(qh[1]);
    return h > 0 ? Math.round(24 / h) : null;
  }
  const map: Record<string, number> = {
    od: 1,
    qd: 1,
    daily: 1,
    'once daily': 1,
    'once a day': 1,
    hs: 1,
    nocte: 1,
    bd: 2,
    bid: 2,
    'twice daily': 2,
    'twice a day': 2,
    tds: 3,
    tid: 3,
    'three times daily': 3,
    'thrice daily': 3,
    qid: 4,
    qds: 4,
    'four times daily': 4,
    '5x': 5,
    '5 times daily': 5,
    '6x': 6,
    stat: 1,
    prn: 1,
    'as needed': 1,
  };
  if (map[f] != null) return map[f];
  // Numeric pattern like "3 times" or "x3"
  const num = f.match(/(?:^|\s)x?\s*(\d+)\s*(?:times|x)?(?:\s*(?:per|a|\/)\s*day)?$/);
  if (num) {
    const n = Number(num[1]);
    if (n > 0 && n <= 24) return n;
  }
  return null;
}

/** Compute age in years from DOB. */
export function ageYears(dob?: Date | string | null, asOf: Date = new Date()): number | null {
  if (!dob) return null;
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  let years = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) years--;
  return years;
}

/**
 * Clinical Decision Support — dose-range checking.
 *
 * Compares prescribed single-dose and computed daily-dose against the
 * configured `maxSingleDose` / `maxDailyDose` on the drug classification.
 * Flags paediatric prescriptions (<18 y) where weight is missing as a
 * non-blocking warning so prescribers are nudged to weight-band properly.
 */
@Injectable()
export class DoseCheckService {
  private readonly logger = new Logger(DoseCheckService.name);

  constructor(
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Vital) private readonly vitalRepo: Repository<Vital>,
    @InjectRepository(Encounter) private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(DrugClassification)
    private readonly classificationRepo: Repository<DrugClassification>,
    @InjectRepository(Item) private readonly itemRepo: Repository<Item>,
  ) {}

  async runDoseChecks(input: DoseCheckInput): Promise<SafetyAlert[]> {
    const tid = requireTenantId(input.tenantId);
    const alerts: SafetyAlert[] = [];

    let age: number | null = null;
    let weightKg: number | null = null;

    if (input.patientId) {
      try {
        const patient = await this.patientRepo.findOne({
          where: { id: input.patientId, tenantId: tid },
        });
        age = patient ? ageYears(patient.dateOfBirth) : null;

        if (age !== null && age < 18) {
          // Latest vital weight via patient encounters
          const enc = await this.encounterRepo.find({
            where: {
              patientId: input.patientId,
              tenantId: tid,
            },
            select: ['id'],
            take: 50,
            order: { createdAt: 'DESC' },
          });
          const encIds = enc.map((e) => e.id);
          if (encIds.length) {
            const vital = await this.vitalRepo
              .createQueryBuilder('v')
              .where('v.encounter_id IN (:...ids)', { ids: encIds })
              .andWhere('v.weight IS NOT NULL')
              .orderBy('v.recorded_at', 'DESC')
              .limit(1)
              .getOne();
            weightKg = vital?.weight ? Number(vital.weight) : null;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Patient/weight lookup failed: ${err?.message}`);
      }
    }

    const drugIds = input.lines.map((l) => l.drugId).filter(Boolean) as string[];
    const classByItemId = new Map<string, DrugClassification>();
    if (drugIds.length) {
      const classifications = await this.classificationRepo.find({
        where: drugIds.map((id) => ({
          itemId: id,
          tenantId: tid,
        })) as any,
      });
      for (const c of classifications) classByItemId.set(c.itemId, c);
    }

    for (const line of input.lines) {
      const cls = line.drugId ? classByItemId.get(line.drugId) : undefined;
      const single = parseDose(line.dose);
      const perDay = frequencyToPerDay(line.frequency);

      if (cls?.maxSingleDose && single) {
        const norm = normalizeDose(single, cls.doseUnit || 'mg');
        if (norm && norm.amount > cls.maxSingleDose) {
          const ratio = norm.amount / cls.maxSingleDose;
          const sev: SafetyAlert['severity'] = ratio > 1.5 ? 'severe' : 'major';
          alerts.push({
            kind: 'dose',
            severity: sev,
            drugId: line.drugId,
            drugName: line.drugName,
            description: `Single dose ${norm.amount}${norm.unit} exceeds maximum ${cls.maxSingleDose}${cls.doseUnit || 'mg'} (${(ratio * 100).toFixed(0)}% of limit).`,
            recommendation: 'Reduce single dose or document override.',
          } as SafetyAlert);
        }
      }

      if (cls?.maxDailyDose && single && perDay) {
        const norm = normalizeDose(single, cls.doseUnit || 'mg');
        if (norm) {
          const daily = norm.amount * perDay;
          if (daily > cls.maxDailyDose) {
            const ratio = daily / cls.maxDailyDose;
            const sev: SafetyAlert['severity'] = ratio > 1.5 ? 'severe' : 'major';
            alerts.push({
              kind: 'dose',
              severity: sev,
              drugId: line.drugId,
              drugName: line.drugName,
              description: `Daily dose ${daily}${norm.unit} (${norm.amount}${norm.unit} × ${perDay}/day) exceeds maximum ${cls.maxDailyDose}${cls.doseUnit || 'mg'} (${(ratio * 100).toFixed(0)}% of limit).`,
              recommendation: 'Reduce dose or frequency, or document override.',
            } as SafetyAlert);
          }
        }
      }

      // Paediatric guard: <18 y without recorded weight is a moderate warning
      if (age !== null && age < 18 && weightKg === null) {
        alerts.push({
          kind: 'dose',
          severity: 'moderate',
          drugId: line.drugId,
          drugName: line.drugName,
          description: `Paediatric patient (age ${age}) — no recorded body weight; weight-band dose verification not possible.`,
          recommendation: "Record the patient's weight in vitals before dispensing.",
        } as SafetyAlert);
      }
    }

    return alerts;
  }
}
