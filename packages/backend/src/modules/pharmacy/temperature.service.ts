import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  TemperatureLog,
  TemperatureSensor,
  AlertType,
  StorageType,
} from '../../database/entities/temperature-log.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

// Default temperature ranges (°C)
const DEFAULT_RANGES: Record<StorageType, { min: number; max: number }> = {
  [StorageType.REFRIGERATED]: { min: 2, max: 8 },
  [StorageType.FROZEN]: { min: -25, max: -15 },
  [StorageType.ROOM_TEMPERATURE]: { min: 15, max: 25 },
};

@Injectable()
export class TemperatureService {
  constructor(
    @InjectRepository(TemperatureLog)
    private logRepo: Repository<TemperatureLog>,
    @InjectRepository(TemperatureSensor)
    private sensorRepo: Repository<TemperatureSensor>,
  ) {}

  async recordReading(
    sensorId: string,
    temperature: number,
    humidity: number | null,
    tenantId?: string,
    facilityId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    // Find the sensor to determine acceptable range
    const sensor = await this.sensorRepo.findOne({
      where: {
        sensorId,
        tenantId: tid,
      },
    });

    const minTemp = sensor?.minTemp ?? DEFAULT_RANGES[StorageType.REFRIGERATED].min;
    const maxTemp = sensor?.maxTemp ?? DEFAULT_RANGES[StorageType.REFRIGERATED].max;
    const location = sensor?.location ?? 'Unknown';

    // Determine if out of range
    let isAlert = false;
    let alertType: AlertType | null = null;

    if (temperature < minTemp || temperature > maxTemp) {
      isAlert = true;
      const deviation = Math.max(
        temperature < minTemp ? minTemp - temperature : 0,
        temperature > maxTemp ? temperature - maxTemp : 0,
      );
      // More than 5°C deviation is critical
      alertType = deviation > 5 ? AlertType.CRITICAL : AlertType.WARNING;
    }

    const log = this.logRepo.create({
      sensorId,
      location,
      temperature,
      humidity: humidity ?? undefined,
      recordedAt: new Date(),
      isAlert,
      alertType: alertType ?? undefined,
      tenantId: tid,
      facilityId,
    } as Partial<TemperatureLog>);

    const saved = await this.logRepo.save(log);

    return {
      ...saved,
      sensorName: sensor?.name,
      rangeMin: minTemp,
      rangeMax: maxTemp,
    };
  }

  async getSensorReadings(sensorId: string, dateFrom?: string, dateTo?: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const where: Record<string, any> = { sensorId };
    where.tenantId = tid;

    if (dateFrom && dateTo) {
      where.recordedAt = Between(new Date(dateFrom), new Date(dateTo));
    } else if (dateFrom) {
      where.recordedAt = MoreThanOrEqual(new Date(dateFrom));
    } else if (dateTo) {
      where.recordedAt = LessThanOrEqual(new Date(dateTo));
    }

    const readings = await this.logRepo.find({
      where,
      order: { recordedAt: 'DESC' },
      take: 500,
    });

    // Compute stats
    if (readings.length === 0) {
      return { readings: [], stats: null };
    }

    const temps = readings.map((r) => Number(r.temperature));
    const stats = {
      count: readings.length,
      min: Math.min(...temps),
      max: Math.max(...temps),
      avg: Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2)),
      alertCount: readings.filter((r) => r.isAlert).length,
    };

    return { readings, stats };
  }

  async getActiveAlerts(tenantId?: string, facilityId?: string) {
    const tid = requireTenantId(tenantId);
    const where: Record<string, any> = {
      isAlert: true,
      acknowledgedAt: IsNull(),
    };
    where.tenantId = tid;
    if (facilityId) where.facilityId = facilityId;

    return this.logRepo.find({
      where,
      order: { recordedAt: 'DESC' },
    });
  }

  async acknowledgeAlert(alertId: string, userId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const alert = await this.logRepo.findOne({
      where: { id: alertId, tenantId: tid },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;
    return this.logRepo.save(alert);
  }

  async getSensors(tenantId?: string, facilityId?: string) {
    const tid = requireTenantId(tenantId);
    const where: any = {};
    where.tenantId = tid;
    if (facilityId) where.facilityId = facilityId;

    const sensors = await this.sensorRepo.find({
      where,
      order: { name: 'ASC' },
    });

    // Attach latest reading to each sensor
    const result = await Promise.all(
      sensors.map(async (sensor) => {
        const latestReading = await this.logRepo.findOne({
          where: { sensorId: sensor.sensorId, tenantId: tid },
          order: { recordedAt: 'DESC' },
        });
        return {
          ...sensor,
          latestReading: latestReading
            ? {
                temperature: latestReading.temperature,
                humidity: latestReading.humidity,
                recordedAt: latestReading.recordedAt,
                isAlert: latestReading.isAlert,
                alertType: latestReading.alertType,
              }
            : null,
        };
      }),
    );

    return result;
  }

  async createSensor(
    data: Partial<TemperatureSensor>,
    tenantId?: string,
  ): Promise<TemperatureSensor> {
    const tid = requireTenantId(tenantId);
    // Apply default ranges if not provided
    const storageType = data.storageType || StorageType.REFRIGERATED;
    const defaults = DEFAULT_RANGES[storageType];

    const sensor = this.sensorRepo.create({
      ...data,
      minTemp: data.minTemp ?? defaults.min,
      maxTemp: data.maxTemp ?? defaults.max,
      tenantId: tid,
    });
    return this.sensorRepo.save(sensor);
  }
}
