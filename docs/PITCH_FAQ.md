# Glide HIMS — Frequently Asked Questions

> **Comprehensive FAQ for Hospital Administrators, Medical Directors, IT Managers & Finance Directors**

---

## Table of Contents

1. [General / Product](#1-general--product)
2. [Implementation & Deployment](#2-implementation--deployment)
3. [Clinical / Operations](#3-clinical--operations)
4. [Financial / Billing](#4-financial--billing)
5. [Technical / IT](#5-technical--it)
6. [Security & Compliance](#6-security--compliance)
7. [Offline / Connectivity](#7-offline--connectivity)
8. [Support & Maintenance](#8-support--maintenance)
9. [Pricing & Licensing](#9-pricing--licensing)
10. [Government & Reporting](#10-government--reporting)

---

## 1. General / Product

### What is Glide HIMS?

Glide HIMS (Healthcare Information Management System) is an enterprise-grade, offline-first hospital management platform purpose-built for African healthcare — with a particular focus on Ugandan facilities. It integrates clinical, financial, and operational workflows into a single unified system, eliminating the need for separate software for labs, pharmacy, billing, HR, and reporting. With 50+ integrated modules, 144 database entities, and 1,800+ API endpoints, Glide HIMS is one of the most comprehensive HMIS platforms available for the East African healthcare market.

### What modules are included?

Glide HIMS ships with 22+ tightly integrated modules spanning three categories:

- **Clinical:** Patient Registration, Encounters & Clinical Notes, Emergency & Triage, Lab (LIS), Radiology (RIS), Pharmacy & Prescriptions, IPD (Inpatient), Maternity & ANC, Surgery & Theatre, Chronic Care, Vitals & Biometrics, Appointments & Scheduling, Queue Management, Referrals, and Follow-ups.
- **Financial:** Billing & Invoicing, Insurance Claims Management, Cashier & Payment Collection, Pricing Engine, Finance & Accounting (Chart of Accounts, Journal Entries), and Payroll.
- **Operational:** Inventory & Stores, Asset Management, HR & Staff Management, Procurement, Supplier Management, Doctor Duty Scheduling, Analytics & Dashboards, DHIS2 Integration, System Settings, and Multi-Facility Administration.

Every module is pre-configured and ready to use on day one — no additional purchases required.

### Is it a cloud or on-premise system?

Glide HIMS is deployed **on-premise** — meaning all your data lives on servers physically located within your facility. This is a deliberate design choice for the African healthcare context, where internet connectivity is unreliable, data sovereignty regulations require local storage, and hospitals need full control over their patient data. The system operates fully without internet, so your clinical workflows never stop — even during extended outages.

### What makes it different from other HMIS solutions?

Four things set Glide HIMS apart. **First**, it was built from the ground up for African healthcare — not adapted from a Western product. Uganda's 13 insurance providers, HMIS-105 government reporting, UGX currency, and local disease profiles (malaria, TB, HIV) are built into the core, not bolted on. **Second**, the offline-first architecture means the system works without internet as the default, not as a degraded fallback. **Third**, it is a single integrated platform — your lab, pharmacy, billing, HR, and reporting all share one database, eliminating duplicate data entry and reconciliation headaches. **Fourth**, it uses a modern technology stack (NestJS, React 19, PostgreSQL) that is performant, secure, and maintainable for the long term.

### Is it suitable for small clinics or only large hospitals?

Glide HIMS is designed to scale from a 10-bed clinic to a 500+ bed hospital. The multi-tenant, multi-facility architecture means a small clinic can start with core modules (Patient Registration, Billing, Pharmacy, Lab) running on a single modest server, while a large hospital network can run the full suite across multiple facilities with centralized reporting. The modular activation system lets you turn on only what you need — you are never paying for or navigating features you don't use.

### What languages does it support?

Glide HIMS v1.0.0 ships with a full English-language interface, which is the standard working language for medical documentation in Uganda and most East African healthcare systems. The architecture supports localization, and additional language packs (Luganda, Swahili) are on the product roadmap. All clinical coding uses international standards (ICD-10/ICD-11) that are language-independent.

---

## 2. Implementation & Deployment

### How long does implementation take?

A standard implementation takes **8 weeks** from contract signing to go-live. This includes hardware setup (Week 1), system installation and configuration (Week 2), data migration and service/pricing setup (Weeks 3–4), staff training across all departments (Weeks 5–6), parallel running alongside your current system (Week 7), and full go-live with on-site support (Week 8). Smaller facilities with fewer customizations can go live in as few as 4–5 weeks.

### What hardware do we need?

The requirements are modest and use standard, locally available equipment:

- **Server:** Linux (Ubuntu 20.04+), minimum 8 GB RAM (16 GB recommended), 4 CPU cores, 500 GB SSD storage. A single mid-range server or workstation is sufficient for most facilities.
- **Client Workstations:** Any computer or tablet with a modern web browser (Chrome, Firefox, Edge, or Safari). No software installation is needed on client machines.
- **Network:** A basic local area network (LAN) connecting the server to workstations. Internet connectivity is needed only for DHIS2 government reporting sync and system updates — all clinical workflows run entirely on the local network.

### Can we migrate data from our current system?

Yes. Glide HIMS includes a structured data migration process as part of the 8-week implementation. We support importing patient demographics, service catalogues, pricing, insurance information, and historical financial data from spreadsheets (Excel/CSV), existing databases, or other HMIS platforms. The migration uses validated import templates with data integrity checks to ensure nothing is lost or corrupted during transfer. For facilities currently using paper records, we provide data entry templates so your team can digitize priority records during the parallel running period.

### Do you provide training?

Absolutely — comprehensive training is a core part of every implementation. We deliver **role-based training** tailored to each department: receptionists learn registration and queue management, doctors learn encounter documentation and prescribing, lab technicians learn sample management and results entry, pharmacists learn dispensing workflows, cashiers learn billing and payment collection, and administrators learn reporting and system configuration. Training is conducted on-site at your facility using your own data and workflows, so staff are learning on the actual system they will use daily. Refresher training and new-staff onboarding materials are included.

### What does the implementation process look like?

The implementation follows a proven 8-week methodology:

1. **Week 1 — Infrastructure:** Server procurement/setup, network assessment, hardware installation.
2. **Week 2 — Configuration:** System installation, facility profile setup, department and ward configuration, user accounts and role assignment.
3. **Weeks 3–4 — Data & Services:** Service catalogue setup, pricing configuration, insurance provider setup, lab test configuration, drug formulary import, data migration from existing systems.
4. **Weeks 5–6 — Training:** Department-by-department role-based training with hands-on practice sessions.
5. **Week 7 — Parallel Run:** System runs alongside your current process so staff gain confidence and any issues are caught before full cutover.
6. **Week 8 — Go-Live:** Full transition with on-site support team present to handle questions and edge cases in real time.

### Can we start with some modules and add more later?

Yes — this is a common and recommended approach, especially for facilities transitioning from paper-based systems. Many hospitals start with the core workflow (Patient Registration → Queue → Consultation → Lab/Pharmacy → Billing) and then activate additional modules like IPD, Maternity, HR, Inventory, and Finance in subsequent phases. The modular architecture means activating a new module takes minutes, not weeks, and all modules share the same patient and financial data — so there is no re-entry or integration work when you expand.

### What happens during the parallel running period?

During parallel running (typically Week 7), your staff operates both Glide HIMS and your existing system simultaneously. Every patient registration, lab order, prescription, and bill is entered into both systems so you can compare outputs and verify accuracy. This period builds staff confidence, surfaces any configuration adjustments needed, and ensures that billing totals, lab results, and patient records match before you decommission the old system. Our implementation team is on-site throughout this period to address issues immediately.

---

## 3. Clinical / Operations

### What lab tests are pre-configured?

Glide HIMS ships with **48+ pre-configured lab tests** covering the most common investigations in Ugandan healthcare:

- **Hematology:** Complete Blood Count (CBC), Hemoglobin, Differential Count, ESR, Coagulation Profile, CD4 Count.
- **Clinical Chemistry:** Renal Function Tests (RFT), Liver Function Tests (LFT), Lipid Profile, Random/Fasting Blood Sugar (RBS/FBS), HbA1c, Thyroid Function (TSH/TFT), PSA, Uric Acid.
- **Serology/Immunology:** HIV Rapid Test, VDRL/RPR, Hepatitis B & C, Widal Test, Brucella, Pregnancy Test (HCG).
- **Microbiology:** Malaria (RDT & Blood Smear), Culture & Sensitivity, Gram Stain, AFB (TB screening).
- **Urinalysis & Parasitology:** Complete Urine Analysis, Stool Analysis.
- **Molecular:** HIV Viral Load.

All tests come with pre-set normal ranges, turnaround time targets (15 minutes for rapid tests to 7 days for viral load), and UGX pricing. You can add, modify, or deactivate any test through the admin interface — no developer required.

### How does the prescription/pharmacy workflow work?

The workflow is fully digital and end-to-end. When a doctor writes a prescription during an encounter, it appears instantly in the pharmacy queue with the patient's name, diagnosis, and clinical notes attached. The pharmacist verifies the order, checks drug availability and batch expiry, confirms insurance coverage (if applicable), and dispenses the medication. For controlled substances, digital signature capture is required. The system tracks batch numbers, expiry dates, and stock levels in real time — when stock runs low, automatic alerts are triggered. For instance, when a doctor prescribes Amoxicillin 500mg, the pharmacist sees exactly which batches are available, their expiry dates, and the patient's insurance coverage — all before dispensing a single capsule.

### Does it support ICD-10 coding?

Yes. Glide HIMS supports both **ICD-10 and ICD-11** diagnostic coding with real-time search from WHO/NIH APIs and a comprehensive offline fallback database. The system comes pre-seeded with 23 high-priority Uganda diagnoses (Malaria, Tuberculosis, HIV/AIDS, Diabetes, Hypertension, Pneumonia, Typhoid, Cholera, and more) across 22 diagnostic categories. Doctors can search by disease name, ICD code, or synonym, and the system automatically flags notifiable diseases and chronic conditions for appropriate follow-up tracking.

### How does the emergency triage system work?

Glide HIMS implements a **5-level triage protocol** aligned with international emergency medicine standards:

1. **Resuscitation** — Immediate attention (life-threatening).
2. **Emergent** — Seen within 10 minutes.
3. **Urgent** — Seen within 30 minutes.
4. **Less Urgent** — Seen within 60 minutes.
5. **Non-Urgent** — Seen within 120 minutes.

When a patient arrives at the emergency department, the triage nurse records the arrival mode (walk-in, ambulance, police, referral), chief complaint, vital signs (BP, heart rate, respiratory rate, temperature, O2 saturation), Glasgow Coma Scale, pain score, and blood glucose. The system automatically assigns a triage level and priority, places the patient in the appropriate treatment queue, and tracks key metrics like arrival-to-triage time and total time in the department. Case dispositions (admitted, discharged, transferred, left AMA) are tracked for reporting.

### Can doctors access the system from their phones?

Yes. Glide HIMS is a fully responsive web application — it runs in any modern mobile browser (Chrome, Safari, Firefox) without needing to install an app. Doctors can review patient histories, view lab results, write clinical notes, and manage their consultation queue from a phone or tablet over the hospital's local network. The interface adapts to smaller screens while maintaining full clinical functionality. For ward rounds, many doctors prefer using a tablet for bedside documentation.

### How does the queue management work?

The queue management system supports **17 service points** (Registration, Triage, Consultation, Lab, Pharmacy, Billing, Radiology, Theatre, Dental, and more) with **9 queue statuses** tracking patient flow from arrival to completion. Patients are automatically prioritized using 7 priority levels: Emergency (immediate), Urgent (< 10 min), VIP, Elderly, Disabled, Pregnant, Pediatric, and Routine. The system includes a real-time display board for waiting areas, so patients can see their position in the queue. When a clinician clicks "Call Next Patient," the system selects the highest-priority patient who has been waiting longest and displays their name on the waiting area screen.

### Does it support multiple wards and theatres?

Yes. Glide HIMS supports **6 ward types** (General, Private, ICU, Pediatric, Maternity, Surgical) and **4+ theatre types** (General, Orthopedic, Obstetric, Minor). Each ward tracks total and occupied beds, floor location, building, and status (Active, Inactive, Maintenance). Theatre management includes scheduling, equipment tracking (anesthesia machines, surgical lights, patient monitors, electrosurgical units, laparoscopic towers, C-arm fluoroscopy, and more), and status monitoring. Bed allocation, patient transfers between wards, and occupancy dashboards are all built in.

---

## 4. Financial / Billing

### Which insurance providers are supported?

Glide HIMS comes pre-configured with **13 Ugandan insurance providers** across three categories:

| Provider | Type | Payment Terms |
|----------|------|---------------|
| Uganda National Health Insurance Scheme (UNHIS) | NHIS | 45 days |
| UAP Old Mutual Insurance | Private | 30 days |
| Jubilee Health Insurance | Private | 30 days |
| AAR Healthcare | Private | 21 days |
| GA Insurance | Private | 30 days |
| First Insurance Company | Private | 30 days |
| Sanlam General Insurance | Private | 30 days |
| Prudential Assurance | Private | 30 days |
| MTN Staff Medical Scheme | Corporate | 14 days |
| Stanbic Bank Medical Scheme | Corporate | 14 days |
| Uganda Government Civil Service Scheme | Government | 60 days |
| Uganda Police Medical Scheme | Government | 60 days |

Additional providers can be added through the admin interface with custom claim submission methods (portal, electronic, or manual), coverage rules, and payment terms.

### How does the insurance claims workflow work?

The claims workflow is integrated into every clinical interaction. When a patient presents their insurance card, the system verifies their coverage and plan details at registration. As services are rendered (consultations, lab tests, medications), the system automatically calculates insurance coverage versus patient responsibility based on the specific plan rules. At checkout, the patient pays only their copay/balance, and the insurance portion is captured as a claim. Claims are batched per provider and submitted through the configured method — electronic portal, direct electronic submission, or printed claim forms for manual submission. The system tracks claim status, aging, and payment reconciliation, so your finance team always knows exactly how much is owed and by whom.

### Can it generate different invoice formats?

Yes. Glide HIMS supports multiple invoice types to match different payer requirements. Invoices can be generated for cash patients, insurance claims, corporate accounts, and membership schemes. Each invoice includes detailed line items (consultations, lab tests, medications, procedures), subtotals, tax calculations, discounts, and balance due. The system supports 6 invoice statuses (Draft, Pending, Partially Paid, Paid, Cancelled, Refunded) for complete lifecycle tracking. Invoices can be printed, exported to PDF, or transmitted electronically depending on the payer's requirements.

### How does it prevent revenue leakage?

Revenue leakage prevention is built into the system architecture, not added as an afterthought. **First**, every clinical service (lab test, medication, procedure) automatically generates a billable line item — it is impossible to render a service without it appearing on the patient's bill. **Second**, the system enforces payment collection at 8 billing points (Central, Pharmacy, Lab, Radiology, OPD, IPD, Emergency, Theatre) so nothing slips through. **Third**, cashier sessions use shift-based cash handling with mandatory opening and closing balances, so discrepancies are caught immediately. **Fourth**, the audit trail logs every financial transaction with user, timestamp, and IP address — making unauthorized modifications traceable and deterrable.

### Does it support package/bundled pricing?

Yes. The pricing engine supports bundled service packages where a set of services (e.g., a "Maternity Package" including ANC visits, delivery, postnatal care, and basic lab tests) can be priced as a single unit at a discounted rate compared to individual service pricing. Packages can be configured per facility and per insurance provider, giving you flexibility to offer competitive pricing while maintaining profitability. The system automatically tracks which services within a package have been delivered and which remain outstanding.

### Can we customize pricing per service?

Absolutely. The pricing engine allows you to set and modify prices for every service, procedure, lab test, and medication in the system. Prices can be differentiated by payment type (cash vs. insurance), by specific insurance provider, and by facility (if you operate multiple locations). Price changes take effect immediately and are applied to all new transactions while preserving historical pricing on existing invoices. For instance, you can set a CBC test at UGX 15,000 for cash patients but UGX 20,000 for insurance billing — the system automatically applies the correct price based on the patient's payment method.

---

## 5. Technical / IT

### What are the system requirements?

Glide HIMS has been designed to run on hardware that is readily available in the Ugandan market:

- **Server:** Linux (Ubuntu 20.04 or newer), minimum 8 GB RAM (16 GB recommended for facilities with 100+ daily patients), 4 CPU cores, 500 GB SSD storage. A standard Dell PowerEdge or HP ProLiant server works perfectly.
- **Client Workstations:** Any computer, laptop, or tablet with a modern web browser — Chrome, Firefox, Edge, or Safari. No special software installation required. Windows, macOS, Linux, Android, and iOS are all supported.
- **Network:** A local area network (LAN) connecting the server to workstations. Internet connectivity is required only for DHIS2 government reporting sync and system updates. All day-to-day clinical, billing, and operational workflows run entirely on the local network.

### How does the offline mode work technically?

Glide HIMS uses a sophisticated offline-first architecture built on **IndexedDB** (via Dexie.js) on the frontend and a server-side sync engine on the backend. When a workstation loses connectivity to the server, the application continues to function by reading from and writing to the local IndexedDB database. All changes are queued with timestamps, device IDs, and operation types (create, update, delete). When connectivity is restored, the sync engine processes the queue, applying changes to the central PostgreSQL database. The system supports 15+ entity types for offline sync including patients, encounters, vital signs, clinical notes, prescriptions, lab orders and results, imaging orders, admissions, invoices, and payments.

### What database does it use?

Glide HIMS uses **PostgreSQL 14+**, the world's most advanced open-source relational database. PostgreSQL was chosen for its reliability, ACID compliance, advanced JSON support (used for audit trail data and flexible configurations), row-level security (used for multi-tenant data isolation), and proven track record in healthcare systems worldwide. The database schema includes 144 entities managed through TypeORM with 18+ versioned migrations, ensuring safe and reversible schema updates. PostgreSQL's robustness means your data is safe even during power failures — a critical consideration for facilities with unreliable electricity.

### Is there an API for integration?

Yes. Glide HIMS exposes a comprehensive **RESTful API** with 1,800+ endpoints covering every function in the system. The API is fully documented using **Swagger/OpenAPI** and accessible at `http://your-server:3000/api/docs`. Every action you can perform in the user interface can also be performed through the API, enabling integration with third-party systems such as lab analyzers, pharmacy robots, mobile health applications, or custom reporting tools. The API uses JWT authentication and respects the same role-based permissions as the UI, ensuring integrations cannot bypass security controls.

### How are backups handled?

Glide HIMS supports a multi-layered backup strategy. The PostgreSQL database can be backed up using standard `pg_dump` tools on an automated schedule (daily recommended, hourly for high-volume facilities). The system's Docker-based deployment uses persistent volumes that can be snapshotted for full system backups. Additionally, the 18+ versioned database migrations and 7 seed data files mean the system structure can be fully reconstructed from code if needed. PM2 process management handles log rotation (stored in `/var/log/pm2/`) and the comprehensive audit trail provides a forensic record of all data changes for recovery scenarios. We recommend maintaining off-site backup copies on encrypted external drives as part of your disaster recovery plan.

### What about system updates?

System updates are delivered as versioned releases and applied during scheduled maintenance windows — typically during off-peak hours. The update process is managed through the deployment infrastructure (Docker containers and PM2 process manager) and includes automatic database migrations that safely evolve the schema without data loss. Updates are tested against a staging environment before being applied to production. The modular architecture means updates to one module (e.g., Lab) do not require downtime for other modules (e.g., Pharmacy), minimizing disruption to clinical operations.

### Can it integrate with our existing lab machines?

Yes. The Lab Information System (LIS) module includes an integration framework that can receive results from laboratory analyzers through standard protocols. The API-first architecture means any lab machine that can transmit results via HL7, ASTM, or HTTP can be integrated. When a lab order is placed in Glide HIMS, the order can be transmitted to the analyzer; when the analyzer completes the test, results flow back into the system and are immediately available to the ordering clinician. Integration with specific analyzer models is configured during implementation based on your facility's equipment.

---

## 6. Security & Compliance

### How is patient data protected?

Patient data protection is implemented at every layer of the system. **At the application layer**, role-based access control (RBAC) with 10 defined roles and 200+ granular permissions ensures staff see only the data they need for their role. **At the database layer**, multi-tenant row-level isolation ensures that data from one facility can never leak to another. **At the network layer**, all communication between browsers and the server uses HTTPS/TLS encryption, with security headers enforced by Helmet.js. **At the deployment layer**, the on-premise architecture means patient data never leaves your facility's network — it is never transmitted to or stored on external cloud servers.

### Is there multi-factor authentication?

Yes. Glide HIMS includes **TOTP-based multi-factor authentication** (Time-based One-Time Password) using the Speakeasy library — the same standard used by Google Authenticator, Microsoft Authenticator, and Authy. MFA can be enabled per user and is recommended for all administrative and clinical accounts. When enabled, users must enter both their password and a 6-digit code from their authenticator app to log in. MFA secrets are encrypted at rest using **AES-256-CBC** with scrypt key derivation, ensuring they cannot be extracted even if the database is compromised.

### What about data encryption?

Glide HIMS employs encryption at multiple levels. **Passwords** are hashed using bcrypt with automatic salting — they cannot be reversed or read by anyone, including system administrators. **MFA secrets** are encrypted using AES-256-CBC with scrypt-derived keys and random initialization vectors per encryption operation. **Data in transit** is protected by HTTPS/TLS between all clients and the server. **SQL injection** is prevented through parameterized queries and ORM-enforced query building (TypeORM). The system also implements CORS policies, rate limiting (via NestJS Throttler), and security headers to protect against common web attack vectors.

### How does the audit trail work?

Every significant action in the system is recorded in an immutable audit log. Each entry captures the **user ID**, **action type** (CREATE, UPDATE, DELETE, LOGIN), **entity type** and **entity ID**, **old and new values** (stored as JSONB for complete before/after comparison), **IP address**, **user agent**, and **timestamp**. For example, if a cashier modifies an invoice amount, the audit log records who made the change, when, from which workstation, and exactly what the amount was before and after the modification. Audit logs are indexed for fast searching and cannot be edited or deleted by any user — including system administrators.

### Is it compliant with Uganda data protection regulations?

Glide HIMS is designed with Uganda's Data Protection and Privacy Act (2019) in mind. The on-premise deployment model ensures all personal health information remains within Uganda's jurisdiction. The system's access controls, audit trails, and encryption capabilities support the Act's requirements for data security, purpose limitation, and accountability. The role-based permission system ensures personal data is accessed only by authorized personnel for legitimate healthcare purposes, and the audit trail provides the accountability records required by the Act.

### Who can access what data?

Access is controlled through a **role-based access control (RBAC) system** with 10 pre-defined roles: Super Admin, Admin, Doctor, Nurse, Pharmacist, Lab Technician, Receptionist, Cashier, Store Keeper, and Accountant. Each role has a carefully defined set of permissions across 22 modules, with 4 permission levels per module (Create, Read, Update, Delete). For example, a Lab Technician can view lab orders and enter results but cannot access financial reports or modify patient demographics. A Receptionist can register patients and manage the queue but cannot view clinical notes or prescriptions. Permissions can be customized per role to match your facility's specific policies.

### What happens if a staff member leaves?

When a staff member leaves your facility, their user account is deactivated immediately by an administrator — this takes less than 30 seconds and instantly revokes all system access. The deactivated account's data and activity history are preserved in the audit trail for accountability, but the person can no longer log in or access any part of the system. If the staff member had MFA enabled, their encrypted MFA secret is invalidated. Active sessions (if any) are terminated. The process is designed to be fast enough to perform during an exit interview.

---

## 7. Offline / Connectivity

### How does it work without internet?

Glide HIMS is designed with an **offline-first architecture**, meaning it treats the offline state as the norm, not the exception. All workstations store critical data locally using IndexedDB (a browser-based database), so clinical workflows — patient registration, encounter documentation, prescriptions, lab orders, billing — continue without any interruption when the local network or internet is unavailable. Staff may not even notice an outage because the interface behaves identically whether online or offline. Internet connectivity is only required for two specific functions: syncing data to DHIS2 for government reporting and downloading system updates.

### What happens when internet comes back?

When connectivity is restored, the sync engine automatically activates and processes the offline queue. Every change made during the offline period — new patients, clinical notes, lab results, invoices, payments — is transmitted to the central server with its original timestamp and device identifier. The sync processes changes in chronological order to maintain data consistency. The entire process is transparent to users; they continue working normally while the background sync catches up. A sync status indicator in the interface shows progress and confirms when all data has been synchronized.

### Can multiple facilities sync data?

Yes. The multi-tenant, multi-facility architecture is specifically designed for hospital networks. Each facility operates independently with its own local data, and the sync engine consolidates data to a central server for cross-facility reporting, patient record sharing (when authorized), and unified financial oversight. For example, a hospital group with three branches can view consolidated revenue reports, track patient referrals between facilities, and maintain a unified drug formulary — all while each facility operates autonomously on its local network.

### Is there risk of data loss?

The risk of data loss is minimal by design. Data is written to the local IndexedDB immediately when entered — there is no "save to server" step that can fail. The sync queue tracks every pending change with its status (Pending, Processing, Synced, Conflict, Failed), and failed syncs are automatically retried. The PostgreSQL database on the server provides ACID-compliant transactions, meaning data is either fully committed or fully rolled back — never partially written. Combined with the recommended daily backup schedule, the system provides multiple layers of data protection.

### What if two people edit the same record offline?

Glide HIMS includes a **conflict resolution system** specifically designed for this scenario. When the sync engine detects that two offline edits target the same record, it identifies the conflict type (version conflict, data conflict, or delete conflict) and applies the configured resolution strategy. Options include **server wins** (the first-synced version is kept), **client wins** (the latest change is kept), **merged** (non-conflicting fields are combined automatically), or **manual review** (a supervisor is alerted to resolve the conflict). Each conflict is logged with full before/after data so no information is ever silently lost. In practice, conflicts are rare because most clinical records (encounters, prescriptions, lab results) are created by a single clinician and rarely edited concurrently.

---

## 8. Support & Maintenance

### What support is included?

Every Glide HIMS license includes a comprehensive support package during the first year. This covers **on-site implementation support** during the 8-week rollout, **remote technical support** via phone and email for configuration questions and troubleshooting, **priority bug fixes** for any issues affecting clinical workflows, and **system updates** including new features and security patches. Support response times are tiered by severity: critical issues (system down) receive same-day response, high-priority issues (module not functioning) within 24 hours, and standard requests within 48 hours.

### How are bugs reported and fixed?

Bugs can be reported through a dedicated support channel (phone, email, or ticketing system). Each report is triaged by severity — critical bugs affecting patient safety or system availability are prioritized for immediate resolution. Bug fixes are delivered as targeted patches that can be applied without full system downtime. The system's modular architecture means a fix to one module (e.g., Lab) can be deployed without affecting other modules. Every bug fix is tested against the full test suite before release to ensure it does not introduce regressions.

### What's the uptime guarantee?

Glide HIMS is designed for **99.9% uptime** during operational hours. The on-premise architecture means uptime depends on your local server hardware rather than external cloud providers — giving you direct control. The PM2 process manager provides automatic process restart with configurable memory limits (512 MB backend, 256 MB frontend) and max restart policies. Server health is monitored via the built-in health check endpoint (`/health`), and the system includes graceful shutdown handling to prevent data corruption during restarts. For facilities requiring higher availability, we recommend a UPS (uninterruptible power supply) and redundant server configuration.

### Is there a user manual / documentation?

Yes. Glide HIMS includes comprehensive documentation at multiple levels. **End-user guides** provide step-by-step instructions for each role (receptionist, doctor, lab technician, pharmacist, cashier, administrator). **Administrator guides** cover system configuration, user management, and reporting. **Technical documentation** covers installation, backup procedures, API reference (via Swagger), and troubleshooting. The interactive Swagger API documentation at `/api/docs` provides a complete reference for every endpoint in the system with request/response examples. Training materials from the implementation period are also provided as reference documents.

### How often are updates released?

Glide HIMS follows a regular release cycle with **quarterly feature updates** and **monthly maintenance releases** (security patches and bug fixes). Critical security patches are released immediately as needed. Each release includes detailed release notes describing new features, improvements, and any required migration steps. Updates are designed to be non-disruptive — most can be applied in under 30 minutes during off-peak hours with zero data loss.

---

## 9. Pricing & Licensing

### How is it priced?

Glide HIMS uses a **per-facility licensing model**. Each facility (hospital, clinic, or health center) requires one license, regardless of the number of users, workstations, or patients at that facility. This means there are no surprise costs as your staff or patient volume grows — you pay the same whether you have 5 users or 50. Multi-facility organizations receive volume pricing. The license fee includes the full software suite (all 22+ modules), implementation support, first-year maintenance, and initial training.

### Are there ongoing costs?

Yes, there is an **annual maintenance and support fee** after the first year (which is included in the initial license). This covers ongoing technical support, system updates (new features and security patches), and access to new module releases. The annual fee is a fraction of the initial license cost and ensures your system stays current, secure, and supported. Hardware maintenance (servers, UPS, network equipment) is managed by your facility's IT team or a local IT service provider.

### What's included in the license?

The Glide HIMS license includes everything you need to operate:

- **Full software suite** — all 22+ modules with no per-module fees
- **Implementation support** — the complete 8-week deployment process
- **Data migration** — transfer of existing data from your current system
- **Staff training** — role-based training for all departments
- **First-year support & maintenance** — remote support, bug fixes, and updates
- **API access** — full API for custom integrations
- **Swagger documentation** — interactive API reference
- **User documentation** — role-specific guides and admin manuals

### Is there a free trial?

We offer a **guided demonstration** where our team sets up a fully configured instance with sample data representative of your facility type and walks your team through the key workflows — patient registration, clinical encounters, lab processing, pharmacy dispensing, billing, and reporting. This is more valuable than a self-service trial because you see the system configured for your specific context, with your insurance providers, your service catalogue, and your reporting requirements. Demonstrations can be conducted on-site at your facility or remotely.

### What payment terms are available?

We offer flexible payment terms designed to work within healthcare facility budgets. Standard terms include an upfront payment at contract signing, but we also offer **milestone-based payments** tied to implementation phases (infrastructure, configuration, training, go-live) and **quarterly installment plans** for the first year. For government and NGO-funded facilities, we accommodate procurement timelines and can provide pro-forma invoices, detailed quotations, and any documentation required for tender processes.

---

## 10. Government & Reporting

### How does DHIS2 integration work?

Glide HIMS includes a native **DHIS2 integration module** that connects directly to Uganda's national DHIS2 instance. The integration is configured through the admin interface by entering your DHIS2 base URL, credentials, and Organisation Unit ID. Data element mappings are pre-configured for standard Uganda reporting datasets. When reporting is due, the system aggregates clinical and operational data from the relevant period and transmits it to DHIS2 in batch uploads. The integration handles authentication, data validation, error handling, and retry logic — so your reporting officer submits reports with a few clicks rather than manually tallying registers.

### Which government reports are supported?

Glide HIMS supports the **HMIS-105** reporting format — Uganda's standard integrated health facility report. The pre-configured data elements cover:

- **OPD Data:** New and return attendance, total outpatient visits.
- **IPD Data:** Admissions, discharges, deaths, referrals in/out.
- **Maternal Health:** ANC visits (new and return), facility deliveries, live births, maternal deaths.
- **Pharmacy:** Total prescriptions dispensed, stockout days per essential medicine.

All data is automatically aggregated from daily clinical transactions — no manual counting or tallying required. The system can also generate internal reports for disease surveillance, workload analysis, and financial performance.

### Is the HMIS-105 report format up-to-date?

Yes. The HMIS-105 data elements in Glide HIMS are configured according to the current Uganda Ministry of Health reporting requirements. The data element mappings are maintained as configuration (not hard-coded), so they can be updated through the admin interface if the Ministry changes reporting requirements — without waiting for a software update. During implementation, we verify the mappings against your District Health Office's current requirements to ensure compliance.

### Can it generate custom reports?

Yes. Beyond the standard HMIS-105 and built-in analytics dashboards, Glide HIMS supports custom reporting through multiple channels. The **Analytics module** provides configurable dashboards with charts and graphs (powered by Recharts) that can be customized to track your facility's specific KPIs. Data can be **exported to Excel** (XLSX) and **PDF** (jsPDF) for custom analysis and presentation. For advanced reporting needs, the full API provides access to all system data, allowing integration with external reporting tools like Power BI, Tableau, or custom spreadsheet workflows. The system also supports barcode and QR code generation (JSBarcode, QRCode libraries) for patient identification and asset tracking.

---

## Quick Reference: Key System Specifications

| Specification | Detail |
|---|---|
| **Product** | Glide HIMS v1.0.0 |
| **Type** | Healthcare Information Management System |
| **Modules** | 22+ integrated (Clinical, Financial, Operational) |
| **Database Entities** | 144 |
| **API Endpoints** | 1,800+ (RESTful, Swagger-documented) |
| **Frontend Pages** | 57+ |
| **RBAC Roles** | 10 (Super Admin, Admin, Doctor, Nurse, Pharmacist, Lab Tech, Receptionist, Cashier, Store Keeper, Accountant) |
| **Permissions** | 200+ granular (22 modules × CRUD) |
| **Pre-configured Lab Tests** | 48+ |
| **Insurance Providers** | 13 (Uganda) |
| **Ward Types** | 6 |
| **Theatre Types** | 4+ |
| **Triage Levels** | 5 |
| **Queue Service Points** | 17 |
| **Billing Points** | 8 |
| **Backend** | NestJS 10.3 / Node.js 20 LTS / TypeScript 5.3 |
| **Frontend** | React 19 / Vite 5.4 / Tailwind CSS / Zustand / TanStack Query |
| **Database** | PostgreSQL 14+ / TypeORM 0.3 |
| **Real-time** | Socket.IO 4.8 |
| **Offline Storage** | Dexie.js (IndexedDB) |
| **Authentication** | JWT (8h access / 7d refresh) + TOTP MFA |
| **Encryption** | AES-256-CBC (MFA), bcrypt (passwords), TLS (transit) |
| **Security Audit Score** | 9.5/10 |
| **Implementation Timeline** | 8 weeks |
| **Deployment** | On-premise, Docker + PM2 |
| **Government Integration** | DHIS2 (HMIS-105) |

---

> **Disclaimer:** This FAQ is based on Glide HIMS v1.0.0. Features and specifications may be updated. Contact us for the most current information.
