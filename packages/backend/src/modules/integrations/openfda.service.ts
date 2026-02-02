import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

/**
 * openFDA API Service
 * 
 * Provides access to US FDA drug database for:
 * - Drug labels (dosage, warnings, contraindications)
 * - Adverse events (reported side effects)
 * - Drug recalls
 * - Drug interactions checking
 * 
 * API Documentation: https://open.fda.gov/apis/
 * Rate Limit: 240 requests/minute without API key, 120,000/day with key
 */

export interface DrugLabel {
  id: string;
  brandName: string;
  genericName: string;
  manufacturer: string;
  dosageForm: string;
  route: string;
  indications: string;
  warnings: string;
  contraindications: string;
  dosage: string;
  adverseReactions: string;
  drugInteractions: string;
  activeIngredients: string[];
}

export interface AdverseEvent {
  reportId: string;
  receiveDate: string;
  serious: boolean;
  seriousnessHospitalization: boolean;
  seriousnessDeath: boolean;
  patientAge?: number;
  patientSex?: string;
  reactions: string[];
  drugs: Array<{
    name: string;
    role: string;
  }>;
}

export interface DrugRecall {
  recallNumber: string;
  recallInitiationDate: string;
  productDescription: string;
  reason: string;
  classification: string;
  status: string;
  distributionPattern: string;
  voluntaryMandated: string;
}

@Injectable()
export class OpenFDAService {
  private readonly logger = new Logger(OpenFDAService.name);
  private readonly BASE_URL = 'https://api.fda.gov';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Search drug labels by name (brand or generic)
   */
  async searchDrugs(query: string, limit = 10): Promise<DrugLabel[]> {
    try {
      const searchQuery = `openfda.brand_name:"${query}"+openfda.generic_name:"${query}"`;
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.BASE_URL}/drug/label.json`, {
          params: {
            search: searchQuery,
            limit,
          },
        }),
      );

      return (response.data.results || []).map((r: any) => this.mapDrugLabel(r));
    } catch (error: any) {
      if (error.response?.status === 404) {
        return []; // No results found
      }
      this.logger.error('openFDA drug search failed', error.message);
      return [];
    }
  }

  /**
   * Get drug details by NDC or application number
   */
  async getDrugByNDC(ndc: string): Promise<DrugLabel | null> {
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.BASE_URL}/drug/label.json`, {
          params: {
            search: `openfda.product_ndc:"${ndc}"`,
            limit: 1,
          },
        }),
      );

      if (response.data.results?.length > 0) {
        return this.mapDrugLabel(response.data.results[0]);
      }
      return null;
    } catch (error: any) {
      this.logger.error('openFDA NDC lookup failed', error.message);
      return null;
    }
  }

  /**
   * Check for drug interactions between multiple medications
   */
  async checkDrugInteractions(drugNames: string[]): Promise<{
    hasInteractions: boolean;
    interactions: Array<{
      drug1: string;
      drug2: string;
      description: string;
      severity: 'low' | 'moderate' | 'high';
    }>;
  }> {
    const interactions: Array<{
      drug1: string;
      drug2: string;
      description: string;
      severity: 'low' | 'moderate' | 'high';
    }> = [];

    // Check each drug's label for interaction warnings with other drugs
    for (const drug of drugNames) {
      try {
        const labels = await this.searchDrugs(drug, 1);
        if (labels.length > 0 && labels[0].drugInteractions) {
          const interactionText = labels[0].drugInteractions.toLowerCase();
          
          for (const otherDrug of drugNames) {
            if (otherDrug !== drug && interactionText.includes(otherDrug.toLowerCase())) {
              interactions.push({
                drug1: drug,
                drug2: otherDrug,
                description: `${drug} may interact with ${otherDrug}. Check drug label for details.`,
                severity: this.estimateSeverity(interactionText, otherDrug),
              });
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Could not check interactions for ${drug}`);
      }
    }

    return {
      hasInteractions: interactions.length > 0,
      interactions,
    };
  }

  /**
   * Get adverse events (side effects) for a drug
   */
  async getAdverseEvents(drugName: string, limit = 20): Promise<AdverseEvent[]> {
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.BASE_URL}/drug/event.json`, {
          params: {
            search: `patient.drug.medicinalproduct:"${drugName}"`,
            limit,
          },
        }),
      );

      return (response.data.results || []).map((r: any) => ({
        reportId: r.safetyreportid,
        receiveDate: r.receivedate,
        serious: r.serious === '1',
        seriousnessHospitalization: r.seriousnesshospitalization === '1',
        seriousnessDeath: r.seriousnessdeath === '1',
        patientAge: r.patient?.patientonsetage,
        patientSex: r.patient?.patientsex === '1' ? 'Male' : r.patient?.patientsex === '2' ? 'Female' : undefined,
        reactions: (r.patient?.reaction || []).map((rx: any) => rx.reactionmeddrapt),
        drugs: (r.patient?.drug || []).map((d: any) => ({
          name: d.medicinalproduct,
          role: d.drugcharacterization === '1' ? 'Suspect' : d.drugcharacterization === '2' ? 'Concomitant' : 'Unknown',
        })),
      }));
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      this.logger.error('openFDA adverse events failed', error.message);
      return [];
    }
  }

  /**
   * Get drug recalls
   */
  async getDrugRecalls(query?: string, limit = 20): Promise<DrugRecall[]> {
    try {
      const params: any = { limit };
      if (query) {
        params.search = `product_description:"${query}"+reason_for_recall:"${query}"`;
      }

      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.BASE_URL}/drug/enforcement.json`, params),
      );

      return (response.data.results || []).map((r: any) => ({
        recallNumber: r.recall_number,
        recallInitiationDate: r.recall_initiation_date,
        productDescription: r.product_description,
        reason: r.reason_for_recall,
        classification: r.classification,
        status: r.status,
        distributionPattern: r.distribution_pattern,
        voluntaryMandated: r.voluntary_mandated,
      }));
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      this.logger.error('openFDA recalls failed', error.message);
      return [];
    }
  }

  /**
   * Get common side effects count for a drug
   */
  async getSideEffectsStats(drugName: string): Promise<Array<{ reaction: string; count: number }>> {
    try {
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${this.BASE_URL}/drug/event.json`, {
          params: {
            search: `patient.drug.medicinalproduct:"${drugName}"`,
            count: 'patient.reaction.reactionmeddrapt.exact',
          },
        }),
      );

      return (response.data.results || []).slice(0, 20).map((r: any) => ({
        reaction: r.term,
        count: r.count,
      }));
    } catch (error: any) {
      this.logger.error('openFDA side effects stats failed', error.message);
      return [];
    }
  }

  private mapDrugLabel(r: any): DrugLabel {
    const openfda = r.openfda || {};
    return {
      id: r.id || openfda.spl_id?.[0],
      brandName: openfda.brand_name?.[0] || 'Unknown',
      genericName: openfda.generic_name?.[0] || openfda.substance_name?.[0] || 'Unknown',
      manufacturer: openfda.manufacturer_name?.[0] || 'Unknown',
      dosageForm: openfda.dosage_form?.[0] || '',
      route: openfda.route?.[0] || '',
      indications: this.cleanText(r.indications_and_usage?.[0]),
      warnings: this.cleanText(r.warnings?.[0] || r.warnings_and_cautions?.[0]),
      contraindications: this.cleanText(r.contraindications?.[0]),
      dosage: this.cleanText(r.dosage_and_administration?.[0]),
      adverseReactions: this.cleanText(r.adverse_reactions?.[0]),
      drugInteractions: this.cleanText(r.drug_interactions?.[0]),
      activeIngredients: openfda.substance_name || [],
    };
  }

  private cleanText(text?: string): string {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000);
  }

  private estimateSeverity(text: string, drug: string): 'low' | 'moderate' | 'high' {
    const lowerText = text.toLowerCase();
    const drugLower = drug.toLowerCase();
    
    // Look for severity indicators near the drug mention
    const idx = lowerText.indexOf(drugLower);
    const context = lowerText.substring(Math.max(0, idx - 200), Math.min(lowerText.length, idx + 200));
    
    if (context.includes('contraindicated') || context.includes('fatal') || context.includes('death') || context.includes('serious')) {
      return 'high';
    }
    if (context.includes('caution') || context.includes('monitor') || context.includes('adjust')) {
      return 'moderate';
    }
    return 'low';
  }
}
