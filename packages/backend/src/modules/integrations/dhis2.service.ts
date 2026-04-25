import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AnalyticsService } from '../analytics/analytics.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

// ---------------------------------------------------------------------------
// DHIS2 Data Element Mapping
// ---------------------------------------------------------------------------
// Placeholder UIDs — facilities must configure actual DHIS2 data-element UIDs
// via the mapping table in their DHIS2 instance.

const DHIS2_DATA_ELEMENTS: Record<string, string> = {
  // OPD Summary
  OPD_NEW_ATTENDANCE: 'OPD_NEW_ATTENDANCE',
  OPD_RETURN_ATTENDANCE: 'OPD_RETURN_ATTENDANCE',
  OPD_TOTAL_ATTENDANCE: 'OPD_TOTAL_ATTENDANCE',

  // Inpatient
  IPD_ADMISSIONS: 'IPD_ADMISSIONS',
  IPD_DISCHARGES: 'IPD_DISCHARGES',
  DEATHS_TOTAL: 'DEATHS_TOTAL',
  REFERRALS_OUT: 'REFERRALS_OUT',

  // Maternal / Child Health
  MCH_ANC_FIRST_VISIT: 'MCH_ANC_FIRST_VISIT',
  MCH_ANC_RETURN_VISIT: 'MCH_ANC_RETURN_VISIT',
  MCH_NORMAL_DELIVERIES: 'MCH_NORMAL_DELIVERIES',
  MCH_CAESAREAN_DELIVERIES: 'MCH_CAESAREAN_DELIVERIES',
  MCH_LIVE_BIRTHS: 'MCH_LIVE_BIRTHS',
  MCH_STILL_BIRTHS: 'MCH_STILL_BIRTHS',
  MCH_MATERNAL_DEATHS: 'MCH_MATERNAL_DEATHS',

  // Pharmacy
  PHARMACY_TOTAL_PRESCRIPTIONS: 'PHARMACY_TOTAL_PRESCRIPTIONS',
  PHARMACY_STOCKOUT_DAYS: 'PHARMACY_STOCKOUT_DAYS',
};

const HMIS_105_DATASET_UID = 'HMIS_105_UID';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DHIS2Config {
  baseUrl: string;
  username: string;
  password: string;
  orgUnitId: string;
  enabled: boolean;
}

export interface DHIS2PushResult {
  success: boolean;
  imported: number;
  updated: number;
  ignored: number;
  conflicts: string[];
}

export interface DHIS2OrgUnit {
  id: string;
  name: string;
  level: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class DHIS2Service {
  private readonly logger = new Logger(DHIS2Service.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly analyticsService: AnalyticsService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  // ======================== Configuration ========================

  async getConfig(tenantId?: string): Promise<DHIS2Config> {
    const defaults: DHIS2Config = {
      baseUrl: 'https://hmis2.health.go.ug/api',
      username: '',
      password: '',
      orgUnitId: '',
      enabled: false,
    };

    try {
      const settings = await this.systemSettingsService.getByPrefix('dhis2.', tenantId);
      for (const s of settings) {
        switch (s.key) {
          case 'dhis2.baseUrl':
            defaults.baseUrl = s.value;
            break;
          case 'dhis2.username':
            defaults.username = s.value;
            break;
          case 'dhis2.password':
            defaults.password = s.value;
            break;
          case 'dhis2.orgUnitId':
            defaults.orgUnitId = s.value;
            break;
          case 'dhis2.enabled':
            defaults.enabled = s.value === true || s.value === 'true';
            break;
        }
      }
    } catch {
      // Settings not found — return defaults
    }

    return defaults;
  }

  /** Return config with the password masked. */
  async getConfigMasked(
    tenantId?: string,
  ): Promise<DHIS2Config & { lastPush?: string; lastPushResult?: string }> {
    const config = await this.getConfig(tenantId);
    const masked = { ...config, password: config.password ? '••••••••' : '' };

    try {
      const lp = await this.systemSettingsService.getByKey('dhis2.lastPush', tenantId);
      (masked as any).lastPush = lp.value;
    } catch {
      /* not set yet */
    }

    try {
      const lr = await this.systemSettingsService.getByKey('dhis2.lastPushResult', tenantId);
      (masked as any).lastPushResult = lr.value;
    } catch {
      /* not set yet */
    }

    return masked as any;
  }

  async saveConfig(tenantId: string | undefined, config: Partial<DHIS2Config>): Promise<void> {
    if (config.baseUrl !== undefined) {
      await this.systemSettingsService.upsert(
        'dhis2.baseUrl',
        config.baseUrl,
        tenantId,
        'DHIS2 API base URL',
      );
    }
    if (config.username !== undefined) {
      await this.systemSettingsService.upsert(
        'dhis2.username',
        config.username,
        tenantId,
        'DHIS2 API username',
      );
    }
    if (config.password !== undefined && config.password !== '••••••••') {
      // TODO: encrypt password before storing — system-settings doesn't have encryption yet
      await this.systemSettingsService.upsert(
        'dhis2.password',
        config.password,
        tenantId,
        'DHIS2 API password (stored as-is)',
      );
    }
    if (config.orgUnitId !== undefined) {
      await this.systemSettingsService.upsert(
        'dhis2.orgUnitId',
        config.orgUnitId,
        tenantId,
        'DHIS2 organisation unit ID',
      );
    }
    if (config.enabled !== undefined) {
      await this.systemSettingsService.upsert(
        'dhis2.enabled',
        config.enabled,
        tenantId,
        'DHIS2 integration enabled',
      );
    }
  }

  // ======================== Test Connection ========================

  async testConnection(
    tenantId?: string,
  ): Promise<{ success: boolean; message: string; orgUnitName?: string }> {
    const config = await this.getConfig(tenantId);

    if (!config.baseUrl || !config.username || !config.password) {
      return { success: false, message: 'DHIS2 credentials are not configured' };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${config.baseUrl}/me`, {
          auth: { username: config.username, password: config.password },
          timeout: 15000,
        }),
      );

      const user = response.data;
      let orgUnitName: string | undefined;

      if (config.orgUnitId) {
        try {
          const ouResp = await firstValueFrom(
            this.httpService.get(
              `${config.baseUrl}/organisationUnits/${config.orgUnitId}?fields=displayName`,
              { auth: { username: config.username, password: config.password }, timeout: 10000 },
            ),
          );
          orgUnitName = ouResp.data?.displayName;
        } catch {
          /* org unit lookup failed — non-critical */
        }
      }

      return {
        success: true,
        message: `Connected as ${user.displayName || user.userCredentials?.username || config.username}`,
        orgUnitName,
      };
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        return { success: false, message: 'Authentication failed — check username/password' };
      }
      if (status === 403) {
        return {
          success: false,
          message: 'Access denied — user does not have required permissions',
        };
      }
      this.logger.error('DHIS2 connection test failed', error.message);
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }

  // ======================== Organisation Units ========================

  async getOrgUnits(tenantId?: string): Promise<DHIS2OrgUnit[]> {
    const config = await this.getConfig(tenantId);

    if (!config.baseUrl || !config.username || !config.password) {
      return [];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${config.baseUrl}/organisationUnits?fields=id,displayName~rename(name),level&paging=false&order=name:asc`,
          { auth: { username: config.username, password: config.password }, timeout: 30000 },
        ),
      );

      return (response.data?.organisationUnits || []).map((ou: any) => ({
        id: ou.id,
        name: ou.name,
        level: ou.level,
      }));
    } catch (error: any) {
      this.logger.error('Failed to fetch DHIS2 org units', error.message);
      return [];
    }
  }

  // ======================== Push HMIS 105 ========================

  async pushHMIS105(
    tenantId: string | undefined,
    facilityId: string,
    month: number,
    year: number,
  ): Promise<DHIS2PushResult> {
    const config = await this.getConfig(tenantId);

    if (!config.enabled) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        ignored: 0,
        conflicts: ['DHIS2 integration is not enabled'],
      };
    }
    if (!config.baseUrl || !config.username || !config.password || !config.orgUnitId) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        ignored: 0,
        conflicts: ['DHIS2 is not fully configured'],
      };
    }

    // 1. Fetch HMIS 105 data from analytics service
    let hmisData: any;
    try {
      hmisData = await this.analyticsService.getHMIS105Report(tenantId, facilityId, month, year);
    } catch (error: any) {
      this.logger.error('Failed to generate HMIS 105 data', error.message);
      return {
        success: false,
        imported: 0,
        updated: 0,
        ignored: 0,
        conflicts: [`Failed to generate HMIS 105: ${error.message}`],
      };
    }

    // 2. Build DHIS2 dataValueSets payload
    const period = `${year}${String(month).padStart(2, '0')}`;
    const dataValues = this.buildDataValues(hmisData, config.orgUnitId, period);

    if (dataValues.length === 0) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        ignored: 0,
        conflicts: ['No data values to push'],
      };
    }

    const payload = {
      dataSet: HMIS_105_DATASET_UID,
      period,
      orgUnit: config.orgUnitId,
      dataValues,
    };

    // 3. POST to DHIS2
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${config.baseUrl}/dataValueSets`, payload, {
          auth: { username: config.username, password: config.password },
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
        }),
      );

      const summary = response.data?.importCount || response.data?.response?.importCount || {};
      const conflicts = (response.data?.conflicts || response.data?.response?.conflicts || []).map(
        (c: any) => c.value || c.object || JSON.stringify(c),
      );

      const result: DHIS2PushResult = {
        success: (summary.imported || 0) + (summary.updated || 0) > 0 || conflicts.length === 0,
        imported: summary.imported || 0,
        updated: summary.updated || 0,
        ignored: summary.ignored || 0,
        conflicts,
      };

      // Record last push metadata
      const now = new Date().toISOString();
      await this.systemSettingsService.upsert(
        'dhis2.lastPush',
        now,
        tenantId,
        'Last DHIS2 push timestamp',
      );
      await this.systemSettingsService.upsert(
        'dhis2.lastPushResult',
        result.success ? 'success' : 'failed',
        tenantId,
        'Last DHIS2 push result',
      );

      return result;
    } catch (error: any) {
      this.logger.error('DHIS2 push failed', error.message);

      await this.systemSettingsService.upsert('dhis2.lastPush', new Date().toISOString(), tenantId);
      await this.systemSettingsService.upsert('dhis2.lastPushResult', 'failed', tenantId);

      const detail = error.response?.data?.message || error.message;
      return {
        success: false,
        imported: 0,
        updated: 0,
        ignored: 0,
        conflicts: [`Push failed: ${detail}`],
      };
    }
  }

  // ======================== Helpers ========================

  private buildDataValues(
    hmisData: any,
    orgUnit: string,
    period: string,
  ): Array<{ dataElement: string; categoryOptionCombo?: string; value: string }> {
    const values: Array<{ dataElement: string; categoryOptionCombo?: string; value: string }> = [];

    const push = (key: string, value: number | string) => {
      const uid = DHIS2_DATA_ELEMENTS[key];
      if (uid && value !== undefined && value !== null) {
        values.push({ dataElement: uid, value: String(value) });
      }
    };

    // Summary section
    const summary = hmisData?.sectionE || hmisData?.sections?.summary;
    if (summary) {
      push('OPD_NEW_ATTENDANCE', summary.newAttendances ?? summary.newPatients ?? 0);
      push('OPD_RETURN_ATTENDANCE', summary.reAttendances ?? summary.returnPatients ?? 0);
      push('OPD_TOTAL_ATTENDANCE', summary.totalAttendances ?? summary.totalOPDAttendance ?? 0);
      push('IPD_ADMISSIONS', summary.totalAdmissions ?? 0);
      push('IPD_DISCHARGES', summary.totalDischarges ?? 0);
      push('DEATHS_TOTAL', summary.totalDeaths ?? 0);
      push('REFERRALS_OUT', summary.referralsOut ?? 0);
    }

    // Maternal health section
    const mch = hmisData?.sectionD || hmisData?.sections?.maternalHealth;
    if (mch) {
      push('MCH_ANC_FIRST_VISIT', mch.ancFirstVisits ?? 0);
      push('MCH_ANC_RETURN_VISIT', mch.ancReturnVisits ?? 0);
      push('MCH_NORMAL_DELIVERIES', mch.normalDeliveries ?? 0);
      push('MCH_CAESAREAN_DELIVERIES', mch.caesareanDeliveries ?? 0);
      push('MCH_LIVE_BIRTHS', mch.liveBirths ?? 0);
      push('MCH_STILL_BIRTHS', mch.stillBirths ?? 0);
      push('MCH_MATERNAL_DEATHS', mch.maternalDeaths ?? 0);
    }

    // Pharmacy section
    const pharm = hmisData?.sectionC || hmisData?.sections?.pharmacy;
    if (pharm) {
      push('PHARMACY_TOTAL_PRESCRIPTIONS', pharm.totalPrescriptions ?? 0);
      push('PHARMACY_STOCKOUT_DAYS', pharm.stockOutDays ?? 0);
    }

    // OPD diagnosis chapters — dynamic elements
    const diagChapters =
      hmisData?.sectionA?.diagnosisGroups || hmisData?.sections?.opdDiagnoses?.byChapter || [];
    for (const ch of diagChapters) {
      const prefix = `OPD_${(ch.chapter || ch.chapterLetter || '').replace(/[^A-Z0-9]/gi, '_')}`;
      const fields = [
        ['MALE_0_28D', ch.male_0_28d],
        ['FEMALE_0_28D', ch.female_0_28d],
        ['MALE_29D_4Y', ch.male_29d_4y],
        ['FEMALE_29D_4Y', ch.female_29d_4y],
        ['MALE_5_12Y', ch.male_5_12y],
        ['FEMALE_5_12Y', ch.female_5_12y],
        ['MALE_13_19Y', ch.male_13_19y],
        ['FEMALE_13_19Y', ch.female_13_19y],
        ['MALE_20_59Y', ch.male_20_59y],
        ['FEMALE_20_59Y', ch.female_20_59y],
        ['MALE_60PLUS', ch.male_60plus],
        ['FEMALE_60PLUS', ch.female_60plus],
      ];
      for (const [suffix, val] of fields) {
        if (val !== undefined && val !== null) {
          values.push({ dataElement: `${prefix}_${suffix}`, value: String(val) });
        }
      }
    }

    // Lab section — dynamic
    const labCats =
      hmisData?.sectionB?.labCategories || hmisData?.sections?.laboratory?.byCategory || [];
    for (const cat of labCats) {
      const key = (cat.category || '').replace(/[^A-Z0-9]/gi, '_').toUpperCase();
      values.push({ dataElement: `LAB_${key}_TESTS`, value: String(cat.totalTests ?? 0) });
      values.push({
        dataElement: `LAB_${key}_POSITIVE`,
        value: String(cat.positiveOrAbnormal ?? 0),
      });
    }

    return values;
  }
}
