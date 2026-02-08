import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { AxiosResponse } from 'axios';
import { Diagnosis, DiagnosisCategory } from '../../database/entities/diagnosis.entity';
import { ICD10Code } from '../../database/entities/icd10-code.entity';

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

// Helper to strip HTML tags from WHO API responses
function stripHtml(text: string): string {
  if (!text) return text;
  return text.replace(/<[^>]*>/g, '').trim();
}

@Injectable()
export class WHOICDService {
  private readonly logger = new Logger(WHOICDService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private isOnline: boolean = true;
  private lastOnlineCheck: Date = new Date();
  
  // Timeout for API requests (10 seconds for initial calls, cache locally after)
  private readonly API_TIMEOUT_MS = 10000;
  
  // WHO API (for ICD-11)
  private readonly TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';
  private readonly ICD11_API_URL = 'https://id.who.int/icd/release/11/2024-01/mms';
  
  // NIH API for ICD-10-CM (free, no auth required)
  private readonly ICD10_API_URL = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search';
  
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(ICD10Code)
    private readonly icd10CodeRepo: Repository<ICD10Code>,
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
        ).pipe(
          timeout(this.API_TIMEOUT_MS),
          catchError((err) => {
            this.markOffline();
            throw err;
          }),
        ),
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      this.markOnline();
      this.logger.log('WHO ICD API token obtained');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Failed to get WHO ICD API token', error);
      this.markOffline();
      throw new Error('Failed to authenticate with WHO ICD API');
    }
  }

  private markOnline() {
    this.isOnline = true;
    this.lastOnlineCheck = new Date();
  }

  private markOffline() {
    this.isOnline = false;
    this.lastOnlineCheck = new Date();
    this.logger.warn('WHO ICD API marked as offline - using local database');
  }

  private shouldTryOnline(): boolean {
    // If we were offline, retry after 30 seconds
    if (!this.isOnline) {
      const timeSinceCheck = Date.now() - this.lastOnlineCheck.getTime();
      return timeSinceCheck > 30000; // 30 seconds
    }
    return true;
  }

  // ==================== HYBRID SEARCH ====================

  /**
   * Main search method - tries online first, falls back to local
   */
  async search(query: string, version: 'icd10' | 'icd11' | 'both' = 'icd10', language = 'en') {
    const results: Array<{
      code: string;
      title: string;
      version: 'ICD-10' | 'ICD-11';
      chapter?: string;
      score: number;
      source: 'online' | 'local';
    }> = [];

    this.logger.log(`Search request: query="${query}", shouldTryOnline=${this.shouldTryOnline()}, isConfigured=${this.isConfigured()}, isOnline=${this.isOnline}`);

    // Try online first if we should
    if (this.shouldTryOnline() && this.isConfigured()) {
      try {
        this.logger.log('Attempting online WHO API search...');
        const onlineResults = await this.searchOnline(query, version, language);
        this.logger.log(`Online search returned ${onlineResults.length} results`);
        if (onlineResults.length > 0) {
          // Cache results to local database
          await this.cacheResults(onlineResults);
          return onlineResults.map(r => ({ ...r, source: 'online' as const }));
        }
      } catch (error) {
        this.logger.warn(`Online search failed: ${error.message}, falling back to local database`);
      }
    }

    // Fall back to local database
    const localResults = await this.searchLocal(query);
    if (localResults.length > 0) {
      this.logger.log(`Returning ${localResults.length} results from local database`);
      return localResults.map(r => ({ ...r, source: 'local' as const }));
    }

    return results;
  }

  /**
   * Search online WHO API
   */
  private async searchOnline(query: string, version: 'icd10' | 'icd11' | 'both', language: string) {
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
          title: stripHtml(r.title),
          version: 'ICD-10' as const,
          chapter: stripHtml(r.chapter),
          score: r.score,
        })),
      );
    }

    if (version === 'icd11' || version === 'both') {
      const icd11Results = await this.searchICD11(query, language);
      results.push(
        ...icd11Results.map((r) => ({
          code: r.theCode,
          title: stripHtml(r.title),
          version: 'ICD-11' as const,
          chapter: stripHtml(r.chapter),
          score: r.score,
        })),
      );
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Search local ICD-10 codes database
   */
  async searchLocal(query: string, limit = 50): Promise<Array<{
    code: string;
    title: string;
    version: 'ICD-10' | 'ICD-11';
    chapter?: string;
    score: number;
  }>> {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    const results = await this.icd10CodeRepo
      .createQueryBuilder('icd')
      .where('LOWER(icd.code) LIKE :search', { search: searchTerm })
      .orWhere('LOWER(icd.description) LIKE :search', { search: searchTerm })
      .orWhere('LOWER(icd.search_terms) LIKE :search', { search: searchTerm })
      .orderBy('icd.use_count', 'DESC')
      .addOrderBy('icd.code', 'ASC')
      .take(limit)
      .getMany();

    return results.map((r, index) => ({
      code: r.code,
      title: r.description,
      version: 'ICD-10' as const,
      chapter: r.chapterDescription || r.chapter,
      score: 100 - index, // Higher score for earlier results
    }));
  }

  /**
   * Cache online results to local database
   */
  private async cacheResults(results: Array<{
    code: string;
    title: string;
    version: 'ICD-10' | 'ICD-11';
    chapter?: string;
    score: number;
  }>) {
    for (const result of results) {
      if (result.version !== 'ICD-10') continue; // Only cache ICD-10 for now
      
      try {
        const existing = await this.icd10CodeRepo.findOne({ where: { code: result.code } });
        
        if (existing) {
          // Update use count
          existing.useCount++;
          existing.lastUsedAt = new Date();
          await this.icd10CodeRepo.save(existing);
        } else {
          // Insert new code
          await this.icd10CodeRepo.save(this.icd10CodeRepo.create({
            code: result.code,
            description: result.title,
            chapterDescription: result.chapter,
            source: 'who_api',
            useCount: 1,
            lastUsedAt: new Date(),
          }));
        }
      } catch (error) {
        // Ignore duplicate key errors
        if (!error.message?.includes('duplicate')) {
          this.logger.warn(`Failed to cache ICD code ${result.code}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Record that a code was used (for popularity sorting)
   */
  async recordUsage(code: string) {
    try {
      await this.icd10CodeRepo
        .createQueryBuilder()
        .update()
        .set({ 
          useCount: () => 'use_count + 1',
          lastUsedAt: new Date(),
        })
        .where('code = :code', { code })
        .execute();
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      lastCheck: this.lastOnlineCheck,
      isConfigured: this.isConfigured(),
      localCodesCount: this.icd10CodeRepo.count(),
    };
  }

  // ==================== WHO API METHODS ====================

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
        ).pipe(
          timeout(this.API_TIMEOUT_MS),
          catchError((err) => {
            this.markOffline();
            throw err;
          }),
        ),
      );

      this.markOnline();

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

  /**
   * Search ICD-10 codes using NIH Clinical Tables API (free, no auth)
   */
  async searchICD10(query: string, language = 'en'): Promise<ICDSearchResult['destinationEntities']> {
    try {
      this.logger.log(`Searching ICD-10 for: ${query}`);
      
      const response = await firstValueFrom(
        this.httpService.get<[number, string[], null, [string, string][]]>(
          this.ICD10_API_URL,
          {
            params: { 
              terms: query,
              sf: 'code,name',
              maxList: 50,
            },
            headers: {
              Accept: 'application/json',
            },
          },
        ).pipe(
          timeout(this.API_TIMEOUT_MS),
          catchError((err) => {
            this.markOffline();
            throw err;
          }),
        ),
      );

      this.markOnline();
      
      // NIH API returns [totalCount, codes[], null, [[code, name], ...]]
      const [count, codes, _, results] = response.data;
      
      this.logger.log(`NIH ICD-10 API returned ${count} total results, ${results?.length || 0} in this batch`);
      
      if (!results || results.length === 0) {
        return [];
      }

      // Convert to our format
      return results.map((item, index) => ({
        id: item[0],
        title: item[1],
        theCode: item[0],
        chapter: '',
        score: 100 - index, // Higher score for earlier results
      }));
    } catch (error) {
      this.logger.error(`ICD-10 search failed: ${error.message}`);
      return [];
    }
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

  /**
   * Seed local database with common ICD-10 codes
   */
  async seedCommonCodes(): Promise<number> {
    const commonCodes = [
      { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', chapter: 'Infectious diseases' },
      { code: 'B34.9', description: 'Viral infection, unspecified', chapter: 'Infectious diseases' },
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', chapter: 'Endocrine diseases' },
      { code: 'E78.5', description: 'Hyperlipidemia, unspecified', chapter: 'Endocrine diseases' },
      { code: 'I10', description: 'Essential (primary) hypertension', chapter: 'Circulatory system' },
      { code: 'I25.9', description: 'Chronic ischaemic heart disease, unspecified', chapter: 'Circulatory system' },
      { code: 'J00', description: 'Acute nasopharyngitis (common cold)', chapter: 'Respiratory system' },
      { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', chapter: 'Respiratory system' },
      { code: 'J18.9', description: 'Pneumonia, unspecified organism', chapter: 'Respiratory system' },
      { code: 'J45.9', description: 'Asthma, unspecified', chapter: 'Respiratory system' },
      { code: 'K29.7', description: 'Gastritis, unspecified', chapter: 'Digestive system' },
      { code: 'K30', description: 'Functional dyspepsia', chapter: 'Digestive system' },
      { code: 'K59.0', description: 'Constipation', chapter: 'Digestive system' },
      { code: 'M54.5', description: 'Low back pain', chapter: 'Musculoskeletal system' },
      { code: 'M79.3', description: 'Panniculitis, unspecified', chapter: 'Musculoskeletal system' },
      { code: 'N39.0', description: 'Urinary tract infection, site not specified', chapter: 'Genitourinary system' },
      { code: 'R05', description: 'Cough', chapter: 'Symptoms and signs' },
      { code: 'R10.4', description: 'Other and unspecified abdominal pain', chapter: 'Symptoms and signs' },
      { code: 'R50.9', description: 'Fever, unspecified', chapter: 'Symptoms and signs' },
      { code: 'R51', description: 'Headache', chapter: 'Symptoms and signs' },
      { code: 'Z00.0', description: 'Encounter for general adult medical examination', chapter: 'Factors influencing health' },
      { code: 'B50.9', description: 'Plasmodium falciparum malaria, unspecified', chapter: 'Infectious diseases' },
      { code: 'A01.0', description: 'Typhoid fever', chapter: 'Infectious diseases' },
      { code: 'A06.0', description: 'Acute amoebic dysentery', chapter: 'Infectious diseases' },
      { code: 'B15.9', description: 'Hepatitis A without hepatic coma', chapter: 'Infectious diseases' },
      { code: 'D50.9', description: 'Iron deficiency anaemia, unspecified', chapter: 'Blood diseases' },
      { code: 'E66.9', description: 'Obesity, unspecified', chapter: 'Endocrine diseases' },
      { code: 'F32.9', description: 'Depressive episode, unspecified', chapter: 'Mental disorders' },
      { code: 'G43.9', description: 'Migraine, unspecified', chapter: 'Nervous system' },
      { code: 'H10.9', description: 'Conjunctivitis, unspecified', chapter: 'Eye diseases' },
      { code: 'H66.9', description: 'Otitis media, unspecified', chapter: 'Ear diseases' },
      { code: 'L30.9', description: 'Dermatitis, unspecified', chapter: 'Skin diseases' },
      { code: 'O80', description: 'Encounter for full-term uncomplicated delivery', chapter: 'Pregnancy' },
      { code: 'S06.0', description: 'Concussion', chapter: 'Injuries' },
      { code: 'T78.4', description: 'Allergy, unspecified', chapter: 'Injuries' },
    ];

    let seeded = 0;
    for (const item of commonCodes) {
      try {
        const existing = await this.icd10CodeRepo.findOne({ where: { code: item.code } });
        if (!existing) {
          await this.icd10CodeRepo.save(this.icd10CodeRepo.create({
            code: item.code,
            description: item.description,
            chapterDescription: item.chapter,
            source: 'seed',
            useCount: 10, // Give seeded codes a base popularity
          }));
          seeded++;
        }
      } catch (error) {
        // Ignore duplicate errors
      }
    }
    
    this.logger.log(`Seeded ${seeded} common ICD-10 codes`);
    return seeded;
  }

  /**
   * Check if online search is available
   * ICD-10 uses NIH API (always available, no config needed)
   * ICD-11 uses WHO API (requires credentials)
   */
  isConfigured(): boolean {
    // NIH API for ICD-10 doesn't need credentials
    return true;
  }

  /**
   * Check if WHO ICD-11 API is configured (for ICD-11 searches)
   */
  isWHOConfigured(): boolean {
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
