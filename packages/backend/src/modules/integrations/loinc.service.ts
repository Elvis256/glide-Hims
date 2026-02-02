import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

/**
 * LOINC (Logical Observation Identifiers Names and Codes) Service
 * 
 * LOINC is the universal standard for identifying lab tests and clinical observations.
 * Used worldwide for:
 * - Lab test codes (CBC, Malaria RDT, HIV, Blood Glucose, etc.)
 * - Reference ranges
 * - Standard units of measurement
 * 
 * This uses the free LOINC FHIR API: https://loinc.org/fhir/
 * No API key required for basic searches
 */

export interface LOINCCode {
  code: string;
  display: string;
  longName: string;
  shortName?: string;
  component: string;
  property: string;
  timeAspect: string;
  system: string;
  scale: string;
  method?: string;
  class: string;
  status: string;
  units?: string;
}

export interface LabTestReference {
  code: string;
  name: string;
  category: string;
  specimen: string;
  units: string;
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
  criticalRange?: {
    low?: number;
    high?: number;
  };
}

// Common lab tests with their LOINC codes for quick reference
const COMMON_LAB_TESTS: LabTestReference[] = [
  // Hematology
  { code: '26453-1', name: 'White Blood Cell Count (WBC)', category: 'Hematology', specimen: 'Blood', units: '10^9/L', referenceRange: { low: 4.0, high: 11.0 } },
  { code: '789-8', name: 'Red Blood Cell Count (RBC)', category: 'Hematology', specimen: 'Blood', units: '10^12/L', referenceRange: { low: 4.5, high: 5.5 } },
  { code: '718-7', name: 'Hemoglobin', category: 'Hematology', specimen: 'Blood', units: 'g/dL', referenceRange: { low: 12.0, high: 17.0 }, criticalRange: { low: 7.0, high: 20.0 } },
  { code: '4544-3', name: 'Hematocrit', category: 'Hematology', specimen: 'Blood', units: '%', referenceRange: { low: 36, high: 50 } },
  { code: '777-3', name: 'Platelet Count', category: 'Hematology', specimen: 'Blood', units: '10^9/L', referenceRange: { low: 150, high: 400 }, criticalRange: { low: 50, high: 1000 } },
  { code: '785-6', name: 'Mean Corpuscular Volume (MCV)', category: 'Hematology', specimen: 'Blood', units: 'fL', referenceRange: { low: 80, high: 100 } },
  { code: '28539-5', name: 'Mean Corpuscular Hemoglobin (MCH)', category: 'Hematology', specimen: 'Blood', units: 'pg', referenceRange: { low: 27, high: 33 } },
  
  // Chemistry
  { code: '2345-7', name: 'Glucose (Fasting)', category: 'Chemistry', specimen: 'Blood', units: 'mg/dL', referenceRange: { low: 70, high: 100 }, criticalRange: { low: 40, high: 500 } },
  { code: '4548-4', name: 'Hemoglobin A1c', category: 'Chemistry', specimen: 'Blood', units: '%', referenceRange: { low: 4.0, high: 5.6 } },
  { code: '2160-0', name: 'Creatinine', category: 'Chemistry', specimen: 'Blood', units: 'mg/dL', referenceRange: { low: 0.6, high: 1.2 }, criticalRange: { high: 10.0 } },
  { code: '3094-0', name: 'Blood Urea Nitrogen (BUN)', category: 'Chemistry', specimen: 'Blood', units: 'mg/dL', referenceRange: { low: 7, high: 20 } },
  { code: '1742-6', name: 'ALT (SGPT)', category: 'Chemistry', specimen: 'Blood', units: 'U/L', referenceRange: { low: 7, high: 56 } },
  { code: '1920-8', name: 'AST (SGOT)', category: 'Chemistry', specimen: 'Blood', units: 'U/L', referenceRange: { low: 10, high: 40 } },
  { code: '1975-2', name: 'Total Bilirubin', category: 'Chemistry', specimen: 'Blood', units: 'mg/dL', referenceRange: { low: 0.1, high: 1.2 } },
  { code: '2885-2', name: 'Total Protein', category: 'Chemistry', specimen: 'Blood', units: 'g/dL', referenceRange: { low: 6.0, high: 8.3 } },
  { code: '1751-7', name: 'Albumin', category: 'Chemistry', specimen: 'Blood', units: 'g/dL', referenceRange: { low: 3.5, high: 5.0 } },
  
  // Electrolytes
  { code: '2951-2', name: 'Sodium', category: 'Electrolytes', specimen: 'Blood', units: 'mmol/L', referenceRange: { low: 136, high: 145 }, criticalRange: { low: 120, high: 160 } },
  { code: '2823-3', name: 'Potassium', category: 'Electrolytes', specimen: 'Blood', units: 'mmol/L', referenceRange: { low: 3.5, high: 5.0 }, criticalRange: { low: 2.5, high: 6.5 } },
  { code: '2075-0', name: 'Chloride', category: 'Electrolytes', specimen: 'Blood', units: 'mmol/L', referenceRange: { low: 98, high: 106 } },
  { code: '17861-6', name: 'Calcium', category: 'Electrolytes', specimen: 'Blood', units: 'mg/dL', referenceRange: { low: 8.5, high: 10.5 }, criticalRange: { low: 6.0, high: 13.0 } },
  
  // Lipid Panel
  { code: '2093-3', name: 'Total Cholesterol', category: 'Lipid Panel', specimen: 'Blood', units: 'mg/dL', referenceRange: { high: 200 } },
  { code: '2085-9', name: 'HDL Cholesterol', category: 'Lipid Panel', specimen: 'Blood', units: 'mg/dL', referenceRange: { low: 40 } },
  { code: '2089-1', name: 'LDL Cholesterol', category: 'Lipid Panel', specimen: 'Blood', units: 'mg/dL', referenceRange: { high: 100 } },
  { code: '2571-8', name: 'Triglycerides', category: 'Lipid Panel', specimen: 'Blood', units: 'mg/dL', referenceRange: { high: 150 } },
  
  // Infectious Diseases (Common in Uganda)
  { code: '32700-7', name: 'Malaria Rapid Test', category: 'Infectious', specimen: 'Blood', units: 'Qual', referenceRange: { text: 'Negative' } },
  { code: '5196-1', name: 'Malaria Smear (Thick)', category: 'Infectious', specimen: 'Blood', units: 'Qual', referenceRange: { text: 'No parasites seen' } },
  { code: '75410-1', name: 'HIV-1/2 Antibody Screen', category: 'Infectious', specimen: 'Blood', units: 'Qual', referenceRange: { text: 'Non-reactive' } },
  { code: '7918-6', name: 'Hepatitis B Surface Antigen', category: 'Infectious', specimen: 'Blood', units: 'Qual', referenceRange: { text: 'Non-reactive' } },
  { code: '13955-0', name: 'Hepatitis C Antibody', category: 'Infectious', specimen: 'Blood', units: 'Qual', referenceRange: { text: 'Non-reactive' } },
  { code: '22587-0', name: 'Typhoid (Widal) Test', category: 'Infectious', specimen: 'Blood', units: 'Titer', referenceRange: { text: '<1:80' } },
  
  // Urinalysis
  { code: '5778-6', name: 'Urine Color', category: 'Urinalysis', specimen: 'Urine', units: 'Color', referenceRange: { text: 'Yellow' } },
  { code: '5803-2', name: 'Urine pH', category: 'Urinalysis', specimen: 'Urine', units: 'pH', referenceRange: { low: 5.0, high: 8.0 } },
  { code: '5811-5', name: 'Urine Specific Gravity', category: 'Urinalysis', specimen: 'Urine', units: 'SG', referenceRange: { low: 1.005, high: 1.030 } },
  { code: '5804-0', name: 'Urine Protein', category: 'Urinalysis', specimen: 'Urine', units: 'Qual', referenceRange: { text: 'Negative' } },
  { code: '5792-7', name: 'Urine Glucose', category: 'Urinalysis', specimen: 'Urine', units: 'Qual', referenceRange: { text: 'Negative' } },
  
  // Thyroid
  { code: '3016-3', name: 'TSH', category: 'Thyroid', specimen: 'Blood', units: 'mIU/L', referenceRange: { low: 0.4, high: 4.0 } },
  { code: '3026-2', name: 'Free T4', category: 'Thyroid', specimen: 'Blood', units: 'ng/dL', referenceRange: { low: 0.8, high: 1.8 } },
  { code: '3053-6', name: 'Free T3', category: 'Thyroid', specimen: 'Blood', units: 'pg/mL', referenceRange: { low: 2.3, high: 4.2 } },
  
  // Coagulation
  { code: '5902-2', name: 'Prothrombin Time (PT)', category: 'Coagulation', specimen: 'Blood', units: 'seconds', referenceRange: { low: 11, high: 13.5 } },
  { code: '6301-6', name: 'INR', category: 'Coagulation', specimen: 'Blood', units: 'INR', referenceRange: { low: 0.8, high: 1.2 } },
  { code: '3173-2', name: 'aPTT', category: 'Coagulation', specimen: 'Blood', units: 'seconds', referenceRange: { low: 25, high: 35 } },
];

@Injectable()
export class LOINCService {
  private readonly logger = new Logger(LOINCService.name);
  private readonly FHIR_URL = 'https://fhir.loinc.org';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Search LOINC codes by name or code
   */
  async searchCodes(query: string, limit = 20): Promise<LOINCCode[]> {
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.FHIR_URL}/CodeSystem/$lookup`, {
          params: {
            system: 'http://loinc.org',
            code: query,
          },
          headers: {
            'Accept': 'application/fhir+json',
          },
        }),
      );

      // If exact code match
      if (response.data.parameter) {
        return [this.mapFHIRToLOINC(response.data.parameter, query)];
      }

      return [];
    } catch (error: any) {
      // Try text search if code lookup fails
      return this.searchByText(query, limit);
    }
  }

  /**
   * Search LOINC by text description
   */
  async searchByText(query: string, limit = 20): Promise<LOINCCode[]> {
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.FHIR_URL}/CodeSystem`, {
          params: {
            _content: query,
            _count: limit,
          },
          headers: {
            'Accept': 'application/fhir+json',
          },
        }),
      );

      // Extract concepts from response
      const concepts = response.data.concept || [];
      return concepts.slice(0, limit).map((c: any) => ({
        code: c.code,
        display: c.display,
        longName: c.display,
        shortName: c.display,
        component: '',
        property: '',
        timeAspect: '',
        system: 'http://loinc.org',
        scale: '',
        class: '',
        status: 'active',
      }));
    } catch (error: any) {
      this.logger.warn('LOINC text search failed, using local database', error.message);
      return this.searchLocal(query, limit);
    }
  }

  /**
   * Search local common lab tests (faster, works offline)
   */
  searchLocal(query: string, limit = 20): LOINCCode[] {
    const q = query.toLowerCase();
    return COMMON_LAB_TESTS
      .filter(t => 
        t.code.toLowerCase().includes(q) || 
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
      .slice(0, limit)
      .map(t => ({
        code: t.code,
        display: t.name,
        longName: t.name,
        shortName: t.name,
        component: t.name,
        property: t.units,
        timeAspect: 'Point in time',
        system: 'http://loinc.org',
        scale: 'Quantitative',
        class: t.category,
        status: 'active',
        units: t.units,
      }));
  }

  /**
   * Get common lab tests by category
   */
  getCommonLabTests(category?: string): LabTestReference[] {
    if (category) {
      return COMMON_LAB_TESTS.filter(t => 
        t.category.toLowerCase() === category.toLowerCase()
      );
    }
    return COMMON_LAB_TESTS;
  }

  /**
   * Get lab test categories
   */
  getCategories(): string[] {
    return [...new Set(COMMON_LAB_TESTS.map(t => t.category))];
  }

  /**
   * Get reference range for a LOINC code
   */
  getReferenceRange(loincCode: string): LabTestReference | null {
    return COMMON_LAB_TESTS.find(t => t.code === loincCode) || null;
  }

  /**
   * Check if a value is within reference range
   */
  checkValue(loincCode: string, value: number): {
    status: 'normal' | 'low' | 'high' | 'critical-low' | 'critical-high' | 'unknown';
    referenceRange?: { low?: number; high?: number };
    criticalRange?: { low?: number; high?: number };
  } {
    const test = this.getReferenceRange(loincCode);
    if (!test || !test.referenceRange) {
      return { status: 'unknown' };
    }

    const { referenceRange, criticalRange } = test;

    // Check critical ranges first
    if (criticalRange) {
      if (criticalRange.low !== undefined && value < criticalRange.low) {
        return { status: 'critical-low', referenceRange, criticalRange };
      }
      if (criticalRange.high !== undefined && value > criticalRange.high) {
        return { status: 'critical-high', referenceRange, criticalRange };
      }
    }

    // Check normal ranges
    if (referenceRange.low !== undefined && value < referenceRange.low) {
      return { status: 'low', referenceRange, criticalRange };
    }
    if (referenceRange.high !== undefined && value > referenceRange.high) {
      return { status: 'high', referenceRange, criticalRange };
    }

    return { status: 'normal', referenceRange, criticalRange };
  }

  /**
   * Get test details by LOINC code
   */
  getTestByCode(loincCode: string): LabTestReference | null {
    return COMMON_LAB_TESTS.find(t => t.code === loincCode) || null;
  }

  private mapFHIRToLOINC(parameters: any[], code: string): LOINCCode {
    const getParam = (name: string) => 
      parameters.find(p => p.name === name)?.valueString || '';

    return {
      code,
      display: getParam('display'),
      longName: getParam('display'),
      shortName: getParam('display'),
      component: getParam('COMPONENT'),
      property: getParam('PROPERTY'),
      timeAspect: getParam('TIME_ASPCT'),
      system: 'http://loinc.org',
      scale: getParam('SCALE_TYP'),
      method: getParam('METHOD_TYP'),
      class: getParam('CLASS'),
      status: 'active',
    };
  }
}
