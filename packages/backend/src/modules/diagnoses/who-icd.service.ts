import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AxiosResponse } from 'axios';
import { Diagnosis, DiagnosisCategory } from '../../database/entities/diagnosis.entity';

interface WHOTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ICDSearchResult {
  destinationEntities: Array<{
    id: string;
    title: string;
    theCode: string;
    chapter: string;
    score: number;
  }>;
  error: boolean;
  errorMessage?: string;
}

@Injectable()
export class WHOICDService {
  private readonly logger = new Logger(WHOICDService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  
  private readonly TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';
  private readonly ICD11_API_URL = 'https://id.who.int/icd/release/11/2024-01/mms';
  private readonly ICD10_API_URL = 'https://id.who.int/icd/release/10/2019';
  
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientId = this.configService.get<string>('WHO_ICD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('WHO_ICD_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('WHO ICD API credentials not configured');
    }

    try {
      const response: AxiosResponse<WHOTokenResponse> = await firstValueFrom(
        this.httpService.post<WHOTokenResponse>(
          this.TOKEN_URL,
          new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'icdapi_access',
            grant_type: 'client_credentials',
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      this.logger.log('WHO ICD API token obtained');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to get WHO ICD API token', error);
      throw new Error('Failed to authenticate with WHO ICD API');
    }
  }

  async searchICD11(query: string, language = 'en'): Promise<ICDSearchResult['destinationEntities']> {
    try {
      const token = await this.getAccessToken();
      
      const response: AxiosResponse<ICDSearchResult> = await firstValueFrom(
        this.httpService.get<ICDSearchResult>(
          `${this.ICD11_API_URL}/search`,
          {
            params: {
              q: query,
              useFlexisearch: true,
              flatResults: true,
            },
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Accept-Language': language,
              'API-Version': 'v2',
            },
          },
        ),
      );

      if (response.data.error) {
        this.logger.warn(`ICD-11 search error: ${response.data.errorMessage}`);
        return [];
      }

      return response.data.destinationEntities || [];
    } catch (error) {
      this.logger.error('ICD-11 search failed', error);
      return [];
    }
  }

  async searchICD10(query: string, language = 'en'): Promise<ICDSearchResult['destinationEntities']> {
    try {
      const token = await this.getAccessToken();
      
      const response: AxiosResponse<ICDSearchResult> = await firstValueFrom(
        this.httpService.get<ICDSearchResult>(
          `${this.ICD10_API_URL}/search`,
          {
            params: { q: query, useFlexisearch: true, flatResults: true },
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
              'Accept-Language': language,
              'API-Version': 'v2',
            },
          },
        ),
      );

      if (response.data.error) {
        return [];
      }

      return response.data.destinationEntities || [];
    } catch (error) {
      this.logger.error('ICD-10 search failed', error);
      return [];
    }
  }

  async search(query: string, version: 'icd10' | 'icd11' | 'both' = 'both', language = 'en') {
    const results: Array<{
      code: string;
      title: string;
      version: 'ICD-10' | 'ICD-11';
      chapter?: string;
      score: number;
    }> = [];

    if (version === 'icd10' || version === 'both') {
      const icd10Results = await this.searchICD10(query, language);
      results.push(
        ...icd10Results.map((r) => ({
          code: r.theCode,
          title: r.title,
          version: 'ICD-10' as const,
          chapter: r.chapter,
          score: r.score,
        })),
      );
    }

    if (version === 'icd11' || version === 'both') {
      const icd11Results = await this.searchICD11(query, language);
      results.push(
        ...icd11Results.map((r) => ({
          code: r.theCode,
          title: r.title,
          version: 'ICD-11' as const,
          chapter: r.chapter,
          score: r.score,
        })),
      );
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  async importToLocal(code: string, version: 'ICD-10' | 'ICD-11' = 'ICD-10'): Promise<Diagnosis | null> {
    const existing = await this.diagnosisRepo.findOne({ 
      where: { icd10Code: code, deletedAt: undefined } 
    });
    if (existing) return existing;

    const results = version === 'ICD-10' 
      ? await this.searchICD10(code) 
      : await this.searchICD11(code);
    
    const match = results.find((r) => r.theCode === code);
    if (!match) return null;

    const diagnosis = this.diagnosisRepo.create({
      icd10Code: code,
      name: match.title,
      category: this.mapChapterToCategory(match.chapter),
      chapterName: match.chapter,
      isActive: true,
    });

    return this.diagnosisRepo.save(diagnosis);
  }

  async bulkImport(codes: Array<{ code: string; title: string; chapter?: string }>): Promise<number> {
    let imported = 0;

    for (const item of codes) {
      try {
        const existing = await this.diagnosisRepo.findOne({ 
          where: { icd10Code: item.code, deletedAt: undefined } 
        });
        
        if (!existing) {
          await this.diagnosisRepo.save(
            this.diagnosisRepo.create({
              icd10Code: item.code,
              name: item.title,
              category: this.mapChapterToCategory(item.chapter),
              chapterName: item.chapter,
              isActive: true,
            }),
          );
          imported++;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to import ${item.code}: ${error.message}`);
      }
    }

    return imported;
  }

  isConfigured(): boolean {
    const clientId = this.configService.get<string>('WHO_ICD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('WHO_ICD_CLIENT_SECRET');
    return !!(clientId && clientSecret);
  }

  private mapChapterToCategory(chapter?: string): DiagnosisCategory {
    if (!chapter) return DiagnosisCategory.OTHER;
    
    const c = chapter.toLowerCase();
    
    if (c.includes('infectious')) return DiagnosisCategory.INFECTIOUS;
    if (c.includes('neoplasm')) return DiagnosisCategory.NEOPLASMS;
    if (c.includes('blood')) return DiagnosisCategory.BLOOD;
    if (c.includes('endocrine') || c.includes('metabolic')) return DiagnosisCategory.ENDOCRINE;
    if (c.includes('mental')) return DiagnosisCategory.MENTAL;
    if (c.includes('nervous')) return DiagnosisCategory.NERVOUS;
    if (c.includes('eye')) return DiagnosisCategory.EYE;
    if (c.includes('ear')) return DiagnosisCategory.EAR;
    if (c.includes('circulatory')) return DiagnosisCategory.CIRCULATORY;
    if (c.includes('respiratory')) return DiagnosisCategory.RESPIRATORY;
    if (c.includes('digestive')) return DiagnosisCategory.DIGESTIVE;
    if (c.includes('skin')) return DiagnosisCategory.SKIN;
    if (c.includes('musculoskeletal')) return DiagnosisCategory.MUSCULOSKELETAL;
    if (c.includes('genitourinary')) return DiagnosisCategory.GENITOURINARY;
    if (c.includes('pregnancy')) return DiagnosisCategory.PREGNANCY;
    if (c.includes('perinatal')) return DiagnosisCategory.PERINATAL;
    if (c.includes('congenital')) return DiagnosisCategory.CONGENITAL;
    if (c.includes('symptoms')) return DiagnosisCategory.SYMPTOMS;
    if (c.includes('injury')) return DiagnosisCategory.INJURY;
    if (c.includes('external')) return DiagnosisCategory.EXTERNAL;
    
    return DiagnosisCategory.OTHER;
  }
}
