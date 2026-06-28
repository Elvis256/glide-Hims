#!/usr/bin/env node
/**
 * Glide-HIMS System Document PDF Generator
 *
 * Usage:  node packages/backend/scripts/generate-system-doc-pdf.js
 * Output: GLIDE-HIMS-SYSTEM-DOCUMENT.pdf in the repo root
 *
 * Requires: pdfkit (already a backend dependency)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outPath = path.resolve(__dirname, '..', '..', '..', 'GLIDE-HIMS-SYSTEM-DOCUMENT.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  bufferPages: true,
  info: {
    Title: 'Glide-HIMS — System Design, Process Flows & Roadmap',
    Author: 'Glide-HIMS Engineering',
    Subject: 'System Architecture Document',
    CreationDate: new Date(),
  },
});

const out = fs.createWriteStream(outPath);
doc.pipe(out);

// ── Colours & Fonts ──
const C = {
  primary: '#1a365d',
  secondary: '#2b6cb0',
  accent: '#3182ce',
  text: '#1a202c',
  muted: '#4a5568',
  light: '#e2e8f0',
  lightBg: '#f7fafc',
  white: '#ffffff',
  green: '#276749',
  red: '#c53030',
  orange: '#c05621',
  greenBg: '#f0fff4',
  redBg: '#fff5f5',
  orangeBg: '#fffaf0',
  tableBorder: '#cbd5e0',
  tableHeader: '#2d3748',
  tableHeaderBg: '#edf2f7',
  tableAlt: '#f7fafc',
};

const pageW = doc.page.width - 100; // usable width

// ── Helpers ──

function heading1(text) {
  doc.moveDown(1.5);
  doc.fontSize(22).font('Helvetica-Bold').fillColor(C.primary).text(text, 50, doc.y, { width: pageW });
  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(50 + pageW, doc.y).strokeColor(C.accent).lineWidth(2).stroke();
  doc.moveDown(0.8);
}

function heading2(text) {
  checkPage(60);
  doc.moveDown(1);
  doc.fontSize(16).font('Helvetica-Bold').fillColor(C.secondary).text(text, 50, doc.y, { width: pageW });
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(50 + pageW * 0.5, doc.y).strokeColor(C.light).lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function heading3(text) {
  checkPage(40);
  doc.moveDown(0.6);
  doc.fontSize(13).font('Helvetica-Bold').fillColor(C.primary).text(text, 50, doc.y, { width: pageW });
  doc.moveDown(0.3);
}

function para(text) {
  checkPage(30);
  doc.fontSize(10).font('Helvetica').fillColor(C.text).text(text, 50, doc.y, { lineGap: 3, align: 'justify', width: pageW });
  doc.moveDown(0.4);
}

function bullet(text, indent = 0) {
  checkPage(20);
  const x = 55 + indent * 15;
  doc.fontSize(10).font('Helvetica').fillColor(C.text);
  doc.text(`\u2022  ${text}`, x, doc.y, { lineGap: 2, width: pageW - (x - 50) });
  doc.moveDown(0.15);
}

function code(text) {
  const lines = text.split('\n');
  const blockH = lines.length * 13 + 16;
  checkPage(blockH + 10);
  const y0 = doc.y;
  doc.rect(50, y0, pageW, blockH).fill(C.lightBg);
  doc.rect(50, y0, pageW, blockH).strokeColor(C.light).lineWidth(0.5).stroke();
  doc.fontSize(8.5).font('Courier').fillColor(C.muted);
  let yy = y0 + 8;
  for (const line of lines) {
    doc.text(line, 58, yy, { width: pageW - 16 });
    yy += 13;
  }
  doc.y = y0 + blockH + 4;
  doc.moveDown(0.3);
}

function checkPage(needed) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
  }
}

function drawTableHeader(headers, colWidths, startX, fontSize, rowH, totalW) {
  const y = doc.y;
  doc.rect(startX, y, totalW, rowH).fill(C.tableHeaderBg);
  doc.rect(startX, y, totalW, rowH).strokeColor(C.tableBorder).lineWidth(0.5).stroke();
  let x = startX;
  doc.fontSize(fontSize).font('Helvetica-Bold').fillColor(C.tableHeader);
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 4, y + 6, { width: colWidths[i] - 8 });
    x += colWidths[i];
  }
  doc.y = y + rowH;
}

function table(headers, rows, colWidths) {
  const rowH = 22;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const startX = 50;
  const fontSize = 8.5;
  const pageBottom = doc.page.height - 60;

  // header — ensure room for header + at least 1 row
  checkPage(rowH * 2 + 10);
  drawTableHeader(headers, colWidths, startX, fontSize, rowH, totalW);

  // rows
  for (let r = 0; r < rows.length; r++) {
    // estimate row height
    doc.fontSize(fontSize).font('Helvetica');
    let maxLines = 1;
    for (let c = 0; c < rows[r].length; c++) {
      const w = colWidths[c] - 8;
      const h = doc.heightOfString(String(rows[r][c]), { width: w });
      const lines = Math.ceil(h / 12);
      if (lines > maxLines) maxLines = lines;
    }
    const thisRowH = Math.max(rowH, maxLines * 13 + 6);

    // page break: add page and re-draw header
    if (doc.y + thisRowH > pageBottom) {
      doc.addPage();
      drawTableHeader(headers, colWidths, startX, fontSize, rowH, totalW);
    }

    const y = doc.y;
    if (r % 2 === 1) {
      doc.rect(startX, y, totalW, thisRowH).fill(C.tableAlt);
    }
    // border
    doc.rect(startX, y, totalW, thisRowH).strokeColor(C.tableBorder).lineWidth(0.5).stroke();

    let x = startX;
    doc.fontSize(fontSize).font('Helvetica').fillColor(C.text);
    for (let c = 0; c < rows[r].length; c++) {
      doc.text(String(rows[r][c]), x + 4, y + 5, { width: colWidths[c] - 8 });
      x += colWidths[c];
    }
    doc.y = y + thisRowH;
  }
  doc.y = doc.y + 6;
  doc.moveDown(0.3);
}

// ══════════════════════════════════════════════════════════════
//  COVER PAGE
// ══════════════════════════════════════════════════════════════

doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.primary);
doc.moveDown(8);
doc.fontSize(36).font('Helvetica-Bold').fillColor(C.white)
  .text('Glide-HIMS', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(18).font('Helvetica').fillColor('#90cdf4')
  .text('System Design, Process Flows & Roadmap', { align: 'center' });
doc.moveDown(3);
doc.moveTo(doc.page.width * 0.3, doc.y)
  .lineTo(doc.page.width * 0.7, doc.y).strokeColor('#90cdf4').lineWidth(1).stroke();
doc.moveDown(1.5);
doc.fontSize(12).font('Helvetica').fillColor('#e2e8f0')
  .text('Version 1.0  |  27 June 2026', { align: 'center' });
doc.moveDown(0.5);
doc.text('Comprehensive Architecture & Process Reference', { align: 'center' });
doc.moveDown(4);
doc.fontSize(10).fillColor('#a0aec0')
  .text('192 Entities  \u00b7  94 Modules  \u00b7  177 Services  \u00b7  104 Migrations', { align: 'center' });
doc.moveDown(0.5);
doc.text('13 Process Flows  \u00b7  16 Stakeholder Roles  \u00b7  12 Domains', { align: 'center' });

// ══════════════════════════════════════════════════════════════
//  TABLE OF CONTENTS
// ══════════════════════════════════════════════════════════════
doc.addPage();

heading1('Table of Contents');

const tocItems = [
  ['Part 1', 'System Architecture & Design'],
  ['  1.1', 'Technology Stack'],
  ['  1.2', 'Monorepo Structure'],
  ['  1.3', 'Multi-Tenant SaaS Model'],
  ['  1.4', 'Entity-Relationship Overview (192 Entities)'],
  ['  1.5', 'Authentication & Authorization'],
  ['  1.6', 'Stakeholder Roles (16 Roles)'],
  ['Part 2', 'Process Flows (13 Flows)'],
  ['  2.1', 'Outpatient (OPD) Journey'],
  ['  2.2', 'Inpatient (IPD) Journey'],
  ['  2.3', 'Emergency Department'],
  ['  2.4', 'Pharmacy & Dispensing'],
  ['  2.5', 'Laboratory'],
  ['  2.6', 'Radiology & Imaging'],
  ['  2.7', 'Billing & Insurance'],
  ['  2.8', 'Procurement & Supply Chain'],
  ['  2.9', 'Human Resources'],
  ['  2.10', 'Inventory & Stores'],
  ['  2.11', 'Maternity Care'],
  ['  2.12', 'Finance & Accounting'],
  ['  2.13', 'SaaS Platform Operations'],
  ['Part 3', 'System Health Audit'],
  ['  3.1', 'Test Coverage (41.5%)'],
  ['  3.2', 'Audit Logging Gaps (27.1%)'],
  ['  3.3', 'Missing Workflow State Machines'],
  ['  3.4', 'Configuration & Report Gaps'],
  ['Part 4', 'Recommended Next Actions (25 Items)'],
];

for (const [num, title] of tocItems) {
  const isMainPart = num.startsWith('Part');
  doc.fontSize(isMainPart ? 11 : 10)
    .font(isMainPart ? 'Helvetica-Bold' : 'Helvetica')
    .fillColor(isMainPart ? C.primary : C.text)
    .text(`${num}    ${title}`, isMainPart ? 50 : 65);
  doc.moveDown(0.15);
}

// ══════════════════════════════════════════════════════════════
//  PART 1 — SYSTEM ARCHITECTURE
// ══════════════════════════════════════════════════════════════
doc.addPage();
doc.fontSize(28).font('Helvetica-Bold').fillColor(C.primary).text('Part 1');
doc.fontSize(18).font('Helvetica').fillColor(C.secondary).text('System Architecture & Design');
doc.moveDown(1);

// 1.1 Technology Stack
heading2('1.1 Technology Stack');

heading3('Backend');
table(
  ['Layer', 'Technology', 'Version'],
  [
    ['Runtime', 'Node.js', '20 LTS'],
    ['Framework', 'NestJS', '10.3.x'],
    ['ORM', 'TypeORM', '0.3.19'],
    ['Database', 'PostgreSQL', '15+'],
    ['Cache', 'Redis (ioredis)', '5.10.x'],
    ['Auth', 'Passport + JWT', '10.x'],
    ['Real-time', 'Socket.IO', '4.8.x'],
    ['Scheduling', '@nestjs/schedule', '6.1.x'],
    ['Email', 'Nodemailer', '7.0.x'],
    ['PDF', 'PDFKit', '0.18.x'],
    ['Excel', 'xlsx', '0.18.x'],
    ['Validation', 'class-validator', '-'],
    ['API Docs', '@nestjs/swagger', '7.1.x'],
    ['Logging', 'Pino (nestjs-pino)', '3.5.x'],
    ['Security', 'Helmet, bcrypt', '8.x / 5.1.x'],
    ['MFA', 'otpauth', '9.5.x'],
    ['Math', 'decimal.js', '10.6.x'],
  ],
  [130, 200, 165],
);

heading3('Frontend');
table(
  ['Layer', 'Technology', 'Version'],
  [
    ['UI', 'React', '19.2.x'],
    ['Build', 'Vite', '5.4.x'],
    ['Routing', 'React Router', '6.30.x'],
    ['State', 'Zustand', '5.0.x'],
    ['Data', 'TanStack React Query', '5.90.x'],
    ['Forms', 'React Hook Form + Zod', '7.71.x / 4.3.x'],
    ['Offline', 'Dexie (IndexedDB)', '4.2.x'],
    ['Charts', 'Recharts', '3.7.x'],
    ['CSS', 'Tailwind CSS', '4.1.x'],
    ['PDF', 'jsPDF + AutoTable', '4.2.x / 5.0.x'],
    ['PWA', 'vite-plugin-pwa + Workbox', '1.2.x / 7.4.x'],
    ['Real-time', 'socket.io-client', '4.8.x'],
  ],
  [130, 200, 165],
);

// 1.2 Monorepo Structure
heading2('1.2 Monorepo Structure');
para('The project is a pnpm monorepo with three packages:');
table(
  ['Package', 'Path', 'Description'],
  [
    ['backend', 'packages/backend/', 'NestJS API — 94 modules, 192 entities'],
    ['frontend', 'packages/frontend/', 'React SPA — Vite + Tailwind + PWA'],
    ['fingerprint-service', 'packages/fingerprint-service/', 'Biometric capture service'],
  ],
  [120, 180, 195],
);

code(
  'glide-Hims/current/\n' +
  '\u251c\u2500\u2500 pnpm-workspace.yaml\n' +
  '\u251c\u2500\u2500 packages/\n' +
  '\u2502   \u251c\u2500\u2500 backend/src/\n' +
  '\u2502   \u2502   \u251c\u2500\u2500 common/        (guards, interceptors, utils)\n' +
  '\u2502   \u2502   \u251c\u2500\u2500 database/      (entities/, migrations/)\n' +
  '\u2502   \u2502   \u2514\u2500\u2500 modules/       (94 NestJS modules)\n' +
  '\u2502   \u251c\u2500\u2500 frontend/src/\n' +
  '\u2502   \u2514\u2500\u2500 fingerprint-service/\n' +
  '\u251c\u2500\u2500 docker-compose.yml\n' +
  '\u2514\u2500\u2500 docker-compose.hybrid.yml'
);

// 1.3 Multi-Tenant SaaS Model
heading2('1.3 Multi-Tenant SaaS Model');
para('Architecture: Row-level multi-tenancy. All data tables include a tenant_id column (NOT NULL). Tenancy is enforced at multiple layers:');

bullet('TenantContextMiddleware — resolves req.tenantContext from JWT / x-facility-id header');
bullet('TenantContextGuard — ensures tenant context exists on protected routes');
bullet('Tenant-Aware Repository — auto-appends WHERE tenant_id = :tenantId');
bullet('Tenant Subscriber — auto-populates tenant_id on INSERT/UPDATE');
bullet('Database constraints — FK to tenants.id, composite indexes for efficient filtering');

doc.moveDown(0.3);
heading3('Tenant Hierarchy');
code(
  'Tenant (Organization)\n' +
  '  \u2514\u2500\u2500 Facility (Hospital / Clinic / Pharmacy)\n' +
  '       \u2514\u2500\u2500 Department\n' +
  '            \u2514\u2500\u2500 Ward / Store / Lab / Theatre'
);

heading3('Deployment Models');
table(
  ['Model', 'Description'],
  [
    ['SaaS (Cloud)', 'Multi-tenant on shared infrastructure. Control plane at hmisdemo.itsolutionsuganda.com'],
    ['Hybrid (On-Premise)', 'Docker Compose on customer LAN. Single-tenant. Connects to control plane for licensing/updates'],
  ],
  [140, 355],
);

// 1.4 Entity-Relationship Overview
heading2('1.4 Entity-Relationship Overview');
para('Total entities: 192 across 12 domains.');

table(
  ['Domain', 'Count', 'Key Entities'],
  [
    ['Clinical & Patient', '30', 'Patient, Encounter, ClinicalNote, Prescription, Diagnosis, Vital, SurgeryCase'],
    ['Laboratory', '8', 'LabTest, LabSample, LabResult, LabQC, LabEquipment, CriticalResultAlert'],
    ['Radiology', '3', 'ImagingModality, ImagingOrder, ImagingResult'],
    ['Pharmacy', '5', 'PharmacySale, DrugClassification, DrugInteractionOverride'],
    ['Inventory & Procurement', '20', 'Item, BatchStock, PurchaseRequest, PurchaseOrder, GoodsReceipt, Supplier'],
    ['Billing & Finance', '25', 'Invoice, JournalEntry, ChartOfAccount, InsuranceClaim, PricingRule'],
    ['HR', '18', 'Employee, Attendance, LeaveRequest, PayrollRun, Payslip, PerformanceAppraisal'],
    ['Maternity', '7', 'AntenatalRegistration, LabourRecord, DeliveryOutcome, ImmunizationSchedule'],
    ['Facility & Org', '8', 'Facility, Department, Ward, Bed, Theatre'],
    ['Auth & Access', '13', 'User, Role, Permission, Session, ApiKey, LoginHistory, PasswordPolicy'],
    ['SaaS Platform', '15+', 'Tenant, License, SaasPlan, SaasSubscription, SaasInvoice, SaasPayment'],
    ['System & Infra', '20+', 'AuditLog, FeatureFlag, Deployment, Backup, SyncQueue, SystemSetting'],
  ],
  [120, 40, 335],
);

// 1.5 Auth
heading2('1.5 Authentication & Authorization');

heading3('Authentication: JWT + Passport');
bullet('Login: POST /auth/login \u2192 username/password \u2192 JWT (access + refresh tokens)');
bullet('JWT stored in accessToken cookie OR Authorization: Bearer header');
bullet('MFA: If user.mfaEnabled, login requires TOTP code (otpauth)');
bullet('Account lockout: After N failed attempts, locked until lockedUntil');
bullet('Token revocation: tokenVersion in JWT checked against DB (5s Redis cache)');

heading3('Authorization Layers');
table(
  ['Layer', 'Decorator', 'Guard'],
  [
    ['Public bypass', '@Public()', 'GlobalJwtAuthGuard (skip)'],
    ['Role-based', '@Auth(...roles)', 'RolesGuard'],
    ['Permission-based', '@AuthWithPermissions(...perms)', 'PermissionsGuard'],
    ['Module-based', '@AuthWithModule(mod, ...perms)', 'ModuleGuard'],
    ['Ownership', '@AuthWithOwnership(perm, cfg)', 'OwnershipGuard'],
    ['Feature flag', '@RequireFeature()', 'FeatureGuard'],
    ['Facility scope', '@FacilityAccess()', 'FacilityGuard'],
    ['System admin', '@SystemAdminOnly()', 'RolesGuard'],
  ],
  [130, 200, 165],
);

heading3('Permission Resolution');
bullet('Fetch user\u2019s direct roles (filtered by facility)');
bullet('Walk role inheritance chain (max depth 10) via parentRoleId');
bullet('Collect permissions from roles + inherited roles + permission groups');
bullet('Collect direct user permissions (UserPermission overrides)');
bullet('Deduplicate and cache (60s TTL, key: perms:{tenantId}:{userId}:{facilityId})');

// 1.6 Stakeholder Roles
heading2('1.6 Stakeholder Roles');
table(
  ['#', 'Role', 'Key Modules'],
  [
    ['1', 'System Administrator', 'Admin, Tenants, Licensing, Deployments, SaaS'],
    ['2', 'Facility Administrator', 'Admin, Facilities, Users, Roles, Settings'],
    ['3', 'Doctor / Clinician', 'Encounters, Clinical Notes, Prescriptions, Orders'],
    ['4', 'Nurse', 'Encounters, Vitals, IPD, Maternity, Emergency'],
    ['5', 'Receptionist', 'Patients, Appointments, Queue, Encounters'],
    ['6', 'Cashier / Billing', 'Billing, POS, Payments'],
    ['7', 'Pharmacist', 'Pharmacy, Prescriptions, Drug Mgmt, Inventory'],
    ['8', 'Lab Technician', 'Lab, Lab Supplies'],
    ['9', 'Lab QC Officer', 'Lab (QC workflow — validate, release, amend)'],
    ['10', 'Radiologist / Imaging', 'Radiology'],
    ['11', 'HR Manager', 'HR (payroll, leave, training, appraisals)'],
    ['12', 'Finance Officer', 'Finance, Billing (GL, journals, reconciliation)'],
    ['13', 'Procurement Officer', 'Procurement, Suppliers, Inventory'],
    ['14', 'Store / Inventory Mgr', 'Inventory, Stores, Stock Transfer'],
    ['15', 'Insurance Officer', 'Insurance (claims, pre-auth, payer coordination)'],
    ['16', 'Patient (Portal)', 'Patient Portal (view records, book appts)'],
  ],
  [25, 130, 340],
);

// ══════════════════════════════════════════════════════════════
//  PART 2 — PROCESS FLOWS
// ══════════════════════════════════════════════════════════════
doc.addPage();
doc.fontSize(28).font('Helvetica-Bold').fillColor(C.primary).text('Part 2');
doc.fontSize(18).font('Helvetica').fillColor(C.secondary).text('Process Flows');
doc.moveDown(1);

// 2.1 OPD
heading2('2.1 Outpatient (OPD) Journey');
para('9-step flow from patient arrival to consultation completion. Module: encounters.service');

heading3('Flow Steps');
table(
  ['Step', 'Action', 'Stakeholder', 'Module', 'Status'],
  [
    ['1', 'Patient Registration', 'Receptionist', 'patients.service', '-'],
    ['2', 'Appointment (optional)', 'Receptionist', 'appointments.service', 'SCHEDULED'],
    ['3', 'Create Encounter', 'Receptionist', 'encounters.service', 'REGISTERED'],
    ['4', 'Triage', 'Nurse', 'vitals.service', 'TRIAGE'],
    ['5', 'Queue Entry', 'System', 'queue-management.service', 'WAITING'],
    ['6', 'Consultation', 'Doctor', 'clinical-notes.service', 'IN_CONSULTATION'],
    ['7', 'Orders (lab/imaging/Rx)', 'Doctor', 'orders/lab/radiology/Rx', 'PENDING_*'],
    ['8', 'Payment', 'Cashier', 'billing.service', 'Invoice: PAID'],
    ['9', 'Completion', 'System', 'encounters.service', 'COMPLETED'],
  ],
  [35, 130, 80, 130, 120],
);

heading3('Business Rules');
bullet('Double-booking prevention: pessimistic lock on provider time slots');
bullet('Active encounter guard: only one active OPD encounter per patient');
bullet('Bounce limit: max 5 returns to doctor; escalates to supervisor at 3+');
bullet('Auto-billing: consultation fee auto-charged on encounter creation (CON-OPD)');
bullet('Queue priority: RETURN_TO_DOCTOR patients processed before new patients');
bullet('Completion guard: blocks if unpaid invoices exist (except post_pay mode)');

heading3('Status Flow');
code(
  'REGISTERED \u2192 TRIAGE \u2192 WAITING \u2192 IN_CONSULTATION\n' +
  '  \u251c\u2500 PENDING_LAB      \u251c\u2500 RETURN_TO_DOCTOR\n' +
  '  \u251c\u2500 PENDING_PHARMACY \u251c\u2500 RETURN_TO_PHARMACY\n' +
  '  \u251c\u2500 PENDING_PAYMENT  \u2514\u2500 RETURN_TO_LAB\n' +
  '  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 COMPLETED'
);

// 2.2 IPD
heading2('2.2 Inpatient (IPD) Journey');
para('Admission to discharge flow with bed management, nursing care, and medication administration. Module: ipd.service');

heading3('Flow Steps');
table(
  ['Step', 'Action', 'Key Business Rule'],
  [
    ['1', 'Bed Allocation', 'Pessimistic lock; bed AVAILABLE \u2192 OCCUPIED; ward counts updated'],
    ['2', 'Admission', 'Duplicate admission prevention; auto-bills bed charge'],
    ['3', 'Nursing Care', 'Shift-by-shift notes; vitals mirrored to canonical table'],
    ['4', 'Medication Admin', 'Allergy check (substring match); double-admin prevention (lock)'],
    ['5', 'Bed Transfer', 'BedTransfer record; dual ward occupancy update'],
    ['6', 'Discharge', 'Bed \u2192 CLEANING; auto-generates bed-day invoice'],
  ],
  [35, 130, 330],
);

heading3('Bed States');
code('AVAILABLE \u2192 RESERVED (4h TTL) \u2192 OCCUPIED \u2192 CLEANING \u2192 AVAILABLE\n                                          \u2514\u2500 OUT_OF_SERVICE');

bullet('Controlled substances: requires witness + doubleCheck verification');
bullet('Nursing vitals auto-sync to canonical vitals table for patient timeline');
bullet('Census reporting: occupancy %, ALOS, turnover metrics');

// 2.3 Emergency
heading2('2.3 Emergency Department');
para('Fast-track registration with triage-based prioritization. Module: emergency.service');

heading3('Flow Steps');
table(
  ['Step', 'Action', 'Status'],
  [
    ['1', 'Registration (atomic: EmergencyCase + Encounter)', 'PENDING'],
    ['2', 'Triage (assign P1-P5 level, record vitals)', 'TRIAGED'],
    ['3', 'Treatment (doctor assigned)', 'IN_TREATMENT'],
    ['4', 'Disposition', 'DISCHARGED / ADMITTED / TRANSFERRED / LEFT_AMA / DECEASED'],
  ],
  [35, 300, 160],
);

heading3('Triage Levels');
table(
  ['Level', 'Name', 'Target Response'],
  [
    ['P1', 'Resuscitation', 'Immediate'],
    ['P2', 'Emergent', '\u2264 10 minutes'],
    ['P3', 'Urgent', '\u2264 30 minutes'],
    ['P4', 'Less Urgent', '\u2264 1-2 hours'],
    ['P5', 'Non-Urgent', '\u2264 2+ hours'],
  ],
  [60, 200, 235],
);

bullet('Case number: pessimistic lock (format: EDYYMMDDnnnnn)');
bullet('Worklist sorted by: triageLevel ASC (P1 first), then arrivalTime');
bullet('Vitals mirrored to canonical table with source=EMERGENCY_TRIAGE');

// 2.4 Pharmacy
heading2('2.4 Pharmacy & Dispensing');
para('Prescription-to-collection workflow with drug interaction checking and controlled substance management.');

heading3('Prescription Flow');
table(
  ['Step', 'Action', 'Status'],
  [
    ['1', 'Doctor prescribes (during consultation)', 'PENDING'],
    ['2', 'Pharmacist reviews + drug interaction check', 'READY_TO_DISPENSE'],
    ['3', 'Pharmacist dispenses (FEFO allocation)', 'DISPENSING'],
    ['4', 'All items dispensed', 'READY_FOR_PICKUP'],
    ['5', 'Patient collects', 'COLLECTED'],
  ],
  [35, 300, 160],
);

heading3('Safety Features');
bullet('Drug interaction checking: flags interactions with Rx history; override requires manager approval');
bullet('FEFO allocation: First Expiry, First Out batch selection');
bullet('Controlled substances: witness + double-check + ControlledSubstanceLog');
bullet('Temperature monitoring: IoT alerts for out-of-range fridge/freezer temps');
bullet('Low stock alerts: qty \u2264 reorderLevel triggers purchase request');
bullet('POS shift guard: sales only allowed during active shift');

// 2.5 Laboratory
heading2('2.5 Laboratory');
para('Sample-to-result workflow with QC validation gate. Module: lab.service');

heading3('Flow Steps');
table(
  ['Step', 'Action', 'Status'],
  [
    ['1', 'Doctor orders lab test', '-'],
    ['2', 'Sample collection (barcode: LABYYMMDDnnnnn)', 'COLLECTED'],
    ['3', 'Sample received at lab', 'RECEIVED'],
    ['4', 'Processing (lab batch run)', 'PROCESSING'],
    ['5', 'Technician enters result', 'ENTERED'],
    ['6', 'QC Officer validates plausibility', 'VALIDATED'],
    ['7', 'QC Officer releases to clinician', 'RELEASED'],
    ['8', 'Amendment (if correction needed)', 'AMENDED'],
  ],
  [35, 300, 160],
);

heading3('Abnormal Flags');
bullet('NORMAL, LOW, HIGH, CRITICAL_LOW, CRITICAL_HIGH');
bullet('Auto-calculated from reference ranges on result entry');
bullet('Critical results trigger in-app notification to attending provider');
bullet('RBAC: non-QC users only see RELEASED/AMENDED results');
bullet('Turnaround KPIs: median & P90 collection\u2192release per test type');

// 2.6 Radiology
heading2('2.6 Radiology & Imaging');
para('Order-to-report workflow with priority-based worklist. Module: radiology.service');

table(
  ['Step', 'Action', 'Status'],
  [
    ['1', 'Doctor orders imaging', 'PENDING'],
    ['2', 'Technician schedules slot + room', 'SCHEDULED'],
    ['3', 'Imaging procedure', 'IN_PROGRESS'],
    ['4', 'Procedure completed', 'COMPLETED'],
    ['5', 'Radiologist generates report', 'Report: ImagingResult'],
  ],
  [35, 300, 160],
);

bullet('Modalities: X-ray, CT, MRI, Ultrasound, Fluoroscopy, Nuclear Medicine, Mammography');
bullet('Priority: STAT (immediate), URGENT (hours), ROUTINE (24-48h)');
bullet('Worklist sorted by priority then order date');

// 2.7 Billing & Insurance
heading2('2.7 Billing & Insurance');
para('Charge capture to payment/insurance claim workflow with GL integration. Module: billing.service, insurance.service');

heading3('Billing Flow');
table(
  ['Step', 'Action', 'GL Impact'],
  [
    ['1', 'Charge capture (createInvoice)', 'DR Accounts Receivable, CR Revenue'],
    ['2', 'Payment collection (recordPayment)', 'DR Bank, CR Accounts Receivable'],
    ['3', 'Insurance claim (if insured)', '-'],
    ['4', 'Insurance payment', 'DR Bank, CR Insurance Receivable'],
    ['5', 'Write-off (bad debt)', 'DR Bad Debt Expense, CR AR'],
  ],
  [35, 260, 200],
);

heading3('Invoice Statuses');
code('DRAFT \u2192 PENDING \u2192 PARTIALLY_PAID \u2192 PAID\n                                  \u2192 CANCELLED\n                                  \u2192 REFUNDED');

heading3('Insurance Pre-Authorization');
bullet('Policy must be ACTIVE');
bullet('Cumulative usage check: sum already-invoiced amounts against pre-auth');
bullet('Reject if new invoice exceeds remaining pre-auth balance');
bullet('Payment methods: CASH, CARD, MOBILE_MONEY, BANK_TRANSFER, INSURANCE, CHEQUE, MEMBERSHIP');

heading3('Claim Lifecycle');
code('DRAFT \u2192 SUBMITTED \u2192 ACKNOWLEDGED \u2192 IN_REVIEW\n  \u2192 APPROVED / PARTIALLY_APPROVED / REJECTED \u2192 PAID\n  REJECTED \u2192 APPEALED');

// 2.8 Procurement
heading2('2.8 Procurement & Supply Chain');
para('PR \u2192 PO \u2192 GRN \u2192 Three-Way Match \u2192 Payment. Module: procurement.service');

heading3('Flow Steps');
table(
  ['Step', 'Action', 'Status'],
  [
    ['1', 'Create Purchase Request', 'DRAFT'],
    ['2', 'Submit for approval', 'PENDING_APPROVAL'],
    ['3', 'Multi-level approval', 'APPROVED (or REJECTED)'],
    ['4', 'Create Purchase Order from PR', 'PO: DRAFT \u2192 APPROVED \u2192 SENT'],
    ['5', 'Goods Receipt (GRN)', 'DRAFT \u2192 INSPECTED \u2192 APPROVED'],
    ['6', 'Post GRN to GL', 'POSTED (DR Inventory, CR AP)'],
    ['7', 'Three-way match (PO \u2194 GRN \u2194 Invoice)', 'Match or flag'],
    ['8', 'Supplier payment', 'Payment recorded'],
  ],
  [35, 280, 180],
);

heading3('Auto-Reorder');
bullet('runAutoReorderDraftPRs(): scans items below reorderLevel');
bullet('Calculates qty to reach maxStockLevel; creates PRs in DRAFT');

// 2.9 HR
heading2('2.9 Human Resources');
para('Employee lifecycle management including payroll, leave, training, and appraisals. Module: hr.service');

heading3('Sub-Flows');
table(
  ['Area', 'Key Operations', 'Statuses'],
  [
    ['Employee', 'Create, activate, suspend, terminate', 'ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, RESIGNED, RETIRED'],
    ['Leave', 'Request, approve/reject, deduct balance', 'DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED'],
    ['Payroll', 'Run calculation, generate payslips', 'DRAFT, SUBMITTED, APPROVED, PROCESSED, PAID'],
    ['Appraisal', 'Self-review, manager review, final', 'DRAFT, IN_PROGRESS, AWAITING_MANAGER, COMPLETED'],
    ['Disciplinary', 'Incident, investigation, hearing', 'OPEN, UNDER_INVESTIGATION, DECISION_ISSUED, RESOLVED'],
    ['Training', 'Programs, enrollment, assessment', 'Enrollment tracking + scores'],
  ],
  [80, 230, 185],
);

bullet('Leave types: ANNUAL (21d default), SICK, MATERNITY, PATERNITY, COMPASSIONATE, UNPAID');
bullet('Payroll: Gross = basicSalary + allowances; Net = Gross - NSSF - PAYE - loans');
bullet('GL: DR Salary Expense, CR Bank on payroll processing');

// 2.10 Inventory
heading2('2.10 Inventory & Stores');
para('Stock ledger-based inventory management with batch tracking, expiry monitoring, and inter-facility transfers. Module: inventory.service');

heading3('Movement Types');
table(
  ['Type', 'Direction', 'Typical Reference'],
  [
    ['PURCHASE', '+qty', 'GRN'],
    ['SALE', '-qty', 'Invoice / dispensing'],
    ['ADJUSTMENT', '\u00b1qty', 'Manual correction'],
    ['TRANSFER_IN', '+qty', 'Stock transfer'],
    ['TRANSFER_OUT', '-qty', 'Stock transfer'],
    ['RETURN', '+qty', 'Patient/customer return'],
    ['EXPIRED', '-qty', 'Write-off'],
    ['DAMAGED', '-qty', 'Write-off'],
  ],
  [120, 100, 275],
);

heading3('Stock Balance');
code('totalQuantity = SUM(PURCHASE + TRANSFER_IN - SALE - TRANSFER_OUT - EXPIRED - DAMAGED)\navailableQuantity = totalQuantity - reservedQuantity');

bullet('Low stock: totalQuantity \u2264 reorderLevel \u2192 trigger PR');
bullet('Expiring: expiryDate \u2264 NOW() + 90 days \u2192 alert');
bullet('Item master: batch tracking, expiry tracking, storage conditions, drug classification');

// 2.11 Maternity
heading2('2.11 Maternity Care');
para('ANC registration through delivery, PNC, and immunization. Module: maternity.service');

heading3('Flow Steps');
table(
  ['Step', 'Action', 'Key Data'],
  [
    ['1', 'ANC Registration', 'EDD = LMP + 280d; GA = (today-LMP)/7 weeks'],
    ['2', 'ANC Visits (min 4)', 'Vitals, fetal movement, urine, BP, weight'],
    ['3', 'Labour Admission', 'Status: IN_LABOUR'],
    ['4', 'Labour Progress', 'Dilation, effacement, FHR, contractions'],
    ['5', 'Delivery', 'Mode: vaginal/caesarean; Status: DELIVERED'],
    ['6', 'Baby Outcome', 'Apgar (1m+5m), sex, weight, resuscitation'],
    ['7', 'Baby Wellness', 'Breastfeeding, jaundice, cord care, temp'],
    ['8', 'Immunization', 'Uganda EPI: BCG(birth), DPT/OPV(6/10/14w), MR(9m)'],
    ['9', 'PNC Visits', '0-3d, 4-7d, 2w, 6w (family planning)'],
  ],
  [35, 150, 310],
);

bullet('Pregnancy status: ACTIVE \u2192 DELIVERED / LOST_TO_FOLLOWUP / TRANSFERRED');
bullet('Delivery modes: VAGINAL_SPONTANEOUS, VAGINAL_ASSISTED, CAESAREAN, BREECH');
bullet('Baby status: LIVE_BIRTH, STILLBIRTH_FRESH, STILLBIRTH_MACERATED, NEONATAL_DEATH');
bullet('Immunization defaulter tracking: children >14 days overdue for next vaccine');

// 2.12 Finance
heading2('2.12 Finance & Accounting');
para('Double-entry GL with fiscal periods, journal approval workflow, and financial reporting. Module: finance.service');

heading3('Journal Entry Flow');
table(
  ['Step', 'Action', 'Status'],
  [
    ['1', 'Create journal entry (totalDebit MUST = totalCredit)', 'DRAFT'],
    ['2', 'Submit for approval', 'SUBMITTED'],
    ['3', 'Approve (amount-based routing)', 'APPROVED'],
    ['4', 'Post to GL (updates account balances)', 'POSTED'],
    ['5', 'Reverse (creates opposite entry)', 'REVERSED'],
  ],
  [35, 310, 150],
);

heading3('Auto-Posted Journals');
bullet('Invoice creation: DR Accounts Receivable, CR Revenue');
bullet('Payment collection: DR Bank, CR Accounts Receivable');
bullet('GRN posting: DR Inventory, CR Accounts Payable');
bullet('Payroll: DR Salary Expense, CR Bank');
bullet('Refund: Reversal entries');

heading3('Account Types');
bullet('ASSET (debit normal), LIABILITY (credit), EQUITY (credit)');
bullet('REVENUE (credit), EXPENSE (debit), CONTRA_ASSET, CONTRA_LIABILITY');
bullet('Hierarchical: parentAccountId supports nesting');

heading3('Reports');
bullet('Trial Balance, Income Statement (P&L), Balance Sheet, Cash Flow');
bullet('Budget Variance: actual (GL) vs planned (budget) by period');
bullet('GL Reconciliation: compare GL vs bank/subsidiary, flag unmatched');

// 2.13 SaaS
heading2('2.13 SaaS Platform Operations');
para('Full client lifecycle from lead to subscription management. Module: saas-revenue.service');

heading3('Lifecycle Flow');
table(
  ['Step', 'Action', 'Output'],
  [
    ['1', 'Lead management (pipeline, activities)', 'Qualified lead'],
    ['2', 'Quotation (from price catalog)', 'DRAFT \u2192 SENT'],
    ['3', 'Acceptance (auto-provisions in transaction)', 'Tenant + Subscription + License'],
    ['4', 'Contract generation', 'HTML-rendered legal document'],
    ['5', 'Onboarding (18-item checklist)', 'Track completion to go-live'],
    ['6', 'Subscription active', 'trial \u2192 active'],
    ['7', 'Health monitoring', '5-component weighted score (daily cron)'],
  ],
  [35, 260, 200],
);

heading3('Subscription States');
code('trial \u2192 active \u2192 past_due \u2192 churned\n              \u2192 paused \u2192 active (resumed)\n              \u2192 cancelled');

heading3('Renewal & Dunning');
bullet('Hourly cron renewalTick(): generate invoice, attempt payment, extend or start dunning');
bullet('Dunning: graceDays \u2192 reminderIntervalDays \u2192 churnAfterDays');
bullet('Email templates: invoice_issued, payment_receipt, dunning, renewal_reminder, trial_ending');
bullet('Dedup guard: same email type max once per 23 hours');
bullet('Webhooks: HMAC-SHA256 signed, 3 retries with exponential backoff');

heading3('Plan Tiers');
table(
  ['Tier', 'Features'],
  [
    ['Community', 'Basic modules, limited users'],
    ['Standard', 'Core clinical + billing'],
    ['Professional', 'Full clinical + procurement + analytics'],
    ['Enterprise', 'All modules, unlimited users/facilities'],
  ],
  [120, 375],
);

heading3('Payment Gateways');
bullet('Flutterwave (pan-Africa): card, mobile money, bank transfer');
bullet('PesaPal (East Africa): card, M-Pesa, MTN MoMo');
bullet('Manual: bank transfer / cash with proof upload + verification');

// ══════════════════════════════════════════════════════════════
//  PART 3 — SYSTEM HEALTH AUDIT
// ══════════════════════════════════════════════════════════════
doc.addPage();
doc.fontSize(28).font('Helvetica-Bold').fillColor(C.primary).text('Part 3');
doc.fontSize(18).font('Helvetica').fillColor(C.secondary).text('System Health Audit');
doc.moveDown(1);

// 3.1 Test Coverage
heading2('3.1 Test Coverage');

table(
  ['Metric', 'Value', 'Assessment'],
  [
    ['Total modules', '94', '-'],
    ['Spec files', '39', '-'],
    ['Coverage ratio', '41.5%', 'NEEDS IMPROVEMENT'],
    ['Modules with zero tests', '~55', 'CRITICAL GAP'],
  ],
  [180, 100, 215],
);

heading3('Well-Tested Modules');
bullet('auth (4 specs), deployments (5), saas-revenue (5), finance (3), procurement (2)');
bullet('common utilities (4), billing, encounters, inventory, patients, pharmacy, users');

heading3('Critical Gaps (Patient-Safety Modules with No Tests)');
table(
  ['Priority', 'Module', 'Risk'],
  [
    ['P0', 'emergency', 'Triage decisions — patient safety'],
    ['P0', 'ipd', 'Admissions, medication admin — patient safety'],
    ['P0', 'maternity', 'Labour, delivery — patient safety'],
    ['P0', 'prescriptions', 'Drug dispensing — patient safety'],
    ['P0', 'surgery', 'Surgical procedures — patient safety'],
    ['P0', 'lab', 'Sample tracking, results — clinical accuracy'],
    ['P1', 'appointments', 'Scheduling — clinical workflow'],
    ['P1', 'hr', 'Payroll calculations — financial accuracy'],
    ['P1', 'pos', 'Financial transactions'],
    ['P1', 'payment-gateway', 'Payment processing'],
  ],
  [50, 130, 315],
);

// 3.2 Audit Logging
heading2('3.2 Audit Logging Coverage');

table(
  ['Metric', 'Value', 'Assessment'],
  [
    ['Total services', '177', '-'],
    ['With audit logging', '48 (27.1%)', 'SIGNIFICANT GAP'],
    ['Without audit logging', '129 (72.9%)', '-'],
  ],
  [180, 150, 165],
);

heading3('Critical Gaps (High-Risk Modules Without Audit)');
bullet('Emergency (1 service) — triage/treatment decisions untracked');
bullet('Maternity (1 service) — delivery outcomes untracked');
bullet('Surgery (1 service) — surgical procedures untracked');
bullet('Appointments (2 services) — scheduling changes untracked');
bullet('Drug Management (2 services) — drug catalog changes');
bullet('POS (4 services) — financial transactions');
bullet('Payment Gateway (1 service) — payment processing');
bullet('Radiology (1 service) — imaging orders/results');
bullet('Orders (1 service) — clinical orders');

// 3.3 State Machines
heading2('3.3 Missing Workflow State Machines');

para('Current state: 0 formal FSM implementations. All status transitions use procedural if/switch logic in services. Some have ad-hoc VALID_TRANSITIONS maps (e.g., encounters).');

heading3('Complex Workflows Needing Formal FSMs');
table(
  ['Entity', 'Statuses', 'Current Approach', 'Risk'],
  [
    ['Encounter', '12', 'VALID_TRANSITIONS map', 'Medium'],
    ['PurchaseRequest', '8', 'Procedural', 'High'],
    ['PurchaseOrder', '8', 'Procedural', 'High'],
    ['InsuranceClaim', '10', 'Procedural', 'High'],
    ['Prescription', '5', 'Procedural', 'High'],
    ['EmergencyCase', '6', 'Procedural', 'High'],
    ['JournalEntry', '6', 'Procedural', 'Medium'],
    ['SaasSubscription', '6', 'Procedural', 'Medium'],
    ['GoodsReceiptNote', '6', 'Procedural', 'Medium'],
    ['PayrollRun', '6', 'Procedural', 'Medium'],
  ],
  [120, 60, 170, 145],
);

// 3.4 Config & Reports
heading2('3.4 Configuration & Report Gaps');

heading3('Hardcoded Configuration');
bullet('API base URLs (Flutterwave default hardcoded)');
bullet('Cron schedules in decorators (not configurable per-tenant)');
bullet('Magic numbers: bounce limit (5), bed reservation TTL (4h), triage wait times');
bullet('Retry counts, rate limits, cache TTLs scattered across services');

heading3('Report Generation');
bullet('Backend PDF: SaaS invoices + insurance claims (working)');
bullet('Backend PDF: Finance reports (STUB — not implemented)');
bullet('Frontend PDF: 15 pages use jsPDF for receipts, lab reports, HR, finance, clinical');
bullet('Missing reports: discharge summary, pharmacy dispensing, bed occupancy, ANC outcomes');

heading3('Input Validation');
bullet('90 DTOs total; ~60 (66.7%) use class-validator decorators');
bullet('~30 DTOs lack validation — mostly legacy and integration DTOs');

// ══════════════════════════════════════════════════════════════
//  PART 4 — RECOMMENDED NEXT ACTIONS
// ══════════════════════════════════════════════════════════════
doc.addPage();
doc.fontSize(28).font('Helvetica-Bold').fillColor(C.primary).text('Part 4');
doc.fontSize(18).font('Helvetica').fillColor(C.secondary).text('Recommended Next Actions');
doc.moveDown(1);

heading2('P0 — Critical (Address Immediately)');
table(
  ['#', 'Action', 'Effort', 'Impact'],
  [
    ['1', 'Test coverage for patient-safety modules (emergency, ipd, maternity, prescriptions, surgery, lab)', '3-4w', 'Clinical safety + compliance'],
    ['2', 'Audit logging for emergency, maternity, surgery, radiology, orders', '1w', 'Regulatory compliance'],
    ['3', 'Formal FSM for Encounter workflow (12 states)', '1w', 'Prevents invalid transitions'],
    ['4', 'Validate all DTOs accepting financial data', '3d', 'Data integrity for money'],
    ['5', 'Startup config validation (fail-fast for missing env vars)', '2d', 'Prevents silent prod failures'],
  ],
  [20, 270, 40, 165],
);

heading2('P1 — High Priority (Next Sprint)');
table(
  ['#', 'Action', 'Effort', 'Impact'],
  [
    ['6', 'Test coverage: appointments, radiology, hr, pos, payment-gateway', '2-3w', 'Coverage 41% \u2192 55%+'],
    ['7', 'FSMs for procurement, insurance claims, prescriptions', '2w', 'Declarative transition rules'],
    ['8', 'PDF reports: discharge summary, lab, pharmacy, ANC outcomes', '2w', 'Clinical documentation'],
    ['9', 'Audit logging: appointments, POS, drug-mgmt, payment, tenants', '1w', 'Coverage 27% \u2192 40%+'],
    ['10', 'Externalize hardcoded config (crons, magic numbers, retries)', '1w', 'Operational flexibility'],
    ['11', 'Input validation for remaining ~30 DTOs', '1w', 'Defense in depth'],
  ],
  [20, 270, 40, 165],
);

heading2('P2 — Medium Priority (Quarterly)');
table(
  ['#', 'Action', 'Effort', 'Impact'],
  [
    ['12', 'Achieve 70% test coverage across all modules', '4-6w', 'Regression prevention'],
    ['13', 'Adopt FSM library (xstate) for all 12 complex workflows', '3-4w', 'Declarative + visualizable'],
    ['14', 'Comprehensive GL integration for all modules', '2w', 'Complete financial picture'],
    ['15', 'HMIS 105 / DHIS2 export for Uganda MOH reporting', '2-3w', 'Regulatory compliance'],
    ['16', 'Per-tenant API rate limiting', '1w', 'Multi-tenant fairness'],
    ['17', 'E2E integration tests for critical patient journeys', '3w', 'End-to-end confidence'],
    ['18', 'Inventory valuation report (FIFO/weighted avg)', '1w', 'Financial reporting'],
  ],
  [20, 270, 40, 165],
);

heading2('P3 — Nice-to-Have (Backlog)');
table(
  ['#', 'Action', 'Effort', 'Impact'],
  [
    ['19', 'Secrets rotation mechanism (JWT_SECRET, LICENSE_SECRET_KEY)', '1w', 'Security hardening'],
    ['20', 'Real-time dashboards (WebSocket) for ED queue, bed board', '2w', 'Operational efficiency'],
    ['21', 'Patient self-service portal (appointments, results, Rx)', '3-4w', 'Patient engagement'],
    ['22', 'Clinical decision support (drug-diagnosis alerts)', '4w', 'Clinical quality'],
    ['23', 'Data analytics / BI layer (trends, predictive stock-outs)', '4w', 'Strategic planning'],
    ['24', 'Mobile app (React Native) for field/community health', '6-8w', 'Rural healthcare reach'],
    ['25', 'FHIR interoperability for health information exchange', '4-6w', 'Standards compliance'],
  ],
  [20, 270, 40, 165],
);

// ── Summary Stats Box ──
doc.moveDown(1);
checkPage(90);
const boxY2 = doc.y;
doc.rect(50, boxY2, pageW, 80).fill(C.lightBg);
doc.rect(50, boxY2, pageW, 80).strokeColor(C.light).lineWidth(0.5).stroke();
doc.fontSize(12).font('Helvetica-Bold').fillColor(C.primary).text('System Summary', 60, boxY2 + 10, { width: pageW - 20 });
doc.fontSize(9).font('Helvetica').fillColor(C.text);
doc.text('192 Entities  \u00b7  94 Modules  \u00b7  177 Services  \u00b7  104 Migrations  \u00b7  13 Process Flows', 60, boxY2 + 28, { width: pageW - 20 });
doc.text('Test Coverage: 41.5%  \u00b7  Audit Coverage: 27.1%  \u00b7  Formal FSMs: 0  \u00b7  DTOs Validated: 66.7%', 60, boxY2 + 43, { width: pageW - 20 });
doc.text('25 Recommended Actions: 5 P0 (Critical) + 6 P1 (High) + 7 P2 (Medium) + 7 P3 (Backlog)', 60, boxY2 + 58, { width: pageW - 20 });
doc.y = boxY2 + 90;

// ── Footer on all pages ──
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.fontSize(7).font('Helvetica').fillColor(C.muted);
  if (i > 0) { // skip cover page
    doc.text(
      `Glide-HIMS System Document  \u00b7  v1.0  \u00b7  27 June 2026  \u00b7  Page ${i + 1} of ${pages.count}`,
      50,
      doc.page.height - 35,
      { align: 'center', width: pageW },
    );
  }
}

doc.end();

out.on('finish', () => {
  const stats = fs.statSync(outPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`PDF generated: ${outPath} (${sizeMB} MB, ${pages.count} pages)`);
});
