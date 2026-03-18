# Pharmacy, Finance & Supply Chain Operations

## Glide-HIMS — Comprehensive Operations Deep Dive

> This document explains the full structure and workflows around **pharmacy dispensing**, **financial management**, **drug/equipment/reagent/aid** operations, **procurement**, **disposal**, and **store management** in the Glide-HIMS system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Pharmacy Module](#2-pharmacy-module)
3. [Dispensing Workflow](#3-dispensing-workflow)
4. [Drug Management](#4-drug-management)
5. [Inventory & Stock Management](#5-inventory--stock-management)
6. [Item Classifications](#6-item-classifications)
7. [Lab Supplies — Reagents & Equipment](#7-lab-supplies--reagents--equipment)
8. [Fixed Assets & Medical Equipment](#8-fixed-assets--medical-equipment)
9. [Procurement Cycle](#9-procurement-cycle)
10. [Supplier Management](#10-supplier-management)
11. [Multi-Store Operations](#11-multi-store-operations)
12. [Finance & Billing](#12-finance--billing)
13. [Insurance & Claims](#13-insurance--claims)
14. [Disposal & Returns](#14-disposal--returns)
15. [Integration Map](#15-integration-map)

---

## 1. System Overview

The supply chain and financial ecosystem spans **14 backend modules** with ~60 entities:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPPLY CHAIN & FINANCE ECOSYSTEM                  │
├─────────────────────────────────────────────────────────────────────┤
│ Pharmacy          │ POS sales, FEFO dispensing, labels, temp monitor │
│ Prescriptions     │ Rx creation, item dispensing, controlled subs    │
│ Drug Management   │ Classifications, interactions, allergies, FDA    │
│ Inventory         │ Stock receive/adjust/transfer, ledger, expiry    │
│ Item Classifications │ Categories, brands, units, formulations      │
│ Lab Supplies      │ Reagents, lots, equipment, calibration, QC      │
│ Assets            │ Fixed assets, depreciation, maintenance          │
│ Procurement       │ PR → PO → GRN → Stock posting                   │
│ Suppliers         │ CRUD, scoring, financial data                    │
│ RFQ               │ Quotations, multi-level approval                 │
│ Vendor Contracts  │ Lifecycle, amendments, renewal                   │
│ Vendor Ratings    │ 4-dimension scoring, summaries, trends           │
│ Price Agreements  │ Volume discounts, price history, best-price      │
│ Stores            │ Multi-store inventory, transfers                  │
│ Disposal          │ Expired/damaged stock handling                    │
│ Supplier Returns  │ Return-to-supplier with credit tracking          │
│ Billing           │ Invoices, payments, GL auto-posting              │
│ Finance           │ Chart of accounts, journals, fiscal periods      │
│ Pricing Engine    │ Dynamic pricing, insurance rates, discounts      │
│ Insurance         │ Claims, pre-auth, policies                       │
│ Supplier Finance  │ Payment vouchers, credit notes, 3-way matching   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pharmacy Module

**Location**: `packages/backend/src/modules/pharmacy/`  
**Files**: 7 (controller, service, module, DTOs, label service, dashboard service, temperature service)  
**Endpoints**: 28

### 2.1 Point-of-Sale (POS) Operations

The pharmacy operates as a POS for both walk-in customers and prescription-linked sales:

| Sale Type | Description | Patient Required? |
|-----------|-------------|-------------------|
| `OTC` | Walk-in counter sale | No (customerName only) |
| `PRESCRIPTION` | Linked to doctor's Rx | Yes (patientId + prescriptionId) |
| `INTERNAL` | Internal consumption (ward, clinic) | No |
| `WHOLESALE` | Bulk orders | No |
| `INPATIENT` | Ward/IPD medication issue | Yes |

**Sale Lifecycle**:
```
CREATE SALE (status: PENDING)
  │  saleNumber = POS-{timestamp}-{random4}
  │  Items: [{itemId, qty, unitPrice, discount%}]
  │  Calc: subtotal, discountAmount, totalAmount
  │
  ├─→ COMPLETE SALE (status: COMPLETED)
  │     ✓ Validate amountPaid ≥ totalAmount
  │     ✓ For each item (in transaction):
  │       - Check StockBalance.availableQty ≥ qty
  │       - Deduct: totalQuantity -= qty, availableQuantity -= qty
  │       - Create StockLedger entry (SALE, -qty)
  │     ✓ Record paymentMethod (cash/mobile_money/card/credit)
  │
  └─→ CANCEL SALE (status: CANCELLED)
        Only if still PENDING
```

### 2.2 Daily Summary & Analytics

| Endpoint | Returns |
|----------|---------|
| `GET /pharmacy/summary/daily` | Total sales, revenue, discounts; breakdown by payment method (cash/mobile/card/insurance) and sale type (Rx/OTC/wholesale) |
| `GET /pharmacy/analytics/profit` | Revenue, COGS, profit margins; top 20 items by profit; daily trend over date range |
| `GET /pharmacy/dashboard/kpis` | Queue stats, stock alerts, revenue, dispensing metrics |
| `GET /pharmacy/queue/stats` | Pending Rx count + daily dispensed count |

### 2.3 Batch Stock & FEFO (First Expiry First Out)

```
GET  /pharmacy/batch-stock/:itemId    → All batches ordered by expiryDate ASC
POST /pharmacy/batch-stock/allocate   → FEFO allocation preview
POST /pharmacy/batch-stock/receive    → Receive incoming batch stock
```

**FEFO Algorithm**:
1. Load all active batches for item+facility, ordered by `expiryDate ASC`
2. For each batch: `availableQty = quantity - reservedQuantity`
3. Greedily allocate from earliest-expiring batch first
4. Return allocation plan: `[{batchId, batchNumber, expiryDate, allocatedQty}]`
5. Fail if total available across all batches < requested quantity

### 2.4 Expiry Management

```
GET  /pharmacy/expiry/alerts     → Items expiring within threshold (default 90 days)
POST /pharmacy/expiry/quarantine → Mark batch as quarantined
POST /pharmacy/expiry/process    → Dispose or return quarantined item
GET  /pharmacy/expiry/report     → Summary: near-expiry, quarantined, disposed, returned
```

**ExpiryAlert Status Flow**: `active → near_expiry → quarantined → disposed | returned`

### 2.5 Drug Labels (Multi-Language)

```
GET  /pharmacy/labels/generate/:prescriptionItemId → Generate label
GET  /pharmacy/labels/templates                     → List templates by language
POST /pharmacy/labels/templates                     → Create custom template
GET  /pharmacy/labels/translations                  → List translations
POST /pharmacy/labels/translations                  → Add translation (e.g., English → Luganda)
```

Labels include: drug name, dose, frequency, duration, translated directions, patient info, warnings.

### 2.6 Temperature Monitoring

For refrigerated storage (vaccines, insulin, biologics):

```
POST /pharmacy/temperature/readings            → Record reading (IoT or manual)
GET  /pharmacy/temperature/readings/:sensorId  → History + min/max/avg stats
GET  /pharmacy/temperature/alerts              → Unacknowledged alerts
POST /pharmacy/temperature/alerts/:id/acknowledge → Acknowledge alert
GET  /pharmacy/temperature/sensors             → List sensors + latest reading
POST /pharmacy/temperature/sensors             → Register sensor (auto-sets ranges by storage type)
```

---

## 3. Dispensing Workflow

**Location**: `packages/backend/src/modules/prescriptions/`  
Dispensing is handled by the **Prescriptions module**, not the Pharmacy module.

### 3.1 End-to-End Flow

```
STEP 1: Doctor Creates Prescription
  │  Rx number: RX{YYYYMMDD}{nnnn}
  │  PrescriptionItems: [{itemId, qty, dose, frequency, duration}]
  │  ✓ Reserves stock: StockBalance.reservedQuantity += qty
  │
STEP 2: Pharmacist Dispenses Individual Item
  │  Input: prescriptionItemId, qty, batchNumber, expiryDate, unitPrice
  │  ✓ Validate: qty ≤ (item.quantity - item.quantityDispensed)
  │  ✓ Create Dispensation record (batch, expiry, price, dispenser)
  │  ✓ Update PrescriptionItem.quantityDispensed
  │  ✓ If fully dispensed: item.isDispensed = true
  │
  │  OR
  │
STEP 2b: Pharmacist Batch-Dispenses All Items
  │  Input: prescriptionId, items[], dispenserSignature?
  │  ✓ IN TRANSACTION:
  │    For each item:
  │      - Create Dispensation record
  │      - Update quantityDispensed
  │      - Auto-bill against encounter invoice (InvoiceItem)
  │
  │  ✓ For Schedule I/II controlled substances:
  │      - Create ControlledSubstanceLog
  │      - Track runningBalance (previous balance - qty dispensed)
  │
  │  ✓ Update Prescription status:
  │      ALL items done → DISPENSED
  │      SOME items done → PARTIALLY_DISPENSED
  │
  │  ✓ If fully dispensed: Encounter → PENDING_PAYMENT
  │
STEP 3: Inpatient Medication Administration (if applicable)
  │  MedicationAdministration: route, dose, administeredBy, witness
  │
STEP 4: Patient Payment & Discharge
```

### 3.2 Controlled Substance Tracking

For Schedule I-V drugs (morphine, pethidine, diazepam, etc.):

| Field | Purpose |
|-------|---------|
| `prescriptionItemId` | Links to dispensed item |
| `quantityDispensed` | Exact amount dispensed |
| `runningBalance` | Rolling inventory balance |
| `dispensedBy` | Pharmacist who dispensed |
| `witnessedBy` | Required for Schedule I-II |
| `patientId`, `encounterId` | Full patient context |

The `ControlledSubstanceLog` provides a perpetual inventory with running balance, ensuring DEA/NDA compliance-style tracking.

---

## 4. Drug Management

**Location**: `packages/backend/src/modules/drug-management/`

### 4.1 Drug Classification

Every drug item gets a `DrugClassification` record (1:1 with Item):

| Category | Fields |
|----------|--------|
| **Coding** | `atcCode` (WHO ATC), `schedule` (I-V, OTC, POM) |
| **Classification** | `therapeuticClass` (50+ enums: analgesics, antibiotics, ARVs, etc.), `formulation` (tablet, capsule, syrup, injection…) |
| **Identification** | `genericName`, `brandName`, `strength` (e.g., "500mg") |
| **Safety Flags** | `isControlled`, `isNarcotic`, `isPsychotropic`, `highAlert`, `lookAlikeSoundAlike` |
| **Prescribing Rules** | `requiresDoubleCheck` (auto for Schedule I-II), `maxSingleDose`, `maxDailyDose`, `contraindications`, `warnings`, `pregnancyCategory` |
| **Formulary** | `isOnFormulary`, `formularyTier` (1/2/3), `requiresPriorAuth` |
| **Storage** | `storageCondition` (room temp, refrigerated, frozen, cool, protected from light, dry) |

### 4.2 Drug Interaction Checking

**DrugInteraction** entity — bidirectional (drugA ↔ drugB):

- **Severity levels**: `minor`, `moderate`, `major`, `contraindicated`
- **Data**: clinicalEffects, mechanism, management recommendation
- **API**: `checkInteractions([drugIds])` — checks all pairs, returns matches
- **OpenFDA sync**: `DrugDbSyncService` batch-queries FDA for known interactions

### 4.3 Drug Allergy Cross-Reactivity

**DrugAllergyClass** — groups related drugs:
- `relatedDrugs[]` — JSONB array of drug IDs in class
- `crossReactiveClasses[]` — classes that cross-react (e.g., Penicillin ↔ Cephalosporin)
- **Check returns**: `{hasRisk, directMatch, crossReactiveRisk, matchedClasses}`

### 4.4 Uganda Essential Medicines (Seeded)

20+ pre-seeded drugs matching Uganda's Essential Medicines List:
- **Antimalarials**: Artemether-Lumefantrine
- **Antibiotics**: Amoxicillin, Cotrimoxazole
- **Diabetes**: Metformin, Insulin (high-alert)
- **Hypertension**: Amlodipine
- **Narcotics**: Morphine, Pethidine (Schedule II)
- **Psychotropics**: Diazepam (Schedule IV)
- **ARVs**: Tenofovir/Lamivudine/Dolutegravir
- **TB**: Rifampicin/Isoniazid/Pyrazinamide/Ethambutol
- **High-Alert**: Heparin, Oxytocin

---

## 5. Inventory & Stock Management

**Location**: `packages/backend/src/modules/inventory/`

### 5.1 Core Entities

| Entity | Purpose |
|--------|---------|
| **Item** | Master catalog: name, code, unitCost, sellingPrice, markup%, reorderLevel, maxLevel, isDrug, isControlled, requiresBatchTracking, requiresExpiryTracking |
| **StockBalance** | Current stock per item+facility: totalQuantity, reservedQuantity, availableQuantity |
| **StockLedger** | Audit trail of ALL movements (immutable log) |
| **BatchStockBalance** | Batch-level: batchNumber, expiryDate, qty, reservedQty, status (active/quarantined/expired) |
| **ExpiryAlert** | Proactive alerts: status flow `active → near_expiry → quarantined → disposed/returned` |

### 5.2 Movement Types

| Type | Direction | Trigger |
|------|-----------|---------|
| `PURCHASE` | +qty | GRN posted to stock |
| `SALE` | -qty | Pharmacy sale completed |
| `ADJUSTMENT` | ±qty | Physical count reconciliation, damage/loss |
| `TRANSFER_IN` | +qty | Received from another store/facility |
| `TRANSFER_OUT` | -qty | Sent to another store/facility |
| `RETURN` | +qty | Returned from patient/department |
| `EXPIRED` | -qty | Expired stock written off |
| `DAMAGED` | -qty | Damaged stock written off |

### 5.3 Stock Operations (All Transactional)

**Receive Stock**:
```
receiveStock(itemId, facilityId, qty, unitCost, batchNumber?, expiryDate?)
  → Create StockLedger: PURCHASE, +qty, balanceAfter
  → Update StockBalance: totalQuantity += qty, availableQuantity += qty
```

**Adjust Stock**:
```
adjustStock(itemId, facilityId, qty, reason)
  → Create StockLedger: ADJUSTMENT, ±qty
  → Update StockBalance accordingly
```

**Transfer Stock**:
```
transferStock(itemId, fromFacility, toFacility, qty)
  → At source: StockLedger TRANSFER_OUT (-qty), balance -=
  → At dest:   StockLedger TRANSFER_IN (+qty), balance +=
```

### 5.4 Reports

| Report | What It Shows |
|--------|---------------|
| **Low Stock** | Items where qty ≤ reorderLevel |
| **Expiring** | Items expiring within N days (default 90) |
| **Expired** | Items past expiry date |
| **Consumption** | Total consumption & value, top 20 items, department breakdown, monthly trend (12 months), daily trend (30 days) |
| **Stock Movements** | Filterable by facility/item/date/type with pagination |

---

## 6. Item Classifications

**Location**: `packages/backend/src/modules/item-classifications/`

Fully customizable, **facility-scoped** classification system:

| Classification | Key Fields | Purpose |
|----------------|------------|---------|
| **ItemCategory** | code, name, isDrugCategory, requiresPrescription, requiresBatchTracking | Top-level grouping |
| **ItemSubcategory** | categoryId (FK), code, name | Second-level grouping |
| **ItemBrand** | code, name, country, isPreferred, qualityRating (1-5) | Manufacturer branding |
| **ItemUnit** | code, abbreviation (tab, cap, btl, ml, g, kg…), isBaseUnit | Unit of measure |
| **ItemFormulation** | code, routeOfAdmin (oral, iv, im, topical…) | Drug form |
| **StorageCondition** | code, minTemp, maxTemp, instructions | Storage requirements |
| **ItemTag** | code, tagType (safety/storage/regulatory), isWarning | Multi-tagging (HIGH_ALERT, COLD_CHAIN, HAZARDOUS…) |

**Seed defaults**: 6 categories (Medications, Medical Equipment, Lab Reagents, Medical Supplies, Consumables, Surgical Supplies), 12 units, 6 storage conditions, 7 safety tags.

---

## 7. Lab Supplies — Reagents & Equipment

**Location**: `packages/backend/src/modules/lab-supplies/`

### 7.1 Reagent Management

**LabReagent** tracks lab consumables with:
- **Category**: chemistry, hematology, microbiology, serology, urinalysis, coagulation, immunology, molecular, blood_bank, histopathology, cytology
- **Stock**: stockQuantity, reorderLevel, maxStockLevel, unitCost
- **Compatibility**: compatibleAnalyzers[] (JSONB), testCodes[], testsPerUnit
- **Storage**: storageTemperature, storageConditions, stabilityDaysAfterOpening
- **Calibration**: requiresCalibration, calibrationFrequencyDays

### 7.2 Lot Tracking

**ReagentLot** (per reagent):
- lotNumber, expiryDate, receivedDate, openedDate
- initialQuantity, currentQuantity
- isQcPassed (QC validation flag)
- supplierName, poNumber

**ReagentConsumption** (per lot):
- Links consumption to lab orders and test codes
- Auto-decrements lot.currentQuantity and reagent.stockQuantity

### 7.3 Lab Equipment Lifecycle

**LabEquipment**:
- **Identity**: assetCode (unique), category (analyzer, centrifuge, microscope, incubator…)
- **Service**: manufacturer, model, serialNumber, warrantyExpiry, serviceProvider, serviceContractNumber
- **Capacity**: dailyCapacity (tests/day), supportedTests[], compatibleReagents[]
- **Status**: operational, under_maintenance, out_of_service, calibration_due, decommissioned

**Calibration tracking** (EquipmentCalibration):
- type: internal, external, verification
- results (JSONB), passed (boolean), certificateNumber
- Auto-updates `nextCalibrationDate = lastCalibrationDate + frequencyDays`

**Maintenance tracking** (EquipmentMaintenance):
- type: preventive, corrective, emergency
- cost, partsReplaced, findings, recommendations

### 7.4 Quality Control (Westgard Rules)

**QCMaterial** (control materials): targetMean, targetSd, acceptableRangeLow/High per test per equipment

**QCResult** (daily runs):
- Auto-calculates `zScore = (resultValue - targetMean) / targetSd`
- Evaluates **Westgard rules**: 1:2s (warning), 1:3s (reject), 2:2s, R:4s, 4:1s, 10x
- **Levey-Jennings charts**: mean, SD, CV%, in-control%, ±1/2/3 SD bands

---

## 8. Fixed Assets & Medical Equipment

**Location**: `packages/backend/src/modules/assets/`

### 8.1 Asset Register

**FixedAsset** covers 13 categories:
- Medical equipment, office equipment, IT equipment, furniture, vehicles, buildings, land, lab equipment, surgical instruments, imaging equipment, dental equipment, pharmacy equipment, other

### 8.2 Depreciation Engine

| Method | Formula |
|--------|---------|
| **Straight Line** | `(totalCost - salvageValue) / usefulLifeMonths` |
| **Declining Balance** | `bookValue × depreciationRate / 12` |
| **Double Declining** | `bookValue × (2 × 100 / usefulLifeYears) / 12` |
| **Sum of Years** | Sum-of-years'-digits method |
| **Units of Production** | Based on usage units |

Monthly **AssetDepreciation** records: openingBookValue → depreciationAmount → closingBookValue, with GL posting (`journalEntryId`).

### 8.3 Asset Lifecycle

```
ACQUISITION → ACTIVE
  ├─→ MAINTENANCE (preventive/corrective/calibration)
  ├─→ TRANSFER (between facilities/departments)
  │     fromFacility → toFacility, transferredBy → receivedBy
  ├─→ VALUATION (market value updates)
  └─→ DISPOSAL (with gain/loss calculation)
        disposalValue vs bookValue → gain or loss
```

### 8.4 Asset Reports

| Report | Content |
|--------|---------|
| **Asset Register** | All assets by facility with custodian & department |
| **Valuation Summary** | totalOriginalCost, accumulatedDepreciation, netBookValue, marketValue |
| **Depreciation Report** | By category: count, cost, accumulated, bookValue for year/month |
| **Loss on Disposal** | Disposed assets with gain/loss calculation |

---

## 9. Procurement Cycle

**Location**: `packages/backend/src/modules/procurement/`

### 9.1 Full P2P (Procure-to-Pay) Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: PURCHASE REQUEST (PR)                               │
│   User creates PR → submits → approver reviews              │
│   PR number: PR{YYYY}{MM}{sequence}                         │
│   Status: DRAFT → PENDING_APPROVAL → APPROVED | REJECTED    │
│   Per-item quantity approval supported                       │
├─────────────────────────────────────────────────────────────┤
│ STAGE 2: REQUEST FOR QUOTATION (RFQ) [Optional]             │
│   RFQ created from PR → sent to vendors                     │
│   Vendors submit quotations with pricing + delivery terms   │
│   Winner selected → 3-level approval:                       │
│     Manager → Finance → Director                            │
│   All approved → quotation SELECTED, RFQ CLOSED             │
├─────────────────────────────────────────────────────────────┤
│ STAGE 3: PURCHASE ORDER (PO)                                 │
│   Created from approved PR or selected quotation            │
│   PO number: PO{YYYY}{MM}{sequence}                         │
│   Calculates: lineTotal, subtotal, tax, discount, total     │
│   Status: DRAFT → APPROVED → SENT → receiving...            │
├─────────────────────────────────────────────────────────────┤
│ STAGE 4: GOODS RECEIPT NOTE (GRN)                            │
│   Created from PO when goods arrive                         │
│   GRN number: GRN{YYYY}{MM}{sequence}                       │
│   Inspection: qty accepted vs rejected, QA check            │
│   Status: DRAFT → INSPECTED → APPROVED → POSTED             │
│                                                              │
│   ⭐ POST TO STOCK (critical step):                         │
│     For each item:                                          │
│       ✓ Create StockLedger (PURCHASE, +qty)                 │
│       ✓ Update StockBalance (+totalQty, +availableQty)      │
│       ✓ Update Item master (unitCost, sellingPrice)         │
│       ✓ Update PO item (quantityReceived)                   │
│     ✓ Update PO status (PARTIALLY/FULLY_RECEIVED)           │
│     ✓ Auto-post GL: DR Inventory / CR Accounts Payable     │
├─────────────────────────────────────────────────────────────┤
│ STAGE 5: STOCK AVAILABLE FOR OPERATIONS                      │
│   Dispensing, transfers, disposal, returns                   │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Procurement Dashboard

```
GET /procurement/dashboard
  → pendingPRs (PENDING_APPROVAL count)
  → approvedPRs (APPROVED count)
  → pendingPOs (DRAFT + PENDING_APPROVAL count)
  → sentPOs (SENT count)
  → pendingGRNs (DRAFT + INSPECTED + APPROVED count)
  → todayPostedValue (GRNs posted today, summed)
```

---

## 10. Supplier Management

### 10.1 Supplier Registry

**Supplier types**: pharmaceutical, medical_equipment, consumables, general  
**Status**: active, inactive, suspended  
**Financial data**: taxId, paymentTerms, creditLimit, bankName, bankAccount *(redacted from non-finance users)*

### 10.2 Vendor Contracts

```
ContractStatus: DRAFT → ACTIVE → EXPIRING_SOON → EXPIRED | RENEWED | TERMINATED
```

- **Amendments**: Track changes with old/new values, sequential numbering
- **Auto-renewal**: Creates new contract when old expires (if `autoRenew=true`)
- **Expiry alerts**: Contracts flagged 30 days before end date

### 10.3 Vendor Ratings (4 Dimensions)

| Dimension | Scale |
|-----------|-------|
| Delivery Time | 1.0 – 5.0 |
| Quality | 1.0 – 5.0 |
| Price | 1.0 – 5.0 |
| Service | 1.0 – 5.0 |
| **Overall** | Average of above |

**VendorRatingSummary**: Auto-aggregated averages + totalReviews + trend (up/down/stable).

### 10.4 Price Agreements

- **Volume discounts**: Tiered — `[{minQty, maxQty, discountPercent}]`
- **Price history**: Tracks every change with % change
- **Best price API**: `GET /price-agreements/best-price/:itemCode?quantity=N`
- **Comparison**: `POST /price-agreements/compare` — all active agreements for item, sorted by effective price

---

## 11. Multi-Store Operations

**Location**: `packages/backend/src/modules/stores/`

### 11.1 Store Types

| Type | canDispense | canIssue | canReceive |
|------|-------------|----------|------------|
| `main` | ✗ | ✓ | ✓ |
| `pharmacy` | ✓ | ✓ | ✓ |
| `ward` | ✗ | ✗ | ✓ |
| `theatre` | ✗ | ✗ | ✓ |
| `lab` | ✗ | ✗ | ✓ |
| `radiology` | ✗ | ✗ | ✓ |
| `emergency` | ✓ | ✗ | ✓ |

### 11.2 Stock Transfer Workflow

```
REQUEST (by ward/department)
  │  transferNumber: TRF-{timestamp}-{random}
  │  items: [{itemId, qty, batchNumber?, expiryDate?}]
  │  Status: REQUESTED
  │
APPROVE (by store manager)
  │  ✓ Validate source store has sufficient stock
  │  ✓ Deduct from source: StockBalance -=, StockLedger TRANSFER_OUT
  │  Status: IN_TRANSIT
  │
RECEIVE (by destination store)
  │  ✓ Add to destination: StockBalance +=, StockLedger TRANSFER_IN
  │  ✓ Record quantityReceived (may differ from dispatched)
  │  Status: RECEIVED
  │
  └─→ Or REJECT / CANCEL at any stage
```

---

## 12. Finance & Billing

**Location**: `packages/backend/src/modules/billing/` and `packages/backend/src/modules/finance/`

### 12.1 Invoice-to-GL Flow (Fully Automated)

```
Clinical Service (Lab/Pharmacy/Imaging/Surgery)
    │
    ▼ addBillableItem()
CREATE INVOICE
    │  invoiceNumber: INV{YYYYMMDD}{nnnn}
    │  Calc: subtotal → tax → discount → totalAmount → balanceDue
    │  ✓ Auto-post GL: DR Accounts Receivable (1200) / CR Revenue (4100-4106)
    │
    ▼ recordPayment()
RECORD PAYMENT
    │  receiptNumber: RCP{YYYYMMDD}{nnnn}
    │  ✓ Pessimistic lock (prevents race conditions)
    │  ✓ Update: amountPaid, balanceDue, status
    │  ✓ Auto-post GL: DR Cash/Bank (1101-1112) / CR AR (1200)
    │  ✓ Advance queue, complete encounter
    │  ✓ Send SMS/Email receipt (non-blocking)
    │
    ▼
INVOICE STATUS: PENDING → PARTIALLY_PAID → PAID | CANCELLED | REFUNDED
```

### 12.2 Chart of Accounts (Hierarchical)

| Code | Account | Type |
|------|---------|------|
| **1101** | Cash | ASSET |
| **1110** | Bank Transfer | ASSET |
| **1111** | Mobile Money | ASSET |
| **1112** | Card | ASSET |
| **1200** | Accounts Receivable | ASSET |
| **1201** | Insurance Receivable | ASSET |
| **1202** | Corporate Receivable | ASSET |
| **2100** | Accounts Payable | LIABILITY |
| **4100** | Consultation Revenue | REVENUE |
| **4101** | IPD Revenue | REVENUE |
| **4102** | Lab Revenue | REVENUE |
| **4103** | Pharmacy Revenue | REVENUE |
| **4104** | Imaging Revenue | REVENUE |
| **4105** | Surgery Revenue | REVENUE |
| **4106** | Maternity Revenue | REVENUE |
| **4200** | Insurance Revenue | REVENUE |
| **4300** | Membership Revenue | REVENUE |
| **5503** | Bad Debt Expense | EXPENSE |

### 12.3 GL Balance Logic

```
For each JournalEntryLine in postJournalEntry():
  IF account.type IN (ASSET, EXPENSE):
    account.currentBalance += (debit - credit)
  ELSE (LIABILITY, EQUITY, REVENUE):
    account.currentBalance += (credit - debit)
```

Balances are **updated in real-time** on every transaction — reports query `ChartOfAccount.currentBalance` directly.

### 12.4 Financial Reports

| Report | Endpoint | Description |
|--------|----------|-------------|
| Trial Balance | `getTrialBalance` | Verify debits = credits |
| Income Statement | `getIncomeStatement` | Revenue - Expenses = Net Income |
| Balance Sheet | `getBalanceSheet` | Assets = Liabilities + Equity |
| Cash Flow | `getCashFlowStatement` | Operating, Investing, Financing |
| AR Aging | `getARAgingReport` | Current, 1-30, 31-60, 61-90, 90+ days |
| VAT Return | `getStatutoryReport('vat')` | Output VAT - Input VAT |
| PAYE Return | `getStatutoryReport('paye')` | Withholding tax |
| Revenue Dashboard | `getRevenueDashboard` | Daily/weekly/monthly trends by source |

### 12.5 Dynamic Pricing Engine

**Location**: `packages/backend/src/modules/pricing-engine/`

Multi-layered discount evaluation:
1. **Insurance negotiated rates** (provider-specific)
2. **Membership discounts** (facility membership tiers)
3. **Loyalty rules** (visit count, spend thresholds)
4. **Promotions** (time-limited, item-specific)

Rules have: `priority`, `canStack`, `stackWithTypes[]`, `minAmount`, `maxDiscount`.

### 12.6 Supplier Finance

**Three-Way Invoice Matching**:
```
PO (Qty × Price) ↔ GRN (Qty × Cost) ↔ Vendor Invoice
  → Variance detection → Resolution → Approved → Paid
```

**Payment Vouchers**: Draft → Pending Approval → Approved → Paid (with withholding tax calculations)

**Credit/Debit Notes**: For supplier adjustments, applied against outstanding invoices

**Supplier Ledger**: Aging analysis of AP balances

---

## 13. Insurance & Claims

**Location**: `packages/backend/src/modules/insurance/`

### Claim Lifecycle

```
DRAFT → SUBMITTED → IN_REVIEW → APPROVED | REJECTED → PAID
```

- **Pre-authorizations** with approval limits per procedure
- **Claim items** with itemType, quantity, pricing, approval tracking
- **Denial codes** and provider notes for rejected claims
- Links to **InsurancePolicy** and **Insurance Provider**

---

## 14. Disposal & Returns

### 14.1 Disposal Workflow

```
IDENTIFY expired/damaged items
  │
CREATE DISPOSAL RECORD
  │  disposalMethod: incineration | chemical | landfill | return_to_manufacturer
  │  ✓ Stock DEDUCTED immediately (StockLedger: DISPOSAL)
  │  Status: PENDING_REVIEW
  │
PERFORM DISPOSAL
  │  ✓ Witness required (2 for drugs)
  │  ✓ Obtain disposal certificate
  │
APPROVE (QA/Compliance)
  │  ✓ Verify method, witness, certificate
  │  complianceStatus: COMPLIANT | PENDING_REVIEW | NON_COMPLIANT
```

### 14.2 Supplier Return Workflow

```
CREATE RETURN REQUEST
  │  returnNumber: RET-{timestamp}-{random}
  │  reason: expired | near_expiry | damaged | recalled | overstock | quality_issue
  │  expectedCredit = Σ(qty × unitValue)
  │  Status: PENDING
  │
AUTHORIZE (Procurement Manager)
  │  ✓ Stock DEDUCTED at this point (StockLedger: SUPPLIER_RETURN)
  │  Status: AUTHORIZED
  │
SHIP → RECEIVED_BY_SUPPLIER → CREDIT_ISSUED
  │  ✓ actualCredit recorded (may differ from expected)
  │  ✓ creditNoteNumber from supplier
  │
COMPLETED
```

---

## 15. Integration Map

### How Everything Connects

```
                    ┌─────────────┐
                    │   PATIENT   │
                    └──────┬──────┘
                           │ encounter
                    ┌──────▼──────┐
                    │  ENCOUNTER  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼────┐ ┌────▼─────┐ ┌───▼────┐
        │ Lab Order │ │ Prescr.  │ │ Imaging│
        └─────┬────┘ └────┬─────┘ └───┬────┘
              │            │            │
              │     ┌──────▼──────┐    │
              │     │  DISPENSING  │    │
              │     │ (Pharmacy)  │    │
              │     └──────┬──────┘    │
              │            │            │
              └────────────┼────────────┘
                           │ billable items
                    ┌──────▼──────┐
                    │   INVOICE   │──→ GL Auto-Post (Revenue)
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   PAYMENT   │──→ GL Auto-Post (Cash/AR)
                    └─────────────┘


        ┌─────────┐     ┌────────┐     ┌───────────┐
        │ SUPPLIER│────→│   PO   │────→│    GRN    │
        └────┬────┘     └────────┘     └─────┬─────┘
             │                               │ post to stock
             │                        ┌──────▼──────┐
             │                        │  INVENTORY  │──→ GL (DR Inventory / CR AP)
             │                        │ StockBalance│
             │                        │ StockLedger │
             │                        └──────┬──────┘
             │                               │
             │              ┌────────────────┼────────────────┐
             │              │                │                │
             │       ┌──────▼──────┐  ┌──────▼──────┐ ┌─────▼──────┐
             │       │   STORES    │  │  PHARMACY   │ │  DISPOSAL  │
             │       │ (Transfers) │  │  (POS/Rx)   │ │  (Write-off)│
             │       └─────────────┘  └─────────────┘ └────────────┘
             │
      ┌──────▼──────┐
      │   RETURNS   │──→ Credit note → AP adjustment
      └─────────────┘
```

### Key Cross-Module Calls

| From | To | Method | Purpose |
|------|----|--------|---------|
| Procurement (GRN post) | Inventory | `receiveStock()` | Add goods to stock |
| Procurement (GRN post) | Finance | `autoPostGRNJournal()` | DR Inventory / CR AP |
| Prescriptions (dispense) | Inventory | Stock reservation/deduction | Reserve on Rx, deduct on dispense |
| Prescriptions (dispense) | Billing | `addBillableItem()` | Auto-bill dispensed items |
| Pharmacy (complete sale) | Inventory | Stock deduction + ledger | POS stock management |
| Billing (invoice) | Finance | `postJournalEntry()` | Revenue recognition |
| Billing (payment) | Finance | `postJournalEntry()` | Cash receipt posting |
| Disposal | Inventory | `deductStock()` | Remove disposed items |
| Supplier Returns | Inventory | `deductStock()` | Remove returned items |
| Stores (transfer) | Inventory | Dual ledger entries | TRANSFER_OUT + TRANSFER_IN |
| Assets (depreciation) | Finance | `postJournalEntry()` | Monthly depreciation GL |

---

*Generated from analysis of 3,600+ lines of backend source code across 14+ modules.*
