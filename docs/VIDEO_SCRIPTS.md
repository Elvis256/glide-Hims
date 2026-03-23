# Glide HIMS — Demo Video Narration Scripts

> **System:** Glide HIMS (Healthcare Information Management System)
> **Tenant:** Amani Children's Clinic
> **Demo User:** elvis (Super Admin)
> **Platform:** NestJS + React + PostgreSQL
> **Scale:** 22+ modules · 382 routes · 148 database entities · 270+ pages

---

## Table of Contents

| # | Video | Duration | Page |
|---|-------|----------|------|
| 1 | [The Complete Patient Journey](#video-1-the-complete-patient-journey) | 3:00 | End-to-end flagship demo |
| 2 | [Patient Registration](#video-2-patient-registration) | 1:30 | Registration & intake |
| 3 | [Doctor Consultation Flow](#video-3-doctor-consultation-flow) | 2:00 | Clinical workflow |
| 4 | [Laboratory Workflow](#video-4-laboratory-workflow) | 1:30 | Lab operations |
| 5 | [Pharmacy & Stock Management](#video-5-pharmacy--stock-management) | 2:00 | Pharmacy & inventory |
| 6 | [Billing & Insurance](#video-6-billing--insurance) | 2:00 | Revenue cycle |
| 7 | [Executive Dashboard & Analytics](#video-7-executive-dashboard--analytics) | 1:30 | KPIs & reporting |
| 8 | [HR & Payroll](#video-8-hr--payroll) | 1:00 | Staff management |
| 9 | [Ward Management (IPD)](#video-9-ward-management-ipd) | 1:00 | Inpatient operations |
| 10 | [Offline Mode](#video-10-offline-mode) | 1:00 | Offline resilience |
| 11 | [HMIS-105 Report Generation](#video-11-hmis-105-report-generation) | 0:45 | Government reporting |

**Total Runtime: ~16 minutes 45 seconds**

---

## General Recording Guidelines

Before recording any video, ensure:

- [ ] Logged in as **elvis** (Super Admin) at the Amani Children's Clinic tenant
- [ ] Browser zoom set to **100%** (or 110% for smaller screens)
- [ ] Browser window at **1920×1080** (full HD)
- [ ] All browser extensions hidden; bookmarks bar hidden
- [ ] Notifications silenced on OS and browser
- [ ] Seed data loaded — patients, lab tests, drugs, insurance providers all present
- [ ] Cursor movements are **slow and deliberate** — viewers must follow along
- [ ] Pause **1–2 seconds** on every important element before clicking
- [ ] Use a **clean, well-lit microphone** — no echo, no background noise

---

## VIDEO 1: The Complete Patient Journey

**Duration:** 3:00
**Filename:** `01-complete-patient-journey.mp4`

### Purpose

This is the flagship demo. It proves to the hospital administrator that Glide HIMS handles the **entire patient lifecycle** — from the moment a patient walks through the door to the moment they walk out with medication in hand and a receipt in their pocket. Every department is connected. No paper. No phone calls between departments. No lost lab results. No missing charges.

### Pre-Recording Setup

1. Prepare a **new patient name** not yet in the system (e.g., "Hope Nakamya", Female, DOB 2015-03-12)
2. Ensure Dr. James Mukasa is listed as on-duty in the doctor schedule
3. Confirm "CBC – Complete Blood Count" exists in the lab test catalog
4. Confirm "Amoxicillin 500mg" is in pharmacy stock with quantity ≥ 20
5. Have the billing service catalog loaded with consultation fee (e.g., UGX 15,000)
6. Open the system in a clean browser tab at the dashboard (`/`)

### Beat-by-Beat Script

---

#### INTRO TITLE CARD (0:00–0:08)

*On screen: Slide with Glide HIMS logo, "The Complete Patient Journey", Amani Children's Clinic*

**Narration:**
> "This is Glide HIMS — a complete Healthcare Information Management System built for African hospitals. In the next three minutes, you'll see a patient walk through every department in your hospital — registration, consultation, lab, pharmacy, billing — all connected in one seamless system. Let's begin."

---

#### BEAT 1 — Patient Registration (0:08–0:35)

*Navigate to: `/patients/new`*

**On-screen actions:**
1. Click **"Patient Management"** in the sidebar
2. Click **"New Patient"**
3. Fill in: Full Name → "Hope Nakamya", Gender → Female, Date of Birth → 12/03/2015, Phone → 0772-555-0123, Address → "Kampala, Wandegeya"
4. Click **"Register Patient"**
5. Show the auto-generated MRN number (e.g., MRN00011)

**Narration:**
> "A mother brings in her daughter, Hope. The receptionist opens the registration form, enters the child's details — name, date of birth, gender, phone number. One click — and Hope is registered. The system automatically assigns a unique Medical Record Number. No paper files. No duplicate risk. This took fifteen seconds."

---

#### BEAT 2 — OPD Token & Queue (0:35–0:55)

*Navigate to: `/opd/token`*

**On-screen actions:**
1. Click **"Queue & Tokens"** → **"Issue OPD Token"**
2. Search for "Hope Nakamya"
3. Select the patient
4. Issue OPD token — show the token number (e.g., OPD-042)
5. Briefly show the queue position

**Narration:**
> "Next, she gets an OPD token. The system assigns her a queue number — OPD-042 — and she's now visible in the doctor's queue. The mother takes a seat. The doctor's screen is already updating."

---

#### BEAT 3 — Doctor Consultation (0:55–1:30)

*Navigate to: `/doctor/queue`*

**On-screen actions:**
1. Show the doctor's waiting queue — Hope Nakamya appears
2. Click on Hope's name to open her encounter
3. Navigate to clinical notes (`/doctor/notes`) — type: "Child presents with fever for 3 days, mild cough, no rash"
4. Navigate to ICD-10 diagnosis (`/doctor/diagnosis/icd`) — search "malaria" → select "B54 – Unspecified malaria"
5. Click **"Lab Orders"** (`/doctor/orders/lab`) → search "CBC" → order "Complete Blood Count"
6. Click **"Write Prescription"** (`/doctor/prescriptions/new`) → search "Amoxicillin 500mg" → set dosage: "1 tablet, 3 times daily, 5 days" → save

**Narration:**
> "Dr. Mukasa opens his queue and sees Hope waiting. He clicks to open her record. He documents her symptoms — fever for three days, mild cough. He selects the ICD-10 code for suspected malaria. Then, in two clicks, he orders a CBC blood test and writes a prescription for Amoxicillin. Watch — the lab order goes directly to the laboratory queue. The prescription goes directly to the pharmacy queue. No paper requisition slips. No phone calls."

---

#### BEAT 4 — Laboratory (1:30–1:55)

*Navigate to: `/lab/queue`*

**On-screen actions:**
1. Show the lab queue — Hope Nakamya's CBC order appears
2. Click to accept the order
3. Navigate to sample collection (`/lab/samples`) — mark sample collected
4. Navigate to results entry (`/lab/results`) — enter: WBC: 11.2, RBC: 4.5, Hemoglobin: 12.1, Platelets: 180
5. Click **"Validate & Submit"**

**Narration:**
> "In the laboratory, the technician sees Hope's CBC order appear instantly. They collect the sample, enter the results — white blood cells, red blood cells, hemoglobin, platelets — and validate. The moment they click submit, these results appear on Dr. Mukasa's screen. No runner carrying paper from the lab to the doctor's office."

---

#### BEAT 5 — Doctor Reviews Results (1:55–2:10)

*Navigate to: `/doctor/results/lab`*

**On-screen actions:**
1. Show Dr. Mukasa's lab results view
2. Click on Hope's CBC result — show all values
3. Briefly highlight the result is now attached to the patient's permanent record

**Narration:**
> "Back at his desk, Dr. Mukasa sees the lab results are ready. He reviews them, confirms his diagnosis, and the results are now part of Hope's permanent medical record — accessible from any future visit."

---

#### BEAT 6 — Pharmacy Dispensing (2:10–2:30)

*Navigate to: `/pharmacy/queue`*

**On-screen actions:**
1. Show the pharmacy queue — Hope's Amoxicillin prescription appears
2. Click to dispense
3. Show the stock auto-deduction (quantity decreases)
4. Mark as dispensed

**Narration:**
> "In the pharmacy, Sarah the pharmacist sees the prescription waiting. She dispenses the Amoxicillin — and watch — the stock count automatically decreases. No manual inventory adjustment. No stock discrepancies at month-end."

---

#### BEAT 7 — Billing & Payment (2:30–2:55)

*Navigate to: `/billing/reception/new`*

**On-screen actions:**
1. Show the billing screen — all charges auto-populated: Consultation fee, CBC lab test, Amoxicillin
2. Show the total (e.g., UGX 45,000)
3. Click **"Collect Payment"** → select "Cash"
4. Process payment
5. Click **"Print Receipt"** — show the receipt preview (POS format)

**Narration:**
> "At the cashier's window, every charge is already captured — the consultation fee, the lab test, the medication. Nothing is missed. Nothing is manually entered. The cashier collects payment, and a receipt prints instantly. This is how you stop revenue leakage."

---

#### CLOSING (2:55–3:00)

*On screen: Return to the dashboard (`/`)*

**Narration:**
> "Registration to receipt — under three minutes. Every department connected. Every charge captured. Every result tracked. That's the complete patient journey in Glide HIMS."

---

### Key Talking Points

- **Speed:** The entire journey takes under 3 minutes in the demo; in a real hospital it replaces hours of paper shuffling
- **Zero leakage:** Every service rendered is automatically added to the bill — no missed charges
- **No runners:** Lab results, prescriptions, and orders flow electronically between departments
- **Permanent record:** Everything is saved to the patient's lifetime medical record
- **One system:** No switching between 5 different software tools

### Transition Notes

- Use a brief **fade-to-black (0.5s)** between each department switch to signal a change of role/location
- Add a subtle **department label overlay** (e.g., "📋 Reception", "🩺 Doctor", "🔬 Laboratory", "💊 Pharmacy", "💰 Billing") when switching contexts

---

## VIDEO 2: Patient Registration

**Duration:** 1:30
**Filename:** `02-patient-registration.mp4`

### Purpose

Prove that patient intake is fast, accurate, and foolproof. Demonstrate that duplicate patients are caught before they're created, MRN numbers are automatic, insurance cards can be uploaded, and the patient immediately enters the OPD queue. The administrator should think: *"My receptionist can do this in under a minute."*

### Pre-Recording Setup

1. Ensure patient **"Sarah Namugga"** (MRN00002) already exists in the system (from seed data)
2. Prepare a new patient: "Moses Ochieng", Male, DOB 1988-07-22
3. Have a sample insurance card image file ready on the desktop (PNG or JPG)
4. Ensure at least 3–4 patients are already in the OPD queue so the queue position is visible

### Beat-by-Beat Script

---

#### INTRO (0:00–0:05)

*On screen: Title card — "Patient Registration in Glide HIMS"*

**Narration:**
> "Let me show you how fast and accurate patient registration is in Glide HIMS."

---

#### BEAT 1 — New Patient Form (0:05–0:30)

*Navigate to: `/patients/new`*

**On-screen actions:**
1. Click **"Patient Management"** → **"New Patient"** in the sidebar
2. Begin typing: Full Name → "Moses Ochieng"
3. Fill in: Gender → Male, Date of Birth → 22/07/1988
4. Phone → 0782-333-4455
5. National ID → CM88012345ABCDE
6. Address → "Jinja Road, Kampala"

**Narration:**
> "The receptionist clicks 'New Patient' and fills in the basics — name, date of birth, gender, phone number, national ID. The form is clean and straightforward. No training manual required."

---

#### BEAT 2 — Duplicate Detection (0:30–0:45)

**On-screen actions:**
1. Clear the form
2. Start typing "Sarah Namugga" in the name field
3. Show the **duplicate detection alert** — the system flags that a patient with a similar name already exists
4. Show the matching record: Sarah Namugga, MRN00002
5. Dismiss the alert and return to Moses Ochieng's registration

**Narration:**
> "Now watch this — if I start typing a name that already exists, the system immediately warns me. 'A patient with a similar name already exists.' This prevents duplicate records — one of the biggest problems in paper-based hospitals. Every patient, one record, forever."

---

#### BEAT 3 — Auto-MRN & Save (0:45–0:58)

**On-screen actions:**
1. Return to Moses Ochieng's completed form
2. Click **"Register Patient"**
3. Show the success confirmation — auto-generated MRN (e.g., MRN00011)
4. Hover over the MRN number to emphasize it

**Narration:**
> "I click 'Register' — and Moses gets his unique Medical Record Number automatically. MRN-zero-zero-zero-eleven. This number follows him for life across every visit, every department, every branch of your hospital."

---

#### BEAT 4 — Insurance Card Upload (0:58–1:10)

*Navigate to: `/insurance/cards` or patient profile*

**On-screen actions:**
1. Open Moses Ochieng's patient profile
2. Click **"Insurance"** or **"Documents"** section
3. Click **"Upload Insurance Card"**
4. Select the image file from the desktop
5. Show the uploaded card preview

**Narration:**
> "If the patient has insurance, the receptionist can upload a photo of their insurance card right here. It's attached to the patient's profile permanently — no filing cabinets, no lost cards."

---

#### BEAT 5 — OPD Token & Queue Position (1:10–1:25)

*Navigate to: `/opd/token`*

**On-screen actions:**
1. Click **"Issue OPD Token"**
2. Search for "Moses Ochieng"
3. Issue the token — show token number (e.g., OPD-045)
4. Show the queue monitor briefly — Moses appears at position 5

**Narration:**
> "Finally, the receptionist issues an OPD token. Moses is now number 45 in the queue, position five. He can sit down and wait — and the doctor's screen is already showing him in line. From arrival to queue — under ninety seconds."

---

#### CLOSING (1:25–1:30)

**Narration:**
> "Fast registration. Duplicate protection. Automatic record numbers. That's patient intake, done right."

---

### Key Talking Points

- **Duplicate detection** saves hospitals from the chaos of multiple files for the same patient
- **Auto-MRN** eliminates human error in numbering and guarantees uniqueness
- **Insurance card upload** replaces physical filing systems
- **OPD token** creates immediate visibility in the doctor's queue — no one is forgotten

---

## VIDEO 3: Doctor Consultation Flow

**Duration:** 2:00
**Filename:** `03-doctor-consultation.mp4`

### Purpose

Show the doctor's complete workflow — from seeing patients in the queue, to documenting findings, diagnosing with ICD-10 codes, ordering labs, and writing prescriptions. The administrator should see that Glide HIMS makes doctors faster, not slower. The system works *with* clinical workflows, not against them.

### Pre-Recording Setup

1. Ensure **3–4 patients** are in the doctor's queue (from OPD tokens issued earlier)
2. Patient **"Grace Nakato"** (MRN00004) should be in the queue with vitals already recorded by the nurse (Temperature: 38.2°C, BP: 120/80, Pulse: 88, Weight: 65kg)
3. Ensure "CBC – Complete Blood Count" exists in the lab test catalog
4. Ensure "Paracetamol 500mg" is in the drug formulary
5. Log in as a doctor role or use Super Admin with doctor module access

### Beat-by-Beat Script

---

#### INTRO (0:00–0:05)

*On screen: Title card — "Doctor Consultation Flow"*

**Narration:**
> "Here's what the doctor sees when they sit down at their desk in the morning."

---

#### BEAT 1 — Doctor's Queue (0:05–0:20)

*Navigate to: `/doctor/queue`*

**On-screen actions:**
1. Show the **Doctor** section in the sidebar — click **"My Queue"** → **"Waiting Patients"**
2. Show the queue list with 3–4 patients, their token numbers, wait times, and chief complaints
3. Highlight Grace Nakato in the queue
4. Click on Grace Nakato's name

**Narration:**
> "The doctor opens their queue and sees every patient waiting — their name, token number, how long they've been waiting, and why they're here. No shouting names in the corridor. No paper lists. Let's see Grace Nakato."

---

#### BEAT 2 — Patient Vitals Review (0:20–0:35)

**On-screen actions:**
1. Show Grace Nakato's encounter view
2. Display the **vitals panel** — Temperature: 38.2°C, BP: 120/80, Pulse: 88, Weight: 65kg
3. Point out that these were recorded by the nurse before the doctor even opened the record

**Narration:**
> "Before the doctor types a single word, the nurse has already recorded Grace's vitals — temperature thirty-eight point two, blood pressure one-twenty over eighty, pulse eighty-eight. The doctor sees this instantly. No asking the nurse to bring the file."

---

#### BEAT 3 — Clinical Notes (0:35–0:55)

*Navigate to: `/doctor/notes`*

**On-screen actions:**
1. Click **"Clinical Notes"** or **"SOAP Notes"**
2. Type in the Subjective field: "Patient reports headache and fever for 2 days, body aches, loss of appetite"
3. Type in the Objective field: "Febrile, mild dehydration, no rash, no neck stiffness"
4. Show the notes auto-saving

**Narration:**
> "The doctor documents their findings using structured clinical notes. Subjective — what the patient tells you. Objective — what you observe. The notes save automatically as you type — no lost documentation if the power flickers."

---

#### BEAT 4 — ICD-10 Diagnosis (0:55–1:10)

*Navigate to: `/doctor/diagnosis/icd`*

**On-screen actions:**
1. Click **"Diagnosis"** → **"ICD-10 Coding"**
2. Type "malaria" in the search box
3. Show the dropdown with ICD-10 codes — B50, B51, B52, B53, B54
4. Select **"B54 – Unspecified malaria"**
5. Show the diagnosis attached to the encounter

**Narration:**
> "For diagnosis, the doctor searches the ICD-10 database — the international standard. Type 'malaria' — every relevant code appears. Select the right one. This is critical for insurance claims, government reporting, and clinical analytics. No more illegible handwritten diagnoses."

---

#### BEAT 5 — Order Lab Test (1:10–1:25)

*Navigate to: `/doctor/orders/lab`*

**On-screen actions:**
1. Click **"Orders"** → **"Lab Orders"**
2. Search for "CBC"
3. Select "CBC – Complete Blood Count"
4. Add clinical note: "Rule out severe malaria"
5. Click **"Submit Order"**
6. Show confirmation — order sent to lab queue

**Narration:**
> "The doctor orders a CBC — two clicks. The order appears instantly in the laboratory queue. No paper requisition slip. No runner walking to the lab. The lab technician sees it on their screen right now."

---

#### BEAT 6 — Write Prescription (1:25–1:45)

*Navigate to: `/doctor/prescriptions/new`*

**On-screen actions:**
1. Click **"Prescriptions"** → **"Write Prescription"**
2. Search for "Paracetamol 500mg"
3. Select it — set: Dosage: 1 tablet, Frequency: 3 times daily, Duration: 3 days
4. Click **"Save Prescription"**
5. Show confirmation — prescription sent to pharmacy queue

**Narration:**
> "Next, a prescription. Search 'Paracetamol' — set the dosage, frequency, duration. Save. The prescription instantly appears in the pharmacy queue. The pharmacist can start preparing the medication before the patient even leaves this room."

---

#### BEAT 7 — Lab Queue Updating (1:45–1:55)

*Navigate to: `/lab/queue` (briefly)*

**On-screen actions:**
1. Quickly switch to the lab queue view
2. Show Grace Nakato's CBC order sitting in the queue with status "Pending"
3. Highlight the real-time nature of the queue

**Narration:**
> "And look — in the lab, Grace's CBC order is already waiting. Everything flows in real time. No delays. No lost orders."

---

#### CLOSING (1:55–2:00)

**Narration:**
> "Queue to diagnosis to orders to prescriptions — the doctor never leaves this screen. That's clinical efficiency."

---

### Key Talking Points

- **ICD-10 coding** enables proper insurance claims and HMIS reporting
- **Real-time lab orders** eliminate the paper requisition bottleneck
- **Instant prescription routing** means the pharmacy is ready before the patient arrives
- **Nurse-recorded vitals** are immediately visible — no duplicated effort
- **Auto-save** protects against data loss during power interruptions

---

## VIDEO 4: Laboratory Workflow

**Duration:** 1:30
**Filename:** `04-laboratory-workflow.mp4`

### Purpose

Demonstrate that the laboratory operates with zero paper. Orders arrive electronically, samples are tracked, results are entered and validated, and the ordering doctor is notified automatically. Show the turnaround time (TAT) dashboard to prove accountability. The administrator should think: *"I'll finally know how fast my lab actually is."*

### Pre-Recording Setup

1. Ensure **2–3 pending lab orders** exist in the lab queue (from doctor orders)
2. Patient **Grace Nakato** should have a pending CBC order
3. Have realistic CBC values ready: WBC: 11.5, RBC: 4.8, Hgb: 13.2, Hct: 39%, Platelets: 210
4. Ensure the lab analytics page has some historical data for the TAT chart

### Beat-by-Beat Script

---

#### INTRO (0:00–0:04)

*On screen: Title card — "Laboratory Workflow"*

**Narration:**
> "Here's how the lab operates — completely paperless."

---

#### BEAT 1 — Lab Queue (0:04–0:18)

*Navigate to: `/lab/queue`*

**On-screen actions:**
1. Open the **Lab** section in the sidebar → **"Lab Queue"**
2. Show the queue with 2–3 pending orders — patient names, test names, ordering doctor, time ordered
3. Highlight Grace Nakato's CBC order
4. Click **"Accept"** on the order

**Narration:**
> "The lab technician opens their queue and sees every pending order — who ordered it, what test, how long ago. No paper slips piling up on the counter. Peter the lab tech accepts Grace's CBC order."

---

#### BEAT 2 — Sample Collection (0:18–0:35)

*Navigate to: `/lab/samples`*

**On-screen actions:**
1. Click on **"Sample Collection"**
2. Find Grace Nakato's order
3. Mark sample as **"Collected"** — timestamp auto-records
4. Show the sample status updating to "In Process"

**Narration:**
> "He collects the blood sample and marks it in the system. The timestamp is recorded automatically — this is critical for turnaround time tracking. The system knows exactly when the sample was collected."

---

#### BEAT 3 — Results Entry (0:35–0:58)

*Navigate to: `/lab/results`*

**On-screen actions:**
1. Click **"Results Entry"**
2. Open Grace Nakato's CBC
3. Enter values: WBC: 11.5, RBC: 4.8, Hemoglobin: 13.2, Hematocrit: 39%, Platelets: 210
4. Show any flagged out-of-range values (if WBC is above normal range, it highlights)
5. Click **"Validate & Submit"**
6. Show the confirmation — results sent to the ordering doctor

**Narration:**
> "Results entry is structured — every parameter has its field, its normal range. Peter enters the values. Notice the system flags the elevated white blood cell count — it's above normal range. He validates and submits. At this exact moment, Dr. Mukasa is notified that Grace's results are ready."

---

#### BEAT 4 — Doctor Notification (0:58–1:08)

*Navigate to: `/doctor/results/lab` (briefly)*

**On-screen actions:**
1. Switch to the doctor's results view
2. Show Grace Nakato's CBC results appearing with a "New" badge
3. Click to view — all values displayed with reference ranges

**Narration:**
> "On the doctor's screen — the results are already here. No waiting. No calling the lab. No walking across the hospital. Instant."

---

#### BEAT 5 — Lab Analytics / TAT Dashboard (1:08–1:25)

*Navigate to: `/lab/analytics`*

**On-screen actions:**
1. Click **"Lab Analytics"**
2. Show the **Turnaround Time dashboard** — average TAT per test type
3. Show the **test volume chart** — tests processed today, this week, this month
4. Highlight the TAT metric (e.g., "Average CBC TAT: 45 minutes")

**Narration:**
> "And for management — the Lab Analytics dashboard. Average turnaround time for a CBC? Forty-five minutes. You can see test volumes, pending orders, and technician performance. If the lab is slow, you'll know — and you'll know exactly where the bottleneck is."

---

#### CLOSING (1:25–1:30)

**Narration:**
> "From order to results — tracked, timed, and transparent. That's a modern laboratory."

---

### Key Talking Points

- **Turnaround time tracking** creates accountability
- **Abnormal value flagging** catches critical results before they're missed
- **Instant doctor notification** eliminates the "results are not ready yet" phone call
- **Sample timestamps** provide an audit trail for quality control

---

## VIDEO 5: Pharmacy & Stock Management

**Duration:** 2:00
**Filename:** `05-pharmacy-stock-management.mp4`

### Purpose

Demonstrate two things: (1) pharmacy dispensing is fast and connected to the doctor's prescriptions, and (2) stock management is automated — no manual counting, no surprise stockouts, no expired drugs reaching patients. The administrator should think: *"I'll never run out of essential drugs again."*

### Pre-Recording Setup

1. Ensure **2–3 prescriptions** are in the pharmacy queue
2. Patient **Grace Nakato** should have a pending Paracetamol prescription
3. Set one drug's stock to a low quantity (e.g., Metronidazole 400mg → 8 tablets) to trigger a low-stock alert
4. Set one drug batch to expire within 30 days to trigger an expiry alert
5. Have a supplier configured (e.g., "Quality Chemicals Ltd" or "National Medical Stores")
6. Ensure the stock management page shows current inventory levels

### Beat-by-Beat Script

---

#### INTRO (0:00–0:05)

*On screen: Title card — "Pharmacy & Stock Management"*

**Narration:**
> "The pharmacy is where revenue meets patient care. Let me show you how Glide HIMS handles both."

---

#### BEAT 1 — Pharmacy Dispensing Queue (0:05–0:22)

*Navigate to: `/pharmacy/queue`*

**On-screen actions:**
1. Open the **Pharmacy** section → **"Pharmacy Queue"**
2. Show 2–3 prescriptions waiting — patient name, drug, prescribing doctor, time
3. Click on Grace Nakato's Paracetamol prescription
4. Review the prescription details: drug, dosage, frequency, duration, quantity

**Narration:**
> "The pharmacist opens the dispensing queue and sees every prescription waiting — who it's for, what drug, who prescribed it, and when. No deciphering handwriting. No calling the doctor to clarify. Sarah clicks on Grace Nakato's prescription — Paracetamol, one tablet, three times daily, three days — nine tablets total."

---

#### BEAT 2 — Dispense & Stock Auto-Deduction (0:22–0:40)

**On-screen actions:**
1. Click **"Dispense"**
2. Show the current stock level before dispensing (e.g., Paracetamol: 500 tablets)
3. Confirm dispensing
4. Show the stock level after dispensing (e.g., Paracetamol: 491 tablets)
5. Mark prescription as **"Dispensed"**

**Narration:**
> "She clicks 'Dispense' — and watch the stock count. Paracetamol was at five hundred tablets. After dispensing nine tablets, it's now four hundred ninety-one. Automatic. No manual stock card. No end-of-day counting. The inventory is always accurate, always real-time."

---

#### BEAT 3 — Low Stock Alert (0:40–0:55)

*Navigate to: `/pharmacy/stock`*

**On-screen actions:**
1. Click **"Stock Management"**
2. Show the stock list — highlight the Metronidazole 400mg row
3. Show the **low stock alert** indicator (red badge or warning icon)
4. Show the reorder level vs. current quantity (Reorder: 50, Current: 8)

**Narration:**
> "Now look at this — Metronidazole is flagged in red. Only eight tablets left, and the reorder level is fifty. The system is telling the pharmacist: order now, before you run out. No more discovering a stockout when a patient is standing at the counter."

---

#### BEAT 4 — Expiry Alerts (0:55–1:08)

**On-screen actions:**
1. On the stock page, show the **expiry alerts** section or filter
2. Show a drug batch expiring within 30 days
3. Highlight the expiry date and the alert indicator

**Narration:**
> "And here — expiry alerts. This batch of Ciprofloxacin expires in twenty-two days. The system warns you before expired drugs reach patients. This is patient safety and financial protection in one feature."

---

#### BEAT 5 — Create Purchase Order (1:08–1:30)

*Navigate to: Procurement or pharmacy purchase orders*

**On-screen actions:**
1. Click to create a **new purchase order**
2. Select supplier: "National Medical Stores"
3. Add items: Metronidazole 400mg × 500 tablets, Ciprofloxacin 500mg × 200 tablets
4. Show the total cost
5. Submit the purchase order

**Narration:**
> "From the same system, the pharmacist creates a purchase order. Select the supplier — National Medical Stores. Add the drugs that need restocking — Metronidazole, five hundred tablets; Ciprofloxacin, two hundred tablets. Submit. The order is recorded, tracked, and ready for the supplier."

---

#### BEAT 6 — Receive Goods (GRN) & Stock Update (1:30–1:52)

**On-screen actions:**
1. Open the **Goods Received Note (GRN)** section
2. Select the purchase order
3. Confirm receipt of goods — enter batch numbers and expiry dates
4. Click **"Receive"**
5. Show the stock levels updating — Metronidazole jumps from 8 to 508

**Narration:**
> "When the delivery arrives, the pharmacist records a Goods Received Note. Enter the batch number, the expiry date, confirm the quantity. One click — and the stock updates instantly. Metronidazole goes from eight tablets to five hundred and eight. The full supply chain — order, receive, stock — all in one system."

---

#### CLOSING (1:52–2:00)

**Narration:**
> "Automated dispensing. Smart alerts. Integrated procurement. Your pharmacy runs itself — and your stock is always accurate."

---

### Key Talking Points

- **Auto-deduction** eliminates manual stock cards and discrepancies
- **Low stock alerts** prevent embarrassing (and dangerous) stockouts
- **Expiry tracking** protects patients and prevents financial loss
- **Integrated procurement** means the pharmacist never leaves the system to create a PO
- **GRN processing** closes the loop — from order to shelf, fully tracked

---

## VIDEO 6: Billing & Insurance

**Duration:** 2:00
**Filename:** `06-billing-insurance.mp4`

### Purpose

Prove that no revenue slips through the cracks. Every consultation, lab test, procedure, and medication is captured and billed automatically. Show that insurance verification happens at the point of care, not after the fact. Demonstrate the 12 pre-configured Uganda insurance providers. The administrator should think: *"This will pay for itself in the first month."*

### Pre-Recording Setup

1. Patient **David Mugisha** (MRN00005) should have a completed encounter with charges: Consultation (UGX 15,000), CBC Lab (UGX 25,000), Paracetamol (UGX 5,000)
2. David should have active insurance with **AAR Healthcare** (coverage: 80%)
3. Ensure the insurance providers list is populated with all 12 Uganda providers
4. Have the revenue dashboard populated with at least a week of data
5. Ensure POS receipt template is configured

### Beat-by-Beat Script

---

#### INTRO (0:00–0:05)

*On screen: Title card — "Billing & Insurance"*

**Narration:**
> "Revenue leakage is the silent killer of African hospitals. Here's how Glide HIMS stops it."

---

#### BEAT 1 — Cashier View (0:05–0:18)

*Navigate to: `/billing/reception/new`*

**On-screen actions:**
1. Open **"Reception Billing"** → **"New Bill"**
2. Search for patient "David Mugisha"
3. Show the **auto-populated charges** — all services rendered are already listed:
   - Consultation Fee: UGX 15,000
   - CBC Lab Test: UGX 25,000
   - Paracetamol 500mg (9 tablets): UGX 5,000
4. Show the total: UGX 45,000

**Narration:**
> "The cashier searches for David Mugisha — and look. Every charge is already here. The consultation, the lab test, the medication. The system captured it all automatically. Nothing was manually entered. Nothing was forgotten. Total: forty-five thousand shillings."

---

#### BEAT 2 — Insurance Verification (0:18–0:38)

*Navigate to: `/insurance/verify`*

**On-screen actions:**
1. Click **"Insurance Desk"** → **"Verify Coverage"**
2. Show David Mugisha's insurance: **AAR Healthcare**
3. Show coverage details: 80% coverage, active policy, policy number
4. Show the system calculating: Insurance pays 80% (UGX 36,000), Patient pays 20% (UGX 9,000)

**Narration:**
> "David has insurance with AAR Healthcare. The receptionist verifies his coverage right here — active policy, eighty percent coverage. The system calculates automatically: AAR pays thirty-six thousand, David pays nine thousand. No manual calculations. No disputes at the counter."

---

#### BEAT 3 — Apply Insurance & Create Bill (0:38–0:58)

*Navigate to: `/billing/reception/new`*

**On-screen actions:**
1. Return to the billing screen
2. Apply insurance — show the AAR Healthcare discount being applied
3. Show the split: Insurance portion (UGX 36,000) and Patient co-pay (UGX 9,000)
4. Click **"Generate Bill"**

**Narration:**
> "Back on the bill — apply AAR Healthcare coverage. Watch the split appear: insurance covers thirty-six thousand, David's co-pay is nine thousand. One click to generate the bill. Clean, transparent, auditable."

---

#### BEAT 4 — Collect Payment & Print Receipt (0:58–1:18)

*Navigate to: `/billing/reception/payment`*

**On-screen actions:**
1. Click **"Collect Payment"**
2. Show the amount due: UGX 9,000 (co-pay only)
3. Select payment method: **"Cash"**
4. Process payment
5. Click **"Print Receipt"** → show the **POS-format receipt** preview
6. Highlight the receipt: patient name, services, insurance applied, amount paid, change

**Narration:**
> "Collect the co-pay — nine thousand shillings, cash. Receipt prints in POS format — compact, professional. It shows every service, the insurance applied, and the amount paid. The patient gets a clear, printed record. The hospital gets a clear, digital audit trail."

---

#### BEAT 5 — Insurance Providers (1:18–1:35)

*Navigate to: `/admin/pricing/insurance` or insurance configuration*

**On-screen actions:**
1. Open the insurance configuration
2. Scroll through the **12 pre-configured Uganda insurance providers**:
   - UNHIS (National Health Insurance)
   - UAP Old Mutual
   - Jubilee Health Insurance
   - AAR Healthcare
   - GA Insurance
   - First Insurance Company
   - Sanlam General Insurance
   - Prudential Assurance
   - MTN Staff Medical Scheme
   - Stanbic Bank Medical Scheme
   - Uganda Government Civil Service Scheme
   - Uganda Police Medical Scheme
3. Show that each has payment terms, submission methods, and price lists configured

**Narration:**
> "Glide HIMS comes pre-configured with twelve Ugandan insurance providers — from UNHIS the national scheme, to AAR, Jubilee, UAP Old Mutual, MTN Staff Medical, Stanbic Bank, Uganda Police — all with their payment terms and submission methods already set up. You're not starting from zero."

---

#### BEAT 6 — Revenue Dashboard (1:35–1:55)

*Navigate to: `/reports/registration/revenue`*

**On-screen actions:**
1. Open **"Revenue Reports"**
2. Show the revenue dashboard:
   - Today's collections
   - Cash vs. insurance breakdown
   - Outstanding insurance claims
   - Revenue trend chart (daily/weekly/monthly)
3. Highlight the insurance receivables figure

**Narration:**
> "And for the administrator — the revenue dashboard. Today's collections. Cash versus insurance breakdown. Outstanding insurance claims — money owed to you. Revenue trends over time. You see exactly where your money is, and where it's supposed to come from."

---

#### CLOSING (1:55–2:00)

**Narration:**
> "Every charge captured. Insurance verified. Revenue tracked. No more leakage."

---

### Key Talking Points

- **Auto-charge capture** is the #1 revenue protection feature — services are billed the moment they're rendered
- **12 Uganda insurance providers** pre-configured — no manual setup
- **Insurance co-pay calculation** is automatic — eliminates human error
- **POS receipt printing** is professional and instant
- **Revenue dashboard** gives administrators real-time financial visibility

---

## VIDEO 7: Executive Dashboard & Analytics

**Duration:** 1:30
**Filename:** `07-executive-dashboard.mp4`

### Purpose

Show the administrator that they can see the health of their hospital at a glance — revenue, patient volume, bed occupancy, lab performance — all without opening a spreadsheet. Demonstrate the HMIS-105 government report generation. The administrator should think: *"I can run my hospital from my phone."*

### Pre-Recording Setup

1. Ensure the dashboard has data for at least the current month
2. Populate financial data with realistic Uganda shilling figures
3. Ensure bed occupancy data exists (some beds occupied, some available)
4. Have HMIS-105 report generation working for the previous month
5. Log in as **elvis** (Super Admin) — full dashboard access

### Beat-by-Beat Script

---

#### INTRO (0:00–0:05)

*On screen: Title card — "Executive Dashboard & Analytics"*

**Narration:**
> "You shouldn't need a meeting to know how your hospital is performing. Here's your answer."

---

#### BEAT 1 — Smart Dashboard Overview (0:05–0:25)

*Navigate to: `/` (Home Dashboard)*

**On-screen actions:**
1. Show the **Smart Dashboard** — the home page after login
2. Highlight the **KPI cards** across the top:
   - Today's Revenue (e.g., UGX 2,450,000)
   - Patients Seen Today (e.g., 47)
   - Bed Occupancy (e.g., 72%)
   - Pending Lab Orders (e.g., 5)
   - Outstanding Bills (e.g., UGX 1,200,000)
3. Hover over each card to show the tooltip/detail

**Narration:**
> "The moment you log in, you see everything. Today's revenue — two million four hundred fifty thousand shillings. Forty-seven patients seen. Bed occupancy at seventy-two percent. Five lab orders still pending. Outstanding bills — one point two million. All at a glance. All real-time."

---

#### BEAT 2 — Financial Trends (0:25–0:42)

**On-screen actions:**
1. Scroll to the **financial trends** section
2. Show the **revenue chart** — daily revenue for the past 30 days
3. Show the **cash vs. insurance** breakdown pie chart
4. Point out any trends (e.g., revenue increasing on certain days)

**Narration:**
> "Scroll down for trends. Revenue over the past thirty days — you can see which days are busiest, whether cash or insurance dominates, and whether revenue is growing or declining. This is the data that drives decisions."

---

#### BEAT 3 — Patient Statistics (0:42–0:58)

**On-screen actions:**
1. Show the **patient statistics** section
2. Display: new vs. returning patients, age distribution, gender split
3. Show the **department-wise patient load** chart (OPD, IPD, Emergency)

**Narration:**
> "Patient statistics — new versus returning, age distribution, department load. Are you seeing more children or adults? Is your emergency department overloaded? The dashboard tells you without asking anyone."

---

#### BEAT 4 — HMIS-105 Report (0:58–1:22)

*Navigate to: `/reports/hmis-105`*

**On-screen actions:**
1. Click **"Reports"** → **"HMIS-105"**
2. Select **Month:** Previous month, **Year:** Current year
3. Click **"Generate Report"**
4. Show the report loading and populating with data
5. Scroll through the completed HMIS-105 report — show sections: OPD attendance, diagnoses by ICD-10, maternal health, immunization
6. Click **"Export PDF"**
7. Show the PDF downloading

**Narration:**
> "And here's the game-changer for compliance — the HMIS-105 report. This is the Health Unit Outpatient Monthly Report required by the Uganda Ministry of Health. Select the month, click generate — the system pulls data from every department and populates the entire report automatically. OPD attendance, diagnoses, maternal health — all filled in. Click 'Export PDF' and it's ready to submit. What used to take your team three days of manual counting now takes thirty seconds."

---

#### CLOSING (1:22–1:30)

**Narration:**
> "Real-time KPIs. Financial trends. Government reports in one click. That's running a hospital with data."

---

### Key Talking Points

- **KPI cards** give instant situational awareness — no reports needed
- **HMIS-105 auto-generation** saves days of manual compilation every month
- **Trend data** enables proactive decision-making, not reactive firefighting
- **Bed occupancy visibility** helps optimize admissions and discharge planning
- **Revenue tracking** catches revenue dips before they become crises

---

## VIDEO 8: HR & Payroll

**Duration:** 1:00
**Filename:** `08-hr-payroll.mp4`

### Purpose

Show that staff management is built into the system — not a separate spreadsheet. Employee records, credentials, leave tracking, and payroll processing all happen in one place. The administrator should think: *"I can replace my HR spreadsheets with this."*

### Pre-Recording Setup

1. Ensure **5–10 staff members** exist in the system (from seed data)
2. Have Dr. James Mukasa's profile fully populated — credentials, department, designation
3. Set up a leave balance for at least one employee (e.g., Grace Nambi: 18 days annual leave, 5 used)
4. Have payroll data configured for the current month
5. Ensure a payslip template is ready for generation

### Beat-by-Beat Script

---

#### INTRO (0:00–0:04)

*On screen: Title card — "HR & Payroll"*

**Narration:**
> "Your staff are your biggest investment. Here's how Glide HIMS manages them."

---

#### BEAT 1 — Staff Directory (0:04–0:16)

*Navigate to: `/admin/hr/staff`*

**On-screen actions:**
1. Open **"HR Settings"** → **"Staff Directory"**
2. Show the staff list — names, departments, designations, status
3. Show the search/filter functionality
4. Count: "10 staff members"

**Narration:**
> "The staff directory shows every employee — their department, designation, and status. Search, filter, sort. No more paper personnel files locked in a cabinet."

---

#### BEAT 2 — Employee Profile & Credentials (0:16–0:30)

**On-screen actions:**
1. Click on **Dr. James Mukasa**
2. Show the full employee profile — personal info, contact details, department (Medical), designation (Medical Officer)
3. Click on the **Credentials** tab
4. Show: Medical license number, expiry date, specialization, qualifications

**Narration:**
> "Click on Dr. Mukasa — full profile. His medical license, expiry date, specializations, qualifications. When license renewals are due, the system can alert you. No surprises during a regulatory inspection."

---

#### BEAT 3 — Leave Balance (0:30–0:40)

*Navigate to: `/admin/hr/leave`*

**On-screen actions:**
1. Click **"Leave Management"**
2. Show an employee's leave balance: Annual Leave — 18 days total, 5 used, 13 remaining
3. Show any pending leave requests

**Narration:**
> "Leave management — Nurse Nambi has eighteen days of annual leave. Five used, thirteen remaining. Pending requests are right here for approval. No more tracking leave on a wall calendar."

---

#### BEAT 4 — Process Payroll & Generate Payslip (0:40–0:55)

*Navigate to: `/admin/hr/payroll`*

**On-screen actions:**
1. Click **"Payroll"**
2. Show the payroll processing screen — current month
3. Show staff list with: basic salary, allowances, deductions, net pay
4. Click **"Process Payroll"** (or show it already processed)
5. Click **"Generate Payslip"** for Dr. James Mukasa
6. Show the payslip preview — employee name, month, gross pay, deductions (PAYE, NSSF), net pay

**Narration:**
> "Payroll — all in one screen. Basic salary, allowances, deductions. Process the entire payroll in one click. Generate individual payslips — showing gross pay, PAYE tax, NSSF contributions, and net pay. Send to the employee or print."

---

#### CLOSING (0:55–1:00)

**Narration:**
> "Staff directory, credentials, leave, payroll — all in one system. HR, simplified."

---

### Key Talking Points

- **Credential tracking** prevents regulatory compliance issues
- **Leave management** replaces manual calendars and spreadsheets
- **Integrated payroll** eliminates the need for separate payroll software
- **PAYE and NSSF** deductions are Uganda-specific and pre-configured

---

## VIDEO 9: Ward Management (IPD)

**Duration:** 1:00
**Filename:** `09-ward-management-ipd.mp4`

### Purpose

Show that inpatient operations are visual and organized. Bed availability is visible at a glance, admissions are tracked, nursing notes are digital, and discharge summaries are comprehensive. The administrator should think: *"I can see every bed in my hospital from my desk."*

### Pre-Recording Setup

1. Configure **2–3 wards** with beds (e.g., General Ward: 20 beds, Pediatric Ward: 10 beds, Maternity: 8 beds)
2. Have **5–8 beds occupied** and the rest available
3. Have patient **John Kato** (MRN00001) ready for admission
4. Ensure nursing notes template is available
5. Have at least one patient ready for discharge with a completed stay

### Beat-by-Beat Script

---

#### INTRO (0:00–0:04)

*On screen: Title card — "Ward Management (IPD)"*

**Narration:**
> "Inpatient management — beds, admissions, rounds, discharge — all in one view."

---

#### BEAT 1 — IPD Dashboard & Bed Map (0:04–0:18)

*Navigate to: `/ipd/wards`*

**On-screen actions:**
1. Open **"Wards & Beds"** from the Clinical section
2. Show the **visual bed map** — color-coded: green (available), red (occupied), yellow (reserved)
3. Show ward summary: General Ward: 14/20 occupied, Pediatric: 6/10, Maternity: 5/8
4. Click on a specific bed to show patient details

**Narration:**
> "The bed map — every bed in every ward, color-coded. Green is available, red is occupied. General Ward: fourteen out of twenty beds full. Click any bed to see the patient. You know your capacity at a glance."

---

#### BEAT 2 — Admit Patient & Assign Bed (0:18–0:32)

*Navigate to: `/ipd/admissions`*

**On-screen actions:**
1. Click **"Admissions"** → **"New Admission"**
2. Search for "John Kato"
3. Select ward: General Ward
4. Assign bed: Bed 15 (available — green)
5. Enter admitting diagnosis: "Acute gastroenteritis"
6. Click **"Admit"**
7. Show the bed map update — Bed 15 turns red

**Narration:**
> "Admitting John Kato. Select the ward, assign an available bed — bed fifteen — enter the admitting diagnosis. Admit. Watch the bed map — bed fifteen turns red. The ward nurse sees the new admission instantly."

---

#### BEAT 3 — Nursing Notes & Doctor Rounds (0:32–0:46)

*Navigate to: `/ipd/nursing`*

**On-screen actions:**
1. Click **"IPD Nursing Notes"**
2. Select John Kato
3. Show the nursing notes interface — add a note: "Patient resting comfortably, IV fluids running, intake/output monitored"
4. Show the doctor rounds section — last round: Dr. Mukasa, 9:30 AM

**Narration:**
> "The ward nurse adds notes directly into the system — vitals, observations, IV fluids, intake and output. The doctor's morning round is recorded too. Every note is timestamped and attributed. Complete accountability."

---

#### BEAT 4 — Discharge Summary (0:46–0:56)

*Navigate to: `/ipd/discharge`*

**On-screen actions:**
1. Click **"Discharge Management"**
2. Select a patient ready for discharge
3. Show the **discharge summary** — admitting diagnosis, treatment given, condition at discharge, follow-up instructions
4. Click **"Discharge"**
5. Show the bed turning green on the bed map

**Narration:**
> "When a patient is ready to leave, the discharge summary is generated — diagnosis, treatment, follow-up instructions. Click discharge — and the bed is immediately available for the next patient."

---

#### CLOSING (0:56–1:00)

**Narration:**
> "Visual beds, digital notes, instant discharge. Inpatient management, modernized."

---

### Key Talking Points

- **Visual bed map** eliminates the "which beds are free?" phone call
- **Color-coded status** provides instant situational awareness
- **Nursing notes** are timestamped and attributed — full accountability
- **Instant bed release** on discharge means no wasted capacity

---

## VIDEO 10: Offline Mode

**Duration:** 1:00
**Filename:** `10-offline-mode.mp4`

### Purpose

This is the differentiator for African healthcare. Internet goes down — and the hospital keeps running. No downtime. No lost data. No chaos. When connectivity returns, everything syncs automatically. The administrator should think: *"Even when the internet fails, my hospital doesn't."*

### Pre-Recording Setup

1. Ensure the sync status page is accessible at `/sync/status`
2. Have the application loaded and functioning normally (online)
3. Prepare to disconnect the network (turn off Wi-Fi or unplug Ethernet — or use browser DevTools to simulate offline)
4. Have a new patient name ready: "Mercy Apio"
5. Plan to perform 2–3 actions while offline (register patient, create bill)

### Beat-by-Beat Script

---

#### INTRO (0:00–0:04)

*On screen: Title card — "Offline Mode — Built for Africa"*

**Narration:**
> "Internet goes down. Power flickers. In most hospitals, everything stops. Not here."

---

#### BEAT 1 — Show Online Status (0:04–0:12)

*Navigate to: `/sync/status`*

**On-screen actions:**
1. Open **"Sync & Offline"** → **"Sync Status"**
2. Show the sync status indicator: **"Online — All Synced"** (green indicator)
3. Show the last sync timestamp

**Narration:**
> "Right now, the system is online and fully synced. Everything is up to date. Now watch what happens when the internet disappears."

---

#### BEAT 2 — Disconnect Network (0:12–0:18)

**On-screen actions:**
1. Open browser DevTools (briefly) or show the network disconnection action
2. Toggle the network off
3. Show the sync status changing to **"Offline"** (red/orange indicator)
4. Close DevTools

**Narration:**
> "I've just disconnected the internet. The system detects it immediately — status changes to 'Offline.' But the application is still running."

---

#### BEAT 3 — Work Offline (0:18–0:38)

**On-screen actions:**
1. Navigate to `/patients/new` — **the page loads normally**
2. Register a new patient: "Mercy Apio", Female, DOB 2010-05-18
3. Click **"Register"** — it succeeds (saved locally)
4. Navigate to `/billing/reception/new`
5. Create a bill for a walkthrough patient — add consultation fee
6. Show that the system is functioning normally despite being offline

**Narration:**
> "I'm registering a new patient — Mercy Apio. Click register — it works. The data is saved locally. I can create a bill, record vitals, issue tokens — the hospital keeps running. Your receptionist doesn't even notice the internet is down."

---

#### BEAT 4 — Reconnect & Sync (0:38–0:55)

**On-screen actions:**
1. Reconnect the network
2. Navigate back to `/sync/status`
3. Show the **sync queue** processing — items syncing one by one
4. Show the status changing back to **"Online — All Synced"** (green)
5. Navigate to the patient list — show Mercy Apio is there with a server-assigned MRN
6. Show the sync queue is now empty

**Narration:**
> "Internet is back. Watch the sync queue — every action I performed offline is now uploading to the server. Patient registration, billing — syncing automatically. Status: all synced. Mercy Apio is now in the central database with her permanent MRN. Zero data loss."

---

#### CLOSING (0:55–1:00)

**Narration:**
> "Built for the reality of African infrastructure. When the internet fails, your hospital doesn't."

---

### Key Talking Points

- **Offline-first architecture** — the system is designed to work offline, not as an afterthought
- **Automatic sync** — no manual upload or import required
- **Conflict resolution** — if the same record is modified online and offline, the system handles it
- **Transparent to users** — staff may not even notice the disconnection
- **Critical for rural clinics** where internet is unreliable

---

## VIDEO 11: HMIS-105 Report Generation

**Duration:** 0:45
**Filename:** `11-hmis-105-report.mp4`

### Purpose

Demonstrate the single most time-saving feature for hospital administrators in Uganda. The HMIS-105 (Health Unit Outpatient Monthly Report) is required by the Ministry of Health. Manual compilation takes 2–3 days. Glide HIMS generates it in seconds. The administrator should think: *"I'll never miss a reporting deadline again."*

### Pre-Recording Setup

1. Ensure at least one month of clinical data exists (patient visits, diagnoses, procedures)
2. The previous month should have enough data to populate the report meaningfully
3. Ensure the HMIS-105 report page is functional at `/reports/hmis-105`
4. Have PDF export configured

### Beat-by-Beat Script

---

#### INTRO (0:00–0:04)

*On screen: Title card — "HMIS-105 Report — One Click"*

**Narration:**
> "The HMIS-105 report. Every Ugandan health facility must submit it monthly. Here's how long it takes with Glide HIMS."

---

#### BEAT 1 — Navigate to Reports (0:04–0:10)

*Navigate to: `/reports/hmis-105`*

**On-screen actions:**
1. Click **"Reports"** in the sidebar
2. Click **"HMIS-105"**
3. Show the report configuration screen

**Narration:**
> "Open Reports, click HMIS-105."

---

#### BEAT 2 — Select Period & Generate (0:10–0:20)

**On-screen actions:**
1. Select **Month:** Previous month (e.g., "November")
2. Select **Year:** Current year (e.g., "2024")
3. Click **"Generate Report"**
4. Show the loading indicator (briefly)
5. Show the completed report populating with data

**Narration:**
> "Select the month — November twenty-twenty-four. Click 'Generate.' The system pulls data from every department — outpatient visits, diagnoses coded by ICD-10, maternal health indicators, immunizations — and compiles the entire report automatically."

---

#### BEAT 3 — Review Report (0:20–0:35)

**On-screen actions:**
1. Scroll through the generated HMIS-105 report
2. Show key sections:
   - OPD attendance by age group and gender
   - Top 10 diagnoses
   - Maternal health indicators
   - Laboratory tests performed
3. Highlight that the numbers are pulled from actual system data — not manually entered

**Narration:**
> "Every number you see here was calculated from real patient data — not typed in by a clerk. OPD attendance broken down by age and gender. Top ten diagnoses. Lab tests performed. Maternal health. All accurate. All auditable."

---

#### BEAT 4 — Export PDF (0:35–0:42)

**On-screen actions:**
1. Click **"Export PDF"**
2. Show the PDF downloading
3. Briefly open the PDF to show it's formatted correctly

**Narration:**
> "Export as PDF — ready to submit to the District Health Office. What used to take your team three days now takes thirty seconds."

---

#### CLOSING (0:42–0:45)

**Narration:**
> "HMIS-105. One click. Every month. Never late."

---

### Key Talking Points

- **3 days → 30 seconds** — the most dramatic time saving in the system
- **Data integrity** — numbers come from actual clinical records, not manual counts
- **Audit trail** — every number can be traced back to specific patient encounters
- **PDF export** — ready for District Health Office submission
- **Monthly compliance** — set a calendar reminder and it's done in under a minute

---

## Post-Production Guide

### Recording Tools (Recommended)

| Tool | Best For | Cost | Notes |
|------|----------|------|-------|
| **Loom** | Quick screen recordings with webcam | Free (up to 25 videos) / $12.50/mo | Easiest to use. Built-in sharing. |
| **OBS Studio** | High-quality, professional recordings | Free (open source) | Most flexible. Steeper learning curve. |
| **Screencastify** | Browser-based recording | Free (5 min) / $49/yr | Chrome extension. No install needed. |
| **ScreenPal** | Screen + webcam with editing | Free / $3/mo | Good built-in editor. |

**Recommended:** Use **Loom** for quick internal demos, **OBS Studio** for the final polished versions.

### OBS Studio Settings

```
Video:
  Base Resolution: 1920x1080
  Output Resolution: 1920x1080
  FPS: 30

Audio:
  Sample Rate: 48kHz
  Channels: Mono (for narration)
  Mic: USB condenser mic preferred (e.g., Blue Yeti, Rode NT-USB)

Output:
  Format: MP4
  Encoder: x264
  Rate Control: CRF
  CRF: 18 (high quality)
  Preset: Medium
```

### Post-Production Checklist

#### Intro Slides (add to each video)
- **Slide 1 (3 seconds):** Glide HIMS logo + video title
- **Slide 2 (2 seconds):** "Amani Children's Clinic Demo" (or client name)
- **Outro slide (3 seconds):** Contact info / call to action

#### Captions
- Add **closed captions** (CC) to all videos
- Use YouTube's auto-caption feature, then manually correct medical terminology
- Alternatively, use [Descript](https://www.descript.com) or [Rev.com](https://www.rev.com) for professional captions
- Ensure ICD-10 codes, drug names, and UGX amounts are captioned correctly

#### Background Music
- Add **subtle, low-volume** background music (10–15% volume)
- Recommended: Royalty-free tracks from:
  - [YouTube Audio Library](https://studio.youtube.com/channel/audio) (free)
  - [Epidemic Sound](https://www.epidemicsound.com) (subscription)
  - [Artlist](https://artlist.io) (subscription)
- Genre: Corporate / Technology / Upbeat — avoid anything distracting
- Music should be **under the narration**, never competing with it

#### Visual Polish
- Add **mouse cursor highlighting** (yellow circle around cursor) — OBS or post-production
- Add **zoom-in effects** on important UI elements (use Camtasia or DaVinci Resolve)
- Add **text callouts** for key metrics (e.g., "UGX 2.4M Revenue Today" overlay)
- Use **consistent transition** between beats (0.5s fade or cut)

### Hosting & Sharing

| Platform | Best For | Link Type | Analytics |
|----------|----------|-----------|-----------|
| **YouTube (Unlisted)** | Client presentations, embedding | Shareable link (not searchable) | Views, watch time, retention |
| **Loom** | Quick internal sharing | Auto-generated link | Views, who watched, engagement |
| **Google Drive** | Formal client delivery | Shared folder link | Download count |
| **Vimeo** | Professional external sharing | Password-protected link | Detailed analytics |

**Recommended Distribution Strategy:**

1. **Sales demos:** YouTube Unlisted → embed in a pitch deck or proposal
2. **Client onboarding:** Loom → share directly via email/WhatsApp
3. **Formal delivery:** Google Drive → shared folder with all 11 videos
4. **Website/marketing:** Vimeo Pro → password-protected, branded player

### Video Naming Convention

```
GLIDE-HIMS_01_Complete-Patient-Journey_v1.mp4
GLIDE-HIMS_02_Patient-Registration_v1.mp4
GLIDE-HIMS_03_Doctor-Consultation_v1.mp4
GLIDE-HIMS_04_Laboratory-Workflow_v1.mp4
GLIDE-HIMS_05_Pharmacy-Stock-Management_v1.mp4
GLIDE-HIMS_06_Billing-Insurance_v1.mp4
GLIDE-HIMS_07_Executive-Dashboard_v1.mp4
GLIDE-HIMS_08_HR-Payroll_v1.mp4
GLIDE-HIMS_09_Ward-Management-IPD_v1.mp4
GLIDE-HIMS_10_Offline-Mode_v1.mp4
GLIDE-HIMS_11_HMIS-105-Report_v1.mp4
```

### Playlist Order

When uploading to YouTube or Loom, create a playlist in this order:

1. **The Complete Patient Journey** (3:00) — *"Start here"*
2. **Patient Registration** (1:30)
3. **Doctor Consultation Flow** (2:00)
4. **Laboratory Workflow** (1:30)
5. **Pharmacy & Stock Management** (2:00)
6. **Billing & Insurance** (2:00)
7. **Executive Dashboard & Analytics** (1:30)
8. **HR & Payroll** (1:00)
9. **Ward Management (IPD)** (1:00)
10. **Offline Mode** (1:00)
11. **HMIS-105 Report Generation** (0:45)

### Thumbnail Design

Create consistent thumbnails for each video:
- **Background:** Dark blue or Glide HIMS brand color
- **Text:** Video title in bold white (max 5 words)
- **Icon:** Department icon (stethoscope, flask, pill, chart, etc.)
- **Badge:** Video number (01, 02, 03...)
- **Tool:** Use [Canva](https://www.canva.com) with a template for consistency

---

## Quick Reference: Narration Tone Guide

| Do | Don't |
|----|-------|
| "Watch how fast this is" | "The system utilizes REST APIs to..." |
| "Every charge is captured automatically" | "The billing module integrates with..." |
| "No more lost lab results" | "Results are persisted in PostgreSQL..." |
| "Your receptionist can do this in 30 seconds" | "The UX has been optimized for..." |
| "This is how you stop revenue leakage" | "The financial reconciliation engine..." |
| "Built for the reality of African healthcare" | "Our offline-first PWA architecture..." |

**Voice tone:** Confident, warm, conversational. You're showing a colleague something you're proud of — not reading a manual.

**Pacing:** Slightly slower than natural conversation. Pause 1 second before and after every key metric or claim. Let the viewer absorb what they see.

**Energy:** Medium-high. Not salesy, not monotone. Think "experienced doctor explaining a procedure to a patient" — clear, calm, authoritative.

---

*Document created for Glide HIMS demo video production. All routes, module names, patient names, and insurance providers reference actual system configuration.*
