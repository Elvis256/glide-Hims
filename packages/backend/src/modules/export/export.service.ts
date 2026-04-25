import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, MoreThanOrEqual, LessThanOrEqual, ILike } from 'typeorm';
import * as XLSX from 'xlsx';
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Item } from '../../database/entities/inventory.entity';

interface ExportFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
}

interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
  ) {}

  async exportEntity(
    entity: string,
    format: string,
    tenantId: string,
    filters: ExportFilters,
  ): Promise<ExportResult> {
    let rows: Record<string, any>[];
    let headers: string[];

    switch (entity) {
      case 'users':
        ({ rows, headers } = await this.queryUsers(tenantId, filters));
        break;
      case 'audit-logs':
        ({ rows, headers } = await this.queryAuditLogs(tenantId, filters));
        break;
      case 'patients':
        ({ rows, headers } = await this.queryPatients(tenantId, filters));
        break;
      case 'invoices':
        ({ rows, headers } = await this.queryInvoices(tenantId, filters));
        break;
      case 'inventory':
        ({ rows, headers } = await this.queryInventory(tenantId, filters));
        break;
      default:
        throw new BadRequestException(`Unsupported entity: ${entity}`);
    }

    this.logger.log(`Exporting ${rows.length} ${entity} records as ${format}`);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${entity}-export-${timestamp}.${format}`;

    if (format === 'xlsx') {
      const buffer = this.generateXlsx(headers, rows, entity);
      return {
        buffer,
        filename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }

    const csv = this.generateCsv(headers, rows);
    return { buffer: Buffer.from(csv, 'utf-8'), filename, contentType: 'text/csv' };
  }

  generateUserImportTemplate(): string {
    const headers = ['username', 'email', 'full_name', 'phone', 'role', 'department', 'job_title'];
    const exampleRows = [
      [
        'jdoe',
        'jdoe@example.com',
        'John Doe',
        '+2348012345678',
        'doctor',
        'Medicine',
        'Consultant',
      ],
      [
        'asmith',
        'asmith@example.com',
        'Alice Smith',
        '+2348098765432',
        'nurse',
        'Nursing',
        'Head Nurse',
      ],
    ];
    return [headers.join(','), ...exampleRows.map((r) => r.join(','))].join('\n') + '\n';
  }

  // ── Private query methods ──────────────────────────────────────

  private async queryUsers(tenantId: string, filters: ExportFilters) {
    const headers = [
      'username',
      'full_name',
      'email',
      'phone',
      'status',
      'job_title',
      'department',
      'roles',
      'last_login_at',
      'created_at',
    ];

    const where = this.buildWhere<User>(tenantId, filters, ['fullName', 'email', 'username']);
    const users = await this.userRepository.find({
      where,
      relations: ['userRoles', 'userRoles.role', 'department'],
      order: { createdAt: 'DESC' },
    });

    const rows = users.map((u) => ({
      username: u.username,
      full_name: u.fullName,
      email: u.email,
      phone: u.phone || '',
      status: u.status,
      job_title: u.jobTitle || '',
      department: u.department?.name || '',
      roles: (u.userRoles || [])
        .map((ur) => ur.role?.name)
        .filter(Boolean)
        .join(', '),
      last_login_at: u.lastLoginAt ? u.lastLoginAt.toISOString() : '',
      created_at: u.createdAt ? u.createdAt.toISOString() : '',
    }));

    return { rows, headers };
  }

  private async queryAuditLogs(tenantId: string, filters: ExportFilters) {
    const headers = ['user', 'action', 'entity_type', 'entity_id', 'ip_address', 'created_at'];

    const where = this.buildWhere<AuditLog>(tenantId, filters, ['action', 'entityType']);
    const logs = await this.auditLogRepository.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    const rows = logs.map((l) => ({
      user: l.user?.username || l.userId,
      action: l.action,
      entity_type: l.entityType,
      entity_id: l.entityId || '',
      ip_address: l.ipAddress || '',
      created_at: l.createdAt ? l.createdAt.toISOString() : '',
    }));

    return { rows, headers };
  }

  private async queryPatients(tenantId: string, filters: ExportFilters) {
    const headers = [
      'mrn',
      'full_name',
      'gender',
      'date_of_birth',
      'phone',
      'email',
      'status',
      'created_at',
    ];

    const where = this.buildWhere<Patient>(tenantId, filters, ['fullName', 'mrn', 'phone']);
    const patients = await this.patientRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    const rows = patients.map((p) => ({
      mrn: p.mrn,
      full_name: p.fullName,
      gender: p.gender,
      date_of_birth: p.dateOfBirth ? p.dateOfBirth.toString() : '',
      phone: p.phone || '',
      email: p.email || '',
      status: p.status,
      created_at: p.createdAt ? p.createdAt.toISOString() : '',
    }));

    return { rows, headers };
  }

  private async queryInvoices(tenantId: string, filters: ExportFilters) {
    const headers = [
      'invoice_number',
      'patient',
      'total_amount',
      'paid_amount',
      'balance',
      'status',
      'created_at',
    ];

    const where = this.buildWhere<Invoice>(tenantId, filters, ['invoiceNumber']);
    const invoices = await this.invoiceRepository.find({
      where,
      relations: ['patient'],
      order: { createdAt: 'DESC' },
    });

    const rows = invoices.map((inv) => ({
      invoice_number: inv.invoiceNumber,
      patient: inv.patient?.fullName || inv.patientId,
      total_amount: Number(inv.totalAmount),
      paid_amount: Number(inv.amountPaid),
      balance: Number(inv.balanceDue),
      status: inv.status,
      created_at: inv.createdAt ? inv.createdAt.toISOString() : '',
    }));

    return { rows, headers };
  }

  private async queryInventory(tenantId: string, filters: ExportFilters) {
    const headers = [
      'name',
      'code',
      'category',
      'reorder_level',
      'unit_cost',
      'selling_price',
      'status',
    ];

    const where = this.buildWhere<Item>(tenantId, filters, ['name', 'code']);
    const items = await this.itemRepository.find({
      where,
      relations: ['itemCategory'],
      order: { name: 'ASC' },
    });

    const rows = items.map((it) => ({
      name: it.name,
      code: it.code,
      category: it.itemCategory?.name || it.category || '',
      reorder_level: it.reorderLevel,
      unit_cost: Number(it.unitCost),
      selling_price: Number(it.sellingPrice),
      status: it.status,
    }));

    return { rows, headers };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private buildWhere<T>(
    tenantId: string,
    filters: ExportFilters,
    searchFields: (keyof T)[],
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const base: Record<string, any> = {};
    if (tenantId) {
      base.tenantId = tenantId;
    }
    if (filters.startDate) {
      base.createdAt = MoreThanOrEqual(new Date(filters.startDate));
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      base.createdAt = filters.startDate
        ? MoreThanOrEqual(new Date(filters.startDate))
        : base.createdAt;
      // Apply both start and end using And if needed; for simplicity keep
      // end date as a separate clause when search fans-out below.
    }

    if (filters.search && searchFields.length > 0) {
      // Fan out into an OR across searchable columns
      return searchFields.map((field) => {
        const clause: Record<string, any> = { ...base, [field]: ILike(`%${filters.search}%`) };
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          clause.createdAt = this.combineDateRange(filters.startDate, end);
        }
        return clause as FindOptionsWhere<T>;
      });
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      base.createdAt = this.combineDateRange(filters.startDate, end);
    }

    return base as FindOptionsWhere<T>;
  }

  private combineDateRange(startDate?: string, end?: Date) {
    if (startDate && end) {
      // TypeORM doesn't have a built-in Between for FindOptionsWhere with
      // two operators on the same column, so we use the raw Between helper.
      const { Between } = require('typeorm');
      return Between(new Date(startDate), end);
    }
    if (end) {
      return LessThanOrEqual(end);
    }
    if (startDate) {
      return MoreThanOrEqual(new Date(startDate));
    }
    return undefined;
  }

  private generateCsv(headers: string[], rows: Record<string, any>[]): string {
    const escapeCsv = (val: any): string => {
      const str = val == null ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
    }
    return lines.join('\n') + '\n';
  }

  private generateXlsx(headers: string[], rows: Record<string, any>[], sheetName: string): Buffer {
    const data = [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}
