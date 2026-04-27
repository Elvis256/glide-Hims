--
-- PostgreSQL database dump
--

\restrict 14fnwvxvfnbj8gVfq4Xm6l9aupNuDGshWkXWDLamCdFTLNuA3eVTLx9Jys3gDgp

-- Dumped from database version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: admissions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admissions_status_enum AS ENUM (
    'admitted',
    'transferred',
    'discharged',
    'absconded',
    'deceased'
);


--
-- Name: admissions_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admissions_type_enum AS ENUM (
    'elective',
    'emergency',
    'transfer'
);


--
-- Name: antenatal_registrations_risk_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.antenatal_registrations_risk_level_enum AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: antenatal_registrations_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.antenatal_registrations_status_enum AS ENUM (
    'active',
    'delivered',
    'miscarriage',
    'stillbirth',
    'ectopic',
    'transferred'
);


--
-- Name: appointments_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointments_status_enum AS ENUM (
    'scheduled',
    'confirmed',
    'checked_in',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
);


--
-- Name: appointments_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointments_type_enum AS ENUM (
    'consultation',
    'follow_up',
    'procedure',
    'lab',
    'imaging',
    'vaccination',
    'screening',
    'other'
);


--
-- Name: baby_wellness_checks_cord_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.baby_wellness_checks_cord_status_enum AS ENUM (
    'clean_dry',
    'slightly_wet',
    'infected',
    'fallen_off'
);


--
-- Name: baby_wellness_checks_feeding_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.baby_wellness_checks_feeding_type_enum AS ENUM (
    'exclusive_breastfeeding',
    'mixed_feeding',
    'formula_only'
);


--
-- Name: baby_wellness_checks_jaundice_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.baby_wellness_checks_jaundice_level_enum AS ENUM (
    'none',
    'mild',
    'moderate',
    'severe'
);


--
-- Name: baby_wellness_checks_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.baby_wellness_checks_status_enum AS ENUM (
    'healthy',
    'needs_attention',
    'referred',
    'critical'
);


--
-- Name: bank_reconciliation_items_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bank_reconciliation_items_status_enum AS ENUM (
    'matched',
    'unmatched',
    'adjusted'
);


--
-- Name: bank_reconciliations_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bank_reconciliations_status_enum AS ENUM (
    'in_progress',
    'completed',
    'reviewed'
);


--
-- Name: bed_transfers_reason_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bed_transfers_reason_enum AS ENUM (
    'clinical',
    'patient_request',
    'bed_management',
    'isolation',
    'step_down',
    'step_up'
);


--
-- Name: beds_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.beds_status_enum AS ENUM (
    'available',
    'occupied',
    'reserved',
    'maintenance',
    'cleaning'
);


--
-- Name: beds_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.beds_type_enum AS ENUM (
    'standard',
    'icu',
    'pediatric',
    'maternity',
    'isolation'
);


--
-- Name: billing_points_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billing_points_type_enum AS ENUM (
    'central',
    'pharmacy',
    'lab',
    'radiology',
    'opd',
    'ipd',
    'emergency',
    'theatre'
);


--
-- Name: budgets_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.budgets_status_enum AS ENUM (
    'draft',
    'approved',
    'active',
    'closed'
);


--
-- Name: change_sets_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.change_sets_status_enum AS ENUM (
    'pending',
    'ready',
    'applying',
    'applied',
    'failed',
    'rolled_back'
);


--
-- Name: chart_of_accounts_account_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chart_of_accounts_account_category_enum AS ENUM (
    'cash',
    'bank',
    'receivables',
    'inventory',
    'fixed_assets',
    'payables',
    'accruals',
    'loans',
    'capital',
    'retained_earnings',
    'service_revenue',
    'other_income',
    'salaries',
    'supplies',
    'utilities',
    'depreciation',
    'other_expense'
);


--
-- Name: chart_of_accounts_account_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.chart_of_accounts_account_type_enum AS ENUM (
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense'
);


--
-- Name: claim_items_item_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.claim_items_item_type_enum AS ENUM (
    'consultation',
    'procedure',
    'laboratory',
    'radiology',
    'pharmacy',
    'supplies',
    'bed_charges',
    'nursing',
    'theatre',
    'icu',
    'other'
);


--
-- Name: claim_items_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.claim_items_status_enum AS ENUM (
    'pending',
    'approved',
    'partially_approved',
    'rejected'
);


--
-- Name: controlled_substance_logs_drug_schedule_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.controlled_substance_logs_drug_schedule_enum AS ENUM (
    'schedule_1',
    'schedule_2',
    'schedule_3',
    'schedule_4',
    'schedule_5',
    'otc',
    'pom',
    'unscheduled'
);


--
-- Name: cost_centers_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cost_centers_type_enum AS ENUM (
    'department',
    'project',
    'program'
);


--
-- Name: delivery_outcomes_baby_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_outcomes_baby_status_enum AS ENUM (
    'alive',
    'nicu',
    'deceased',
    'discharged'
);


--
-- Name: delivery_outcomes_outcome_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_outcomes_outcome_enum AS ENUM (
    'live_birth',
    'stillbirth',
    'neonatal_death'
);


--
-- Name: delivery_outcomes_sex_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_outcomes_sex_enum AS ENUM (
    'male',
    'female',
    'ambiguous'
);


--
-- Name: deployment_alerts_alerttype_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deployment_alerts_alerttype_enum AS ENUM (
    'high_error_rate',
    'high_cpu',
    'high_memory',
    'high_disk',
    'slow_response',
    'sync_delay',
    'connection_failure',
    'deployment_offline',
    'version_mismatch',
    'license_expired',
    'quota_exceeded',
    'data_integrity',
    'replication_failed',
    'unknown'
);


--
-- Name: deployment_alerts_severity_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deployment_alerts_severity_enum AS ENUM (
    'info',
    'warning',
    'critical',
    'resolved'
);


--
-- Name: deployment_alerts_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deployment_alerts_status_enum AS ENUM (
    'open',
    'acknowledged',
    'resolved',
    'escalated',
    'false_positive'
);


--
-- Name: deployment_health_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deployment_health_status_enum AS ENUM (
    'healthy',
    'warning',
    'critical',
    'offline',
    'degraded'
);


--
-- Name: deployment_versions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deployment_versions_status_enum AS ENUM (
    'pending',
    'active',
    'rolled_back',
    'failed'
);


--
-- Name: deployments_deployment_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deployments_deployment_type_enum AS ENUM (
    'cloud',
    'onpremise',
    'hybrid'
);


--
-- Name: deployments_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.deployments_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended',
    'maintenance'
);


--
-- Name: diagnoses_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.diagnoses_category_enum AS ENUM (
    'infectious',
    'neoplasms',
    'blood',
    'endocrine',
    'mental',
    'nervous',
    'eye',
    'ear',
    'circulatory',
    'respiratory',
    'digestive',
    'skin',
    'musculoskeletal',
    'genitourinary',
    'pregnancy',
    'perinatal',
    'congenital',
    'symptoms',
    'injury',
    'external',
    'other'
);


--
-- Name: diagnoses_icd_version_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.diagnoses_icd_version_enum AS ENUM (
    'ICD-10',
    'ICD-11'
);


--
-- Name: discharge_summaries_destination_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discharge_summaries_destination_enum AS ENUM (
    'home',
    'other_facility',
    'nursing_home',
    'hospice',
    'rehabilitation',
    'morgue'
);


--
-- Name: discharge_summaries_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discharge_summaries_type_enum AS ENUM (
    'regular',
    'against_medical_advice',
    'transferred',
    'deceased',
    'absconded',
    'referral'
);


--
-- Name: disciplinary_actions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.disciplinary_actions_status_enum AS ENUM (
    'active',
    'resolved',
    'escalated',
    'expired',
    'appealed'
);


--
-- Name: disciplinary_actions_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.disciplinary_actions_type_enum AS ENUM (
    'verbal_warning',
    'first_written',
    'second_written',
    'final_warning',
    'suspension',
    'termination'
);


--
-- Name: disposal_records_compliance_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.disposal_records_compliance_status_enum AS ENUM (
    'compliant',
    'pending_review',
    'non_compliant'
);


--
-- Name: disposal_records_disposal_method_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.disposal_records_disposal_method_enum AS ENUM (
    'incineration',
    'chemical',
    'landfill',
    'return_to_manufacturer'
);


--
-- Name: doctor_duties_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.doctor_duties_status_enum AS ENUM (
    'on_duty',
    'off_duty',
    'on_break',
    'in_consultation'
);


--
-- Name: donor_funds_restriction_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.donor_funds_restriction_enum AS ENUM (
    'unrestricted',
    'temporarily_restricted',
    'permanently_restricted'
);


--
-- Name: donor_funds_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.donor_funds_status_enum AS ENUM (
    'active',
    'exhausted',
    'expired',
    'closed'
);


--
-- Name: drug_classifications_formulation_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_classifications_formulation_enum AS ENUM (
    'tablet',
    'capsule',
    'syrup',
    'suspension',
    'injection',
    'infusion',
    'cream',
    'ointment',
    'gel',
    'drops',
    'inhaler',
    'suppository',
    'patch',
    'powder',
    'solution',
    'lotion',
    'spray',
    'other'
);


--
-- Name: drug_classifications_schedule_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_classifications_schedule_enum AS ENUM (
    'schedule_1',
    'schedule_2',
    'schedule_3',
    'schedule_4',
    'schedule_5',
    'otc',
    'pom',
    'unscheduled'
);


--
-- Name: drug_classifications_storage_condition_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_classifications_storage_condition_enum AS ENUM (
    'room_temperature',
    'refrigerated',
    'frozen',
    'controlled_room',
    'cool',
    'protect_from_light',
    'dry'
);


--
-- Name: drug_classifications_therapeutic_class_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_classifications_therapeutic_class_enum AS ENUM (
    'analgesics',
    'antibiotics',
    'antivirals',
    'antifungals',
    'antimalarials',
    'antiretrovirals',
    'antituberculosis',
    'antihypertensives',
    'antidiabetics',
    'anticoagulants',
    'cardiovascular',
    'cns_agents',
    'gastrointestinal',
    'respiratory',
    'dermatological',
    'hormones',
    'immunosuppressants',
    'vaccines',
    'vitamins',
    'minerals',
    'fluids_electrolytes',
    'anaesthetics',
    'antidotes',
    'oncology',
    'ophthalmology',
    'other'
);


--
-- Name: drug_label_templates_label_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_label_templates_label_type_enum AS ENUM (
    'prescription',
    'otc',
    'controlled',
    'external_use'
);


--
-- Name: drug_sync_logs_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_sync_logs_status_enum AS ENUM (
    'running',
    'completed',
    'failed'
);


--
-- Name: drug_sync_logs_sync_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.drug_sync_logs_sync_type_enum AS ENUM (
    'interactions',
    'labels',
    'full'
);


--
-- Name: emergency_cases_arrival_mode_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.emergency_cases_arrival_mode_enum AS ENUM (
    'walk_in',
    'ambulance',
    'police',
    'private_vehicle',
    'carried',
    'referred'
);


--
-- Name: emergency_cases_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.emergency_cases_status_enum AS ENUM (
    'pending',
    'triaged',
    'in_treatment',
    'transferred',
    'admitted',
    'discharged',
    'left_ama',
    'deceased'
);


--
-- Name: emergency_cases_triage_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.emergency_cases_triage_level_enum AS ENUM (
    '1',
    '2',
    '3',
    '4',
    '5'
);


--
-- Name: employees_employment_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employees_employment_type_enum AS ENUM (
    'permanent',
    'contract',
    'temporary',
    'intern',
    'consultant'
);


--
-- Name: employees_gender_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employees_gender_enum AS ENUM (
    'male',
    'female',
    'other'
);


--
-- Name: employees_marital_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employees_marital_status_enum AS ENUM (
    'single',
    'married',
    'divorced',
    'widowed'
);


--
-- Name: employees_staff_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employees_staff_category_enum AS ENUM (
    'doctor',
    'nurse',
    'consultant',
    'lab_technician',
    'pharmacist',
    'radiologist',
    'receptionist',
    'cashier',
    'administrator',
    'store_keeper',
    'accountant',
    'it_support',
    'other'
);


--
-- Name: employees_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employees_status_enum AS ENUM (
    'active',
    'on_leave',
    'suspended',
    'terminated',
    'resigned',
    'retired'
);


--
-- Name: encounters_payer_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.encounters_payer_type_enum AS ENUM (
    'cash',
    'insurance',
    'corporate'
);


--
-- Name: encounters_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.encounters_status_enum AS ENUM (
    'registered',
    'triage',
    'waiting',
    'in_consultation',
    'pending_lab',
    'pending_pharmacy',
    'pending_payment',
    'return_to_doctor',
    'return_to_pharmacy',
    'return_to_lab',
    'admitted',
    'discharged',
    'completed',
    'cancelled'
);


--
-- Name: encounters_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.encounters_type_enum AS ENUM (
    'opd',
    'ipd',
    'emergency',
    'anc',
    'pnc',
    'art',
    'tb',
    'dental',
    'optical',
    'mental_health',
    'vaccination',
    'well_child',
    'family_planning',
    'surgical',
    'dialysis',
    'oncology',
    'physiotherapy'
);


--
-- Name: expiry_alert_configs_severity_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expiry_alert_configs_severity_enum AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: expiry_alert_history_channel_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expiry_alert_history_channel_enum AS ENUM (
    'email',
    'sms',
    'in_app',
    'push'
);


--
-- Name: expiry_alert_history_severity_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expiry_alert_history_severity_enum AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


--
-- Name: expiry_alerts_alert_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expiry_alerts_alert_level_enum AS ENUM (
    'info',
    'warning',
    'urgent'
);


--
-- Name: expiry_alerts_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expiry_alerts_status_enum AS ENUM (
    'active',
    'near_expiry',
    'quarantined',
    'disposed',
    'returned'
);


--
-- Name: fiscal_periods_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fiscal_periods_status_enum AS ENUM (
    'open',
    'closed',
    'locked'
);


--
-- Name: fixed_assets_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fixed_assets_category_enum AS ENUM (
    'medical_equipment',
    'laboratory_equipment',
    'imaging_equipment',
    'surgical_equipment',
    'furniture',
    'it_equipment',
    'vehicles',
    'buildings',
    'land',
    'office_equipment',
    'electrical_equipment',
    'hvac',
    'other'
);


--
-- Name: fixed_assets_condition_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fixed_assets_condition_enum AS ENUM (
    'excellent',
    'good',
    'fair',
    'poor',
    'non_functional'
);


--
-- Name: fixed_assets_depreciation_method_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fixed_assets_depreciation_method_enum AS ENUM (
    'straight_line',
    'declining_balance',
    'double_declining',
    'sum_of_years',
    'units_of_production'
);


--
-- Name: fixed_assets_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.fixed_assets_status_enum AS ENUM (
    'active',
    'under_maintenance',
    'disposed',
    'written_off',
    'transferred',
    'stolen',
    'damaged'
);


--
-- Name: follow_ups_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.follow_ups_priority_enum AS ENUM (
    'high',
    'medium',
    'low'
);


--
-- Name: follow_ups_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.follow_ups_status_enum AS ENUM (
    'scheduled',
    'confirmed',
    'checked_in',
    'completed',
    'missed',
    'cancelled',
    'rescheduled'
);


--
-- Name: follow_ups_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.follow_ups_type_enum AS ENUM (
    'routine',
    'post_procedure',
    'lab_review',
    'imaging_review',
    'medication_review',
    'chronic_care',
    'wound_care',
    'post_discharge',
    'vaccination',
    'anc',
    'pnc',
    'immunization',
    'other'
);


--
-- Name: goods_receipt_notes_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.goods_receipt_notes_status_enum AS ENUM (
    'draft',
    'pending_inspection',
    'inspected',
    'approved',
    'posted',
    'cancelled'
);


--
-- Name: imaging_modalities_modality_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.imaging_modalities_modality_type_enum AS ENUM (
    'xray',
    'ct',
    'mri',
    'ultrasound',
    'mammography',
    'fluoroscopy',
    'dexa',
    'echocardiogram'
);


--
-- Name: imaging_orders_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.imaging_orders_priority_enum AS ENUM (
    'routine',
    'urgent',
    'stat'
);


--
-- Name: imaging_orders_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.imaging_orders_status_enum AS ENUM (
    'ordered',
    'scheduled',
    'in_progress',
    'completed',
    'reported',
    'cancelled'
);


--
-- Name: imaging_results_finding_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.imaging_results_finding_category_enum AS ENUM (
    'normal',
    'abnormal',
    'critical',
    'indeterminate'
);


--
-- Name: immunization_schedules_reaction_severity_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.immunization_schedules_reaction_severity_enum AS ENUM (
    'none',
    'mild',
    'moderate',
    'severe'
);


--
-- Name: immunization_schedules_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.immunization_schedules_status_enum AS ENUM (
    'scheduled',
    'due',
    'overdue',
    'administered',
    'missed',
    'contraindicated'
);


--
-- Name: immunization_schedules_vaccine_name_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.immunization_schedules_vaccine_name_enum AS ENUM (
    'BCG',
    'OPV-0',
    'OPV-1',
    'OPV-2',
    'OPV-3',
    'DPT-HepB-Hib-1',
    'DPT-HepB-Hib-2',
    'DPT-HepB-Hib-3',
    'PCV-1',
    'PCV-2',
    'PCV-3',
    'Rota-1',
    'Rota-2',
    'IPV',
    'Measles-1',
    'Measles-2',
    'Vitamin-A-1',
    'Vitamin-A-2',
    'Vitamin-A-3',
    'Vitamin-A-4',
    'TT-1',
    'TT-2',
    'TT-3',
    'TT-4',
    'TT-5',
    'HPV-1',
    'HPV-2',
    'COVID-1',
    'COVID-2',
    'COVID-Booster'
);


--
-- Name: in_app_notifications_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.in_app_notifications_type_enum AS ENUM (
    'PATIENT_QUEUED',
    'PATIENT_TRANSFERRED',
    'PATIENT_CALLED',
    'LAB_ORDER_CREATED',
    'LAB_SAMPLE_COLLECTED',
    'LAB_RESULT_READY',
    'RADIOLOGY_ORDER_CREATED',
    'RADIOLOGY_RESULT_READY',
    'PRESCRIPTION_CREATED',
    'PRESCRIPTION_DISPENSED',
    'INVOICE_CREATED',
    'ENCOUNTER_STATUS_CHANGED',
    'SUPPORT_ACCESS_REQUESTED',
    'SUPPORT_ACCESS_APPROVED',
    'SUPPORT_ACCESS_DENIED',
    'GENERAL'
);


--
-- Name: insurance_claims_claim_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_claims_claim_type_enum AS ENUM (
    'outpatient',
    'inpatient',
    'maternity',
    'emergency',
    'surgical',
    'diagnostic'
);


--
-- Name: insurance_claims_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_claims_status_enum AS ENUM (
    'draft',
    'submitted',
    'acknowledged',
    'in_review',
    'approved',
    'partially_approved',
    'rejected',
    'paid',
    'appealed',
    'cancelled'
);


--
-- Name: insurance_policies_coverage_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_policies_coverage_type_enum AS ENUM (
    'inpatient',
    'outpatient',
    'both',
    'maternity',
    'dental',
    'optical',
    'comprehensive'
);


--
-- Name: insurance_policies_member_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_policies_member_type_enum AS ENUM (
    'principal',
    'spouse',
    'child',
    'dependent'
);


--
-- Name: insurance_policies_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_policies_status_enum AS ENUM (
    'active',
    'expired',
    'suspended',
    'cancelled',
    'pending'
);


--
-- Name: insurance_providers_claim_submission_method_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_providers_claim_submission_method_enum AS ENUM (
    'electronic',
    'manual',
    'portal'
);


--
-- Name: insurance_providers_provider_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.insurance_providers_provider_type_enum AS ENUM (
    'nhis',
    'private',
    'corporate',
    'government'
);


--
-- Name: interfacility_transactions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interfacility_transactions_status_enum AS ENUM (
    'pending',
    'confirmed',
    'settled',
    'cancelled'
);


--
-- Name: invoice_items_charge_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_items_charge_type_enum AS ENUM (
    'consultation',
    'procedure',
    'lab',
    'radiology',
    'pharmacy',
    'bed',
    'nursing',
    'other'
);


--
-- Name: invoice_matches_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_matches_status_enum AS ENUM (
    'pending',
    'matched',
    'mismatch',
    'flagged',
    'approved',
    'paid'
);


--
-- Name: invoices_payment_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoices_payment_type_enum AS ENUM (
    'cash',
    'insurance',
    'corporate',
    'membership'
);


--
-- Name: invoices_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoices_status_enum AS ENUM (
    'draft',
    'pending',
    'partially_paid',
    'paid',
    'cancelled',
    'refunded'
);


--
-- Name: job_applications_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_applications_status_enum AS ENUM (
    'submitted',
    'screening',
    'shortlisted',
    'interview',
    'offered',
    'hired',
    'rejected',
    'withdrawn'
);


--
-- Name: job_postings_employment_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_postings_employment_type_enum AS ENUM (
    'full-time',
    'part-time',
    'contract',
    'intern'
);


--
-- Name: job_postings_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_postings_status_enum AS ENUM (
    'draft',
    'open',
    'closed',
    'on_hold',
    'filled'
);


--
-- Name: journal_entries_journal_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_entries_journal_type_enum AS ENUM (
    'general',
    'revenue',
    'payment',
    'adjustment',
    'closing'
);


--
-- Name: journal_entries_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.journal_entries_status_enum AS ENUM (
    'draft',
    'posted',
    'reversed'
);


--
-- Name: lab_equipment_calibration_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_equipment_calibration_status_enum AS ENUM (
    'current',
    'due_soon',
    'overdue',
    'not_required'
);


--
-- Name: lab_equipment_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_equipment_category_enum AS ENUM (
    'analyzer',
    'centrifuge',
    'microscope',
    'incubator',
    'refrigerator',
    'freezer',
    'autoclave',
    'water_bath',
    'pipette',
    'balance',
    'ph_meter',
    'spectrophotometer',
    'electrophoresis',
    'pcr_machine',
    'blood_gas_analyzer',
    'hematology_analyzer',
    'chemistry_analyzer',
    'coagulation_analyzer',
    'immunoassay_analyzer',
    'urinalysis_analyzer',
    'blood_bank_equipment',
    'safety_cabinet',
    'other'
);


--
-- Name: lab_equipment_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_equipment_status_enum AS ENUM (
    'operational',
    'under_maintenance',
    'out_of_service',
    'calibration_due',
    'decommissioned'
);


--
-- Name: lab_reagents_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_reagents_category_enum AS ENUM (
    'chemistry',
    'hematology',
    'microbiology',
    'serology',
    'urinalysis',
    'coagulation',
    'immunology',
    'molecular',
    'blood_bank',
    'histopathology',
    'cytology',
    'other'
);


--
-- Name: lab_reagents_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_reagents_status_enum AS ENUM (
    'active',
    'low_stock',
    'out_of_stock',
    'expired',
    'discontinued'
);


--
-- Name: lab_results_abnormalflag_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_results_abnormalflag_enum AS ENUM (
    'normal',
    'low',
    'high',
    'critical_low',
    'critical_high',
    'abnormal'
);


--
-- Name: lab_results_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_results_status_enum AS ENUM (
    'pending',
    'entered',
    'validated',
    'released',
    'amended'
);


--
-- Name: lab_samples_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_samples_priority_enum AS ENUM (
    'routine',
    'urgent',
    'stat'
);


--
-- Name: lab_samples_sampletype_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_samples_sampletype_enum AS ENUM (
    'blood',
    'serum',
    'plasma',
    'urine',
    'stool',
    'sputum',
    'csf',
    'swab',
    'tissue',
    'other'
);


--
-- Name: lab_samples_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_samples_status_enum AS ENUM (
    'pending_collection',
    'collected',
    'received',
    'processing',
    'completed',
    'rejected'
);


--
-- Name: lab_tests_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_tests_category_enum AS ENUM (
    'hematology',
    'chemistry',
    'microbiology',
    'serology',
    'urinalysis',
    'parasitology',
    'immunology',
    'molecular',
    'blood_bank',
    'other'
);


--
-- Name: lab_tests_sampletype_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_tests_sampletype_enum AS ENUM (
    'blood',
    'serum',
    'plasma',
    'urine',
    'stool',
    'sputum',
    'csf',
    'swab',
    'tissue',
    'other'
);


--
-- Name: lab_tests_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lab_tests_status_enum AS ENUM (
    'active',
    'inactive'
);


--
-- Name: labour_records_delivery_mode_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.labour_records_delivery_mode_enum AS ENUM (
    'svd',
    'assisted',
    'caesarean',
    'breech'
);


--
-- Name: labour_records_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.labour_records_status_enum AS ENUM (
    'admitted',
    'first_stage',
    'second_stage',
    'third_stage',
    'delivered',
    'postpartum',
    'discharged'
);


--
-- Name: leave_requests_leave_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_requests_leave_type_enum AS ENUM (
    'annual',
    'sick',
    'maternity',
    'paternity',
    'compassionate',
    'study',
    'unpaid'
);


--
-- Name: leave_requests_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_requests_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: master_data_approval_rules_entity_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.master_data_approval_rules_entity_type_enum AS ENUM (
    'service',
    'service_category',
    'item',
    'lab_test',
    'imaging_modality',
    'diagnosis',
    'supplier',
    'insurance_provider',
    'chart_of_account',
    'membership_scheme',
    'role',
    'department',
    'unit',
    'provider'
);


--
-- Name: master_data_versions_action_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.master_data_versions_action_enum AS ENUM (
    'create',
    'update',
    'delete',
    'restore',
    'approve',
    'reject'
);


--
-- Name: master_data_versions_approval_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.master_data_versions_approval_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'auto_approved'
);


--
-- Name: master_data_versions_entity_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.master_data_versions_entity_type_enum AS ENUM (
    'service',
    'service_category',
    'item',
    'lab_test',
    'imaging_modality',
    'diagnosis',
    'supplier',
    'insurance_provider',
    'chart_of_account',
    'membership_scheme',
    'role',
    'department',
    'unit',
    'provider'
);


--
-- Name: medication_adherence_records_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.medication_adherence_records_status_enum AS ENUM (
    'pending',
    'taken',
    'skipped',
    'missed'
);


--
-- Name: membership_schemes_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.membership_schemes_type_enum AS ENUM (
    'regular',
    'vip',
    'staff',
    'corporate',
    'insurance',
    'charity'
);


--
-- Name: notification_configs_provider_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_configs_provider_enum AS ENUM (
    'smtp',
    'africas_talking',
    'twilio',
    'whatsapp_business',
    'whatsapp_cloud',
    'custom'
);


--
-- Name: notification_configs_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_configs_type_enum AS ENUM (
    'email',
    'sms',
    'whatsapp',
    'both',
    'template'
);


--
-- Name: nursing_notes_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.nursing_notes_type_enum AS ENUM (
    'assessment',
    'intervention',
    'observation',
    'progress',
    'handoff',
    'incident'
);


--
-- Name: onboarding_tasks_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_tasks_category_enum AS ENUM (
    'documentation',
    'it_setup',
    'orientation',
    'training',
    'compliance',
    'equipment',
    'access',
    'other'
);


--
-- Name: onboarding_tasks_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.onboarding_tasks_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'skipped',
    'overdue'
);


--
-- Name: orders_order_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orders_order_type_enum AS ENUM (
    'lab',
    'radiology',
    'pharmacy',
    'procedure'
);


--
-- Name: orders_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orders_priority_enum AS ENUM (
    'routine',
    'urgent',
    'stat'
);


--
-- Name: orders_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orders_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: patient_chronic_conditions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_chronic_conditions_status_enum AS ENUM (
    'active',
    'controlled',
    'uncontrolled',
    'in_remission',
    'resolved'
);


--
-- Name: patient_credit_notes_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_credit_notes_status_enum AS ENUM (
    'draft',
    'approved',
    'applied',
    'cancelled'
);


--
-- Name: patient_credit_notes_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_credit_notes_type_enum AS ENUM (
    'credit',
    'debit'
);


--
-- Name: patient_deposits_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_deposits_status_enum AS ENUM (
    'active',
    'partially_applied',
    'fully_applied',
    'refunded'
);


--
-- Name: patient_problems_severity_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_problems_severity_enum AS ENUM (
    'mild',
    'moderate',
    'severe',
    'critical'
);


--
-- Name: patient_problems_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_problems_status_enum AS ENUM (
    'active',
    'chronic',
    'resolved',
    'inactive'
);


--
-- Name: patient_reminders_channel_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_reminders_channel_enum AS ENUM (
    'email',
    'sms',
    'whatsapp',
    'both',
    'all'
);


--
-- Name: patient_reminders_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_reminders_status_enum AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'failed',
    'cancelled'
);


--
-- Name: patient_reminders_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.patient_reminders_type_enum AS ENUM (
    'appointment',
    'follow_up',
    'medication',
    'lab_test',
    'lab_result',
    'prescription_ready',
    'chronic_checkup',
    'thank_you',
    'payment_reminder',
    'discharge',
    'birthday',
    'custom'
);


--
-- Name: payments_method_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payments_method_enum AS ENUM (
    'cash',
    'card',
    'mobile_money',
    'bank_transfer',
    'insurance',
    'cheque'
);


--
-- Name: payments_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payments_status_enum AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded',
    'voided'
);


--
-- Name: payroll_runs_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payroll_runs_status_enum AS ENUM (
    'draft',
    'processing',
    'completed',
    'paid',
    'cancelled'
);


--
-- Name: performance_appraisals_appraisal_period_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.performance_appraisals_appraisal_period_enum AS ENUM (
    'Q1',
    'Q2',
    'Q3',
    'Q4',
    'annual',
    'probation'
);


--
-- Name: performance_appraisals_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.performance_appraisals_status_enum AS ENUM (
    'draft',
    'self_review',
    'manager_review',
    'completed',
    'acknowledged'
);


--
-- Name: petty_cash_transactions_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.petty_cash_transactions_type_enum AS ENUM (
    'expense',
    'topup',
    'refund'
);


--
-- Name: pharmacy_sales_sale_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pharmacy_sales_sale_type_enum AS ENUM (
    'prescription',
    'otc',
    'internal',
    'wholesale',
    'inpatient'
);


--
-- Name: pharmacy_sales_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pharmacy_sales_status_enum AS ENUM (
    'pending',
    'completed',
    'cancelled',
    'refunded'
);


--
-- Name: postnatal_visits_breast_condition_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.postnatal_visits_breast_condition_enum AS ENUM (
    'normal',
    'engorged',
    'cracked_nipples',
    'mastitis',
    'abscess'
);


--
-- Name: postnatal_visits_lochia_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.postnatal_visits_lochia_type_enum AS ENUM (
    'rubra',
    'serosa',
    'alba'
);


--
-- Name: postnatal_visits_mental_health_risk_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.postnatal_visits_mental_health_risk_enum AS ENUM (
    'none',
    'low',
    'moderate',
    'high'
);


--
-- Name: postnatal_visits_visit_number_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.postnatal_visits_visit_number_enum AS ENUM (
    '1',
    '2',
    '3',
    '4'
);


--
-- Name: pre_authorizations_auth_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pre_authorizations_auth_type_enum AS ENUM (
    'admission',
    'surgery',
    'procedure',
    'investigation',
    'maternity',
    'extension'
);


--
-- Name: pre_authorizations_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pre_authorizations_status_enum AS ENUM (
    'pending',
    'submitted',
    'approved',
    'partially_approved',
    'denied',
    'expired',
    'cancelled'
);


--
-- Name: prescriptions_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.prescriptions_status_enum AS ENUM (
    'pending',
    'dispensing',
    'ready',
    'collected',
    'partially_dispensed',
    'dispensed',
    'cancelled'
);


--
-- Name: price_agreements_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.price_agreements_status_enum AS ENUM (
    'draft',
    'pending',
    'active',
    'expired',
    'terminated'
);


--
-- Name: pricing_rules_applies_to_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pricing_rules_applies_to_enum AS ENUM (
    'all',
    'services',
    'lab',
    'pharmacy',
    'radiology'
);


--
-- Name: pricing_rules_discount_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pricing_rules_discount_type_enum AS ENUM (
    'percentage',
    'fixed_amount',
    'price_list',
    'formula'
);


--
-- Name: pricing_rules_rule_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pricing_rules_rule_type_enum AS ENUM (
    'insurance',
    'membership',
    'loyalty',
    'corporate',
    'promotion',
    'volume'
);


--
-- Name: providers_provider_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.providers_provider_type_enum AS ENUM (
    'physician',
    'surgeon',
    'nurse',
    'midwife',
    'pharmacist',
    'lab_technician',
    'radiologist',
    'physiotherapist',
    'dentist',
    'clinical_officer',
    'specialist',
    'consultant',
    'intern',
    'other'
);


--
-- Name: providers_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.providers_status_enum AS ENUM (
    'active',
    'inactive',
    'on_leave',
    'suspended',
    'terminated'
);


--
-- Name: purchase_orders_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_orders_status_enum AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'partially_received',
    'fully_received',
    'cancelled',
    'closed'
);


--
-- Name: purchase_requests_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_requests_priority_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


--
-- Name: purchase_requests_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_requests_status_enum AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'partially_ordered',
    'fully_ordered',
    'cancelled'
);


--
-- Name: qc_materials_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qc_materials_level_enum AS ENUM (
    'level_1',
    'level_2',
    'level_3'
);


--
-- Name: qc_results_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qc_results_status_enum AS ENUM (
    'in_control',
    'out_of_control',
    'warning',
    'not_evaluated'
);


--
-- Name: queues_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queues_priority_enum AS ENUM (
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '10'
);


--
-- Name: queues_servicepoint_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queues_servicepoint_enum AS ENUM (
    'registration',
    'triage',
    'consultation',
    'laboratory',
    'radiology',
    'pharmacy',
    'billing',
    'cashier',
    'injection',
    'dressing',
    'vitals',
    'records',
    'ipd',
    'emergency',
    'theatre',
    'physiotherapy',
    'dental',
    'optical',
    'nutrition',
    'counselling'
);


--
-- Name: queues_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.queues_status_enum AS ENUM (
    'pending_payment',
    'waiting',
    'called',
    'in_service',
    'completed',
    'skipped',
    'no_show',
    'transferred',
    'cancelled'
);


--
-- Name: quotation_approvals_level_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quotation_approvals_level_enum AS ENUM (
    'approval_1',
    'approval_2',
    'approval_3'
);


--
-- Name: quotation_approvals_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quotation_approvals_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: referrals_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.referrals_priority_enum AS ENUM (
    'emergency',
    'urgent',
    'routine'
);


--
-- Name: referrals_reason_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.referrals_reason_enum AS ENUM (
    'specialist_consultation',
    'diagnostic_services',
    'surgical_intervention',
    'higher_level_care',
    'inpatient_admission',
    'maternity_care',
    'mental_health',
    'rehabilitation',
    'palliative_care',
    'other'
);


--
-- Name: referrals_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.referrals_status_enum AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'completed',
    'cancelled',
    'expired'
);


--
-- Name: referrals_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.referrals_type_enum AS ENUM (
    'internal',
    'external',
    'self',
    'community'
);


--
-- Name: release_candidates_stage_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.release_candidates_stage_enum AS ENUM (
    'alpha',
    'beta',
    'rc',
    'stable',
    'hotfix'
);


--
-- Name: replication_logs_entitytype_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.replication_logs_entitytype_enum AS ENUM (
    'drug',
    'patient',
    'appointment',
    'billing',
    'inventory',
    'staff',
    'facility',
    'config',
    'user',
    'permission',
    'module',
    'other'
);


--
-- Name: replication_logs_operationtype_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.replication_logs_operationtype_enum AS ENUM (
    'create',
    'update',
    'delete',
    'bulk_update'
);


--
-- Name: replication_logs_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.replication_logs_status_enum AS ENUM (
    'pending',
    'sent',
    'acknowledged',
    'failed',
    'retrying'
);


--
-- Name: rfqs_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rfqs_status_enum AS ENUM (
    'draft',
    'sent',
    'pending_responses',
    'responses_received',
    'closed',
    'cancelled'
);


--
-- Name: salary_history_change_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.salary_history_change_type_enum AS ENUM (
    'initial',
    'increment',
    'promotion',
    'adjustment',
    'demotion'
);


--
-- Name: sample_referrals_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sample_referrals_priority_enum AS ENUM (
    'STAT',
    'URGENT',
    'ROUTINE'
);


--
-- Name: sample_referrals_stage_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sample_referrals_stage_enum AS ENUM (
    'collected',
    'packaged',
    'in_transit',
    'received_at_hub',
    'processing',
    'result_ready',
    'result_delivered',
    'rejected'
);


--
-- Name: service_prices_tier_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_prices_tier_enum AS ENUM (
    'basic',
    'standard',
    'premium',
    'vip'
);


--
-- Name: services_tier_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.services_tier_enum AS ENUM (
    'basic',
    'standard',
    'premium',
    'vip'
);


--
-- Name: shift_definitions_shift_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_definitions_shift_type_enum AS ENUM (
    'morning',
    'afternoon',
    'night',
    'on_call',
    'custom'
);


--
-- Name: shift_swap_requests_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.shift_swap_requests_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: sms_templates_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sms_templates_type_enum AS ENUM (
    'appointment',
    'follow_up',
    'medication',
    'lab_test',
    'lab_result',
    'prescription_ready',
    'chronic_checkup',
    'thank_you',
    'payment_reminder',
    'discharge',
    'birthday',
    'custom'
);


--
-- Name: staff_rosters_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.staff_rosters_status_enum AS ENUM (
    'scheduled',
    'confirmed',
    'in_progress',
    'completed',
    'absent',
    'swap_pending',
    'cancelled'
);


--
-- Name: stock_ledger_movement_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stock_ledger_movement_type_enum AS ENUM (
    'purchase',
    'sale',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'return',
    'expired',
    'damaged'
);


--
-- Name: stock_transfers_reason_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stock_transfers_reason_enum AS ENUM (
    'near_expiry',
    'surplus',
    'stockout_relief',
    'redistribution',
    'restock',
    'emergency',
    'expiry_prevention',
    'facility_request',
    'other'
);


--
-- Name: stock_transfers_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stock_transfers_status_enum AS ENUM (
    'requested',
    'approved',
    'in_transit',
    'received',
    'cancelled',
    'rejected'
);


--
-- Name: stores_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.stores_type_enum AS ENUM (
    'main',
    'pharmacy',
    'ward',
    'theatre',
    'lab',
    'radiology',
    'emergency',
    'department'
);


--
-- Name: supplier_credit_notes_note_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_credit_notes_note_type_enum AS ENUM (
    'credit_note',
    'debit_note'
);


--
-- Name: supplier_credit_notes_reason_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_credit_notes_reason_enum AS ENUM (
    'goods_returned',
    'damaged_goods',
    'pricing_error',
    'quantity_discrepancy',
    'quality_issue',
    'expired_goods',
    'overcharge',
    'undercharge',
    'other'
);


--
-- Name: supplier_credit_notes_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_credit_notes_status_enum AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'applied',
    'cancelled'
);


--
-- Name: supplier_payments_payment_method_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_payments_payment_method_enum AS ENUM (
    'cash',
    'bank_transfer',
    'cheque',
    'mobile_money',
    'credit_card'
);


--
-- Name: supplier_payments_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_payments_status_enum AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'paid',
    'cancelled'
);


--
-- Name: supplier_returns_reason_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_returns_reason_enum AS ENUM (
    'expired',
    'near_expiry',
    'damaged',
    'recalled',
    'overstock',
    'quality_issue'
);


--
-- Name: supplier_returns_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.supplier_returns_status_enum AS ENUM (
    'pending',
    'authorized',
    'shipped',
    'received_by_supplier',
    'credit_issued',
    'completed',
    'rejected'
);


--
-- Name: suppliers_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suppliers_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended'
);


--
-- Name: suppliers_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.suppliers_type_enum AS ENUM (
    'pharmaceutical',
    'medical_equipment',
    'consumables',
    'general'
);


--
-- Name: support_access_requests_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.support_access_requests_status_enum AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: surgery_cases_anesthesia_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.surgery_cases_anesthesia_type_enum AS ENUM (
    'general',
    'spinal',
    'epidural',
    'local',
    'regional',
    'sedation'
);


--
-- Name: surgery_cases_priority_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.surgery_cases_priority_enum AS ENUM (
    'elective',
    'urgent',
    'emergency'
);


--
-- Name: surgery_cases_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.surgery_cases_status_enum AS ENUM (
    'scheduled',
    'pre_op',
    'in_progress',
    'post_op',
    'completed',
    'cancelled',
    'postponed'
);


--
-- Name: surgery_cases_surgery_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.surgery_cases_surgery_type_enum AS ENUM (
    'major',
    'minor',
    'day_case'
);


--
-- Name: surgery_consumables_category_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.surgery_consumables_category_enum AS ENUM (
    'surgical_supplies',
    'anesthesia',
    'sutures',
    'medications',
    'implants',
    'instruments_disposable',
    'dressings',
    'fluids',
    'blood_products',
    'other'
);


--
-- Name: sync_conflicts_conflict_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_conflicts_conflict_type_enum AS ENUM (
    'version_mismatch',
    'concurrent_edit',
    'delete_edit',
    'edit_delete',
    'unique_constraint'
);


--
-- Name: sync_conflicts_entity_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_conflicts_entity_type_enum AS ENUM (
    'patient',
    'encounter',
    'vital_sign',
    'clinical_note',
    'prescription',
    'lab_order',
    'lab_result',
    'imaging_order',
    'admission',
    'invoice',
    'payment',
    'antenatal_visit',
    'postnatal_visit',
    'immunization'
);


--
-- Name: sync_conflicts_resolution_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_conflicts_resolution_enum AS ENUM (
    'pending',
    'client_wins',
    'server_wins',
    'merged',
    'manual'
);


--
-- Name: sync_queue_entity_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_queue_entity_type_enum AS ENUM (
    'patient',
    'encounter',
    'vital_sign',
    'clinical_note',
    'prescription',
    'lab_order',
    'lab_result',
    'imaging_order',
    'admission',
    'invoice',
    'payment',
    'antenatal_visit',
    'postnatal_visit',
    'immunization'
);


--
-- Name: sync_queue_operation_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_queue_operation_enum AS ENUM (
    'create',
    'update',
    'delete'
);


--
-- Name: sync_queue_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_queue_status_enum AS ENUM (
    'pending',
    'processing',
    'synced',
    'conflict',
    'failed'
);


--
-- Name: tax_rates_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tax_rates_type_enum AS ENUM (
    'vat',
    'service_tax',
    'excise',
    'custom'
);


--
-- Name: temperature_logs_alert_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.temperature_logs_alert_type_enum AS ENUM (
    'normal',
    'warning',
    'critical'
);


--
-- Name: temperature_sensors_storage_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.temperature_sensors_storage_type_enum AS ENUM (
    'refrigerated',
    'frozen',
    'room_temperature'
);


--
-- Name: theatres_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.theatres_status_enum AS ENUM (
    'available',
    'in_use',
    'cleaning',
    'maintenance',
    'out_of_service'
);


--
-- Name: theatres_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.theatres_type_enum AS ENUM (
    'general',
    'orthopedic',
    'cardiac',
    'neuro',
    'obstetric',
    'ophthalmic',
    'ent',
    'minor'
);


--
-- Name: training_enrollments_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_enrollments_status_enum AS ENUM (
    'enrolled',
    'attending',
    'completed',
    'failed',
    'cancelled',
    'no_show'
);


--
-- Name: training_programs_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_programs_status_enum AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'cancelled'
);


--
-- Name: training_programs_training_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_programs_training_type_enum AS ENUM (
    'orientation',
    'skills',
    'compliance',
    'leadership',
    'technical',
    'safety',
    'certification'
);


--
-- Name: treatment_plans_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.treatment_plans_status_enum AS ENUM (
    'draft',
    'active',
    'on_hold',
    'completed',
    'discontinued',
    'revised'
);


--
-- Name: treatment_plans_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.treatment_plans_type_enum AS ENUM (
    'acute',
    'chronic',
    'preventive',
    'palliative',
    'rehabilitation',
    'surgical',
    'mental_health'
);


--
-- Name: update_notifications_notificationtype_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.update_notifications_notificationtype_enum AS ENUM (
    'update_available',
    'update_started',
    'update_completed',
    'update_failed',
    'rollback_initiated',
    'rollback_completed',
    'feature_flag_changed',
    'maintenance_scheduled',
    'system_alert'
);


--
-- Name: update_notifications_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.update_notifications_status_enum AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'retrying',
    'acknowledged'
);


--
-- Name: update_rollouts_currentphase_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.update_rollouts_currentphase_enum AS ENUM (
    'phase_1',
    'phase_2',
    'phase_3'
);


--
-- Name: update_rollouts_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.update_rollouts_status_enum AS ENUM (
    'scheduled',
    'in_progress',
    'paused',
    'completed',
    'rolled_back',
    'failed'
);


--
-- Name: vendor_contracts_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vendor_contracts_status_enum AS ENUM (
    'draft',
    'active',
    'expiring_soon',
    'expired',
    'renewed',
    'terminated'
);


--
-- Name: vendor_quotations_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vendor_quotations_status_enum AS ENUM (
    'received',
    'under_review',
    'selected',
    'rejected'
);


--
-- Name: vendor_rating_summaries_trend_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vendor_rating_summaries_trend_enum AS ENUM (
    'up',
    'down',
    'stable'
);


--
-- Name: waivers_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.waivers_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'applied'
);


--
-- Name: wards_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wards_status_enum AS ENUM (
    'active',
    'inactive',
    'maintenance'
);


--
-- Name: wards_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wards_type_enum AS ENUM (
    'general',
    'private',
    'icu',
    'pediatric',
    'maternity',
    'surgical',
    'emergency'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    "admissionNumber" character varying NOT NULL,
    type public.admissions_type_enum DEFAULT 'emergency'::public.admissions_type_enum NOT NULL,
    status public.admissions_status_enum DEFAULT 'admitted'::public.admissions_status_enum NOT NULL,
    "admissionDate" timestamp without time zone NOT NULL,
    "dischargeDate" timestamp without time zone,
    "admissionReason" text,
    "admissionDiagnosis" text,
    "dischargeSummary" text,
    "dischargeDiagnosis" text,
    "dischargeInstructions" text,
    "followUpPlan" text,
    metadata jsonb,
    "patientId" uuid NOT NULL,
    "encounterId" uuid NOT NULL,
    "wardId" uuid NOT NULL,
    "bedId" uuid NOT NULL,
    "admittedById" uuid NOT NULL,
    "dischargedById" uuid,
    "attendingDoctorId" uuid
);


--
-- Name: antenatal_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.antenatal_registrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    anc_number character varying(20) NOT NULL,
    patient_id uuid NOT NULL,
    gravida integer DEFAULT 1 NOT NULL,
    para integer DEFAULT 0 NOT NULL,
    living_children integer DEFAULT 0 NOT NULL,
    abortions integer DEFAULT 0 NOT NULL,
    lmp_date date NOT NULL,
    edd date NOT NULL,
    gestational_age_at_booking integer,
    risk_level public.antenatal_registrations_risk_level_enum DEFAULT 'low'::public.antenatal_registrations_risk_level_enum NOT NULL,
    risk_factors text,
    status public.antenatal_registrations_status_enum DEFAULT 'active'::public.antenatal_registrations_status_enum NOT NULL,
    blood_group character varying(5),
    rh_positive boolean,
    medical_history text,
    surgical_history text,
    allergies text,
    current_medications text,
    partner_name character varying(100),
    partner_phone character varying(20),
    partner_hiv_tested boolean,
    facility_id uuid NOT NULL,
    registered_by_id uuid,
    registration_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: antenatal_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.antenatal_visits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    registration_id uuid NOT NULL,
    visit_number integer NOT NULL,
    visit_date date NOT NULL,
    gestational_age integer NOT NULL,
    weight numeric(5,2),
    bp_systolic integer,
    bp_diastolic integer,
    temperature numeric(4,1),
    pulse_rate integer,
    fundal_height numeric(4,1),
    fetal_presentation character varying(50),
    fetal_heart_rate integer,
    fetal_movement boolean,
    edema boolean,
    urine_protein boolean,
    urine_glucose boolean,
    hemoglobin numeric(4,1),
    iron_folate_given boolean DEFAULT false NOT NULL,
    tetanus_toxoid_given boolean DEFAULT false NOT NULL,
    tt_dose_number integer,
    ipt_given boolean DEFAULT false NOT NULL,
    ipt_dose_number integer,
    deworming_given boolean DEFAULT false NOT NULL,
    complaints text,
    findings text,
    diagnosis text,
    plan text,
    next_visit_date date,
    seen_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: app_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version character varying(50) NOT NULL,
    version_code character varying(50) NOT NULL,
    release_notes text,
    min_upgrade_from character varying(50),
    is_mandatory boolean DEFAULT false NOT NULL,
    is_latest boolean DEFAULT false NOT NULL,
    download_url character varying(500),
    checksum character varying(64),
    file_size bigint,
    released_at timestamp without time zone DEFAULT now() NOT NULL,
    end_of_support timestamp without time zone
);


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    appointment_number character varying NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    appointment_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone,
    type public.appointments_type_enum DEFAULT 'consultation'::public.appointments_type_enum NOT NULL,
    status public.appointments_status_enum DEFAULT 'scheduled'::public.appointments_status_enum NOT NULL,
    department character varying,
    reason_for_visit text,
    notes text,
    cancellation_reason text,
    created_by uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    operation_type character varying(50) NOT NULL,
    requested_by_id uuid NOT NULL,
    operation_data jsonb,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    approved_by_id uuid,
    approved_at timestamp without time zone,
    notes text
);


--
-- Name: asset_depreciations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_depreciations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    asset_id uuid NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    opening_book_value numeric(15,2) NOT NULL,
    depreciation_amount numeric(15,2) NOT NULL,
    accumulated_depreciation numeric(15,2) NOT NULL,
    closing_book_value numeric(15,2) NOT NULL,
    is_posted boolean DEFAULT false NOT NULL,
    journal_entry_id uuid,
    posted_by uuid,
    posted_at timestamp without time zone
);


--
-- Name: asset_maintenances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_maintenances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    asset_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    maintenance_date date NOT NULL,
    description text NOT NULL,
    performed_by character varying(255),
    service_provider character varying(255),
    cost numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    next_due_date date,
    findings text,
    recommendations text,
    attachments jsonb
);


--
-- Name: asset_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_transfers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    asset_id uuid NOT NULL,
    from_facility_id uuid NOT NULL,
    from_department_id uuid,
    to_facility_id uuid NOT NULL,
    to_department_id uuid,
    transfer_date date NOT NULL,
    reason text,
    transferred_by uuid NOT NULL,
    received_by uuid,
    received_date date,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    clock_in time without time zone,
    clock_out time without time zone,
    hours_worked numeric(4,2),
    overtime_hours numeric(4,2),
    status character varying(20) DEFAULT 'present'::character varying NOT NULL,
    notes text,
    facility_id uuid NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(100) NOT NULL,
    entity_id uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address character varying(45),
    user_agent text,
    actor_type character varying(50),
    support_access_tier integer
);


--
-- Name: baby_wellness_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.baby_wellness_checks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    delivery_outcome_id uuid NOT NULL,
    postnatal_visit_id uuid,
    check_date timestamp without time zone NOT NULL,
    age_in_days integer NOT NULL,
    weight numeric(5,3),
    temperature numeric(4,1),
    heart_rate integer,
    respiratory_rate integer,
    feeding_type public.baby_wellness_checks_feeding_type_enum,
    feeding_well boolean,
    feeds_per_day integer,
    feeding_notes text,
    cord_status public.baby_wellness_checks_cord_status_enum,
    cord_separation_date date,
    jaundice_level public.baby_wellness_checks_jaundice_level_enum,
    phototherapy_needed boolean,
    eyes_normal boolean,
    eye_discharge boolean,
    not_feeding boolean DEFAULT false NOT NULL,
    convulsions boolean DEFAULT false NOT NULL,
    fast_breathing boolean DEFAULT false NOT NULL,
    severe_chest_indrawing boolean DEFAULT false NOT NULL,
    no_movement boolean DEFAULT false NOT NULL,
    hypothermia boolean DEFAULT false NOT NULL,
    hyperthermia boolean DEFAULT false NOT NULL,
    weight_for_age character varying(50),
    weight_change_percent numeric(5,2),
    status public.baby_wellness_checks_status_enum DEFAULT 'healthy'::public.baby_wellness_checks_status_enum NOT NULL,
    findings text,
    actions text,
    referral_reason text,
    notes text,
    checked_by_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id character varying NOT NULL,
    filename character varying NOT NULL,
    file_path character varying NOT NULL,
    size_bytes bigint DEFAULT '0'::bigint NOT NULL,
    status character varying DEFAULT 'completed'::character varying NOT NULL,
    created_by character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_reconciliation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliation_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    reconciliation_id uuid NOT NULL,
    statement_reference character varying,
    statement_description character varying,
    statement_amount numeric(15,2) NOT NULL,
    statement_date date NOT NULL,
    journal_entry_id uuid,
    status public.bank_reconciliation_items_status_enum DEFAULT 'unmatched'::public.bank_reconciliation_items_status_enum NOT NULL,
    notes text
);


--
-- Name: bank_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    statement_date date NOT NULL,
    statement_balance numeric(15,2) NOT NULL,
    book_balance numeric(15,2) NOT NULL,
    reconciled_balance numeric(15,2),
    status public.bank_reconciliations_status_enum DEFAULT 'in_progress'::public.bank_reconciliations_status_enum NOT NULL,
    reconciled_by uuid,
    reconciled_at timestamp without time zone
);


--
-- Name: batch_stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_stock_balances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    item_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    store_id uuid,
    batch_number character varying NOT NULL,
    expiry_date date NOT NULL,
    quantity numeric(15,4) DEFAULT '0'::numeric NOT NULL,
    reserved_quantity numeric(15,4) DEFAULT '0'::numeric NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: bed_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bed_transfers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    reason public.bed_transfers_reason_enum NOT NULL,
    notes text,
    "transferTime" timestamp without time zone DEFAULT now() NOT NULL,
    "admissionId" uuid NOT NULL,
    "fromWardId" uuid NOT NULL,
    "fromBedId" uuid NOT NULL,
    "toWardId" uuid NOT NULL,
    "toBedId" uuid NOT NULL,
    "transferredById" uuid NOT NULL
);


--
-- Name: beds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    "bedNumber" character varying NOT NULL,
    type public.beds_type_enum DEFAULT 'standard'::public.beds_type_enum NOT NULL,
    status public.beds_status_enum DEFAULT 'available'::public.beds_status_enum NOT NULL,
    "dailyRate" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    notes character varying,
    "wardId" uuid NOT NULL
);


--
-- Name: billing_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_points (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    type public.billing_points_type_enum DEFAULT 'central'::public.billing_points_type_enum NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    can_collect_payment boolean DEFAULT true NOT NULL,
    can_create_invoice boolean DEFAULT true NOT NULL,
    can_give_discount boolean DEFAULT false NOT NULL,
    max_discount_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    printer_name character varying,
    facility_id uuid NOT NULL,
    department_id uuid
);


--
-- Name: biometric_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.biometric_data (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid NOT NULL,
    finger_index character varying(20) NOT NULL,
    template_data text NOT NULL,
    quality_score integer,
    registered_at timestamp without time zone DEFAULT now() NOT NULL,
    last_verified_at timestamp without time zone
);


--
-- Name: budget_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    budget_id uuid NOT NULL,
    account_id uuid NOT NULL,
    cost_center_id uuid,
    budgeted_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    actual_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    period integer,
    notes text
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    fiscal_year integer NOT NULL,
    name character varying(100) NOT NULL,
    status public.budgets_status_enum DEFAULT 'draft'::public.budgets_status_enum NOT NULL,
    total_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone
);


--
-- Name: cashier_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cashier_sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    session_number character varying NOT NULL,
    billing_point_id uuid NOT NULL,
    cashier_id uuid NOT NULL,
    opening_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    closing_balance numeric(12,2),
    total_cash numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_card numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_mobile numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_insurance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    transactions_count integer DEFAULT 0 NOT NULL,
    status character varying DEFAULT 'open'::character varying NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    notes text,
    denominations jsonb
);


--
-- Name: change_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_sets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tenantId" uuid NOT NULL,
    "deploymentId" uuid,
    "batchId" character varying(255) NOT NULL,
    status public.change_sets_status_enum DEFAULT 'pending'::public.change_sets_status_enum NOT NULL,
    "changeCount" integer DEFAULT 0 NOT NULL,
    changes jsonb NOT NULL,
    description text,
    metadata jsonb,
    "successCount" integer DEFAULT 0 NOT NULL,
    "failureCount" integer DEFAULT 0 NOT NULL,
    "failureReason" text,
    "canRollback" boolean DEFAULT false NOT NULL,
    "appliedAt" timestamp without time zone,
    "rolledBackAt" timestamp without time zone,
    "appliedBy" uuid,
    "rolledBackBy" uuid,
    "createdBy" uuid,
    "sourceSystem" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    tenant_id uuid NOT NULL,
    deployment_id uuid,
    entity character varying(255),
    operation character varying(50)
);


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_of_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    tenant_id uuid,
    account_code character varying(20) NOT NULL,
    account_name character varying(200) NOT NULL,
    account_type public.chart_of_accounts_account_type_enum NOT NULL,
    account_category public.chart_of_accounts_account_category_enum NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    is_header boolean DEFAULT false NOT NULL,
    current_balance numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    currency character varying(10) DEFAULT 'UGX'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    mpath character varying DEFAULT ''::character varying,
    "parentId" uuid
);


--
-- Name: claim_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claim_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    claim_id uuid NOT NULL,
    item_type public.claim_items_item_type_enum NOT NULL,
    service_code character varying,
    description character varying NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    claimed_amount numeric(15,2) NOT NULL,
    approved_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    status public.claim_items_status_enum DEFAULT 'pending'::public.claim_items_status_enum NOT NULL,
    rejection_reason character varying,
    service_date date NOT NULL,
    provider_notes character varying,
    insurer_notes character varying
);


--
-- Name: clinical_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinical_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    subjective text,
    objective text,
    assessment text,
    plan text,
    diagnoses jsonb,
    follow_up_date date,
    follow_up_notes text,
    encounter_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    edit_history jsonb,
    last_edited_by_id uuid,
    last_edited_at timestamp with time zone
);


--
-- Name: common_drug_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.common_drug_translations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    drug_name character varying(255) NOT NULL,
    language character varying(10) NOT NULL,
    translated_name character varying(255) NOT NULL,
    directions text,
    warnings text
);


--
-- Name: contract_amendments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_amendments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    contract_id uuid NOT NULL,
    amendment_number integer NOT NULL,
    description text NOT NULL,
    effective_date date NOT NULL,
    changes jsonb,
    created_by_id uuid NOT NULL
);


--
-- Name: controlled_substance_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.controlled_substance_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    prescription_item_id uuid NOT NULL,
    dispensation_id uuid NOT NULL,
    drug_schedule public.controlled_substance_logs_drug_schedule_enum NOT NULL,
    quantity_dispensed numeric(10,2) NOT NULL,
    running_balance numeric(10,2) NOT NULL,
    dispensed_by_id uuid NOT NULL,
    witness_id uuid,
    witness_signature text,
    witnessed_at timestamp with time zone,
    double_check_by_id uuid,
    double_checked_at timestamp with time zone,
    notes text,
    facility_id uuid
);


--
-- Name: cost_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_centers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    type public.cost_centers_type_enum DEFAULT 'department'::public.cost_centers_type_enum NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    parent_id uuid
);


--
-- Name: delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delegations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    delegator_id uuid NOT NULL,
    delegate_id uuid NOT NULL,
    role_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL
);


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    sale_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    delivery_address character varying NOT NULL,
    driver_name character varying,
    driver_phone character varying,
    vehicle_number character varying,
    scheduled_at timestamp without time zone,
    dispatched_at timestamp without time zone,
    delivered_at timestamp without time zone,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    notes text
);


--
-- Name: delivery_outcomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_outcomes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    labour_record_id uuid NOT NULL,
    baby_number integer DEFAULT 1 NOT NULL,
    time_of_birth timestamp without time zone NOT NULL,
    outcome public.delivery_outcomes_outcome_enum NOT NULL,
    sex public.delivery_outcomes_sex_enum NOT NULL,
    birth_weight numeric(5,3) NOT NULL,
    birth_length numeric(4,1),
    head_circumference numeric(4,1),
    apgar_1min integer,
    apgar_5min integer,
    apgar_10min integer,
    resuscitation_needed boolean DEFAULT false NOT NULL,
    resuscitation_details text,
    skin_to_skin boolean DEFAULT false NOT NULL,
    breastfeeding_initiated boolean DEFAULT false NOT NULL,
    vitamin_k_given boolean DEFAULT false NOT NULL,
    eye_prophylaxis boolean DEFAULT false NOT NULL,
    bcg_given boolean DEFAULT false NOT NULL,
    opv0_given boolean DEFAULT false NOT NULL,
    baby_status public.delivery_outcomes_baby_status_enum DEFAULT 'alive'::public.delivery_outcomes_baby_status_enum NOT NULL,
    abnormalities text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    parent_id uuid,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    head_user_id uuid
);


--
-- Name: deployment_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "deploymentId" uuid NOT NULL,
    "alertType" public.deployment_alerts_alerttype_enum DEFAULT 'unknown'::public.deployment_alerts_alerttype_enum NOT NULL,
    severity public.deployment_alerts_severity_enum DEFAULT 'warning'::public.deployment_alerts_severity_enum NOT NULL,
    status public.deployment_alerts_status_enum DEFAULT 'open'::public.deployment_alerts_status_enum NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    metadata jsonb,
    "occurrenceCount" integer DEFAULT 1 NOT NULL,
    "acknowledgedCount" integer DEFAULT 0 NOT NULL,
    "triggerCondition" text,
    threshold text,
    "actualValue" text,
    "notificationsSent" integer DEFAULT 0 NOT NULL,
    escalated boolean DEFAULT false NOT NULL,
    "escalationReason" text,
    "escalatedAt" timestamp without time zone,
    "acknowledgedAt" timestamp without time zone,
    "acknowledgedBy" uuid,
    "acknowledgmentNotes" text,
    "resolvedAt" timestamp without time zone,
    "resolvedBy" uuid,
    "resolutionNotes" text,
    "createdBy" uuid,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    deployment_id uuid NOT NULL
);


--
-- Name: deployment_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    deployment_id uuid NOT NULL,
    config_key character varying(255) NOT NULL,
    config_value text NOT NULL,
    data_type character varying(50),
    override_reason text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: deployment_health; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_health (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "deploymentId" uuid NOT NULL,
    status public.deployment_health_status_enum DEFAULT 'healthy'::public.deployment_health_status_enum NOT NULL,
    uptime integer DEFAULT 0 NOT NULL,
    "uptimePercentage" double precision DEFAULT '0'::double precision NOT NULL,
    "cpuUsagePercent" double precision DEFAULT '0'::double precision NOT NULL,
    "memoryUsagePercent" double precision DEFAULT '0'::double precision NOT NULL,
    "diskUsagePercent" double precision DEFAULT '0'::double precision NOT NULL,
    "errorRatePercent" integer DEFAULT 0 NOT NULL,
    "responseTimeMs" integer DEFAULT 0 NOT NULL,
    "requestCountPerMinute" integer DEFAULT 0 NOT NULL,
    "activeConnectionsCount" integer DEFAULT 0 NOT NULL,
    "queuedRequestsCount" integer DEFAULT 0 NOT NULL,
    "totalErrorsLast24h" integer DEFAULT 0 NOT NULL,
    "syncDelaySeconds" integer DEFAULT 0 NOT NULL,
    "lastErrorMessage" text,
    "lastErrorAt" timestamp without time zone,
    "lastSyncAt" timestamp without time zone,
    "lastHealthCheckAt" timestamp without time zone,
    metadata jsonb,
    "serviceMetrics" jsonb,
    notes text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    deployment_id uuid NOT NULL
);


--
-- Name: deployment_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    deployment_id uuid NOT NULL,
    app_version_id uuid NOT NULL,
    status public.deployment_versions_status_enum DEFAULT 'pending'::public.deployment_versions_status_enum NOT NULL,
    deployed_at timestamp without time zone NOT NULL,
    rollback_reason text,
    rolled_back_at timestamp without time zone,
    deployment_metadata jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: deployments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    deployment_type public.deployments_deployment_type_enum NOT NULL,
    name character varying(255) NOT NULL,
    status public.deployments_status_enum DEFAULT 'active'::public.deployments_status_enum NOT NULL,
    api_endpoint character varying(500) NOT NULL,
    current_version character varying(50) NOT NULL,
    last_sync timestamp without time zone,
    last_health_check timestamp without time zone,
    config jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: deposit_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deposit_applications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    deposit_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    applied_by uuid NOT NULL
);


--
-- Name: diagnoses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnoses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    icd10_code character varying(20) NOT NULL,
    icd_version public.diagnoses_icd_version_enum DEFAULT 'ICD-10'::public.diagnoses_icd_version_enum NOT NULL,
    name character varying(500) NOT NULL,
    short_name character varying(500),
    description text,
    category public.diagnoses_category_enum DEFAULT 'other'::public.diagnoses_category_enum NOT NULL,
    chapter_code character varying(10),
    chapter_name character varying(255),
    block_code character varying(20),
    block_name character varying(255),
    is_notifiable boolean DEFAULT false NOT NULL,
    is_chronic boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    synonyms jsonb,
    related_codes jsonb
);


--
-- Name: discharge_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discharge_summaries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    discharge_number character varying NOT NULL,
    type public.discharge_summaries_type_enum DEFAULT 'regular'::public.discharge_summaries_type_enum NOT NULL,
    destination public.discharge_summaries_destination_enum DEFAULT 'home'::public.discharge_summaries_destination_enum NOT NULL,
    discharge_date timestamp with time zone NOT NULL,
    chief_complaint text NOT NULL,
    presenting_illness text,
    admission_diagnosis text,
    final_diagnosis text NOT NULL,
    diagnosis_codes jsonb,
    secondary_diagnoses jsonb,
    comorbidities jsonb,
    hospital_course text NOT NULL,
    procedures_performed jsonb,
    significant_findings text,
    complications text,
    consultations jsonb,
    condition_at_discharge text NOT NULL,
    vital_signs_at_discharge jsonb,
    functional_status text,
    discharge_medications jsonb,
    medications_discontinued jsonb,
    discharge_instructions text NOT NULL,
    diet_instructions text,
    activity_instructions text,
    wound_care_instructions text,
    warning_signs text,
    when_to_seek_care text,
    follow_up_appointments jsonb,
    pending_results jsonb,
    pending_referrals jsonb,
    transfer_facility_name character varying,
    transfer_reason text,
    transport_mode character varying,
    ama_reason text,
    ama_risks_explained boolean DEFAULT false NOT NULL,
    ama_consent_signed boolean DEFAULT false NOT NULL,
    education_provided jsonb,
    emergency_contact_informed boolean DEFAULT false NOT NULL,
    emergency_contact_name character varying,
    emergency_contact_phone character varying,
    patient_id uuid NOT NULL,
    encounter_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    discharged_by_id uuid NOT NULL,
    attending_physician_id uuid
);


--
-- Name: disciplinary_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disciplinary_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    type public.disciplinary_actions_type_enum NOT NULL,
    status public.disciplinary_actions_status_enum DEFAULT 'active'::public.disciplinary_actions_status_enum NOT NULL,
    reason character varying NOT NULL,
    incident_date date NOT NULL,
    details text,
    expected_improvement text,
    consequences text,
    issued_by_id uuid,
    acknowledged_at timestamp without time zone,
    resolution_notes text,
    resolution_date date,
    appeal_notes text,
    follow_up_date date,
    facility_id character varying,
    tenant_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: dispensations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dispensations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    batch_number character varying,
    expiry_date date,
    quantity integer NOT NULL,
    unit_price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    dispensed_at timestamp with time zone DEFAULT now() NOT NULL,
    counseling_provided boolean DEFAULT false NOT NULL,
    counseling_notes text,
    prescription_id uuid NOT NULL,
    prescription_item_id uuid NOT NULL,
    dispensed_by_id uuid NOT NULL
);


--
-- Name: disposal_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disposal_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    item_id uuid NOT NULL,
    batch_number character varying,
    quantity integer NOT NULL,
    unit_value numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_value numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    disposal_date date NOT NULL,
    disposal_method public.disposal_records_disposal_method_enum DEFAULT 'incineration'::public.disposal_records_disposal_method_enum NOT NULL,
    witness character varying,
    certificate_number character varying,
    compliance_status public.disposal_records_compliance_status_enum DEFAULT 'pending_review'::public.disposal_records_compliance_status_enum NOT NULL,
    reason text,
    notes text,
    facility_id uuid NOT NULL,
    disposed_by_id uuid NOT NULL,
    approved_by_id uuid
);


--
-- Name: doctor_duties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_duties (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    doctor_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    department_id uuid,
    duty_date date NOT NULL,
    status public.doctor_duties_status_enum DEFAULT 'off_duty'::public.doctor_duties_status_enum NOT NULL,
    check_in_time time without time zone,
    check_out_time time without time zone,
    room_number character varying(100),
    current_queue_count integer DEFAULT 0 NOT NULL,
    max_patients integer DEFAULT 20 NOT NULL,
    notes text,
    marked_by_id uuid NOT NULL
);


--
-- Name: doctor_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    doctor_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_duration integer DEFAULT 15 NOT NULL,
    max_patients integer DEFAULT 20 NOT NULL,
    department character varying,
    is_active boolean DEFAULT true NOT NULL,
    effective_from date,
    effective_to date,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: donor_funds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.donor_funds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    fund_code character varying NOT NULL,
    name character varying NOT NULL,
    donor_name character varying NOT NULL,
    grant_amount numeric(15,2) NOT NULL,
    disbursed_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    remaining_balance numeric(15,2) NOT NULL,
    restriction public.donor_funds_restriction_enum DEFAULT 'temporarily_restricted'::public.donor_funds_restriction_enum NOT NULL,
    status public.donor_funds_status_enum DEFAULT 'active'::public.donor_funds_status_enum NOT NULL,
    start_date date NOT NULL,
    end_date date,
    description text,
    account_id uuid
);


--
-- Name: drug_allergy_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_allergy_classes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    class_name character varying(100) NOT NULL,
    description text,
    related_drugs jsonb,
    cross_reactive_classes jsonb
);


--
-- Name: drug_classifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_classifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    item_id uuid NOT NULL,
    atc_code character varying(20),
    atc_description character varying(255),
    schedule public.drug_classifications_schedule_enum DEFAULT 'unscheduled'::public.drug_classifications_schedule_enum NOT NULL,
    therapeutic_class public.drug_classifications_therapeutic_class_enum,
    therapeutic_subclass character varying(255),
    formulation public.drug_classifications_formulation_enum,
    strength character varying(100),
    generic_name character varying(255),
    brand_name character varying(255),
    is_controlled boolean DEFAULT false NOT NULL,
    is_narcotic boolean DEFAULT false NOT NULL,
    is_psychotropic boolean DEFAULT false NOT NULL,
    requires_double_check boolean DEFAULT false NOT NULL,
    high_alert boolean DEFAULT false NOT NULL,
    look_alike_sound_alike boolean DEFAULT false NOT NULL,
    storage_condition public.drug_classifications_storage_condition_enum DEFAULT 'room_temperature'::public.drug_classifications_storage_condition_enum NOT NULL,
    max_single_dose integer,
    max_daily_dose integer,
    dose_unit character varying(50),
    contraindications text,
    warnings text,
    pregnancy_category text,
    is_on_formulary boolean DEFAULT true NOT NULL,
    formulary_tier character varying(50),
    requires_prior_auth boolean DEFAULT false NOT NULL,
    notes text
);


--
-- Name: drug_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_interactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    drug_a_id uuid NOT NULL,
    drug_b_id uuid NOT NULL,
    severity character varying(20) NOT NULL,
    description text NOT NULL,
    clinical_effects text,
    mechanism text,
    management text,
    reference character varying(255),
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: drug_label_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_label_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(255) NOT NULL,
    language character varying(10) NOT NULL,
    label_type public.drug_label_templates_label_type_enum DEFAULT 'prescription'::public.drug_label_templates_label_type_enum NOT NULL,
    header_template text NOT NULL,
    body_template text NOT NULL,
    footer_template text NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);


--
-- Name: drug_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_sync_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    sync_type public.drug_sync_logs_sync_type_enum NOT NULL,
    status public.drug_sync_logs_status_enum DEFAULT 'running'::public.drug_sync_logs_status_enum NOT NULL,
    records_processed integer DEFAULT 0 NOT NULL,
    records_added integer DEFAULT 0 NOT NULL,
    records_failed integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    error_message text
);


--
-- Name: emergency_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_cases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    case_number character varying NOT NULL,
    triage_level public.emergency_cases_triage_level_enum NOT NULL,
    status public.emergency_cases_status_enum DEFAULT 'pending'::public.emergency_cases_status_enum NOT NULL,
    arrival_mode public.emergency_cases_arrival_mode_enum DEFAULT 'walk_in'::public.emergency_cases_arrival_mode_enum NOT NULL,
    arrival_time timestamp with time zone NOT NULL,
    triage_time timestamp with time zone,
    treatment_start_time timestamp with time zone,
    discharge_time timestamp with time zone,
    chief_complaint text NOT NULL,
    presenting_symptoms text,
    mechanism_of_injury text,
    blood_pressure_systolic integer,
    blood_pressure_diastolic integer,
    heart_rate integer,
    respiratory_rate integer,
    temperature numeric(4,1),
    oxygen_saturation integer,
    gcs_score integer,
    pain_score integer,
    blood_glucose numeric(5,1),
    allergies text,
    current_medications text,
    past_medical_history text,
    triage_notes text,
    treatment_notes text,
    disposition_notes text,
    primary_diagnosis text,
    procedures_performed jsonb,
    encounter_id uuid,
    facility_id uuid NOT NULL,
    triage_nurse_id uuid,
    attending_doctor_id uuid
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_number character varying(20) NOT NULL,
    user_id uuid,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    other_names character varying(100),
    date_of_birth date NOT NULL,
    gender public.employees_gender_enum NOT NULL,
    marital_status public.employees_marital_status_enum,
    national_id character varying(50),
    nssf_number character varying(50),
    tin_number character varying(50),
    phone character varying(20),
    email character varying(100),
    address text,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    emergency_contact_relationship character varying(50),
    job_title character varying(100) NOT NULL,
    department character varying(100),
    staff_category public.employees_staff_category_enum,
    license_number character varying(50),
    specialization character varying(100),
    employment_type public.employees_employment_type_enum DEFAULT 'permanent'::public.employees_employment_type_enum NOT NULL,
    status public.employees_status_enum DEFAULT 'active'::public.employees_status_enum NOT NULL,
    hire_date date NOT NULL,
    termination_date date,
    termination_reason text,
    salary_grade character varying(20),
    basic_salary numeric(12,2) NOT NULL,
    allowances jsonb,
    deductions jsonb,
    bank_name character varying(100),
    bank_account_number character varying(50),
    bank_branch character varying(20),
    annual_leave_balance integer DEFAULT 21 NOT NULL,
    sick_leave_balance integer DEFAULT 10 NOT NULL,
    facility_id uuid NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: encounters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    visit_number character varying NOT NULL,
    type public.encounters_type_enum DEFAULT 'opd'::public.encounters_type_enum NOT NULL,
    status public.encounters_status_enum DEFAULT 'registered'::public.encounters_status_enum NOT NULL,
    chief_complaint text,
    notes text,
    start_time timestamp with time zone DEFAULT now() NOT NULL,
    end_time timestamp with time zone,
    queue_number integer,
    payer_type public.encounters_payer_type_enum DEFAULT 'cash'::public.encounters_payer_type_enum NOT NULL,
    metadata jsonb,
    patient_id uuid NOT NULL,
    insurance_policy_id uuid,
    facility_id uuid NOT NULL,
    department_id uuid,
    attending_provider_id uuid,
    created_by_id uuid NOT NULL
);


--
-- Name: equipment_calibrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_calibrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    equipment_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    calibration_date date NOT NULL,
    type character varying(50) NOT NULL,
    performed_by character varying(255),
    external_provider character varying(255),
    certificate_number character varying(100),
    results jsonb,
    passed boolean DEFAULT true NOT NULL,
    comments text,
    next_due_date date,
    attachments jsonb
);


--
-- Name: equipment_maintenances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment_maintenances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    equipment_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    maintenance_date date NOT NULL,
    type character varying(50) NOT NULL,
    description text NOT NULL,
    performed_by character varying(255),
    service_provider character varying(255),
    cost numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    parts_replaced text,
    findings text,
    recommendations text,
    next_due_date date,
    attachments jsonb
);


--
-- Name: expiry_alert_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expiry_alert_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    config_name character varying NOT NULL,
    days_before_expiry integer NOT NULL,
    severity public.expiry_alert_configs_severity_enum DEFAULT 'medium'::public.expiry_alert_configs_severity_enum NOT NULL,
    channels text,
    is_active boolean DEFAULT true NOT NULL,
    notify_emails text,
    notify_phones text,
    facility_id uuid NOT NULL,
    created_by_id uuid NOT NULL
);


--
-- Name: expiry_alert_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expiry_alert_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    alert_type character varying NOT NULL,
    items_affected integer NOT NULL,
    total_value numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    severity public.expiry_alert_history_severity_enum DEFAULT 'medium'::public.expiry_alert_history_severity_enum NOT NULL,
    message text,
    acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_at timestamp without time zone,
    channel public.expiry_alert_history_channel_enum,
    sent_at timestamp without time zone,
    facility_id uuid NOT NULL,
    acknowledged_by_id uuid
);


--
-- Name: expiry_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expiry_alerts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    item_id uuid NOT NULL,
    batch_number character varying,
    expiry_date date NOT NULL,
    alert_date timestamp with time zone,
    quantity integer DEFAULT 0 NOT NULL,
    status public.expiry_alerts_status_enum DEFAULT 'near_expiry'::public.expiry_alerts_status_enum NOT NULL,
    days_until_expiry integer,
    alert_level public.expiry_alerts_alert_level_enum,
    sms_sent boolean DEFAULT false NOT NULL,
    in_app_sent boolean DEFAULT false NOT NULL,
    action_taken character varying,
    action_date timestamp with time zone,
    action_by uuid,
    notes text,
    facility_id uuid NOT NULL
);


--
-- Name: facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facilities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(255) NOT NULL,
    type character varying(100) NOT NULL,
    parent_facility_id uuid,
    location text,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    contact jsonb,
    settings jsonb
);


--
-- Name: facility_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facility_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    facility_type character varying(50) NOT NULL,
    single_user_mode boolean DEFAULT false NOT NULL,
    auto_login boolean DEFAULT false NOT NULL,
    default_user_id uuid,
    multi_site_enabled boolean DEFAULT false NOT NULL,
    setup_completed boolean DEFAULT false NOT NULL,
    "uiPreferences" jsonb,
    "workflowSettings" jsonb,
    notes text
);


--
-- Name: facility_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facility_modules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    module_code character varying(50) NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    settings jsonb,
    notes text
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    feature_key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_enabled boolean DEFAULT false NOT NULL,
    value_type character varying(50) DEFAULT 'boolean'::character varying NOT NULL,
    value text,
    category character varying(50) DEFAULT 'feature'::character varying NOT NULL,
    metadata jsonb
);


--
-- Name: finance_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    entity_type character varying NOT NULL,
    entity_id uuid NOT NULL,
    action character varying NOT NULL,
    old_value jsonb,
    new_value jsonb,
    user_id uuid NOT NULL,
    user_name character varying,
    ip_address character varying,
    notes text,
    facility_id uuid NOT NULL
);


--
-- Name: fiscal_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    tenant_id uuid,
    fiscal_year integer NOT NULL,
    period integer NOT NULL,
    period_name character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status public.fiscal_periods_status_enum DEFAULT 'open'::public.fiscal_periods_status_enum NOT NULL,
    closed_by_id uuid,
    closed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_assets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    department_id uuid,
    asset_code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category public.fixed_assets_category_enum NOT NULL,
    sub_category character varying(100),
    serial_number character varying(100),
    model character varying(100),
    manufacturer character varying(100),
    supplier character varying(255),
    purchase_order_number character varying(100),
    acquisition_date date NOT NULL,
    acquisition_cost numeric(15,2) NOT NULL,
    installation_cost numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_cost numeric(15,2) NOT NULL,
    salvage_value numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    useful_life_months integer NOT NULL,
    depreciation_method public.fixed_assets_depreciation_method_enum DEFAULT 'straight_line'::public.fixed_assets_depreciation_method_enum NOT NULL,
    depreciation_rate numeric(5,2),
    depreciation_start_date date NOT NULL,
    accumulated_depreciation numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    book_value numeric(15,2) NOT NULL,
    current_market_value numeric(15,2),
    last_valuation_date date,
    status public.fixed_assets_status_enum DEFAULT 'active'::public.fixed_assets_status_enum NOT NULL,
    condition public.fixed_assets_condition_enum DEFAULT 'good'::public.fixed_assets_condition_enum NOT NULL,
    location character varying(255),
    custodian_id uuid,
    warranty_expiry date,
    warranty_provider character varying(255),
    next_maintenance_date date,
    maintenance_interval_days integer,
    is_insured boolean DEFAULT false NOT NULL,
    insurance_policy_number character varying(100),
    insured_value numeric(15,2),
    insurance_expiry date,
    disposal_date date,
    disposal_value numeric(15,2),
    disposal_reason text,
    image_url character varying(500),
    specifications jsonb,
    notes text
);


--
-- Name: follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follow_ups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    appointment_number character varying NOT NULL,
    type public.follow_ups_type_enum DEFAULT 'routine'::public.follow_ups_type_enum NOT NULL,
    status public.follow_ups_status_enum DEFAULT 'scheduled'::public.follow_ups_status_enum NOT NULL,
    priority public.follow_ups_priority_enum DEFAULT 'medium'::public.follow_ups_priority_enum NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time character varying,
    duration_minutes integer DEFAULT 30 NOT NULL,
    reason text,
    instructions text,
    reminder_sent boolean DEFAULT false NOT NULL,
    reminder_sent_at timestamp with time zone,
    sms_reminder boolean DEFAULT true NOT NULL,
    days_before_reminder integer DEFAULT 1 NOT NULL,
    confirmed_at timestamp with time zone,
    checked_in_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancellation_reason text,
    cancelled_at timestamp with time zone,
    rescheduled_from_id character varying,
    missed_reason text,
    outcome_notes text,
    metadata jsonb,
    patient_id uuid NOT NULL,
    source_encounter_id uuid,
    follow_up_encounter_id uuid,
    facility_id uuid NOT NULL,
    department_id uuid,
    provider_id uuid,
    scheduled_by_id uuid NOT NULL,
    completed_by_id uuid
);


--
-- Name: goods_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    quantity_expected integer NOT NULL,
    quantity_received integer NOT NULL,
    quantity_accepted integer,
    quantity_rejected integer DEFAULT 0 NOT NULL,
    rejection_reason text,
    unit_cost numeric(10,2) NOT NULL,
    line_total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    batch_number character varying,
    expiry_date date,
    manufacture_date date,
    notes text,
    goods_receipt_note_id uuid NOT NULL,
    item_id character varying NOT NULL,
    item_code character varying NOT NULL,
    item_name character varying NOT NULL,
    item_unit character varying DEFAULT 'unit'::character varying NOT NULL,
    selling_price numeric(10,2),
    markup_percentage numeric(5,2),
    retail_price numeric(10,2),
    wholesale_price numeric(10,2),
    purchase_order_item_id character varying
);


--
-- Name: goods_receipt_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.goods_receipt_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    grn_number character varying NOT NULL,
    status public.goods_receipt_notes_status_enum DEFAULT 'draft'::public.goods_receipt_notes_status_enum NOT NULL,
    received_at timestamp with time zone NOT NULL,
    delivery_note_number character varying,
    invoice_number character varying,
    invoice_date date,
    invoice_amount numeric(12,2),
    total_quantity_received integer DEFAULT 0 NOT NULL,
    total_value numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    inspected_at timestamp with time zone,
    inspection_notes text,
    posted_at timestamp with time zone,
    facility_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_order_id uuid,
    received_by_id uuid NOT NULL,
    inspected_by_id uuid,
    posted_by_id uuid
);


--
-- Name: group_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    group_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: icd10_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icd10_codes (
    code character varying(10) NOT NULL,
    description text NOT NULL,
    category character varying,
    category_description character varying,
    chapter character varying,
    chapter_description character varying,
    is_billable boolean DEFAULT true NOT NULL,
    search_terms text,
    use_count integer DEFAULT 0 NOT NULL,
    last_used_at timestamp without time zone,
    source character varying DEFAULT 'who_api'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: imaging_modalities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaging_modalities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    modality_type public.imaging_modalities_modality_type_enum NOT NULL,
    manufacturer character varying(50),
    model character varying(100),
    location character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    is_available boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: imaging_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaging_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    order_number character varying(20) NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    modality_id uuid NOT NULL,
    study_type character varying(200) NOT NULL,
    body_part character varying(100),
    clinical_history text,
    clinical_indication text,
    priority public.imaging_orders_priority_enum DEFAULT 'routine'::public.imaging_orders_priority_enum NOT NULL,
    status public.imaging_orders_status_enum DEFAULT 'ordered'::public.imaging_orders_status_enum NOT NULL,
    ordered_by_id uuid NOT NULL,
    ordered_at timestamp without time zone NOT NULL,
    scheduled_at timestamp without time zone,
    performed_by_id uuid,
    performed_at timestamp without time zone,
    technologist_notes text,
    accession_number character varying(100),
    image_count integer DEFAULT 0 NOT NULL,
    price numeric(12,2) DEFAULT '0'::numeric,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: imaging_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaging_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    imaging_order_id uuid NOT NULL,
    findings text,
    impression text,
    recommendations text,
    finding_category public.imaging_results_finding_category_enum,
    reported_by_id uuid NOT NULL,
    reported_at timestamp without time zone NOT NULL,
    verified_by_id uuid,
    verified_at timestamp without time zone,
    is_critical boolean DEFAULT false NOT NULL,
    critical_notified boolean DEFAULT false NOT NULL,
    critical_notified_at timestamp without time zone,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: immunization_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.immunization_schedules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    patient_id uuid,
    delivery_outcome_id uuid,
    vaccine_name public.immunization_schedules_vaccine_name_enum NOT NULL,
    dose_number integer NOT NULL,
    age_in_weeks_due integer NOT NULL,
    scheduled_date date NOT NULL,
    due_date date NOT NULL,
    grace_period_end date,
    status public.immunization_schedules_status_enum DEFAULT 'scheduled'::public.immunization_schedules_status_enum NOT NULL,
    administered_at timestamp without time zone,
    administered_by_id uuid,
    batch_number character varying(100),
    expiry_date date,
    manufacturer character varying(100),
    site_of_administration character varying(50),
    route character varying(50),
    adverse_reaction boolean DEFAULT false NOT NULL,
    reaction_severity public.immunization_schedules_reaction_severity_enum DEFAULT 'none'::public.immunization_schedules_reaction_severity_enum NOT NULL,
    reaction_description text,
    reaction_treatment text,
    contraindication_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: in_app_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.in_app_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid,
    target_department_id uuid,
    target_user_id uuid,
    sender_user_id uuid,
    sender_name character varying(255),
    type public.in_app_notifications_type_enum DEFAULT 'GENERAL'::public.in_app_notifications_type_enum NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    read_by_user_id uuid,
    read_at timestamp without time zone
);


--
-- Name: insurance_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_claims (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    claim_number character varying NOT NULL,
    provider_id uuid NOT NULL,
    policy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    invoice_id character varying,
    pre_auth_id character varying,
    claim_type public.insurance_claims_claim_type_enum NOT NULL,
    status public.insurance_claims_status_enum DEFAULT 'draft'::public.insurance_claims_status_enum NOT NULL,
    service_date date NOT NULL,
    admission_date date,
    discharge_date date,
    primary_diagnosis character varying NOT NULL,
    diagnosis_code character varying,
    secondary_diagnoses jsonb,
    total_claimed numeric(15,2) NOT NULL,
    total_approved numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_paid numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    patient_responsibility numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    submitted_at timestamp without time zone,
    submitted_by_id uuid,
    reviewed_at timestamp without time zone,
    paid_at timestamp without time zone,
    payment_reference character varying,
    denial_reason character varying,
    denial_code character varying,
    notes text,
    attachments jsonb,
    metadata jsonb
);


--
-- Name: insurance_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    provider_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    policy_number character varying NOT NULL,
    member_number character varying NOT NULL,
    member_type public.insurance_policies_member_type_enum DEFAULT 'principal'::public.insurance_policies_member_type_enum NOT NULL,
    principal_member_number character varying,
    employer_name character varying,
    employer_code character varying,
    coverage_type public.insurance_policies_coverage_type_enum DEFAULT 'both'::public.insurance_policies_coverage_type_enum NOT NULL,
    annual_limit numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    used_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    copay_percentage numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    copay_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    effective_date date NOT NULL,
    expiry_date date NOT NULL,
    status public.insurance_policies_status_enum DEFAULT 'active'::public.insurance_policies_status_enum NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp without time zone,
    exclusions jsonb,
    metadata jsonb
);


--
-- Name: insurance_price_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_price_lists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    insurance_provider_id uuid NOT NULL,
    service_id uuid,
    lab_test_id uuid,
    item_id uuid,
    agreed_price numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    effective_from date DEFAULT ('now'::text)::date NOT NULL,
    effective_to date,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid
);


--
-- Name: insurance_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    name character varying NOT NULL,
    code character varying NOT NULL,
    provider_type public.insurance_providers_provider_type_enum DEFAULT 'private'::public.insurance_providers_provider_type_enum NOT NULL,
    contact_person character varying,
    email character varying,
    phone character varying,
    address character varying,
    claim_submission_method public.insurance_providers_claim_submission_method_enum DEFAULT 'manual'::public.insurance_providers_claim_submission_method_enum NOT NULL,
    api_endpoint character varying,
    api_key character varying,
    payment_terms_days integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb
);


--
-- Name: interfacility_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interfacility_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    source_facility_id uuid NOT NULL,
    target_facility_id uuid NOT NULL,
    reference_number character varying NOT NULL,
    amount numeric(15,2) NOT NULL,
    description text NOT NULL,
    transaction_type character varying NOT NULL,
    status public.interfacility_transactions_status_enum DEFAULT 'pending'::public.interfacility_transactions_status_enum NOT NULL,
    created_by uuid NOT NULL,
    confirmed_by uuid,
    settled_at timestamp without time zone,
    journal_entry_id uuid
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    service_code character varying NOT NULL,
    description character varying NOT NULL,
    charge_type public.invoice_items_charge_type_enum DEFAULT 'other'::public.invoice_items_charge_type_enum NOT NULL,
    quantity numeric(8,2) DEFAULT '1'::numeric NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    amount numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    tax_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    reference_type character varying,
    reference_id character varying,
    insurance_covered boolean DEFAULT false NOT NULL,
    insurance_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    copay_amount numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    coverage_note text,
    invoice_id uuid NOT NULL
);


--
-- Name: invoice_match_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_match_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    match_id uuid NOT NULL,
    item_id character varying NOT NULL,
    item_name character varying NOT NULL,
    po_qty integer NOT NULL,
    po_price numeric(10,2) NOT NULL,
    grn_qty integer DEFAULT 0 NOT NULL,
    invoice_qty integer NOT NULL,
    invoice_price numeric(10,2) NOT NULL,
    qty_match boolean DEFAULT true NOT NULL,
    price_match boolean DEFAULT true NOT NULL
);


--
-- Name: invoice_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_matches (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    match_number character varying NOT NULL,
    vendor_invoice_number character varying NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_order_id uuid NOT NULL,
    grn_id uuid,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    status public.invoice_matches_status_enum DEFAULT 'pending'::public.invoice_matches_status_enum NOT NULL,
    po_total numeric(14,2) NOT NULL,
    grn_total numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    invoice_total numeric(14,2) NOT NULL,
    variance numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    variance_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    payment_scheduled date,
    notes text,
    facility_id uuid NOT NULL,
    approved_by_id uuid,
    approved_at timestamp with time zone
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    invoice_number character varying NOT NULL,
    status public.invoices_status_enum DEFAULT 'pending'::public.invoices_status_enum NOT NULL,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    tax_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    discount_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    amount_paid numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    balance_due numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    insurance_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    copay_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    patient_responsibility numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    payment_type public.invoices_payment_type_enum DEFAULT 'cash'::public.invoices_payment_type_enum,
    insurance_policy_id character varying,
    notes text,
    due_date date,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    created_by_id uuid NOT NULL
);


--
-- Name: item_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_brands (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    country character varying(100),
    website character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    is_preferred boolean DEFAULT false NOT NULL,
    quality_rating integer,
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL
);


--
-- Name: item_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(7),
    icon character varying(50),
    is_drug_category boolean DEFAULT false NOT NULL,
    requires_prescription boolean DEFAULT false NOT NULL,
    requires_batch_tracking boolean DEFAULT false NOT NULL,
    requires_expiry_tracking boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    default_retail_markup numeric(5,2),
    default_wholesale_markup numeric(5,2),
    facility_id uuid NOT NULL
);


--
-- Name: item_formulations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_formulations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    route_of_admin character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL
);


--
-- Name: item_strengths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_strengths (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    value character varying(50),
    unit character varying(20),
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL
);


--
-- Name: item_subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_subcategories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    category_id uuid NOT NULL
);


--
-- Name: item_tag_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_tag_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    item_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: item_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_tags (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    color character varying(7),
    icon character varying(50),
    tag_type character varying(50) DEFAULT 'general'::character varying NOT NULL,
    is_warning boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL
);


--
-- Name: item_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_units (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    abbreviation character varying(10),
    description text,
    is_base_unit boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL
);


--
-- Name: items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    generic_name character varying,
    description character varying,
    category character varying,
    category_id uuid,
    subcategory_id uuid,
    brand_id uuid,
    formulation_id uuid,
    unit_id uuid,
    storage_condition_id uuid,
    strength_id uuid,
    unit character varying DEFAULT 'unit'::character varying NOT NULL,
    strength character varying,
    pack_size integer,
    is_drug boolean DEFAULT false NOT NULL,
    requires_prescription boolean DEFAULT false NOT NULL,
    is_controlled boolean DEFAULT false NOT NULL,
    max_dispense_quantity integer,
    requires_batch_tracking boolean DEFAULT false NOT NULL,
    requires_expiry_tracking boolean DEFAULT true NOT NULL,
    reorder_level integer DEFAULT 10 NOT NULL,
    max_stock_level integer,
    unit_cost numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    selling_price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    markup_percentage numeric(5,2),
    retail_price numeric(10,2),
    wholesale_price numeric(10,2),
    is_sellable boolean DEFAULT true NOT NULL,
    item_type character varying(50) DEFAULT 'standard'::character varying NOT NULL,
    preferred_supplier_id uuid,
    manufacturer character varying,
    barcode character varying,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    facility_id uuid
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    job_posting_id uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    phone character varying(20),
    cover_letter text,
    resume_url character varying(500),
    experience jsonb,
    education jsonb,
    status public.job_applications_status_enum DEFAULT 'submitted'::public.job_applications_status_enum NOT NULL,
    notes text,
    rating integer,
    interview_date date,
    tenant_id uuid,
    applied_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: job_postings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_postings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    department_id uuid,
    description text,
    requirements text,
    responsibilities text,
    employment_type public.job_postings_employment_type_enum DEFAULT 'full-time'::public.job_postings_employment_type_enum NOT NULL,
    salary_min numeric(12,2),
    salary_max numeric(12,2),
    location character varying(100),
    status public.job_postings_status_enum DEFAULT 'draft'::public.job_postings_status_enum NOT NULL,
    closing_date date,
    positions_available integer DEFAULT 1 NOT NULL,
    applications_count integer DEFAULT 0 NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    tenant_id uuid,
    journal_number character varying(20) NOT NULL,
    journal_date date NOT NULL,
    fiscal_period_id uuid NOT NULL,
    journal_type public.journal_entries_journal_type_enum DEFAULT 'general'::public.journal_entries_journal_type_enum NOT NULL,
    description text,
    reference character varying(100),
    status public.journal_entries_status_enum DEFAULT 'draft'::public.journal_entries_status_enum NOT NULL,
    total_debit numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_credit numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    created_by_id uuid NOT NULL,
    posted_by_id uuid,
    posted_at timestamp without time zone,
    is_reversal boolean DEFAULT false NOT NULL,
    is_reversed boolean DEFAULT false NOT NULL,
    reversal_of_id uuid,
    reversed_by_id uuid,
    reversed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_entry_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    journal_entry_id uuid NOT NULL,
    tenant_id uuid,
    account_id uuid NOT NULL,
    description text,
    debit numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    credit numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    line_number integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: lab_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_equipment (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    department_id uuid,
    asset_code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category public.lab_equipment_category_enum NOT NULL,
    manufacturer character varying(100),
    model character varying(100),
    serial_number character varying(100),
    installation_date date,
    warranty_expiry date,
    location character varying(255),
    status public.lab_equipment_status_enum DEFAULT 'operational'::public.lab_equipment_status_enum NOT NULL,
    requires_calibration boolean DEFAULT true NOT NULL,
    calibration_frequency_days integer,
    last_calibration_date date,
    next_calibration_date date,
    calibration_status public.lab_equipment_calibration_status_enum DEFAULT 'not_required'::public.lab_equipment_calibration_status_enum NOT NULL,
    requires_maintenance boolean DEFAULT true NOT NULL,
    maintenance_frequency_days integer,
    last_maintenance_date date,
    next_maintenance_date date,
    responsible_person_id uuid,
    service_provider character varying(255),
    service_contract_number character varying(100),
    service_contract_expiry date,
    supported_tests jsonb,
    compatible_reagents jsonb,
    daily_capacity integer,
    specifications jsonb,
    manual_url character varying(500),
    is_active boolean DEFAULT true NOT NULL,
    notes text
);


--
-- Name: lab_reagents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_reagents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category public.lab_reagents_category_enum NOT NULL,
    manufacturer character varying(100),
    catalog_number character varying(100),
    unit character varying(50) NOT NULL,
    unit_size numeric(10,2) NOT NULL,
    unit_size_unit character varying(50),
    stock_quantity integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 0 NOT NULL,
    max_stock_level integer,
    unit_cost numeric(15,2),
    storage_temperature character varying(50),
    storage_conditions text,
    stability_days_after_opening integer,
    requires_calibration boolean DEFAULT false NOT NULL,
    calibration_frequency_days integer,
    compatible_analyzers jsonb,
    test_codes jsonb,
    tests_per_unit integer,
    status public.lab_reagents_status_enum DEFAULT 'active'::public.lab_reagents_status_enum NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text
);


--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    parameter character varying NOT NULL,
    value text,
    "numericValue" numeric(15,4),
    unit character varying,
    "referenceMin" numeric(15,4),
    "referenceMax" numeric(15,4),
    "referenceRange" character varying,
    "abnormalFlag" public.lab_results_abnormalflag_enum DEFAULT 'normal'::public.lab_results_abnormalflag_enum NOT NULL,
    status public.lab_results_status_enum DEFAULT 'pending'::public.lab_results_status_enum NOT NULL,
    interpretation text,
    comments text,
    "validatedAt" timestamp without time zone,
    "releasedAt" timestamp without time zone,
    "amendmentReason" text,
    "previousValues" jsonb,
    "sampleId" uuid NOT NULL,
    "enteredById" uuid,
    "validatedById" uuid,
    "releasedById" uuid
);


--
-- Name: lab_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_samples (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    "sampleNumber" character varying NOT NULL,
    barcode character varying,
    "sampleType" public.lab_samples_sampletype_enum NOT NULL,
    status public.lab_samples_status_enum DEFAULT 'pending_collection'::public.lab_samples_status_enum NOT NULL,
    priority public.lab_samples_priority_enum DEFAULT 'routine'::public.lab_samples_priority_enum NOT NULL,
    "collectionTime" timestamp without time zone,
    "receivedTime" timestamp without time zone,
    "processedTime" timestamp without time zone,
    "completedTime" timestamp without time zone,
    "collectionNotes" text,
    "rejectionReason" text,
    metadata jsonb,
    "orderId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "labTestId" uuid NOT NULL,
    "facilityId" uuid NOT NULL,
    "collectedById" uuid,
    "processedById" uuid
);


--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    category public.lab_tests_category_enum DEFAULT 'other'::public.lab_tests_category_enum NOT NULL,
    "sampleType" public.lab_tests_sampletype_enum DEFAULT 'blood'::public.lab_tests_sampletype_enum NOT NULL,
    status public.lab_tests_status_enum DEFAULT 'active'::public.lab_tests_status_enum NOT NULL,
    price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "turnaroundTimeMinutes" integer DEFAULT 60 NOT NULL,
    "referenceRanges" jsonb,
    components jsonb,
    "requiresFasting" boolean DEFAULT false NOT NULL,
    "specialInstructions" text
);


--
-- Name: labour_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.labour_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    labour_number character varying(20) NOT NULL,
    registration_id uuid NOT NULL,
    status public.labour_records_status_enum DEFAULT 'admitted'::public.labour_records_status_enum NOT NULL,
    admission_time timestamp without time zone NOT NULL,
    gestational_age_at_delivery integer NOT NULL,
    admission_notes text,
    bp_systolic integer,
    bp_diastolic integer,
    pulse_rate integer,
    temperature numeric(4,1),
    cervical_dilation integer,
    station integer,
    membranes_intact boolean,
    membrane_rupture_time timestamp without time zone,
    liquor_color character varying(50),
    delivery_time timestamp without time zone,
    delivery_mode public.labour_records_delivery_mode_enum,
    delivery_notes text,
    placenta_delivery_time timestamp without time zone,
    placenta_complete boolean,
    blood_loss_ml integer,
    perineum_status character varying(50),
    episiotomy_done boolean,
    complications jsonb,
    complication_notes text,
    facility_id uuid NOT NULL,
    delivered_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    employee_id uuid NOT NULL,
    leave_type public.leave_requests_leave_type_enum NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_requested integer NOT NULL,
    reason text,
    status public.leave_requests_status_enum DEFAULT 'pending'::public.leave_requests_status_enum NOT NULL,
    approved_by_id uuid,
    approved_at timestamp without time zone,
    approval_notes text
);


--
-- Name: licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_key character varying(128) NOT NULL,
    organization_name character varying(255) NOT NULL,
    email character varying(255),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    license_type character varying(50) NOT NULL,
    issued_at timestamp without time zone NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    max_users integer DEFAULT 50 NOT NULL,
    max_facilities integer DEFAULT 1 NOT NULL,
    enabled_modules jsonb,
    features jsonb,
    hardware_id character varying(255),
    last_validated_at timestamp without time zone,
    validation_failures integer DEFAULT 0 NOT NULL,
    signature text,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: login_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.login_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid,
    ip_address character varying(45),
    user_agent character varying(500),
    success boolean DEFAULT true NOT NULL,
    failure_reason character varying(255),
    login_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: master_data_approval_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_data_approval_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid,
    entity_type public.master_data_approval_rules_entity_type_enum NOT NULL,
    requires_approval boolean DEFAULT false NOT NULL,
    approver_role_id uuid,
    min_approvers integer DEFAULT 1 NOT NULL,
    notify_on_change boolean DEFAULT false NOT NULL,
    notification_emails jsonb,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: master_data_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_data_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid,
    entity_type public.master_data_versions_entity_type_enum NOT NULL,
    entity_id uuid NOT NULL,
    version_number integer NOT NULL,
    action public.master_data_versions_action_enum NOT NULL,
    previous_data jsonb,
    current_data jsonb NOT NULL,
    changed_fields jsonb,
    change_reason text,
    changed_by uuid NOT NULL,
    approval_status public.master_data_versions_approval_status_enum DEFAULT 'auto_approved'::public.master_data_versions_approval_status_enum NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    approval_notes text,
    ip_address character varying(50),
    user_agent character varying(255)
);


--
-- Name: medication_adherence_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_adherence_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    patient_id character varying NOT NULL,
    prescription_item_id uuid NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time character varying(10) NOT NULL,
    taken_at timestamp with time zone,
    skipped_at timestamp with time zone,
    skip_reason text,
    status public.medication_adherence_records_status_enum DEFAULT 'pending'::public.medication_adherence_records_status_enum NOT NULL
);


--
-- Name: medication_administrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medication_administrations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    prescription_id uuid,
    prescription_item_id uuid,
    admission_id uuid,
    drug_name character varying,
    dose character varying,
    route character varying,
    scheduled_time timestamp with time zone,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    administered_by_id uuid,
    witness_id character varying,
    administered_at timestamp with time zone,
    dose_given numeric(10,4),
    route_of_administration character varying,
    notes text,
    batch_number character varying,
    reason text,
    is_controlled_substance boolean DEFAULT false NOT NULL
);


--
-- Name: membership_schemes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membership_schemes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    type public.membership_schemes_type_enum DEFAULT 'regular'::public.membership_schemes_type_enum NOT NULL,
    description text,
    discount_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    credit_limit numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    requires_approval boolean DEFAULT false NOT NULL,
    valid_days integer DEFAULT 365 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    benefits jsonb,
    facility_id uuid
);


--
-- Name: notification_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    type public.notification_configs_type_enum NOT NULL,
    provider public.notification_configs_provider_enum,
    is_enabled boolean DEFAULT false NOT NULL,
    smtp_host character varying(255),
    smtp_port integer,
    smtp_secure boolean DEFAULT true NOT NULL,
    smtp_user character varying(255),
    smtp_password character varying(255),
    from_email character varying(255),
    from_name character varying(255),
    sms_api_url character varying(255),
    sms_api_key character varying(255),
    sms_api_secret character varying(255),
    sms_sender_id character varying(50),
    sms_username character varying(255),
    extra_config jsonb,
    last_tested_at timestamp without time zone,
    test_successful boolean DEFAULT false NOT NULL
);


--
-- Name: nursing_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nursing_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    type public.nursing_notes_type_enum DEFAULT 'observation'::public.nursing_notes_type_enum NOT NULL,
    content text NOT NULL,
    "noteTime" timestamp without time zone DEFAULT now() NOT NULL,
    shift character varying,
    vitals jsonb,
    "intakeOutput" jsonb,
    "admissionId" uuid NOT NULL,
    "nurseId" uuid NOT NULL
);


--
-- Name: onboarding_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    task_name character varying NOT NULL,
    description text,
    category public.onboarding_tasks_category_enum DEFAULT 'other'::public.onboarding_tasks_category_enum NOT NULL,
    status public.onboarding_tasks_status_enum DEFAULT 'pending'::public.onboarding_tasks_status_enum NOT NULL,
    due_date date,
    completed_at timestamp without time zone,
    completed_by_id uuid,
    assigned_to_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    notes text,
    facility_id character varying,
    tenant_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    order_number character varying NOT NULL,
    order_type public.orders_order_type_enum NOT NULL,
    status public.orders_status_enum DEFAULT 'pending'::public.orders_status_enum NOT NULL,
    priority public.orders_priority_enum DEFAULT 'routine'::public.orders_priority_enum NOT NULL,
    instructions text,
    clinical_notes text,
    test_codes jsonb,
    completed_at timestamp with time zone,
    assigned_to character varying,
    encounter_id uuid NOT NULL,
    ordered_by_id uuid NOT NULL,
    completed_by_id uuid,
    reviewed_by_id uuid,
    reviewed_at timestamp with time zone
);


--
-- Name: password_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid NOT NULL,
    password_hash character varying(255) NOT NULL,
    changed_at timestamp without time zone NOT NULL
);


--
-- Name: password_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_policies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid,
    name character varying(100) NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    min_length integer DEFAULT 8 NOT NULL,
    max_length integer DEFAULT 128 NOT NULL,
    require_uppercase boolean DEFAULT true NOT NULL,
    require_lowercase boolean DEFAULT true NOT NULL,
    require_numbers boolean DEFAULT true NOT NULL,
    require_special_chars boolean DEFAULT true NOT NULL,
    allowed_special_chars character varying(100),
    expiry_days integer DEFAULT 90 NOT NULL,
    password_history_count integer DEFAULT 5 NOT NULL,
    max_failed_attempts integer DEFAULT 5 NOT NULL,
    lockout_duration_minutes integer DEFAULT 30 NOT NULL,
    require_mfa boolean DEFAULT false NOT NULL,
    min_age_days integer DEFAULT 0 NOT NULL,
    common_passwords_blacklist jsonb,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: patient_chronic_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_chronic_conditions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    diagnosis_id uuid NOT NULL,
    status public.patient_chronic_conditions_status_enum DEFAULT 'active'::public.patient_chronic_conditions_status_enum NOT NULL,
    diagnosed_date date NOT NULL,
    notes text,
    next_follow_up date,
    follow_up_interval_days integer DEFAULT 30 NOT NULL,
    reminder_enabled boolean DEFAULT true NOT NULL,
    reminder_days_before integer DEFAULT 3 NOT NULL,
    primary_doctor_id uuid,
    current_medications jsonb,
    last_visit timestamp without time zone,
    registered_by uuid
);


--
-- Name: patient_credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_credit_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    note_number character varying NOT NULL,
    invoice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    type public.patient_credit_notes_type_enum DEFAULT 'credit'::public.patient_credit_notes_type_enum NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    status public.patient_credit_notes_status_enum DEFAULT 'draft'::public.patient_credit_notes_status_enum NOT NULL,
    created_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    applied_at timestamp without time zone
);


--
-- Name: patient_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_deposits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    deposit_number character varying NOT NULL,
    patient_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    payment_method character varying NOT NULL,
    payment_reference character varying,
    status public.patient_deposits_status_enum DEFAULT 'active'::public.patient_deposits_status_enum NOT NULL,
    received_by uuid NOT NULL,
    notes text
);


--
-- Name: patient_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    patient_id uuid NOT NULL,
    category character varying(50) NOT NULL,
    document_name character varying(255) NOT NULL,
    description text,
    file_path character varying(500) NOT NULL,
    file_type character varying(100),
    file_size integer,
    original_filename character varying(255),
    source_type character varying(50),
    source_id uuid,
    document_date date,
    notes text,
    tags text,
    uploaded_by uuid NOT NULL,
    is_confidential boolean DEFAULT false NOT NULL,
    access_count integer DEFAULT 0 NOT NULL,
    last_accessed_at timestamp without time zone,
    last_accessed_by uuid
);


--
-- Name: patient_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_memberships (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    membership_number character varying NOT NULL,
    patient_id character varying NOT NULL,
    scheme_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    corporate_name character varying,
    employee_id character varying,
    metadata jsonb
);


--
-- Name: patient_merges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_merges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    primary_patient_id uuid NOT NULL,
    secondary_patient_id uuid NOT NULL,
    merged_by_id uuid NOT NULL,
    secondary_patient_snapshot jsonb,
    merged_data_summary jsonb,
    reason text
);


--
-- Name: patient_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    patient_id uuid NOT NULL,
    type character varying(50) DEFAULT 'administrative'::character varying NOT NULL,
    content text NOT NULL,
    created_by uuid NOT NULL
);


--
-- Name: patient_problems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_problems (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    diagnosis_id uuid,
    custom_diagnosis character varying(500),
    custom_icd_code character varying(20),
    status public.patient_problems_status_enum DEFAULT 'active'::public.patient_problems_status_enum NOT NULL,
    severity public.patient_problems_severity_enum,
    onset_date date NOT NULL,
    resolved_date date,
    notes text,
    diagnosed_by uuid,
    encounter_id uuid,
    last_reviewed_at timestamp without time zone,
    last_reviewed_by uuid
);


--
-- Name: patient_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_reminders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    type public.patient_reminders_type_enum NOT NULL,
    channel public.patient_reminders_channel_enum DEFAULT 'both'::public.patient_reminders_channel_enum NOT NULL,
    status public.patient_reminders_status_enum DEFAULT 'pending'::public.patient_reminders_status_enum NOT NULL,
    subject character varying(255) NOT NULL,
    message text NOT NULL,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    reference_type character varying(50),
    reference_id uuid,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    created_by uuid
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    mrn character varying(50) NOT NULL,
    user_id uuid,
    national_id character varying(50),
    full_name character varying(255) NOT NULL,
    gender character varying(20) NOT NULL,
    date_of_birth date NOT NULL,
    phone character varying(50),
    address text,
    email character varying(100),
    blood_group character varying(100),
    next_of_kin jsonb,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    metadata jsonb,
    allergies jsonb,
    marital_status character varying(50),
    occupation character varying(255),
    language character varying(100),
    photograph_url character varying(500)
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    receipt_number character varying NOT NULL,
    amount numeric(12,2) NOT NULL,
    method public.payments_method_enum NOT NULL,
    status public.payments_status_enum DEFAULT 'completed'::public.payments_status_enum NOT NULL,
    transaction_reference character varying,
    notes text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid NOT NULL,
    received_by_id uuid NOT NULL
);


--
-- Name: payroll_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payroll_number character varying(20) NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    pay_period_start date NOT NULL,
    pay_period_end date NOT NULL,
    payment_date date,
    status public.payroll_runs_status_enum DEFAULT 'draft'::public.payroll_runs_status_enum NOT NULL,
    employee_count integer DEFAULT 0 NOT NULL,
    total_gross numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_deductions numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_net numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_paye numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_nssf numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    facility_id uuid NOT NULL,
    tenant_id uuid,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payslips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payslips (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    payroll_run_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    basic_salary numeric(12,2) NOT NULL,
    allowances jsonb,
    overtime_pay numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    gross_salary numeric(12,2) NOT NULL,
    paye numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    nssf_employee numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    nssf_employer numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    other_deductions jsonb,
    total_deductions numeric(12,2) NOT NULL,
    net_salary numeric(12,2) NOT NULL,
    days_worked integer DEFAULT 0 NOT NULL,
    days_absent integer DEFAULT 0 NOT NULL,
    overtime_hours numeric(4,2) DEFAULT '0'::numeric NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    paid_date date,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: performance_appraisals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_appraisals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    facility_id uuid NOT NULL,
    tenant_id uuid,
    employee_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    appraisal_period public.performance_appraisals_appraisal_period_enum NOT NULL,
    year integer NOT NULL,
    status public.performance_appraisals_status_enum DEFAULT 'draft'::public.performance_appraisals_status_enum NOT NULL,
    job_knowledge_rating numeric(3,2),
    work_quality_rating numeric(3,2),
    attendance_rating numeric(3,2),
    communication_rating numeric(3,2),
    teamwork_rating numeric(3,2),
    initiative_rating numeric(3,2),
    overall_rating numeric(3,2),
    employee_comments text,
    reviewer_comments text,
    strengths text,
    areas_for_improvement text,
    goals text,
    questions jsonb,
    employee_answers jsonb,
    review_date date,
    acknowledged_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: permission_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(100) NOT NULL,
    description text
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    module character varying(100)
);


--
-- Name: petty_cash_funds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.petty_cash_funds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    imprest_amount numeric(12,2) NOT NULL,
    current_balance numeric(12,2) NOT NULL,
    custodian_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: petty_cash_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.petty_cash_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    fund_id uuid NOT NULL,
    type public.petty_cash_transactions_type_enum NOT NULL,
    amount numeric(12,2) NOT NULL,
    description character varying NOT NULL,
    receipt_reference character varying,
    category character varying,
    recorded_by uuid NOT NULL,
    approved_by uuid
);


--
-- Name: pharmacy_sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_sale_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    sale_id uuid NOT NULL,
    item_id character varying NOT NULL,
    item_code character varying NOT NULL,
    item_name character varying NOT NULL,
    batch_number character varying,
    expiry_date date,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    amount numeric(12,2) NOT NULL,
    instructions text
);


--
-- Name: pharmacy_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_sales (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    sale_number character varying NOT NULL,
    sale_type public.pharmacy_sales_sale_type_enum DEFAULT 'otc'::public.pharmacy_sales_sale_type_enum NOT NULL,
    status public.pharmacy_sales_status_enum DEFAULT 'pending'::public.pharmacy_sales_status_enum NOT NULL,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    discount_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    tax_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    amount_paid numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    payment_method character varying DEFAULT 'cash'::character varying NOT NULL,
    transaction_reference character varying,
    customer_name character varying,
    customer_phone character varying,
    notes text,
    prescription_id character varying,
    store_id uuid NOT NULL,
    patient_id uuid,
    sold_by_id uuid NOT NULL
);


--
-- Name: phone_home_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_home_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_id uuid NOT NULL,
    ip_address character varying(45) NOT NULL,
    hardware_id character varying(255),
    app_version character varying(50),
    active_users integer DEFAULT 0 NOT NULL,
    total_users integer DEFAULT 0 NOT NULL,
    total_patients integer DEFAULT 0 NOT NULL,
    total_encounters integer DEFAULT 0 NOT NULL,
    system_info jsonb,
    usage_stats jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pos_payment_splits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_payment_splits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    sale_id uuid NOT NULL,
    payment_method character varying NOT NULL,
    amount numeric(12,2) NOT NULL,
    transaction_reference character varying
);


--
-- Name: pos_registers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_registers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    location character varying,
    store_id uuid NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL
);


--
-- Name: pos_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_shifts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    register_id uuid NOT NULL,
    cashier_id uuid NOT NULL,
    opened_at timestamp without time zone NOT NULL,
    closed_at timestamp without time zone,
    opening_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    closing_balance numeric(12,2),
    expected_balance numeric(12,2),
    cash_sales numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    mobile_money_sales numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    card_sales numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    transaction_count integer DEFAULT 0 NOT NULL,
    cash_difference numeric(12,2),
    notes text,
    status character varying DEFAULT 'open'::character varying NOT NULL
);


--
-- Name: postnatal_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postnatal_visits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    registration_id uuid NOT NULL,
    delivery_outcome_id uuid,
    visit_number public.postnatal_visits_visit_number_enum NOT NULL,
    visit_date timestamp without time zone NOT NULL,
    days_postpartum integer NOT NULL,
    temperature numeric(4,1),
    bp_systolic integer,
    bp_diastolic integer,
    pulse_rate integer,
    respiratory_rate integer,
    uterus_well_contracted boolean,
    fundal_height_cm numeric(4,1),
    lochia_type public.postnatal_visits_lochia_type_enum,
    lochia_normal_amount boolean,
    lochia_foul_smelling boolean,
    perineum_intact boolean,
    wound_healing_well boolean,
    wound_infection_signs boolean,
    wound_notes text,
    breast_condition public.postnatal_visits_breast_condition_enum,
    breastfeeding_established boolean,
    breastfeeding_issues boolean,
    breastfeeding_notes text,
    epds_score integer,
    mental_health_risk public.postnatal_visits_mental_health_risk_enum,
    mental_health_referral boolean,
    heavy_bleeding boolean DEFAULT false NOT NULL,
    fever boolean DEFAULT false NOT NULL,
    severe_headache boolean DEFAULT false NOT NULL,
    blurred_vision boolean DEFAULT false NOT NULL,
    convulsions boolean DEFAULT false NOT NULL,
    breathing_difficulty boolean DEFAULT false NOT NULL,
    leg_swelling boolean DEFAULT false NOT NULL,
    iron_folate_given boolean DEFAULT false NOT NULL,
    vitamin_a_given boolean DEFAULT false NOT NULL,
    family_planning_counseling boolean DEFAULT false NOT NULL,
    contraceptive_method character varying(100),
    complaints text,
    examination text,
    diagnosis text,
    treatment text,
    notes text,
    next_visit_date timestamp without time zone,
    seen_by_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pre_authorizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pre_authorizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    auth_number character varying NOT NULL,
    policy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    auth_type public.pre_authorizations_auth_type_enum NOT NULL,
    status public.pre_authorizations_status_enum DEFAULT 'pending'::public.pre_authorizations_status_enum NOT NULL,
    requested_by_id uuid NOT NULL,
    requested_at timestamp without time zone DEFAULT now() NOT NULL,
    primary_diagnosis character varying NOT NULL,
    diagnosis_code character varying,
    clinical_justification text NOT NULL,
    proposed_treatment text NOT NULL,
    estimated_cost numeric(15,2) NOT NULL,
    approved_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    expected_admission_date date,
    expected_discharge_date date,
    expected_los_days integer,
    valid_from date,
    valid_until date,
    insurer_reference character varying,
    approved_by_insurer character varying,
    approved_at timestamp without time zone,
    denial_reason character varying,
    notes text,
    attachments jsonb,
    metadata jsonb
);


--
-- Name: prescription_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    drug_code character varying NOT NULL,
    drug_name character varying NOT NULL,
    dose character varying NOT NULL,
    frequency character varying NOT NULL,
    duration character varying NOT NULL,
    quantity integer NOT NULL,
    quantity_dispensed integer DEFAULT 0 NOT NULL,
    instructions text,
    is_dispensed boolean DEFAULT false NOT NULL,
    prescription_id uuid NOT NULL
);


--
-- Name: prescription_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(255) NOT NULL,
    description text,
    condition character varying(255),
    department character varying(255),
    scope character varying(20) DEFAULT 'personal'::character varying NOT NULL,
    created_by_id uuid NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    facility_id uuid
);


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    prescription_number character varying NOT NULL,
    status public.prescriptions_status_enum DEFAULT 'pending'::public.prescriptions_status_enum NOT NULL,
    notes text,
    dispensing_started_at timestamp with time zone,
    dispensed_at timestamp with time zone,
    ready_at timestamp with time zone,
    collected_at timestamp with time zone,
    prescriber_signature text,
    prescriber_signed_at timestamp with time zone,
    dispenser_signature text,
    dispenser_signed_at timestamp with time zone,
    signature_verified boolean DEFAULT false NOT NULL,
    encounter_id uuid NOT NULL,
    prescribed_by_id uuid NOT NULL
);


--
-- Name: price_agreements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_agreements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    supplier_id uuid NOT NULL,
    item_id character varying,
    item_code character varying NOT NULL,
    item_name character varying NOT NULL,
    category character varying,
    unit_price numeric(12,2) NOT NULL,
    unit character varying DEFAULT 'unit'::character varying NOT NULL,
    valid_from date NOT NULL,
    valid_to date NOT NULL,
    status public.price_agreements_status_enum DEFAULT 'draft'::public.price_agreements_status_enum NOT NULL,
    "volumeDiscounts" jsonb,
    "priceHistory" jsonb,
    is_best_price boolean DEFAULT false NOT NULL,
    notes text,
    facility_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    approved_by_id uuid
);


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(100) NOT NULL,
    description text,
    rule_type public.pricing_rules_rule_type_enum NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    discount_type public.pricing_rules_discount_type_enum NOT NULL,
    discount_value numeric(12,2),
    min_amount numeric(12,2),
    max_discount numeric(12,2),
    can_stack boolean DEFAULT false NOT NULL,
    stack_with_types character varying(200),
    applies_to public.pricing_rules_applies_to_enum DEFAULT 'all'::public.pricing_rules_applies_to_enum NOT NULL,
    conditions jsonb,
    is_active boolean DEFAULT true NOT NULL,
    valid_from date,
    valid_to date,
    facility_id uuid,
    created_by_id uuid
);


--
-- Name: pricing_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_tiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    discount_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    min_order_amount integer DEFAULT 0 NOT NULL,
    description text,
    status character varying DEFAULT 'active'::character varying NOT NULL
);


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid,
    facility_id uuid NOT NULL,
    department_id uuid,
    full_name character varying(255) NOT NULL,
    title character varying(10),
    provider_type public.providers_provider_type_enum DEFAULT 'physician'::public.providers_provider_type_enum NOT NULL,
    specialty character varying(100),
    sub_specialty character varying(100),
    license_number character varying(100),
    license_expiry date,
    registration_number character varying(100),
    regulatory_body character varying(255),
    qualifications jsonb,
    email character varying(255),
    phone character varying(50),
    can_prescribe boolean DEFAULT true NOT NULL,
    can_order_labs boolean DEFAULT true NOT NULL,
    can_order_imaging boolean DEFAULT true NOT NULL,
    can_admit boolean DEFAULT false NOT NULL,
    can_perform_surgery boolean DEFAULT false NOT NULL,
    consultation_fee numeric(10,2),
    available_days jsonb,
    available_from time without time zone,
    available_to time without time zone,
    max_patients_per_day integer,
    signature character varying(500),
    status public.providers_status_enum DEFAULT 'active'::public.providers_status_enum NOT NULL,
    notes text
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    quantity_ordered integer NOT NULL,
    quantity_received integer DEFAULT 0 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    discount_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    line_total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    purchase_order_id uuid NOT NULL,
    item_id character varying NOT NULL,
    item_code character varying NOT NULL,
    item_name character varying NOT NULL,
    item_unit character varying DEFAULT 'unit'::character varying NOT NULL
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    order_number character varying NOT NULL,
    status public.purchase_orders_status_enum DEFAULT 'draft'::public.purchase_orders_status_enum NOT NULL,
    order_date date NOT NULL,
    expected_delivery date,
    payment_terms character varying,
    delivery_address text,
    subtotal numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    tax_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    discount_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    terms text,
    notes text,
    approved_at timestamp with time zone,
    sent_at timestamp with time zone,
    facility_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_request_id uuid,
    rfq_id uuid,
    quotation_id uuid,
    created_from character varying,
    created_by_id uuid NOT NULL,
    approved_by_id uuid
);


--
-- Name: purchase_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_request_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    quantity_requested integer NOT NULL,
    quantity_approved integer,
    quantity_ordered integer DEFAULT 0 NOT NULL,
    unit_price_estimated numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    specifications text,
    notes text,
    purchase_request_id uuid NOT NULL,
    item_id character varying NOT NULL,
    item_code character varying NOT NULL,
    item_name character varying NOT NULL,
    item_unit character varying DEFAULT 'unit'::character varying NOT NULL
);


--
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    request_number character varying NOT NULL,
    status public.purchase_requests_status_enum DEFAULT 'draft'::public.purchase_requests_status_enum NOT NULL,
    priority public.purchase_requests_priority_enum DEFAULT 'normal'::public.purchase_requests_priority_enum NOT NULL,
    justification text,
    required_date date,
    total_estimated numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    approved_at timestamp with time zone,
    rejection_reason text,
    facility_id uuid NOT NULL,
    department_id uuid,
    requested_by_id uuid NOT NULL,
    approved_by_id uuid
);


--
-- Name: qc_levey_jennings_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qc_levey_jennings_data (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    qc_material_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    data_date date NOT NULL,
    calculated_mean numeric(15,4) NOT NULL,
    calculated_sd numeric(15,4) NOT NULL,
    calculated_cv numeric(10,4) NOT NULL,
    data_points integer NOT NULL,
    in_control_count integer DEFAULT 0 NOT NULL,
    out_of_control_count integer DEFAULT 0 NOT NULL,
    plus_1sd numeric(15,4) NOT NULL,
    plus_2sd numeric(15,4) NOT NULL,
    plus_3sd numeric(15,4) NOT NULL,
    minus_1sd numeric(15,4) NOT NULL,
    minus_2sd numeric(15,4) NOT NULL,
    minus_3sd numeric(15,4) NOT NULL
);


--
-- Name: qc_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qc_materials (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    manufacturer character varying(100),
    lot_number character varying(100),
    expiry_date date,
    level public.qc_materials_level_enum NOT NULL,
    test_code character varying(100) NOT NULL,
    test_name character varying(255) NOT NULL,
    target_mean numeric(15,4) NOT NULL,
    target_sd numeric(15,4) NOT NULL,
    target_cv numeric(15,4),
    acceptable_range_low numeric(15,4),
    acceptable_range_high numeric(15,4),
    unit character varying(50),
    equipment_id uuid,
    storage_temperature character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    notes text
);


--
-- Name: qc_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qc_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    qc_material_id uuid NOT NULL,
    equipment_id uuid,
    test_code character varying(100) NOT NULL,
    run_date timestamp without time zone NOT NULL,
    result_value numeric(15,4) NOT NULL,
    unit character varying(50),
    target_mean numeric(15,4) NOT NULL,
    target_sd numeric(15,4) NOT NULL,
    z_score numeric(10,4) NOT NULL,
    status public.qc_results_status_enum DEFAULT 'not_evaluated'::public.qc_results_status_enum NOT NULL,
    violated_rules text,
    performed_by uuid NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    corrective_action text,
    is_repeat boolean DEFAULT false NOT NULL,
    comments text,
    reagent_lot character varying(100),
    calibrator_lot character varying(100)
);


--
-- Name: queue_displays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_displays (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    display_code character varying NOT NULL,
    service_points jsonb NOT NULL,
    facility_id uuid NOT NULL,
    department_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    display_settings jsonb
);


--
-- Name: queues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queues (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    ticket_number character varying NOT NULL,
    queue_date date NOT NULL,
    "servicePoint" public.queues_servicepoint_enum DEFAULT 'registration'::public.queues_servicepoint_enum NOT NULL,
    status public.queues_status_enum DEFAULT 'waiting'::public.queues_status_enum NOT NULL,
    priority public.queues_priority_enum DEFAULT '10'::public.queues_priority_enum NOT NULL,
    priority_reason character varying,
    sequence_number integer NOT NULL,
    estimated_wait_minutes integer,
    actual_wait_minutes integer,
    service_duration_minutes integer,
    called_at timestamp with time zone,
    service_started_at timestamp with time zone,
    service_ended_at timestamp with time zone,
    call_count integer DEFAULT 0 NOT NULL,
    counter_number character varying,
    room_number character varying,
    notes text,
    skip_reason text,
    transfer_reason text,
    next_service_point character varying,
    visit_type character varying(50),
    chief_complaint_at_token text,
    patient_condition_flags jsonb,
    on_hold boolean DEFAULT false NOT NULL,
    hold_reason text,
    hold_started_at timestamp with time zone,
    previous_service_point character varying,
    previous_queue_id character varying,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    facility_id uuid NOT NULL,
    department_id uuid,
    serving_user_id uuid,
    created_by_id uuid NOT NULL,
    assigned_doctor_id uuid
);


--
-- Name: quotation_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotation_approvals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    quotation_id uuid NOT NULL,
    level public.quotation_approvals_level_enum NOT NULL,
    status public.quotation_approvals_status_enum DEFAULT 'pending'::public.quotation_approvals_status_enum NOT NULL,
    approver_id uuid,
    approved_at timestamp with time zone,
    comments text,
    self_approved boolean DEFAULT false NOT NULL,
    justification text
);


--
-- Name: reagent_consumptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reagent_consumptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    lot_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    lab_order_id uuid,
    test_code character varying(50),
    quantity_used numeric(10,2) NOT NULL,
    unit character varying(50),
    consumed_at timestamp without time zone NOT NULL,
    consumed_by uuid,
    notes text
);


--
-- Name: reagent_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reagent_lots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    reagent_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    lot_number character varying(100) NOT NULL,
    expiry_date date NOT NULL,
    received_date date NOT NULL,
    opened_date date,
    initial_quantity integer NOT NULL,
    current_quantity integer NOT NULL,
    unit_cost numeric(15,2),
    supplier_name character varying(100),
    po_number character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    is_qc_passed boolean DEFAULT false NOT NULL,
    qc_date date,
    notes text
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    referral_number character varying NOT NULL,
    type public.referrals_type_enum DEFAULT 'external'::public.referrals_type_enum NOT NULL,
    status public.referrals_status_enum DEFAULT 'pending'::public.referrals_status_enum NOT NULL,
    priority public.referrals_priority_enum DEFAULT 'routine'::public.referrals_priority_enum NOT NULL,
    reason public.referrals_reason_enum DEFAULT 'specialist_consultation'::public.referrals_reason_enum NOT NULL,
    reason_details text,
    clinical_summary text NOT NULL,
    provisional_diagnosis text,
    diagnosis_codes jsonb,
    vital_signs jsonb,
    investigations_done jsonb,
    treatment_given text,
    referring_department character varying,
    referred_to_department character varying,
    referred_to_specialty character varying,
    appointment_date timestamp with time zone,
    appointment_time character varying,
    transport_mode character varying,
    escort_required boolean DEFAULT false NOT NULL,
    escort_name character varying,
    escort_phone character varying,
    expiry_date timestamp with time zone,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    rejection_reason text,
    feedback_notes text,
    attachments jsonb,
    patient_id uuid NOT NULL,
    source_encounter_id uuid,
    destination_encounter_id uuid,
    from_facility_id uuid NOT NULL,
    to_facility_id uuid,
    external_facility_name character varying,
    external_facility_address character varying,
    external_facility_phone character varying,
    referred_by_id uuid NOT NULL,
    accepted_by_id uuid,
    community_health_worker_name character varying,
    community_health_worker_phone character varying
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid,
    token_hash character varying(64) NOT NULL,
    token_family character varying(64) NOT NULL,
    is_revoked boolean DEFAULT false NOT NULL,
    replaced_by_hash character varying(64),
    ip_address character varying(45),
    user_agent character varying(500),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: release_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.release_candidates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "appVersionId" uuid NOT NULL,
    stage public.release_candidates_stage_enum DEFAULT 'alpha'::public.release_candidates_stage_enum NOT NULL,
    "releaseNotes" text,
    "testingNotes" text,
    "testersCount" integer DEFAULT 0 NOT NULL,
    "deploymentCountRisk" integer DEFAULT 0 NOT NULL,
    "knownIssues" jsonb,
    "performanceMetrics" jsonb,
    "approvedForRollout" boolean DEFAULT false NOT NULL,
    "approvedBy" uuid,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "approvedAt" timestamp without time zone,
    app_version_id uuid NOT NULL
);


--
-- Name: replication_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replication_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tenantId" uuid NOT NULL,
    "deploymentId" uuid,
    "entityType" public.replication_logs_entitytype_enum NOT NULL,
    "entityId" uuid NOT NULL,
    "operationType" public.replication_logs_operationtype_enum NOT NULL,
    status public.replication_logs_status_enum DEFAULT 'pending'::public.replication_logs_status_enum NOT NULL,
    "oldData" jsonb NOT NULL,
    "newData" jsonb NOT NULL,
    "changeSet" jsonb,
    "failureReason" text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 0 NOT NULL,
    "sentAt" timestamp without time zone,
    "acknowledgedAt" timestamp without time zone,
    "changedBy" uuid,
    "changeReason" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "processedAt" timestamp without time zone,
    tenant_id uuid NOT NULL,
    deployment_id uuid,
    "changesetCount" integer
);


--
-- Name: rfq_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfq_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    item_code character varying NOT NULL,
    item_name character varying NOT NULL,
    quantity integer NOT NULL,
    unit character varying DEFAULT 'unit'::character varying NOT NULL,
    specifications text,
    rfq_id uuid NOT NULL
);


--
-- Name: rfq_vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfq_vendors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    rfq_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    has_responded boolean DEFAULT false NOT NULL,
    response_date timestamp with time zone,
    reminder_sent boolean DEFAULT false NOT NULL,
    reminder_sent_at timestamp with time zone
);


--
-- Name: rfqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfqs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    rfq_number character varying NOT NULL,
    title character varying NOT NULL,
    status public.rfqs_status_enum DEFAULT 'draft'::public.rfqs_status_enum NOT NULL,
    deadline date NOT NULL,
    sent_date timestamp with time zone,
    closed_date timestamp with time zone,
    notes text,
    instructions text,
    purchase_request_id uuid,
    facility_id uuid NOT NULL,
    created_by_id uuid NOT NULL
);


--
-- Name: role_permission_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permission_groups (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    role_id uuid NOT NULL,
    group_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(100) NOT NULL,
    description text,
    is_system_role boolean DEFAULT true NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    parent_role_id uuid
);


--
-- Name: rx_notification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rx_notification_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    prescription_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    notification_type character varying(50) NOT NULL,
    channel character varying(20) DEFAULT 'sms'::character varying NOT NULL,
    phone_number character varying(30) NOT NULL,
    message text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    external_id character varying(255),
    error_message text,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: salary_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    previous_salary numeric(12,2),
    new_salary numeric(12,2) NOT NULL,
    previous_title character varying,
    new_title character varying,
    previous_department character varying,
    new_department character varying,
    change_type public.salary_history_change_type_enum NOT NULL,
    effective_date date NOT NULL,
    reason character varying,
    approved_by_id uuid,
    notes text,
    facility_id character varying,
    tenant_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sample_referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sample_referrals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    "referralNumber" character varying NOT NULL,
    "sampleId" uuid NOT NULL,
    "patientId" uuid NOT NULL,
    "fromFacilityId" uuid NOT NULL,
    "toFacilityId" uuid NOT NULL,
    stage public.sample_referrals_stage_enum DEFAULT 'collected'::public.sample_referrals_stage_enum NOT NULL,
    "testRequested" character varying,
    "clinicalInfo" text,
    priority public.sample_referrals_priority_enum DEFAULT 'ROUTINE'::public.sample_referrals_priority_enum NOT NULL,
    "collectedAt" timestamp with time zone,
    "packagedAt" timestamp with time zone,
    "shippedAt" timestamp with time zone,
    "receivedAtHubAt" timestamp with time zone,
    "processingStartedAt" timestamp with time zone,
    "resultReadyAt" timestamp with time zone,
    "resultDeliveredAt" timestamp with time zone,
    "rejectedAt" timestamp with time zone,
    "rejectionReason" text,
    "transportMethod" character varying,
    "transporterName" character varying,
    "transporterPhone" character varying,
    "temperatureOnArrival" numeric(5,2),
    "sampleConditionOnArrival" character varying,
    notes text,
    "collectedById" uuid,
    "receivedById" uuid
);


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: service_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_packages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    package_price numeric(12,2) NOT NULL,
    valid_days integer DEFAULT 30 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    "includedServices" jsonb
);


--
-- Name: service_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_prices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    service_id uuid NOT NULL,
    tier public.service_prices_tier_enum NOT NULL,
    price numeric(12,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    facility_id uuid
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    category_id uuid NOT NULL,
    tier public.services_tier_enum DEFAULT 'standard'::public.services_tier_enum NOT NULL,
    base_price numeric(12,2) NOT NULL,
    is_package boolean DEFAULT false NOT NULL,
    department character varying,
    duration_minutes integer,
    requires_appointment boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    metadata jsonb,
    facility_id uuid
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid,
    token_hash character varying(64) NOT NULL,
    ip_address character varying(45),
    user_agent character varying(500),
    device_info character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    last_activity_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shift_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    shift_type public.shift_definitions_shift_type_enum NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_hours numeric(4,2) NOT NULL,
    crosses_midnight boolean DEFAULT false NOT NULL,
    break_minutes integer DEFAULT 0 NOT NULL,
    department_id uuid,
    min_staff integer DEFAULT 1 NOT NULL,
    max_staff integer,
    pay_multiplier numeric(3,2) DEFAULT '1'::numeric NOT NULL,
    color character varying(7),
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: shift_swap_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_swap_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    requester_id uuid NOT NULL,
    requester_roster_id uuid NOT NULL,
    target_employee_id uuid NOT NULL,
    target_roster_id uuid,
    is_mutual_swap boolean DEFAULT false NOT NULL,
    reason text NOT NULL,
    status public.shift_swap_requests_status_enum DEFAULT 'pending'::public.shift_swap_requests_status_enum NOT NULL,
    target_accepted boolean,
    target_responded_at timestamp without time zone,
    approved_by_id uuid,
    approved_at timestamp without time zone,
    rejection_reason text,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sms_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    type public.sms_templates_type_enum NOT NULL,
    name character varying(100) NOT NULL,
    "smsTemplate" text NOT NULL,
    "whatsappTemplate" text,
    "emailSubject" text,
    "emailTemplate" text,
    is_active boolean DEFAULT true NOT NULL,
    variables jsonb
);


--
-- Name: staff_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    document_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_type character varying(100),
    file_size integer,
    license_number character varying(100),
    issuing_authority character varying(255),
    issue_date date,
    expiry_date date,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    verified_by uuid,
    verified_at timestamp without time zone
);


--
-- Name: staff_rosters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_rosters (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    shift_definition_id uuid NOT NULL,
    roster_date date NOT NULL,
    status public.staff_rosters_status_enum DEFAULT 'scheduled'::public.staff_rosters_status_enum NOT NULL,
    actual_start_time time without time zone,
    actual_end_time time without time zone,
    hours_worked numeric(5,2),
    overtime_hours numeric(5,2),
    original_employee_id uuid,
    notes text,
    absence_reason text,
    created_by_id uuid NOT NULL,
    confirmed_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_balances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    total_quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0 NOT NULL,
    available_quantity integer DEFAULT 0 NOT NULL,
    last_movement_at timestamp with time zone,
    item_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    store_id uuid
);


--
-- Name: stock_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_ledger (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    batch_number character varying,
    expiry_date date,
    quantity integer NOT NULL,
    balance_after integer NOT NULL,
    movement_type public.stock_ledger_movement_type_enum NOT NULL,
    unit_cost numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    reference_type character varying,
    reference_id character varying,
    notes text,
    item_id uuid NOT NULL,
    facility_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    store_id uuid
);


--
-- Name: stock_transfer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfer_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    transfer_id uuid NOT NULL,
    item_id uuid NOT NULL,
    batch_number character varying NOT NULL,
    expiry_date date NOT NULL,
    requested_quantity integer NOT NULL,
    approved_quantity integer,
    received_quantity integer,
    unit_cost numeric(10,2) NOT NULL,
    notes text
);


--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    transfer_number character varying NOT NULL,
    from_facility_id uuid,
    to_facility_id uuid,
    from_store_id uuid,
    to_store_id uuid,
    status public.stock_transfers_status_enum DEFAULT 'requested'::public.stock_transfers_status_enum NOT NULL,
    reason public.stock_transfers_reason_enum,
    notes text,
    requested_by_id uuid NOT NULL,
    approved_by_id uuid,
    approved_at timestamp with time zone,
    received_by_id uuid,
    received_at timestamp with time zone,
    shipped_at timestamp with time zone,
    rejection_reason text,
    cancellation_reason text
);


--
-- Name: storage_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storage_conditions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    min_temp numeric(5,2),
    max_temp numeric(5,2),
    instructions text,
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    type public.stores_type_enum DEFAULT 'main'::public.stores_type_enum NOT NULL,
    description text,
    location text,
    is_active boolean DEFAULT true NOT NULL,
    can_dispense boolean DEFAULT false NOT NULL,
    can_issue boolean DEFAULT true NOT NULL,
    can_receive boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL,
    department_id uuid,
    manager_id uuid
);


--
-- Name: supplier_credit_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_credit_note_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    credit_note_id uuid NOT NULL,
    item_id uuid,
    description character varying(255) NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit character varying(50),
    unit_price numeric(15,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    tax_amount numeric(15,2) NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    batch_number character varying(100)
);


--
-- Name: supplier_credit_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_credit_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    note_number character varying(50) NOT NULL,
    note_type public.supplier_credit_notes_note_type_enum NOT NULL,
    supplier_id uuid NOT NULL,
    note_date date NOT NULL,
    supplier_invoice_number character varying(100),
    grn_id uuid,
    reason public.supplier_credit_notes_reason_enum NOT NULL,
    reason_details text,
    subtotal_amount numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    total_amount numeric(15,2) NOT NULL,
    status public.supplier_credit_notes_status_enum DEFAULT 'draft'::public.supplier_credit_notes_status_enum NOT NULL,
    applied_amount numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    balance_amount numeric(15,2) NOT NULL,
    created_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    notes text
);


--
-- Name: supplier_payment_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_payment_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    payment_id uuid NOT NULL,
    description character varying(255) NOT NULL,
    invoice_number character varying(100),
    invoice_date date,
    amount numeric(15,2) NOT NULL,
    grn_id uuid
);


--
-- Name: supplier_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    voucher_number character varying(50) NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_order_id uuid,
    payment_date date NOT NULL,
    gross_amount numeric(15,2) NOT NULL,
    withholding_tax numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    other_deductions numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    net_amount numeric(15,2) NOT NULL,
    payment_method public.supplier_payments_payment_method_enum NOT NULL,
    cheque_number character varying(100),
    bank_reference character varying(100),
    bank_name character varying(255),
    account_number character varying(100),
    status public.supplier_payments_status_enum DEFAULT 'draft'::public.supplier_payments_status_enum NOT NULL,
    description text,
    remarks text,
    prepared_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    paid_by uuid,
    paid_at timestamp without time zone,
    journal_entry_id uuid
);


--
-- Name: supplier_return_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_return_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    supplier_return_id uuid NOT NULL,
    item_id uuid NOT NULL,
    batch_number character varying,
    expiry_date date,
    quantity integer NOT NULL,
    unit_value numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    total_value numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    notes text
);


--
-- Name: supplier_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_returns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    return_number character varying NOT NULL,
    supplier_id uuid NOT NULL,
    status public.supplier_returns_status_enum DEFAULT 'pending'::public.supplier_returns_status_enum NOT NULL,
    reason public.supplier_returns_reason_enum NOT NULL,
    authorization_number character varying,
    credit_note_number character varying,
    total_value numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    expected_credit numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    actual_credit numeric(10,2),
    shipping_date date,
    received_date date,
    notes text,
    facility_id uuid NOT NULL,
    created_by_id uuid NOT NULL
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    code character varying NOT NULL,
    name character varying NOT NULL,
    type public.suppliers_type_enum DEFAULT 'general'::public.suppliers_type_enum NOT NULL,
    contact_person character varying,
    email character varying,
    phone character varying,
    alt_phone character varying,
    address text,
    city character varying,
    country character varying,
    tax_id character varying,
    payment_terms character varying,
    credit_limit numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    bank_name character varying,
    bank_account character varying,
    status public.suppliers_status_enum DEFAULT 'active'::public.suppliers_status_enum NOT NULL,
    notes text,
    facility_id uuid NOT NULL
);


--
-- Name: support_access_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_access_grants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    granted_to_id uuid NOT NULL,
    access_tier integer DEFAULT 1 NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    granted_by_id uuid NOT NULL,
    reason text,
    revoked_at timestamp without time zone,
    revoked_by_id uuid
);


--
-- Name: support_access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_access_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    requested_by_id uuid NOT NULL,
    requested_tier integer DEFAULT 2 NOT NULL,
    requested_duration_hours integer DEFAULT 4 NOT NULL,
    reason text NOT NULL,
    status public.support_access_requests_status_enum DEFAULT 'pending'::public.support_access_requests_status_enum NOT NULL,
    reviewed_by_id uuid,
    reviewed_at timestamp without time zone,
    review_notes text
);


--
-- Name: surgery_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surgery_cases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    case_number character varying(20) NOT NULL,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    theatre_id uuid NOT NULL,
    procedure_name character varying(200) NOT NULL,
    procedure_code character varying(20),
    diagnosis text,
    surgery_type public.surgery_cases_surgery_type_enum DEFAULT 'major'::public.surgery_cases_surgery_type_enum NOT NULL,
    priority public.surgery_cases_priority_enum DEFAULT 'elective'::public.surgery_cases_priority_enum NOT NULL,
    status public.surgery_cases_status_enum DEFAULT 'scheduled'::public.surgery_cases_status_enum NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time time without time zone NOT NULL,
    estimated_duration_minutes integer NOT NULL,
    actual_start_time timestamp without time zone,
    actual_end_time timestamp without time zone,
    lead_surgeon_id uuid NOT NULL,
    assistant_surgeon_id uuid,
    anesthesiologist_id uuid,
    nursing_team jsonb,
    anesthesia_type public.surgery_cases_anesthesia_type_enum,
    anesthesia_notes text,
    pre_op_checklist jsonb,
    pre_op_notes text,
    consent_signed boolean DEFAULT false NOT NULL,
    consent_signed_at timestamp without time zone,
    blood_available boolean DEFAULT false NOT NULL,
    blood_group text,
    operative_findings text,
    operative_notes text,
    complications jsonb,
    blood_loss_ml integer,
    specimens_collected jsonb,
    post_op_instructions text,
    post_op_diagnosis text,
    recovery_notes text,
    discharge_from_theatre timestamp without time zone,
    discharge_destination text,
    facility_id uuid NOT NULL,
    created_by_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: surgery_consumables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surgery_consumables (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    surgery_case_id uuid NOT NULL,
    item_id uuid NOT NULL,
    item_code character varying(50) NOT NULL,
    item_name character varying(255) NOT NULL,
    category public.surgery_consumables_category_enum DEFAULT 'surgical_supplies'::public.surgery_consumables_category_enum NOT NULL,
    quantity_used numeric(10,2) NOT NULL,
    unit character varying(20) DEFAULT 'unit'::character varying NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    total_cost numeric(14,2) NOT NULL,
    batch_number character varying(100),
    expiry_date date,
    usage_phase character varying(50) NOT NULL,
    used_at timestamp without time zone NOT NULL,
    is_billable boolean DEFAULT false NOT NULL,
    is_deducted_from_stock boolean DEFAULT false NOT NULL,
    notes text,
    recorded_by_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_conflicts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_conflicts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    entity_type public.sync_conflicts_entity_type_enum NOT NULL,
    entity_id uuid NOT NULL,
    conflict_type public.sync_conflicts_conflict_type_enum NOT NULL,
    client_version integer NOT NULL,
    server_version integer NOT NULL,
    client_timestamp bigint NOT NULL,
    server_timestamp bigint NOT NULL,
    client_payload jsonb NOT NULL,
    server_payload jsonb NOT NULL,
    base_payload jsonb,
    conflicting_fields jsonb NOT NULL,
    suggested_merge jsonb,
    resolution public.sync_conflicts_resolution_enum DEFAULT 'pending'::public.sync_conflicts_resolution_enum NOT NULL,
    resolved_payload jsonb,
    resolved_by_id uuid,
    resolved_at timestamp without time zone,
    resolution_notes text,
    client_id uuid NOT NULL,
    client_user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sync_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    facility_id uuid NOT NULL,
    client_id uuid NOT NULL,
    device_name character varying(255),
    device_type character varying(100),
    entity_type public.sync_queue_entity_type_enum NOT NULL,
    entity_id uuid NOT NULL,
    operation public.sync_queue_operation_enum NOT NULL,
    client_version integer NOT NULL,
    client_timestamp bigint NOT NULL,
    payload jsonb NOT NULL,
    previous_payload jsonb,
    status public.sync_queue_status_enum DEFAULT 'pending'::public.sync_queue_status_enum NOT NULL,
    synced_at timestamp without time zone,
    retry_count integer DEFAULT 0 NOT NULL,
    error_message text,
    conflict_id uuid,
    user_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: system_features; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_features (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    feature_key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    category character varying(50) NOT NULL,
    default_enabled boolean DEFAULT true NOT NULL,
    min_license_type character varying(50) DEFAULT 'standard'::character varying NOT NULL,
    dependencies jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description text
);


--
-- Name: tax_exemptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_exemptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    category character varying(100) NOT NULL,
    reason text,
    applicable_taxes text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: tax_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    rate numeric(5,2) NOT NULL,
    type public.tax_rates_type_enum DEFAULT 'vat'::public.tax_rates_type_enum NOT NULL,
    applicable_services text,
    is_active boolean DEFAULT true NOT NULL,
    effective_from date
);


--
-- Name: temperature_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temperature_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    sensor_id character varying(100) NOT NULL,
    location character varying(255) NOT NULL,
    temperature numeric(5,2) NOT NULL,
    humidity numeric(5,2),
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    is_alert boolean DEFAULT false NOT NULL,
    alert_type public.temperature_logs_alert_type_enum,
    acknowledged_at timestamp with time zone,
    acknowledged_by character varying(255),
    facility_id uuid
);


--
-- Name: temperature_sensors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temperature_sensors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    sensor_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255) NOT NULL,
    storage_type public.temperature_sensors_storage_type_enum DEFAULT 'refrigerated'::public.temperature_sensors_storage_type_enum NOT NULL,
    min_temp numeric(5,2) NOT NULL,
    max_temp numeric(5,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid
);


--
-- Name: tenant_feature_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_feature_modules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    module_key character varying(100) NOT NULL,
    name character varying(255),
    description text,
    is_enabled boolean DEFAULT true NOT NULL,
    config jsonb,
    feature_flags jsonb,
    enable_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(255) NOT NULL,
    slug character varying(100),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    description text,
    settings jsonb
);


--
-- Name: theatres; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theatres (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    type public.theatres_type_enum DEFAULT 'general'::public.theatres_type_enum NOT NULL,
    status public.theatres_status_enum DEFAULT 'available'::public.theatres_status_enum NOT NULL,
    location text,
    equipment jsonb,
    capacity integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    facility_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: training_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_enrollments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    training_program_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    status public.training_enrollments_status_enum DEFAULT 'enrolled'::public.training_enrollments_status_enum NOT NULL,
    completion_date date,
    score numeric(5,2),
    certified boolean DEFAULT false NOT NULL,
    certification_expiry date,
    feedback text,
    enrolled_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: training_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_programs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    training_type public.training_programs_training_type_enum NOT NULL,
    trainer character varying(200),
    location character varying(200),
    start_date date NOT NULL,
    end_date date NOT NULL,
    duration_hours integer,
    max_participants integer,
    status public.training_programs_status_enum DEFAULT 'scheduled'::public.training_programs_status_enum NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    provides_certification boolean DEFAULT false NOT NULL,
    certification_name character varying(200),
    certification_validity_months integer
);


--
-- Name: treatment_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    plan_number character varying NOT NULL,
    plan_name character varying NOT NULL,
    type public.treatment_plans_type_enum DEFAULT 'acute'::public.treatment_plans_type_enum NOT NULL,
    status public.treatment_plans_status_enum DEFAULT 'draft'::public.treatment_plans_status_enum NOT NULL,
    primary_diagnosis text NOT NULL,
    diagnosis_codes jsonb,
    clinical_summary text,
    start_date date NOT NULL,
    expected_end_date date,
    actual_end_date date,
    goals jsonb,
    interventions jsonb,
    medications jsonb,
    monitoring_parameters jsonb,
    lifestyle_modifications jsonb,
    patient_education text,
    follow_up_schedule jsonb,
    precautions text,
    contraindications text,
    allergies_considered jsonb,
    patient_consent_obtained boolean DEFAULT false NOT NULL,
    consent_date timestamp with time zone,
    revision_number integer DEFAULT 1 NOT NULL,
    revision_reason text,
    previous_plan_id character varying,
    "progressNotes" jsonb,
    patient_id uuid NOT NULL,
    encounter_id uuid,
    created_by_id uuid NOT NULL,
    primary_provider_id uuid,
    care_team jsonb
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    department_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    head_user_id uuid,
    location character varying(50),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL
);


--
-- Name: update_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.update_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "deploymentId" uuid NOT NULL,
    "updateRolloutId" uuid,
    "notificationType" public.update_notifications_notificationtype_enum DEFAULT 'update_available'::public.update_notifications_notificationtype_enum NOT NULL,
    status public.update_notifications_status_enum DEFAULT 'pending'::public.update_notifications_status_enum NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "sentAt" timestamp without time zone,
    "deliveredAt" timestamp without time zone,
    "acknowledgedAt" timestamp without time zone,
    "failedAt" timestamp without time zone,
    "failureReason" text,
    "deploymentResponse" text,
    "sentBy" uuid,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "scheduledFor" timestamp without time zone,
    deployment_id uuid NOT NULL,
    update_rollout_id uuid
);


--
-- Name: update_rollouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.update_rollouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "releaseCandidateId" uuid NOT NULL,
    status public.update_rollouts_status_enum DEFAULT 'scheduled'::public.update_rollouts_status_enum NOT NULL,
    "currentPhase" public.update_rollouts_currentphase_enum DEFAULT 'phase_1'::public.update_rollouts_currentphase_enum NOT NULL,
    "startDate" timestamp without time zone NOT NULL,
    "endDate" timestamp without time zone,
    "phase1PercentageTarget" integer DEFAULT 10 NOT NULL,
    "phase2PercentageTarget" integer DEFAULT 50 NOT NULL,
    "phase3PercentageTarget" integer DEFAULT 100 NOT NULL,
    "errorThresholdPercentage" integer DEFAULT 5 NOT NULL,
    "autoRollbackOnError" boolean DEFAULT false NOT NULL,
    "deploymentsTotalCount" integer DEFAULT 0 NOT NULL,
    "deploymentsSuccessCount" integer DEFAULT 0 NOT NULL,
    "deploymentsFailedCount" integer DEFAULT 0 NOT NULL,
    "deploymentsRolledBackCount" integer DEFAULT 0 NOT NULL,
    "rollbackReason" jsonb,
    "rolledBackAt" timestamp without time zone,
    "scheduledBy" uuid,
    notes text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    release_candidate_id uuid NOT NULL,
    metadata jsonb
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    user_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    granted_by uuid,
    granted_at timestamp without time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    facility_id uuid,
    department_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    username character varying(100) NOT NULL,
    "passwordHash" character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    is_system_admin boolean DEFAULT false NOT NULL,
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_secret character varying(255),
    last_login_at timestamp without time zone,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp without time zone,
    must_change_password boolean DEFAULT false NOT NULL,
    token_version integer DEFAULT 0 NOT NULL,
    reports_to_id uuid,
    employee_number character varying(20),
    job_title character varying(100),
    staff_category character varying(50),
    employment_type character varying(50),
    date_of_birth date,
    gender character varying(10),
    hire_date date,
    basic_salary numeric(12,2),
    allowances jsonb,
    deductions jsonb,
    national_id character varying(50),
    address text,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    bank_name character varying(100),
    bank_account_number character varying(50),
    annual_leave_balance integer DEFAULT 21 NOT NULL,
    sick_leave_balance integer DEFAULT 10 NOT NULL,
    facility_id uuid,
    department_id uuid
);


--
-- Name: vendor_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_contracts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    contract_number character varying NOT NULL,
    supplier_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    value numeric(14,2) NOT NULL,
    terms text,
    status public.vendor_contracts_status_enum DEFAULT 'draft'::public.vendor_contracts_status_enum NOT NULL,
    auto_renew boolean DEFAULT false NOT NULL,
    renewal_notice_days integer DEFAULT 30 NOT NULL,
    documents jsonb,
    notes text,
    facility_id uuid NOT NULL,
    created_by_id uuid NOT NULL,
    renewed_from_id uuid
);


--
-- Name: vendor_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_quotation_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    quotation_id uuid NOT NULL,
    rfq_item_id character varying NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    delivery_days integer,
    in_stock boolean DEFAULT true NOT NULL,
    notes text
);


--
-- Name: vendor_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_quotations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    quotation_number character varying NOT NULL,
    rfq_id uuid NOT NULL,
    supplier_id uuid NOT NULL,
    status public.vendor_quotations_status_enum DEFAULT 'received'::public.vendor_quotations_status_enum NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    delivery_days integer NOT NULL,
    payment_terms character varying,
    warranty character varying,
    valid_until date NOT NULL,
    received_date timestamp with time zone NOT NULL,
    notes text
);


--
-- Name: vendor_rating_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_rating_summaries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    supplier_id uuid NOT NULL,
    avg_delivery_time numeric(2,1) DEFAULT '0'::numeric NOT NULL,
    avg_quality numeric(2,1) DEFAULT '0'::numeric NOT NULL,
    avg_price numeric(2,1) DEFAULT '0'::numeric NOT NULL,
    avg_service numeric(2,1) DEFAULT '0'::numeric NOT NULL,
    avg_overall numeric(2,1) DEFAULT '0'::numeric NOT NULL,
    total_reviews integer DEFAULT 0 NOT NULL,
    last_review_date timestamp with time zone,
    trend public.vendor_rating_summaries_trend_enum DEFAULT 'stable'::public.vendor_rating_summaries_trend_enum NOT NULL,
    "monthlyHistory" jsonb
);


--
-- Name: vendor_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_ratings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    supplier_id uuid NOT NULL,
    delivery_time_rating numeric(2,1) NOT NULL,
    quality_rating numeric(2,1) NOT NULL,
    price_rating numeric(2,1) NOT NULL,
    service_rating numeric(2,1) NOT NULL,
    overall_rating numeric(2,1) NOT NULL,
    comments text,
    purchase_order_id uuid,
    facility_id uuid NOT NULL,
    rated_by_id uuid NOT NULL
);


--
-- Name: vitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vitals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    temperature numeric(4,1),
    pulse integer,
    bp_systolic integer,
    bp_diastolic integer,
    respiratory_rate integer,
    oxygen_saturation numeric(5,2),
    weight numeric(5,2),
    height numeric(5,2),
    bmi numeric(5,2),
    blood_glucose numeric(6,2),
    pain_scale integer,
    notes text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    encounter_id uuid NOT NULL,
    recorded_by_id uuid NOT NULL
);


--
-- Name: waivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waivers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    facility_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    waiver_percent numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    waiver_amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    status public.waivers_status_enum DEFAULT 'pending'::public.waivers_status_enum NOT NULL,
    requested_by uuid NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    rejection_reason text
);


--
-- Name: wards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    code character varying NOT NULL,
    type public.wards_type_enum DEFAULT 'general'::public.wards_type_enum NOT NULL,
    status public.wards_status_enum DEFAULT 'active'::public.wards_status_enum NOT NULL,
    "totalBeds" integer DEFAULT 0 NOT NULL,
    "occupiedBeds" integer DEFAULT 0 NOT NULL,
    floor character varying,
    building character varying,
    description text,
    "facilityId" uuid NOT NULL
);


--
-- Name: wholesale_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wholesale_customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying NOT NULL,
    contact_person character varying,
    phone character varying,
    email character varying,
    address character varying,
    tax_id character varying,
    credit_limit numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    outstanding_balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    pricing_tier character varying DEFAULT 'standard'::character varying NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL
);


--
-- Name: support_access_requests PK_0110027d61e183923c98f5f4e4d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_access_requests
    ADD CONSTRAINT "PK_0110027d61e183923c98f5f4e4d" PRIMARY KEY (id);


--
-- Name: quotation_approvals PK_0151b09032b1320b9e76b4a7af8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_approvals
    ADD CONSTRAINT "PK_0151b09032b1320b9e76b4a7af8" PRIMARY KEY (id);


--
-- Name: user_permissions PK_01f4295968ba33d73926684264f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT "PK_01f4295968ba33d73926684264f" PRIMARY KEY (id);


--
-- Name: delegations PK_01f9fbbc9b3bf52236a4e951b19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT "PK_01f9fbbc9b3bf52236a4e951b19" PRIMARY KEY (id);


--
-- Name: rx_notification_logs PK_028c56b3a4765227843f5c34b86; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rx_notification_logs
    ADD CONSTRAINT "PK_028c56b3a4765227843f5c34b86" PRIMARY KEY (id);


--
-- Name: onboarding_tasks PK_04ddbad3ed27e955e9edd674447; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT "PK_04ddbad3ed27e955e9edd674447" PRIMARY KEY (id);


--
-- Name: purchase_orders PK_05148947415204a897e8beb2553; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "PK_05148947415204a897e8beb2553" PRIMARY KEY (id);


--
-- Name: billing_points PK_060bb31558e47a60213ca614400; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_points
    ADD CONSTRAINT "PK_060bb31558e47a60213ca614400" PRIMARY KEY (id);


--
-- Name: pre_authorizations PK_0879f27cdeb80ae15a87765e0f9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorizations
    ADD CONSTRAINT "PK_0879f27cdeb80ae15a87765e0f9" PRIMARY KEY (id);


--
-- Name: contract_amendments PK_08eb1387dc379408f2477217504; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_amendments
    ADD CONSTRAINT "PK_08eb1387dc379408f2477217504" PRIMARY KEY (id);


--
-- Name: release_candidates PK_095c5c78ed640cff69a56d1d688; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_candidates
    ADD CONSTRAINT "PK_095c5c78ed640cff69a56d1d688" PRIMARY KEY (id);


--
-- Name: prescriptions PK_097b2cc2f2b7e56825468188503; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT "PK_097b2cc2f2b7e56825468188503" PRIMARY KEY (id);


--
-- Name: pharmacy_sales PK_0a124a37bc70572cad2c2f18ec6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT "PK_0a124a37bc70572cad2c2f18ec6" PRIMARY KEY (id);


--
-- Name: system_features PK_0c1d7826eeafb79aca18282059b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_features
    ADD CONSTRAINT "PK_0c1d7826eeafb79aca18282059b" PRIMARY KEY (id);


--
-- Name: supplier_credit_notes PK_0e2c2f4982a5bd60040fa750eaf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_credit_notes
    ADD CONSTRAINT "PK_0e2c2f4982a5bd60040fa750eaf" PRIMARY KEY (id);


--
-- Name: patient_merges PK_0f7510e196493dde5b5b21003f5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merges
    ADD CONSTRAINT "PK_0f7510e196493dde5b5b21003f5" PRIMARY KEY (id);


--
-- Name: invoice_matches PK_105c1ba0ecc842a4cb37743f161; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_matches
    ADD CONSTRAINT "PK_105c1ba0ecc842a4cb37743f161" PRIMARY KEY (id);


--
-- Name: vendor_rating_summaries PK_13e8166327468a25c5fa495674c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_rating_summaries
    ADD CONSTRAINT "PK_13e8166327468a25c5fa495674c" PRIMARY KEY (id);


--
-- Name: phone_home_records PK_15282b3bc72bd163de75cef3f83; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_home_records
    ADD CONSTRAINT "PK_15282b3bc72bd163de75cef3f83" PRIMARY KEY (id);


--
-- Name: payments PK_197ab7af18c93fbb0c9b28b4a59; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY (id);


--
-- Name: insurance_providers PK_1b917328814bb47bfdf32f01a0a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_providers
    ADD CONSTRAINT "PK_1b917328814bb47bfdf32f01a0a" PRIMARY KEY (id);


--
-- Name: audit_logs PK_1bb179d048bbc581caa3b013439; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id);


--
-- Name: queue_displays PK_1bcfaa77ad245afd415abc6e224; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_displays
    ADD CONSTRAINT "PK_1bcfaa77ad245afd415abc6e224" PRIMARY KEY (id);


--
-- Name: goods_receipt_notes PK_1cec586a0a55f192ee26bc5c3ec; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "PK_1cec586a0a55f192ee26bc5c3ec" PRIMARY KEY (id);


--
-- Name: discharge_summaries PK_1e4e49ee335e870071c013b1dc6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summaries
    ADD CONSTRAINT "PK_1e4e49ee335e870071c013b1dc6" PRIMARY KEY (id);


--
-- Name: deployments PK_1e5627acb3c950deb83fe98fc48; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT "PK_1e5627acb3c950deb83fe98fc48" PRIMARY KEY (id);


--
-- Name: insurance_price_lists PK_1fc21dd440d47f5f874812ff413; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_price_lists
    ADD CONSTRAINT "PK_1fc21dd440d47f5f874812ff413" PRIMARY KEY (id);


--
-- Name: baby_wellness_checks PK_21d33ec3844ac7986319d4263da; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baby_wellness_checks
    ADD CONSTRAINT "PK_21d33ec3844ac7986319d4263da" PRIMARY KEY (id);


--
-- Name: beds PK_2212ae7113d85a70dc65983e742; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT "PK_2212ae7113d85a70dc65983e742" PRIMARY KEY (id);


--
-- Name: qc_materials PK_2408a49890eb5b82cef23ddc0f3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_materials
    ADD CONSTRAINT "PK_2408a49890eb5b82cef23ddc0f3" PRIMARY KEY (id);


--
-- Name: vendor_quotation_items PK_2478b96b4acde887513b91bf572; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_quotation_items
    ADD CONSTRAINT "PK_2478b96b4acde887513b91bf572" PRIMARY KEY (id);


--
-- Name: bank_reconciliations PK_2616ee3f2acfae424b545a9d3be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT "PK_2616ee3f2acfae424b545a9d3be" PRIMARY KEY (id);


--
-- Name: bank_reconciliation_items PK_26354e4299b104c338599dd2ef3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliation_items
    ADD CONSTRAINT "PK_26354e4299b104c338599dd2ef3" PRIMARY KEY (id);


--
-- Name: item_tag_assignments PK_264669242513075d41e8a5b7d33; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_tag_assignments
    ADD CONSTRAINT "PK_264669242513075d41e8a5b7d33" PRIMARY KEY (id);


--
-- Name: rfq_items PK_2694c253e3966a3a8d5e9dc3d60; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_items
    ADD CONSTRAINT "PK_2694c253e3966a3a8d5e9dc3d60" PRIMARY KEY (id);


--
-- Name: surgery_cases PK_27e7b8c74baaff3312b4c7e138a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "PK_27e7b8c74baaff3312b4c7e138a" PRIMARY KEY (id);


--
-- Name: patient_deposits PK_282b4d3b3c7270a7721e547d570; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_deposits
    ADD CONSTRAINT "PK_282b4d3b3c7270a7721e547d570" PRIMARY KEY (id);


--
-- Name: supplier_return_items PK_28827c40eef29faaeaee24fe4d8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT "PK_28827c40eef29faaeaee24fe4d8" PRIMARY KEY (id);


--
-- Name: payslips PK_2b1cd07059daf60cc440c9976e1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT "PK_2b1cd07059daf60cc440c9976e1" PRIMARY KEY (id);


--
-- Name: drug_label_templates PK_2c733d6f6dbfd9840f676324412; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_label_templates
    ADD CONSTRAINT "PK_2c733d6f6dbfd9840f676324412" PRIMARY KEY (id);


--
-- Name: facilities PK_2e6c685b2e1195e6d6394a22bc7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT "PK_2e6c685b2e1195e6d6394a22bc7" PRIMARY KEY (id);


--
-- Name: group_permissions PK_2eb53190d645a321bc8cad558ac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permissions
    ADD CONSTRAINT "PK_2eb53190d645a321bc8cad558ac" PRIMARY KEY (id);


--
-- Name: dispensations PK_2fd4df898cc037676b04fffbe7c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT "PK_2fd4df898cc037676b04fffbe7c" PRIMARY KEY (id);


--
-- Name: sessions PK_3238ef96f18b355b671619111bc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY (id);


--
-- Name: pos_registers PK_337c429f2be84a4bc0543a27256; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_registers
    ADD CONSTRAINT "PK_337c429f2be84a4bc0543a27256" PRIMARY KEY (id);


--
-- Name: sync_conflicts PK_351e71cb6c48c898e6cb7fb5347; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_conflicts
    ADD CONSTRAINT "PK_351e71cb6c48c898e6cb7fb5347" PRIMARY KEY (id);


--
-- Name: performance_appraisals PK_3632321ee51ce723fd17b393567; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_appraisals
    ADD CONSTRAINT "PK_3632321ee51ce723fd17b393567" PRIMARY KEY (id);


--
-- Name: goods_receipt_items PK_3773489ac01faa49777eed0a14f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT "PK_3773489ac01faa49777eed0a14f" PRIMARY KEY (id);


--
-- Name: update_notifications PK_389322c4311a447703c45f5878c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_notifications
    ADD CONSTRAINT "PK_389322c4311a447703c45f5878c" PRIMARY KEY (id);


--
-- Name: lab_tests PK_400d229da68540bf586c0f4a20f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT "PK_400d229da68540bf586c0f4a20f" PRIMARY KEY (id);


--
-- Name: tax_rates PK_41164a748f3dafa373c7e508ca2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT "PK_41164a748f3dafa373c7e508ca2" PRIMARY KEY (id);


--
-- Name: notification_configs PK_433fa4c682827cab491c91fc9d0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_configs
    ADD CONSTRAINT "PK_433fa4c682827cab491c91fc9d0" PRIMARY KEY (id);


--
-- Name: deployment_alerts PK_438e11b9d7c3a2d5cf7b22fce7c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_alerts
    ADD CONSTRAINT "PK_438e11b9d7c3a2d5cf7b22fce7c" PRIMARY KEY (id);


--
-- Name: drug_classifications PK_442ddfcc6eeaae0d4f413440655; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_classifications
    ADD CONSTRAINT "PK_442ddfcc6eeaae0d4f413440655" PRIMARY KEY (id);


--
-- Name: temperature_sensors PK_44fa62466ddfcb2a7dbfef7c606; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_sensors
    ADD CONSTRAINT "PK_44fa62466ddfcb2a7dbfef7c606" PRIMARY KEY (id);


--
-- Name: antenatal_registrations PK_4585b4c11ead0cbcd88e7d4321d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_registrations
    ADD CONSTRAINT "PK_4585b4c11ead0cbcd88e7d4321d" PRIMARY KEY (id);


--
-- Name: imaging_results PK_4598063ca5e5ecf50445918a5ba; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_results
    ADD CONSTRAINT "PK_4598063ca5e5ecf50445918a5ba" PRIMARY KEY (id);


--
-- Name: deployment_versions PK_462fbaf1d6fedf515ba98611ee4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_versions
    ADD CONSTRAINT "PK_462fbaf1d6fedf515ba98611ee4" PRIMARY KEY (id);


--
-- Name: chart_of_accounts PK_467c08a2efc78393c647da32bac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT "PK_467c08a2efc78393c647da32bac" PRIMARY KEY (id);


--
-- Name: cashier_sessions PK_46e6cc581c2e2d21cb1e29e3ba0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_sessions
    ADD CONSTRAINT "PK_46e6cc581c2e2d21cb1e29e3ba0" PRIMARY KEY (id);


--
-- Name: equipment_maintenances PK_4703170d2eab1ff1ef3017f4eed; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenances
    ADD CONSTRAINT "PK_4703170d2eab1ff1ef3017f4eed" PRIMARY KEY (id);


--
-- Name: patient_credit_notes PK_483fefef1ff8efa4b5a3c41181b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_credit_notes
    ADD CONSTRAINT "PK_483fefef1ff8efa4b5a3c41181b" PRIMARY KEY (id);


--
-- Name: approval_requests PK_484806bb8ff331b851fc75973c0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT "PK_484806bb8ff331b851fc75973c0" PRIMARY KEY (id);


--
-- Name: pos_shifts PK_48c3a5a8edb67abfa198992a0fa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT "PK_48c3a5a8edb67abfa198992a0fa" PRIMARY KEY (id);


--
-- Name: appointments PK_4a437a9a27e948726b8bb3e36ad; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY (id);


--
-- Name: biometric_data PK_4a640314851fccc8494107b5727; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biometric_data
    ADD CONSTRAINT "PK_4a640314851fccc8494107b5727" PRIMARY KEY (id);


--
-- Name: stock_balances PK_4c0d249ce58f9a559eb7df31b23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT "PK_4c0d249ce58f9a559eb7df31b23" PRIMARY KEY (id);


--
-- Name: bed_transfers PK_4db376d9670566bb4ad66c98d59; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_transfers
    ADD CONSTRAINT "PK_4db376d9670566bb4ad66c98d59" PRIMARY KEY (id);


--
-- Name: budget_lines PK_4eabf9c9d7c8edc9ad302270c94; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT "PK_4eabf9c9d7c8edc9ad302270c94" PRIMARY KEY (id);


--
-- Name: lab_results PK_4f1c5b3b5813c98fb531e5db738; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT "PK_4f1c5b3b5813c98fb531e5db738" PRIMARY KEY (id);


--
-- Name: petty_cash_funds PK_51ed2daba57482cd36a26857e58; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petty_cash_funds
    ADD CONSTRAINT "PK_51ed2daba57482cd36a26857e58" PRIMARY KEY (id);


--
-- Name: invoice_items PK_53b99f9e0e2945e69de1a12b75a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY (id);


--
-- Name: tenants PK_53be67a04681c66b87ee27c9321; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY (id);


--
-- Name: password_policies PK_5468b65a86afc8563ac81cb9153; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_policies
    ADD CONSTRAINT "PK_5468b65a86afc8563ac81cb9153" PRIMARY KEY (id);


--
-- Name: item_brands PK_55c9546e3aa2c8ae2a61c27ab22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_brands
    ADD CONSTRAINT "PK_55c9546e3aa2c8ae2a61c27ab22" PRIMARY KEY (id);


--
-- Name: change_sets PK_58d9928d386f68ec41f87501e4f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_sets
    ADD CONSTRAINT "PK_58d9928d386f68ec41f87501e4f" PRIMARY KEY (id);


--
-- Name: clinical_notes PK_590ad4cecf429ecc12e8202cbb4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT "PK_590ad4cecf429ecc12e8202cbb4" PRIMARY KEY (id);


--
-- Name: units PK_5a8f2f064919b587d93936cb223; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT "PK_5a8f2f064919b587d93936cb223" PRIMARY KEY (id);


--
-- Name: lab_equipment PK_5c6595301ed4e29cd5a8d860b01; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_equipment
    ADD CONSTRAINT "PK_5c6595301ed4e29cd5a8d860b01" PRIMARY KEY (id);


--
-- Name: item_units PK_5dfc0d836ad14f9e4ac775ec89d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_units
    ADD CONSTRAINT "PK_5dfc0d836ad14f9e4ac775ec89d" PRIMARY KEY (id);


--
-- Name: vendor_quotations PK_5eb3d7d583679bf600cddcb9b58; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_quotations
    ADD CONSTRAINT "PK_5eb3d7d583679bf600cddcb9b58" PRIMARY KEY (id);


--
-- Name: patient_memberships PK_5fbf3269230d4c7891196fc60a5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_memberships
    ADD CONSTRAINT "PK_5fbf3269230d4c7891196fc60a5" PRIMARY KEY (id);


--
-- Name: payroll_runs PK_6049f42c972640c0eb99ba8035e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT "PK_6049f42c972640c0eb99ba8035e" PRIMARY KEY (id);


--
-- Name: update_rollouts PK_60cdd010960f318aec8e2d92096; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_rollouts
    ADD CONSTRAINT "PK_60cdd010960f318aec8e2d92096" PRIMARY KEY (id);


--
-- Name: nursing_notes PK_60d757be21786a01840b53ea46f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_notes
    ADD CONSTRAINT "PK_60d757be21786a01840b53ea46f" PRIMARY KEY (id);


--
-- Name: training_enrollments PK_61c7ba1db08ad1c4aae4ab05217; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_enrollments
    ADD CONSTRAINT "PK_61c7ba1db08ad1c4aae4ab05217" PRIMARY KEY (id);


--
-- Name: prescription_items PK_6216831f49afc381b3934c9672c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT "PK_6216831f49afc381b3934c9672c" PRIMARY KEY (id);


--
-- Name: treatment_plans PK_6372779b339933b56aa985167f0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT "PK_6372779b339933b56aa985167f0" PRIMARY KEY (id);


--
-- Name: reagent_lots PK_63f66833824ebcf897a690e785e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_lots
    ADD CONSTRAINT "PK_63f66833824ebcf897a690e785e" PRIMARY KEY (id);


--
-- Name: common_drug_translations PK_6449e16ab9fe225d5a7f45d08db; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.common_drug_translations
    ADD CONSTRAINT "PK_6449e16ab9fe225d5a7f45d08db" PRIMARY KEY (id);


--
-- Name: shift_swap_requests PK_65b212b948b24350cffb8c4cec4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT "PK_65b212b948b24350cffb8c4cec4" PRIMARY KEY (id);


--
-- Name: invoices PK_668cef7c22a427fd822cc1be3ce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY (id);


--
-- Name: patient_problems PK_66a7d0b86d31b96138e21719b11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_problems
    ADD CONSTRAINT "PK_66a7d0b86d31b96138e21719b11" PRIMARY KEY (id);


--
-- Name: delivery_outcomes PK_6801eb7bf51dd5ac23232a1daf7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_outcomes
    ADD CONSTRAINT "PK_6801eb7bf51dd5ac23232a1daf7" PRIMARY KEY (id);


--
-- Name: insurance_policies PK_69af1d3a19277d1a822c9b13bf1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT "PK_69af1d3a19277d1a822c9b13bf1" PRIMARY KEY (id);


--
-- Name: asset_maintenances PK_6af14ce16fe98b64069ab12a3d6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenances
    ADD CONSTRAINT "PK_6af14ce16fe98b64069ab12a3d6" PRIMARY KEY (id);


--
-- Name: facility_modules PK_6c504610a5ff85a878c95bb86fe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_modules
    ADD CONSTRAINT "PK_6c504610a5ff85a878c95bb86fe" PRIMARY KEY (id);


--
-- Name: admissions PK_6d47682a899dfa0a78ce11fe98a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "PK_6d47682a899dfa0a78ce11fe98a" PRIMARY KEY (id);


--
-- Name: item_strengths PK_6e4b18a3ea9014572079e1a98d5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_strengths
    ADD CONSTRAINT "PK_6e4b18a3ea9014572079e1a98d5" PRIMARY KEY (id);


--
-- Name: supplier_returns PK_700c8777a97d463d3ecc01aa189; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT "PK_700c8777a97d463d3ecc01aa189" PRIMARY KEY (id);


--
-- Name: orders PK_710e2d4957aa5878dfe94e4ac2f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY (id);


--
-- Name: surgery_consumables PK_759fdf0ec83722ad61048f2e180; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_consumables
    ADD CONSTRAINT "PK_759fdf0ec83722ad61048f2e180" PRIMARY KEY (id);


--
-- Name: supplier_payments PK_76e86f3194494faf999c652dbf9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT "PK_76e86f3194494faf999c652dbf9" PRIMARY KEY (id);


--
-- Name: temperature_logs PK_7738b8501fbf3aa21698f99a34f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temperature_logs
    ADD CONSTRAINT "PK_7738b8501fbf3aa21698f99a34f" PRIMARY KEY (id);


--
-- Name: salary_history PK_796fc91fc02d8e1b35a08c3de32; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_history
    ADD CONSTRAINT "PK_796fc91fc02d8e1b35a08c3de32" PRIMARY KEY (id);


--
-- Name: facility_configs PK_79a09f3d0d56ed6d3892dcc1d36; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_configs
    ADD CONSTRAINT "PK_79a09f3d0d56ed6d3892dcc1d36" PRIMARY KEY (id);


--
-- Name: waivers PK_79c78ef719b30d113528b6cd9c2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waivers
    ADD CONSTRAINT "PK_79c78ef719b30d113528b6cd9c2" PRIMARY KEY (id);


--
-- Name: vendor_contracts PK_79f157570a1cbf76b2351932d9e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_contracts
    ADD CONSTRAINT "PK_79f157570a1cbf76b2351932d9e" PRIMARY KEY (id);


--
-- Name: interfacility_transactions PK_7a218e7a9c06d8b38a905aa6f8a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interfacility_transactions
    ADD CONSTRAINT "PK_7a218e7a9c06d8b38a905aa6f8a" PRIMARY KEY (id);


--
-- Name: stores PK_7aa6e7d71fa7acdd7ca43d7c9cb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT "PK_7aa6e7d71fa7acdd7ca43d7c9cb" PRIMARY KEY (id);


--
-- Name: claim_items PK_7cf44c1e8a230f5dc37d3f6c9a2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_items
    ADD CONSTRAINT "PK_7cf44c1e8a230f5dc37d3f6c9a2" PRIMARY KEY (id);


--
-- Name: refresh_tokens PK_7d8bee0204106019488c4c50ffa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY (id);


--
-- Name: prescription_templates PK_81373adbc66823e27fdd89d74c2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_templates
    ADD CONSTRAINT "PK_81373adbc66823e27fdd89d74c2" PRIMARY KEY (id);


--
-- Name: tax_exemptions PK_815d780b1be6e0dc16d07698b68; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_exemptions
    ADD CONSTRAINT "PK_815d780b1be6e0dc16d07698b68" PRIMARY KEY (id);


--
-- Name: system_settings PK_82521f08790d248b2a80cc85d40; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT "PK_82521f08790d248b2a80cc85d40" PRIMARY KEY (id);


--
-- Name: antenatal_visits PK_82b01d2796241d80648b7fe3d42; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_visits
    ADD CONSTRAINT "PK_82b01d2796241d80648b7fe3d42" PRIMARY KEY (id);


--
-- Name: departments PK_839517a681a86bb84cbcc6a1e9d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY (id);


--
-- Name: staff_documents PK_839ead62045ac25f73271e6823d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_documents
    ADD CONSTRAINT "PK_839ead62045ac25f73271e6823d" PRIMARY KEY (id);


--
-- Name: role_permissions PK_84059017c90bfcb701b8fa42297; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "PK_84059017c90bfcb701b8fa42297" PRIMARY KEY (id);


--
-- Name: lab_reagents PK_855f941e94818ad993672c87101; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagents
    ADD CONSTRAINT "PK_855f941e94818ad993672c87101" PRIMARY KEY (id);


--
-- Name: lab_samples PK_85e0672b00445a37162572c2f10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "PK_85e0672b00445a37162572c2f10" PRIMARY KEY (id);


--
-- Name: asset_depreciations PK_883381751d81a7a81933910d46a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_depreciations
    ADD CONSTRAINT "PK_883381751d81a7a81933910d46a" PRIMARY KEY (id);


--
-- Name: item_formulations PK_8a2f35124959c3372ec127efec8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_formulations
    ADD CONSTRAINT "PK_8a2f35124959c3372ec127efec8" PRIMARY KEY (id);


--
-- Name: user_roles PK_8acd5cf26ebd158416f477de799; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "PK_8acd5cf26ebd158416f477de799" PRIMARY KEY (id);


--
-- Name: stock_transfer_items PK_8acee6121ab8a5135dc84495588; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT "PK_8acee6121ab8a5135dc84495588" PRIMARY KEY (id);


--
-- Name: qc_results PK_8b5b61ec4c10edf10400ca07eb9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_results
    ADD CONSTRAINT "PK_8b5b61ec4c10edf10400ca07eb9" PRIMARY KEY (id);


--
-- Name: app_versions PK_8d36b0dcf0c026c7aad923c80fd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT "PK_8d36b0dcf0c026c7aad923c80fd" PRIMARY KEY (id);


--
-- Name: fixed_assets PK_901984c25ddf1dcf11f1c7a70d8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT "PK_901984c25ddf1dcf11f1c7a70d8" PRIMARY KEY (id);


--
-- Name: support_access_grants PK_902bce1d8282d901bd323887872; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_access_grants
    ADD CONSTRAINT "PK_902bce1d8282d901bd323887872" PRIMARY KEY (id);


--
-- Name: deployment_configs PK_90cfa6a1981c402c60df904e874; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_configs
    ADD CONSTRAINT "PK_90cfa6a1981c402c60df904e874" PRIMARY KEY (id);


--
-- Name: patient_reminders PK_910e079e6df1872897f3fb1e272; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT "PK_910e079e6df1872897f3fb1e272" PRIMARY KEY (id);


--
-- Name: permissions PK_920331560282b8bd21bb02290df; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY (id);


--
-- Name: role_permission_groups PK_93e1ae95cda57920afa452a2025; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission_groups
    ADD CONSTRAINT "PK_93e1ae95cda57920afa452a2025" PRIMARY KEY (id);


--
-- Name: sms_templates PK_940ef6d70e5e49587c1a2f3222d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_templates
    ADD CONSTRAINT "PK_940ef6d70e5e49587c1a2f3222d" PRIMARY KEY (id);


--
-- Name: attendance_records PK_946920332f5bc9efad3f3023b96; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT "PK_946920332f5bc9efad3f3023b96" PRIMARY KEY (id);


--
-- Name: item_subcategories PK_96c822c4cd62583d2fa6c3334ac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_subcategories
    ADD CONSTRAINT "PK_96c822c4cd62583d2fa6c3334ac" PRIMARY KEY (id);


--
-- Name: storage_conditions PK_98a635e781d87e57579c533fb0b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_conditions
    ADD CONSTRAINT "PK_98a635e781d87e57579c533fb0b" PRIMARY KEY (id);


--
-- Name: staff_rosters PK_98fec296eb18128c395feda9f90; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_rosters
    ADD CONSTRAINT "PK_98fec296eb18128c395feda9f90" PRIMARY KEY (id);


--
-- Name: immunization_schedules PK_996dee14faaef239ee7c46432ac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.immunization_schedules
    ADD CONSTRAINT "PK_996dee14faaef239ee7c46432ac" PRIMARY KEY (id);


--
-- Name: fiscal_periods PK_9bb1e4e84a0d820b943e116888d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT "PK_9bb1e4e84a0d820b943e116888d" PRIMARY KEY (id);


--
-- Name: budgets PK_9c8a51748f82387644b773da482; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY (id);


--
-- Name: sample_referrals PK_9f164aa6a648f14b3a4a9e1b651; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_referrals
    ADD CONSTRAINT "PK_9f164aa6a648f14b3a4a9e1b651" PRIMARY KEY (id);


--
-- Name: theatres PK_a1451caeaf6c1085e17e01ffe4a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theatres
    ADD CONSTRAINT "PK_a1451caeaf6c1085e17e01ffe4a" PRIMARY KEY (id);


--
-- Name: doctor_schedules PK_a1cab57bc0a680b50d06930b377; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT "PK_a1cab57bc0a680b50d06930b377" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: reagent_consumptions PK_a5e60660defe9c9932c51c1eb42; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_consumptions
    ADD CONSTRAINT "PK_a5e60660defe9c9932c51c1eb42" PRIMARY KEY (id);


--
-- Name: deliveries PK_a6ef225c5c5f0974e503bfb731f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT "PK_a6ef225c5c5f0974e503bfb731f" PRIMARY KEY (id);


--
-- Name: vitals PK_a6f02e68a2c1766b720d065dfd8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT "PK_a6f02e68a2c1766b720d065dfd8" PRIMARY KEY (id);


--
-- Name: journal_entries PK_a70368e64230434457c8d007ab3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "PK_a70368e64230434457c8d007ab3" PRIMARY KEY (id);


--
-- Name: batch_stock_balances PK_a76a2a892e48c8c011148371fc5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock_balances
    ADD CONSTRAINT "PK_a76a2a892e48c8c011148371fc5" PRIMARY KEY (id);


--
-- Name: medication_administrations PK_a7829a4b8a75cade9da727b785c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT "PK_a7829a4b8a75cade9da727b785c" PRIMARY KEY (id);


--
-- Name: expiry_alert_history PK_a7bd0fe9c10a7112b976204c616; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alert_history
    ADD CONSTRAINT "PK_a7bd0fe9c10a7112b976204c616" PRIMARY KEY (id);


--
-- Name: patients PK_a7f0b9fcbb3469d5ec0b0aceaa7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY (id);


--
-- Name: supplier_credit_note_items PK_aaf2d1d110f24727e828bc4bc01; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_credit_note_items
    ADD CONSTRAINT "PK_aaf2d1d110f24727e828bc4bc01" PRIMARY KEY (id);


--
-- Name: providers PK_af13fc2ebf382fe0dad2e4793aa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT "PK_af13fc2ebf382fe0dad2e4793aa" PRIMARY KEY (id);


--
-- Name: encounters PK_b2e596be58aabc4ccc8f8458b53; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "PK_b2e596be58aabc4ccc8f8458b53" PRIMARY KEY (id);


--
-- Name: journal_entry_lines PK_b2f60e3664cd9803a829fb61aa4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT "PK_b2f60e3664cd9803a829fb61aa4" PRIMARY KEY (id);


--
-- Name: petty_cash_transactions PK_b5bd7a92c01fd8d043e53f7e016; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petty_cash_transactions
    ADD CONSTRAINT "PK_b5bd7a92c01fd8d043e53f7e016" PRIMARY KEY (id);


--
-- Name: suppliers PK_b70ac51766a9e3144f778cfe81e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY (id);


--
-- Name: pharmacy_sale_items PK_b77ee9942820f313e85c009afe8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_sale_items
    ADD CONSTRAINT "PK_b77ee9942820f313e85c009afe8" PRIMARY KEY (id);


--
-- Name: employees PK_b9535a98350d5b26e7eb0c26af4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY (id);


--
-- Name: disciplinary_actions PK_b9955aca9397750a58c4fe27221; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinary_actions
    ADD CONSTRAINT "PK_b9955aca9397750a58c4fe27221" PRIMARY KEY (id);


--
-- Name: services PK_ba2d347a3168a296416c6c5ccb2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY (id);


--
-- Name: wholesale_customers PK_ba352144ac3cf8a52ab39485912; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wholesale_customers
    ADD CONSTRAINT "PK_ba352144ac3cf8a52ab39485912" PRIMARY KEY (id);


--
-- Name: items PK_ba5885359424c15ca6b9e79bcf6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY (id);


--
-- Name: asset_transfers PK_ba9dc8ea271c20ab7375000e4af; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT "PK_ba9dc8ea271c20ab7375000e4af" PRIMARY KEY (id);


--
-- Name: stock_ledger PK_bb04575ee2ff52f72028f669701; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "PK_bb04575ee2ff52f72028f669701" PRIMARY KEY (id);


--
-- Name: item_tags PK_bdc3f2833142bfd6d43fefc6bbc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_tags
    ADD CONSTRAINT "PK_bdc3f2833142bfd6d43fefc6bbc" PRIMARY KEY (id);


--
-- Name: equipment_calibrations PK_bdf762cfd4fed4ab2fca46cbd19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_calibrations
    ADD CONSTRAINT "PK_bdf762cfd4fed4ab2fca46cbd19" PRIMARY KEY (id);


--
-- Name: imaging_modalities PK_bea06391eb99a13786a4c0fd574; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_modalities
    ADD CONSTRAINT "PK_bea06391eb99a13786a4c0fd574" PRIMARY KEY (id);


--
-- Name: purchase_request_items PK_beecbb6cca527e5c67903520e1e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items
    ADD CONSTRAINT "PK_beecbb6cca527e5c67903520e1e" PRIMARY KEY (id);


--
-- Name: expiry_alerts PK_c096653c39c4de6e6ff4e2ac0f3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alerts
    ADD CONSTRAINT "PK_c096653c39c4de6e6ff4e2ac0f3" PRIMARY KEY (id);


--
-- Name: roles PK_c1433d71a4838793a49dcad46ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id);


--
-- Name: patient_chronic_conditions PK_c4607c24d07ae9975d2066e1cce; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_chronic_conditions
    ADD CONSTRAINT "PK_c4607c24d07ae9975d2066e1cce" PRIMARY KEY (id);


--
-- Name: job_applications PK_c56a5e86707d0f0df18fa111280; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT "PK_c56a5e86707d0f0df18fa111280" PRIMARY KEY (id);


--
-- Name: master_data_approval_rules PK_c5d9216a9d595959a7cb203af75; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_approval_rules
    ADD CONSTRAINT "PK_c5d9216a9d595959a7cb203af75" PRIMARY KEY (id);


--
-- Name: insurance_claims PK_c6f7929fdcec8c17a24034a48d3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "PK_c6f7929fdcec8c17a24034a48d3" PRIMARY KEY (id);


--
-- Name: deposit_applications PK_c82e14cb9e78fb3aa99414004c6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_applications
    ADD CONSTRAINT "PK_c82e14cb9e78fb3aa99414004c6" PRIMARY KEY (id);


--
-- Name: rfqs PK_c8b7481584218bdee534e5fc436; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT "PK_c8b7481584218bdee534e5fc436" PRIMARY KEY (id);


--
-- Name: backups PK_ca30ff369eddfc7dac3b35d0d3c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backups
    ADD CONSTRAINT "PK_ca30ff369eddfc7dac3b35d0d3c" PRIMARY KEY (id);


--
-- Name: controlled_substance_logs PK_ca8383021ff7299d5d540162b18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_logs
    ADD CONSTRAINT "PK_ca8383021ff7299d5d540162b18" PRIMARY KEY (id);


--
-- Name: emergency_cases PK_cb3920da6b61503a7a6fafd5513; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "PK_cb3920da6b61503a7a6fafd5513" PRIMARY KEY (id);


--
-- Name: membership_schemes PK_cc9924838f07c360a04bef3608f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_schemes
    ADD CONSTRAINT "PK_cc9924838f07c360a04bef3608f" PRIMARY KEY (id);


--
-- Name: replication_logs PK_ceef747b0f9d6960f979c1b3a91; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replication_logs
    ADD CONSTRAINT "PK_ceef747b0f9d6960f979c1b3a91" PRIMARY KEY (id);


--
-- Name: service_prices PK_d03695e32fe299c7b53f7775804; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_prices
    ADD CONSTRAINT "PK_d03695e32fe299c7b53f7775804" PRIMARY KEY (id);


--
-- Name: expiry_alert_configs PK_d0d53cadeaef871a55dd48a94cb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alert_configs
    ADD CONSTRAINT "PK_d0d53cadeaef871a55dd48a94cb" PRIMARY KEY (id);


--
-- Name: diagnoses PK_d1bfabf423f99c537817e6ad244; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT "PK_d1bfabf423f99c537817e6ad244" PRIMARY KEY (id);


--
-- Name: training_programs PK_d2f7c8d9677739e09110067656a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT "PK_d2f7c8d9677739e09110067656a" PRIMARY KEY (id);


--
-- Name: leave_requests PK_d3abcf9a16cef1450129e06fa9f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT "PK_d3abcf9a16cef1450129e06fa9f" PRIMARY KEY (id);


--
-- Name: pos_payment_splits PK_d3af91d2b31990a40b072ad06bb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_payment_splits
    ADD CONSTRAINT "PK_d3af91d2b31990a40b072ad06bb" PRIMARY KEY (id);


--
-- Name: vendor_ratings PK_d4b5c309bea14f7623e89651ea5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT "PK_d4b5c309bea14f7623e89651ea5" PRIMARY KEY (id);


--
-- Name: follow_ups PK_d510aabdff2ec7fdc67a1092157; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "PK_d510aabdff2ec7fdc67a1092157" PRIMARY KEY (id);


--
-- Name: qc_levey_jennings_data PK_d53ce6b7d0dbc135336ed1b93c2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_levey_jennings_data
    ADD CONSTRAINT "PK_d53ce6b7d0dbc135336ed1b93c2" PRIMARY KEY (id);


--
-- Name: drug_interactions PK_d568e030baddbbb88761bfaf3f7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_interactions
    ADD CONSTRAINT "PK_d568e030baddbbb88761bfaf3f7" PRIMARY KEY (id);


--
-- Name: postnatal_visits PK_d5bf735129c08c29001e3a312a4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_visits
    ADD CONSTRAINT "PK_d5bf735129c08c29001e3a312a4" PRIMARY KEY (id);


--
-- Name: service_packages PK_d602a30f23af1a0ecf7c8e994df; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT "PK_d602a30f23af1a0ecf7c8e994df" PRIMARY KEY (id);


--
-- Name: price_agreements PK_d6448fe108bfe8dcbfee06272ab; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_agreements
    ADD CONSTRAINT "PK_d6448fe108bfe8dcbfee06272ab" PRIMARY KEY (id);


--
-- Name: supplier_payment_items PK_d9653c3eadaa7f8add1041066ef; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment_items
    ADD CONSTRAINT "PK_d9653c3eadaa7f8add1041066ef" PRIMARY KEY (id);


--
-- Name: queues PK_d966f9eb39a9396658387071bb3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "PK_d966f9eb39a9396658387071bb3" PRIMARY KEY (id);


--
-- Name: licenses PK_da5021501ce80efa03de6f40086; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT "PK_da5021501ce80efa03de6f40086" PRIMARY KEY (id);


--
-- Name: password_history PK_da65ed4600e5e6bc9315754a8b2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_history
    ADD CONSTRAINT "PK_da65ed4600e5e6bc9315754a8b2" PRIMARY KEY (id);


--
-- Name: shift_definitions PK_daffd91a4414d5359c36b06b752; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT "PK_daffd91a4414d5359c36b06b752" PRIMARY KEY (id);


--
-- Name: item_categories PK_db3359595abacbe15cf2f89c07e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_categories
    ADD CONSTRAINT "PK_db3359595abacbe15cf2f89c07e" PRIMARY KEY (id);


--
-- Name: feature_flags PK_db657d344e9caacfc9d5cf8bbac; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT "PK_db657d344e9caacfc9d5cf8bbac" PRIMARY KEY (id);


--
-- Name: patient_notes PK_dc96e9d72e43bd35a91edf5af4f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT "PK_dc96e9d72e43bd35a91edf5af4f" PRIMARY KEY (id);


--
-- Name: tenant_feature_modules PK_dd08f74183e364eeddb33afc818; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_feature_modules
    ADD CONSTRAINT "PK_dd08f74183e364eeddb33afc818" PRIMARY KEY (id);


--
-- Name: job_postings PK_dda635ece382c8ad2d90a179182; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_postings
    ADD CONSTRAINT "PK_dda635ece382c8ad2d90a179182" PRIMARY KEY (id);


--
-- Name: invoice_match_items PK_e01bdbdcb3f40e2cb037e2a120a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_match_items
    ADD CONSTRAINT "PK_e01bdbdcb3f40e2cb037e2a120a" PRIMARY KEY (id);


--
-- Name: deployment_health PK_e12a266c7ace6adf4f6f227a209; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_health
    ADD CONSTRAINT "PK_e12a266c7ace6adf4f6f227a209" PRIMARY KEY (id);


--
-- Name: patient_documents PK_e4143f9458241dc676abf823356; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT "PK_e4143f9458241dc676abf823356" PRIMARY KEY (id);


--
-- Name: permission_groups PK_e6d3b6dc86109f8149c4d6c5400; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT "PK_e6d3b6dc86109f8149c4d6c5400" PRIMARY KEY (id);


--
-- Name: cost_centers PK_e70f55c677c255c1f81f0ed1ccb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT "PK_e70f55c677c255c1f81f0ed1ccb" PRIMARY KEY (id);


--
-- Name: labour_records PK_e8a9a0ec65b00f101c20474b175; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labour_records
    ADD CONSTRAINT "PK_e8a9a0ec65b00f101c20474b175" PRIMARY KEY (id);


--
-- Name: purchase_order_items PK_e8b7568d25c41e3290db596b312; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT "PK_e8b7568d25c41e3290db596b312" PRIMARY KEY (id);


--
-- Name: drug_allergy_classes PK_ea665ecb06f5f1e0268b39baa04; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_allergy_classes
    ADD CONSTRAINT "PK_ea665ecb06f5f1e0268b39baa04" PRIMARY KEY (id);


--
-- Name: referrals PK_ea9980e34f738b6252817326c08; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "PK_ea9980e34f738b6252817326c08" PRIMARY KEY (id);


--
-- Name: rfq_vendors PK_ead00c4131c7ac9eaadf6e14f9e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_vendors
    ADD CONSTRAINT "PK_ead00c4131c7ac9eaadf6e14f9e" PRIMARY KEY (id);


--
-- Name: finance_audit_log PK_ecabc7df6cc3da78e8bffd16bdd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_audit_log
    ADD CONSTRAINT "PK_ecabc7df6cc3da78e8bffd16bdd" PRIMARY KEY (id);


--
-- Name: disposal_records PK_ede29deb2b7447f6e294d51865d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_records
    ADD CONSTRAINT "PK_ede29deb2b7447f6e294d51865d" PRIMARY KEY (id);


--
-- Name: stock_transfers PK_ef738a3a4a578c7f1802c1bb50a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "PK_ef738a3a4a578c7f1802c1bb50a" PRIMARY KEY (id);


--
-- Name: doctor_duties PK_f1a28f1b68f653304c39797d769; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_duties
    ADD CONSTRAINT "PK_f1a28f1b68f653304c39797d769" PRIMARY KEY (id);


--
-- Name: purchase_requests PK_f3c5a8ff7bd4338f4c860925c8f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT "PK_f3c5a8ff7bd4338f4c860925c8f" PRIMARY KEY (id);


--
-- Name: icd10_codes PK_f455ed8ffc710ef8cf5513bf82a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icd10_codes
    ADD CONSTRAINT "PK_f455ed8ffc710ef8cf5513bf82a" PRIMARY KEY (code);


--
-- Name: pricing_tiers PK_f5f75ade45fc37142b2cdbaa2f5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_tiers
    ADD CONSTRAINT "PK_f5f75ade45fc37142b2cdbaa2f5" PRIMARY KEY (id);


--
-- Name: wards PK_f67afa72e02ac056570c0dde279; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT "PK_f67afa72e02ac056570c0dde279" PRIMARY KEY (id);


--
-- Name: drug_sync_logs PK_f7ae1760531b43d8c3ce5f9cb17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_sync_logs
    ADD CONSTRAINT "PK_f7ae1760531b43d8c3ce5f9cb17" PRIMARY KEY (id);


--
-- Name: in_app_notifications PK_f871e2a23724692bbb5b3b75c98; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.in_app_notifications
    ADD CONSTRAINT "PK_f871e2a23724692bbb5b3b75c98" PRIMARY KEY (id);


--
-- Name: imaging_orders PK_f8a3689297c2a0f189cb836158e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "PK_f8a3689297c2a0f189cb836158e" PRIMARY KEY (id);


--
-- Name: donor_funds PK_f8c71279533a1ba1ee6b0e6fae6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_funds
    ADD CONSTRAINT "PK_f8c71279533a1ba1ee6b0e6fae6" PRIMARY KEY (id);


--
-- Name: master_data_versions PK_f92416f4b95a00d38f991753929; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_versions
    ADD CONSTRAINT "PK_f92416f4b95a00d38f991753929" PRIMARY KEY (id);


--
-- Name: pricing_rules PK_fda27bb8db4630894decda61ff6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT "PK_fda27bb8db4630894decda61ff6" PRIMARY KEY (id);


--
-- Name: login_history PK_fe377f36d49c39547cb6b9f0727; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT "PK_fe377f36d49c39547cb6b9f0727" PRIMARY KEY (id);


--
-- Name: service_categories PK_fe4da5476c4ffe5aa2d3524ae68; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT "PK_fe4da5476c4ffe5aa2d3524ae68" PRIMARY KEY (id);


--
-- Name: medication_adherence_records PK_fe8c589692b2e7692ea1ac8efb8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_adherence_records
    ADD CONSTRAINT "PK_fe8c589692b2e7692ea1ac8efb8" PRIMARY KEY (id);


--
-- Name: sync_queue PK_ff45aae31ec336e210e9bb34e6b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_queue
    ADD CONSTRAINT "PK_ff45aae31ec336e210e9bb34e6b" PRIMARY KEY (id);


--
-- Name: imaging_results REL_666a89128d0c5a7a09875da6dd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_results
    ADD CONSTRAINT "REL_666a89128d0c5a7a09875da6dd" UNIQUE (imaging_order_id);


--
-- Name: providers REL_842a46f6b0079a69520561eeb6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT "REL_842a46f6b0079a69520561eeb6" UNIQUE (user_id);


--
-- Name: patient_credit_notes UQ_01a6f3b3e3acd96a46826c3bb64; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_credit_notes
    ADD CONSTRAINT "UQ_01a6f3b3e3acd96a46826c3bb64" UNIQUE (note_number);


--
-- Name: lab_samples UQ_058199105fbaf9a51aef48a90df; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "UQ_058199105fbaf9a51aef48a90df" UNIQUE ("sampleNumber");


--
-- Name: invoice_matches UQ_07024a687f21d22f6223ee2ca87; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_matches
    ADD CONSTRAINT "UQ_07024a687f21d22f6223ee2ca87" UNIQUE (match_number);


--
-- Name: antenatal_registrations UQ_0d9fe51b00b6de5b768607dde18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_registrations
    ADD CONSTRAINT "UQ_0d9fe51b00b6de5b768607dde18" UNIQUE (anc_number);


--
-- Name: doctor_duties UQ_0f52003db657aefcf5423d88367; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_duties
    ADD CONSTRAINT "UQ_0f52003db657aefcf5423d88367" UNIQUE (doctor_id, facility_id, duty_date);


--
-- Name: system_features UQ_110bf2a730617b04904652b456c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_features
    ADD CONSTRAINT "UQ_110bf2a730617b04904652b456c" UNIQUE (feature_key);


--
-- Name: items UQ_1b0a705ce0dc5430c020a0ec31f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "UQ_1b0a705ce0dc5430c020a0ec31f" UNIQUE (code);


--
-- Name: licenses UQ_1b3ac7d3db7519c152840de6611; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT "UQ_1b3ac7d3db7519c152840de6611" UNIQUE (license_key);


--
-- Name: tenants UQ_2310ecc5cb8be427097154b18fc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE (slug);


--
-- Name: wards UQ_24f16d2207b1dcb6ce07d81d20f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT "UQ_24f16d2207b1dcb6ce07d81d20f" UNIQUE (code);


--
-- Name: encounters UQ_2f340dc8b043495009e78bad917; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "UQ_2f340dc8b043495009e78bad917" UNIQUE (visit_number);


--
-- Name: patients UQ_2fe90c44da84b034e30bdadb9d0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT "UQ_2fe90c44da84b034e30bdadb9d0" UNIQUE (mrn);


--
-- Name: donor_funds UQ_3237878512e3ab80b1e026bd503; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.donor_funds
    ADD CONSTRAINT "UQ_3237878512e3ab80b1e026bd503" UNIQUE (fund_code);


--
-- Name: vendor_contracts UQ_352fe12cbb7b070c3a62029e5ed; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_contracts
    ADD CONSTRAINT "UQ_352fe12cbb7b070c3a62029e5ed" UNIQUE (contract_number);


--
-- Name: purchase_requests UQ_36f7c0445f64194c8caec1b472c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT "UQ_36f7c0445f64194c8caec1b472c" UNIQUE (request_number);


--
-- Name: imaging_orders UQ_411441fd7acb00c311b5cfc8224; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "UQ_411441fd7acb00c311b5cfc8224" UNIQUE (order_number);


--
-- Name: pre_authorizations UQ_4cd109645c48a01aa8a5d77144b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorizations
    ADD CONSTRAINT "UQ_4cd109645c48a01aa8a5d77144b" UNIQUE (auth_number);


--
-- Name: facility_modules UQ_4d5e222e9b5343d11efb2832ba1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_modules
    ADD CONSTRAINT "UQ_4d5e222e9b5343d11efb2832ba1" UNIQUE (facility_id, module_code);


--
-- Name: permission_groups UQ_4d923def23302dc5da192374bfc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission_groups
    ADD CONSTRAINT "UQ_4d923def23302dc5da192374bfc" UNIQUE (name);


--
-- Name: insurance_providers UQ_4e8b449b3956e99585cdaa4dc29; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_providers
    ADD CONSTRAINT "UQ_4e8b449b3956e99585cdaa4dc29" UNIQUE (code);


--
-- Name: system_settings UQ_5ba7577e3e8902627979745b9db; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT "UQ_5ba7577e3e8902627979745b9db" UNIQUE (key, tenant_id);


--
-- Name: payroll_runs UQ_5e527dde533e49bf08ee4bc9b71; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT "UQ_5e527dde533e49bf08ee4bc9b71" UNIQUE (payroll_number);


--
-- Name: roles UQ_648e3f5447f725579d7d4ffdfb7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE (name);


--
-- Name: theatres UQ_6749438010e036fdedc3ec3a858; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theatres
    ADD CONSTRAINT "UQ_6749438010e036fdedc3ec3a858" UNIQUE (code);


--
-- Name: treatment_plans UQ_6e6bf1b3c55be6c2073ec5d856f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT "UQ_6e6bf1b3c55be6c2073ec5d856f" UNIQUE (plan_number);


--
-- Name: suppliers UQ_6f01a03dcb1aa33822e19534cd6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "UQ_6f01a03dcb1aa33822e19534cd6" UNIQUE (code);


--
-- Name: cashier_sessions UQ_6f0b5deeb0f3ef22158ced76602; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_sessions
    ADD CONSTRAINT "UQ_6f0b5deeb0f3ef22158ced76602" UNIQUE (session_number);


--
-- Name: stores UQ_72bdebc754d6a689b3c169cab8a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT "UQ_72bdebc754d6a689b3c169cab8a" UNIQUE (code);


--
-- Name: admissions UQ_74e48aa72fa810bbae624084dcc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "UQ_74e48aa72fa810bbae624084dcc" UNIQUE ("admissionNumber");


--
-- Name: orders UQ_75eba1c6b1a66b09f2a97e6927b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "UQ_75eba1c6b1a66b09f2a97e6927b" UNIQUE (order_number);


--
-- Name: patient_memberships UQ_82d82a95dd807d0d327b538f36b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_memberships
    ADD CONSTRAINT "UQ_82d82a95dd807d0d327b538f36b" UNIQUE (membership_number);


--
-- Name: emergency_cases UQ_84f113f1f204f051409192d3ef4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "UQ_84f113f1f204f051409192d3ef4" UNIQUE (case_number);


--
-- Name: employees UQ_8878710dc844ecd6f9e587f34fc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "UQ_8878710dc844ecd6f9e587f34fc" UNIQUE (employee_number);


--
-- Name: permissions UQ_8dad765629e83229da6feda1c1d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE (code);


--
-- Name: departments UQ_91fddbe23e927e1e525c152baa3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "UQ_91fddbe23e927e1e525c152baa3" UNIQUE (code);


--
-- Name: patient_deposits UQ_93b041575ccffbb435519239fd3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_deposits
    ADD CONSTRAINT "UQ_93b041575ccffbb435519239fd3" UNIQUE (deposit_number);


--
-- Name: interfacility_transactions UQ_96769c48a75c9da43ef71e633c2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interfacility_transactions
    ADD CONSTRAINT "UQ_96769c48a75c9da43ef71e633c2" UNIQUE (reference_number);


--
-- Name: vendor_rating_summaries UQ_9ad31cda2d277f9c891e336878a; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_rating_summaries
    ADD CONSTRAINT "UQ_9ad31cda2d277f9c891e336878a" UNIQUE (supplier_id);


--
-- Name: billing_points UQ_a07e3e3af8ac40e957bd7d3ba2f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_points
    ADD CONSTRAINT "UQ_a07e3e3af8ac40e957bd7d3ba2f" UNIQUE (code);


--
-- Name: supplier_returns UQ_a497146b6a0d165e4ac2065dc31; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT "UQ_a497146b6a0d165e4ac2065dc31" UNIQUE (return_number);


--
-- Name: user_permissions UQ_a537c48b1f80e8626a71cb56589; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT "UQ_a537c48b1f80e8626a71cb56589" UNIQUE (user_id, permission_id);


--
-- Name: surgery_cases UQ_a652a6c9b70e884a18eb38f81c2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "UQ_a652a6c9b70e884a18eb38f81c2" UNIQUE (case_number);


--
-- Name: payments UQ_a6659e5eb1bf3b467c819e7f167; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "UQ_a6659e5eb1bf3b467c819e7f167" UNIQUE (receipt_number);


--
-- Name: refresh_tokens UQ_a7838d2ba25be1342091b6695f1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE (token_hash);


--
-- Name: appointments UQ_aaee5b216775a0cef6d13f2097e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "UQ_aaee5b216775a0cef6d13f2097e" UNIQUE (appointment_number);


--
-- Name: sample_referrals UQ_ab19f23bd2e621cc6ca9dd698e3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_referrals
    ADD CONSTRAINT "UQ_ab19f23bd2e621cc6ca9dd698e3" UNIQUE ("referralNumber");


--
-- Name: journal_entries UQ_ad8f448e942e0b6efc27101606c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "UQ_ad8f448e942e0b6efc27101606c" UNIQUE (journal_number);


--
-- Name: rfqs UQ_b19e346f96ffd54c4d436a95869; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT "UQ_b19e346f96ffd54c4d436a95869" UNIQUE (rfq_number);


--
-- Name: purchase_orders UQ_b297010fff05faf7baf4e67afa7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "UQ_b297010fff05faf7baf4e67afa7" UNIQUE (order_number);


--
-- Name: lab_tests UQ_b7756de508bcd61121c5aa28b56; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT "UQ_b7756de508bcd61121c5aa28b56" UNIQUE (code);


--
-- Name: labour_records UQ_c6866eabc434ddcac63938f2e00; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labour_records
    ADD CONSTRAINT "UQ_c6866eabc434ddcac63938f2e00" UNIQUE (labour_number);


--
-- Name: service_packages UQ_cad246d7110b2f7cb05225b4eaa; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT "UQ_cad246d7110b2f7cb05225b4eaa" UNIQUE (code);


--
-- Name: referrals UQ_cc46d89ad723e0cfb06ef438327; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "UQ_cc46d89ad723e0cfb06ef438327" UNIQUE (referral_number);


--
-- Name: app_versions UQ_cde2ede409ddea9d486b50b834e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT "UQ_cde2ede409ddea9d486b50b834e" UNIQUE (version);


--
-- Name: prescriptions UQ_d234a398a58d401c4cf7c5951d9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT "UQ_d234a398a58d401c4cf7c5951d9" UNIQUE (prescription_number);


--
-- Name: discharge_summaries UQ_d601ff7ddfd1b27a4ed9340dadc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summaries
    ADD CONSTRAINT "UQ_d601ff7ddfd1b27a4ed9340dadc" UNIQUE (discharge_number);


--
-- Name: invoices UQ_d8f8d3788694e1b3f96c42c36fb; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "UQ_d8f8d3788694e1b3f96c42c36fb" UNIQUE (invoice_number);


--
-- Name: facility_configs UQ_df76ba52b3c5f7267dcdc260c4e; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_configs
    ADD CONSTRAINT "UQ_df76ba52b3c5f7267dcdc260c4e" UNIQUE (facility_id);


--
-- Name: membership_schemes UQ_e01a226ce2d4eb14c57b9c0097d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_schemes
    ADD CONSTRAINT "UQ_e01a226ce2d4eb14c57b9c0097d" UNIQUE (code);


--
-- Name: queue_displays UQ_e2513658463b46101e314030140; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_displays
    ADD CONSTRAINT "UQ_e2513658463b46101e314030140" UNIQUE (display_code);


--
-- Name: follow_ups UQ_e415ed22462f17d6955a4c42d3f; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "UQ_e415ed22462f17d6955a4c42d3f" UNIQUE (appointment_number);


--
-- Name: insurance_claims UQ_e5633a00228c507a174c45e32e0; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "UQ_e5633a00228c507a174c45e32e0" UNIQUE (claim_number);


--
-- Name: pharmacy_sales UQ_eb7780518ad1d58bb195ee3edd6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT "UQ_eb7780518ad1d58bb195ee3edd6" UNIQUE (sale_number);


--
-- Name: services UQ_f019a17cb439406ab185382df9b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "UQ_f019a17cb439406ab185382df9b" UNIQUE (code);


--
-- Name: biometric_data UQ_f142bb4038c448978ca652dc65d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biometric_data
    ADD CONSTRAINT "UQ_f142bb4038c448978ca652dc65d" UNIQUE (user_id, finger_index);


--
-- Name: service_categories UQ_fa8e5034d4e454f1564fa6042cc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT "UQ_fa8e5034d4e454f1564fa6042cc" UNIQUE (code);


--
-- Name: tax_rates UQ_fbcf2dcc3de5f2ac044b05d2ac3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT "UQ_fbcf2dcc3de5f2ac044b05d2ac3" UNIQUE (code);


--
-- Name: goods_receipt_notes UQ_fcaf6e658610326f536de2faaf3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "UQ_fcaf6e658610326f536de2faaf3" UNIQUE (grn_number);


--
-- Name: IDX_008faa8b9422a31733bd7a17a1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_008faa8b9422a31733bd7a17a1" ON public.cashier_sessions USING btree (billing_point_id, opened_at);


--
-- Name: IDX_00d459497429b7681a09308029; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_00d459497429b7681a09308029" ON public.suppliers USING btree (status);


--
-- Name: IDX_00fe8f8b5aa1c40e7460fdfefe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_00fe8f8b5aa1c40e7460fdfefe" ON public.providers USING btree (tenant_id);


--
-- Name: IDX_019abc61671f17c7dd77e5bfcf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_019abc61671f17c7dd77e5bfcf" ON public.lab_results USING btree (status);


--
-- Name: IDX_03481a69cd98a1b78d678862dd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_03481a69cd98a1b78d678862dd" ON public.pharmacy_sales USING btree (status, created_at);


--
-- Name: IDX_03df3183cb1f5334fd624f2283; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_03df3183cb1f5334fd624f2283" ON public.pricing_tiers USING btree (tenant_id);


--
-- Name: IDX_042d3b482596f4dd3607635e7a; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_042d3b482596f4dd3607635e7a" ON public.item_subcategories USING btree (category_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_046713440a98830b619c4c649b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_046713440a98830b619c4c649b" ON public.in_app_notifications USING btree (target_user_id);


--
-- Name: IDX_05a56557807e9d38c66e67e195; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_05a56557807e9d38c66e67e195" ON public.expiry_alert_history USING btree (facility_id, created_at);


--
-- Name: IDX_06967fb9b18360c3a950a3da64; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_06967fb9b18360c3a950a3da64" ON public.insurance_price_lists USING btree (insurance_provider_id, item_id) WHERE ((item_id IS NOT NULL) AND (is_active = true));


--
-- Name: IDX_07af7f9ac261ad4ebe5f8524c0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_07af7f9ac261ad4ebe5f8524c0" ON public.controlled_substance_logs USING btree (facility_id);


--
-- Name: IDX_07b5f918539a78a195515b3976; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_07b5f918539a78a195515b3976" ON public.invoice_items USING btree (reference_type, reference_id);


--
-- Name: IDX_086d3659574db5780a1e3b2022; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_086d3659574db5780a1e3b2022" ON public.facility_modules USING btree (facility_id, enabled);


--
-- Name: IDX_08f7d5e04b578c76c8b79c1ffb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_08f7d5e04b578c76c8b79c1ffb" ON public.deployment_versions USING btree (app_version_id);


--
-- Name: IDX_09e1c5b6577a7b26f049e981b9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_09e1c5b6577a7b26f049e981b9" ON public.stock_ledger USING btree (tenant_id);


--
-- Name: IDX_0a1592a7a19aefa6b5f48de701; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0a1592a7a19aefa6b5f48de701" ON public.deliveries USING btree (tenant_id);


--
-- Name: IDX_0a253be79cae66417d40949f43; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0a253be79cae66417d40949f43" ON public.vendor_quotations USING btree (rfq_id, supplier_id);


--
-- Name: IDX_0a567f53589e603b14a5df1054; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0a567f53589e603b14a5df1054" ON public.emergency_cases USING btree (tenant_id);


--
-- Name: IDX_0b4a90889c05119ca76090734e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0b4a90889c05119ca76090734e" ON public.item_units USING btree (tenant_id);


--
-- Name: IDX_0b74e4271b801bfa7919114133; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0b74e4271b801bfa7919114133" ON public.pricing_tiers USING btree (tenant_id, name);


--
-- Name: IDX_0c4aa809ddf5b0c6ca45d8a8e8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0c4aa809ddf5b0c6ca45d8a8e8" ON public.items USING btree (category_id);


--
-- Name: IDX_0d8abdd1fc98950881713b684a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0d8abdd1fc98950881713b684a" ON public.temperature_logs USING btree (is_alert, acknowledged_at, tenant_id);


--
-- Name: IDX_0d94e582b2132b1b966b695c7d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0d94e582b2132b1b966b695c7d" ON public.sync_conflicts USING btree (facility_id, resolution);


--
-- Name: IDX_0def5a8f767d73d98ec7491168; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0def5a8f767d73d98ec7491168" ON public.stock_ledger USING btree (created_at);


--
-- Name: IDX_0e8513cbaa7124a81ae262a30b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0e8513cbaa7124a81ae262a30b" ON public.prescription_templates USING btree (tenant_id, created_by_id);


--
-- Name: IDX_0f5b7d10c33fd6432f7b263604; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0f5b7d10c33fd6432f7b263604" ON public.purchase_order_items USING btree (tenant_id);


--
-- Name: IDX_0f91dd7ce3f7ed07b27af736a4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_0f91dd7ce3f7ed07b27af736a4" ON public.vendor_ratings USING btree (created_at);


--
-- Name: IDX_10037beb5ca4587e149e18e489; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_10037beb5ca4587e149e18e489" ON public.wards USING btree (tenant_id);


--
-- Name: IDX_104426fe1660ad273348c06244; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_104426fe1660ad273348c06244" ON public.referrals USING btree (tenant_id);


--
-- Name: IDX_109638590074998bb72a2f2cf0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_109638590074998bb72a2f2cf0" ON public.users USING btree (tenant_id);


--
-- Name: IDX_10f3bb26864d25c2e0310540da; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_10f3bb26864d25c2e0310540da" ON public.drug_interactions USING btree (drug_a_id, drug_b_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_110bf2a730617b04904652b456; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_110bf2a730617b04904652b456" ON public.system_features USING btree (feature_key);


--
-- Name: IDX_117870fc849e1555da99d169e0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_117870fc849e1555da99d169e0" ON public.icd10_codes USING btree (category);


--
-- Name: IDX_11dfc7a2e25580da41e3b408ef; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_11dfc7a2e25580da41e3b408ef" ON public.batch_stock_balances USING btree (expiry_date);


--
-- Name: IDX_12a9526c4c05ed96a95cafeaca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_12a9526c4c05ed96a95cafeaca" ON public.shift_definitions USING btree (tenant_id);


--
-- Name: IDX_12d6fa010df6ac973700d174da; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_12d6fa010df6ac973700d174da" ON public.lab_results USING btree (tenant_id);


--
-- Name: IDX_14187aa4d2d58318c82c62c7ea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_14187aa4d2d58318c82c62c7ea" ON public.refresh_tokens USING btree (user_id, is_revoked);


--
-- Name: IDX_1434bae2810cb510a0743890fa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1434bae2810cb510a0743890fa" ON public.pre_authorizations USING btree (tenant_id);


--
-- Name: IDX_146fd7019eea73f8ee7bbb52d4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_146fd7019eea73f8ee7bbb52d4" ON public.departments USING btree (tenant_id);


--
-- Name: IDX_1517771ef42a3b52d9a212a6e8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1517771ef42a3b52d9a212a6e8" ON public.expiry_alerts USING btree (tenant_id);


--
-- Name: IDX_152b2f49d05c22c4766022365a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_152b2f49d05c22c4766022365a" ON public.pos_shifts USING btree (tenant_id, register_id);


--
-- Name: IDX_156cd3e5710ec8c0a4bbe7865f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_156cd3e5710ec8c0a4bbe7865f" ON public.user_roles USING btree (tenant_id);


--
-- Name: IDX_1575b669ee0bd02e59f50347d6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1575b669ee0bd02e59f50347d6" ON public.support_access_requests USING btree (tenant_id, status);


--
-- Name: IDX_15c62c608fbdbc93f95db0d8cf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_15c62c608fbdbc93f95db0d8cf" ON public.master_data_approval_rules USING btree (tenant_id);


--
-- Name: IDX_16e4b428fa2c7a7c3994e6c36e; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_16e4b428fa2c7a7c3994e6c36e" ON public.diagnoses USING btree (icd10_code, tenant_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_1782fdc8531f328557a7e55922; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1782fdc8531f328557a7e55922" ON public.vendor_quotations USING btree (status);


--
-- Name: IDX_17b424a1cd2858d4054632059e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_17b424a1cd2858d4054632059e" ON public.patients USING btree (full_name, date_of_birth);


--
-- Name: IDX_17d16526bc399a548ceae7487d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_17d16526bc399a548ceae7487d" ON public.labour_records USING btree (tenant_id);


--
-- Name: IDX_1843230d4c3b3a2e54ff68a1f4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1843230d4c3b3a2e54ff68a1f4" ON public.reagent_lots USING btree (tenant_id);


--
-- Name: IDX_18615dd154f4ad615267671093; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_18615dd154f4ad615267671093" ON public.cashier_sessions USING btree (tenant_id);


--
-- Name: IDX_1997bfe011e0c157333a00703d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1997bfe011e0c157333a00703d" ON public.discharge_summaries USING btree (patient_id);


--
-- Name: IDX_1a456950e7188aa5bb7fddd925; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1a456950e7188aa5bb7fddd925" ON public.medication_adherence_records USING btree (tenant_id);


--
-- Name: IDX_1b0a705ce0dc5430c020a0ec31; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_1b0a705ce0dc5430c020a0ec31" ON public.items USING btree (code);


--
-- Name: IDX_1b1b242da355b9c38e464184e4; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_1b1b242da355b9c38e464184e4" ON public.drug_classifications USING btree (item_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_1b3ac7d3db7519c152840de661; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_1b3ac7d3db7519c152840de661" ON public.licenses USING btree (license_key);


--
-- Name: IDX_1b5cd21ce65c2949341c36cc8c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1b5cd21ce65c2949341c36cc8c" ON public.biometric_data USING btree (tenant_id);


--
-- Name: IDX_1bb7dabf480b109ef63273d4c6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1bb7dabf480b109ef63273d4c6" ON public.clinical_notes USING btree (encounter_id, created_at);


--
-- Name: IDX_1be5b5db098cafc5cd45bbd34b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1be5b5db098cafc5cd45bbd34b" ON public.goods_receipt_items USING btree (goods_receipt_note_id);


--
-- Name: IDX_1bf116918b1aaf14fbbfd80ad6; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_1bf116918b1aaf14fbbfd80ad6" ON public.insurance_price_lists USING btree (insurance_provider_id, lab_test_id) WHERE (lab_test_id IS NOT NULL);


--
-- Name: IDX_1c49016cb857e99824a64af5ec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1c49016cb857e99824a64af5ec" ON public.immunization_schedules USING btree (tenant_id);


--
-- Name: IDX_1c586cd457d457ee6cefb73a6b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1c586cd457d457ee6cefb73a6b" ON public.sync_queue USING btree (client_id, created_at);


--
-- Name: IDX_1caa5edd6bd193924bcf09d3e6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1caa5edd6bd193924bcf09d3e6" ON public.queues USING btree (tenant_id);


--
-- Name: IDX_1e23017f3b56fa3ee6611392c4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1e23017f3b56fa3ee6611392c4" ON public.patients USING btree (full_name);


--
-- Name: IDX_1eaae6588685fa7f53bff98640; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1eaae6588685fa7f53bff98640" ON public.vendor_quotation_items USING btree (tenant_id);


--
-- Name: IDX_1f8d1173481678a035b4a81a4e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1f8d1173481678a035b4a81a4e" ON public.services USING btree (category_id);


--
-- Name: IDX_1fa0a81f5df5664c563aa5be49; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_1fa0a81f5df5664c563aa5be49" ON public.expiry_alerts USING btree (expiry_date);


--
-- Name: IDX_2078ea628bb9833cab3a01d5fe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2078ea628bb9833cab3a01d5fe" ON public.vendor_contracts USING btree (end_date);


--
-- Name: IDX_21b4c71c7ab2d8ac04be7691a4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_21b4c71c7ab2d8ac04be7691a4" ON public.patients USING btree (tenant_id);


--
-- Name: IDX_21c9a98b6fd3d9d47b592280f8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_21c9a98b6fd3d9d47b592280f8" ON public.master_data_versions USING btree (created_at);


--
-- Name: IDX_21d832caeb26ee18f3a27f3b51; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_21d832caeb26ee18f3a27f3b51" ON public.temperature_sensors USING btree (tenant_id, facility_id);


--
-- Name: IDX_22375ca9f9867a6370267d928a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_22375ca9f9867a6370267d928a" ON public.items USING btree (subcategory_id);


--
-- Name: IDX_22a131a0e33a353be546491912; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_22a131a0e33a353be546491912" ON public.in_app_notifications USING btree (tenant_id);


--
-- Name: IDX_22aa22eb69a1e6826a1f58902d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_22aa22eb69a1e6826a1f58902d" ON public.sessions USING btree (tenant_id);


--
-- Name: IDX_2310ecc5cb8be427097154b18f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_2310ecc5cb8be427097154b18f" ON public.tenants USING btree (slug);


--
-- Name: IDX_23348b3976f647d15295f20342; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_23348b3976f647d15295f20342" ON public.staff_rosters USING btree (employee_id, roster_date);


--
-- Name: IDX_237678c98436e0abb48b3060c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_237678c98436e0abb48b3060c8" ON public.purchase_orders USING btree (tenant_id);


--
-- Name: IDX_246fe1b78ecb0d9f1fd8f9c87c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_246fe1b78ecb0d9f1fd8f9c87c" ON public.qc_levey_jennings_data USING btree (qc_material_id, data_date);


--
-- Name: IDX_2478c01bc814c56c38a0b9bca9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2478c01bc814c56c38a0b9bca9" ON public.rfq_items USING btree (tenant_id);


--
-- Name: IDX_247d440ff32f1ec7c29e44b06c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_247d440ff32f1ec7c29e44b06c" ON public.purchase_orders USING btree (created_at);


--
-- Name: IDX_24cee900eb9b3c0d565c4ac62f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_24cee900eb9b3c0d565c4ac62f" ON public.stock_balances USING btree (item_id, facility_id);


--
-- Name: IDX_24f38221b4c8f5c458e780cd5d; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_24f38221b4c8f5c458e780cd5d" ON public.asset_depreciations USING btree (asset_id, period_year, period_month);


--
-- Name: IDX_25d24010f53bb80b78e412c965; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_25d24010f53bb80b78e412c965" ON public.role_permissions USING btree (role_id, permission_id);


--
-- Name: IDX_263e44ef0d19a0c64385ef1787; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_263e44ef0d19a0c64385ef1787" ON public.disposal_records USING btree (tenant_id);


--
-- Name: IDX_274dc3d3aa9198a1a5ded99e3b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_274dc3d3aa9198a1a5ded99e3b" ON public.role_permission_groups USING btree (tenant_id);


--
-- Name: IDX_28926e2be66e55c640b99b6dbe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_28926e2be66e55c640b99b6dbe" ON public.asset_depreciations USING btree (tenant_id);


--
-- Name: IDX_28fb69fb259a8512c2968e0368; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_28fb69fb259a8512c2968e0368" ON public.wholesale_customers USING btree (tenant_id, name);


--
-- Name: IDX_2981d39027084a1ffcb0013b81; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2981d39027084a1ffcb0013b81" ON public.wholesale_customers USING btree (tenant_id);


--
-- Name: IDX_29ff514387ae0912833e3f0bca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_29ff514387ae0912833e3f0bca" ON public.lab_samples USING btree (tenant_id);


--
-- Name: IDX_2a570d8b10401e299fc6295d44; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_2a570d8b10401e299fc6295d44" ON public.storage_conditions USING btree (facility_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_2bb5f8192cf91d65040b68a0a5; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_2bb5f8192cf91d65040b68a0a5" ON public.queues USING btree (facility_id, ticket_number, queue_date);


--
-- Name: IDX_2bc5fb666b382723700bb4c1e7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2bc5fb666b382723700bb4c1e7" ON public.tenants USING btree (tenant_id);


--
-- Name: IDX_2c211a073170ae051bb52e6685; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2c211a073170ae051bb52e6685" ON public.system_settings USING btree (tenant_id);


--
-- Name: IDX_2cd10fda8276bb995288acfbfb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2cd10fda8276bb995288acfbfb" ON public.audit_logs USING btree (created_at);


--
-- Name: IDX_2ce53d4299f3ed09bf0c4b8da3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2ce53d4299f3ed09bf0c4b8da3" ON public.quotation_approvals USING btree (quotation_id);


--
-- Name: IDX_2e4d60d1ae658dfd51ed8128c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2e4d60d1ae658dfd51ed8128c8" ON public.item_strengths USING btree (facility_id, name);


--
-- Name: IDX_2e9e3b8a600ed4f0695dacc6be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2e9e3b8a600ed4f0695dacc6be" ON public.quotation_approvals USING btree (tenant_id);


--
-- Name: IDX_2f340dc8b043495009e78bad91; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_2f340dc8b043495009e78bad91" ON public.encounters USING btree (visit_number);


--
-- Name: IDX_2f9cfbd4df8f269ce407aa853a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_2f9cfbd4df8f269ce407aa853a" ON public.surgery_cases USING btree (tenant_id);


--
-- Name: IDX_3109f6c28209c0d06b0faea167; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3109f6c28209c0d06b0faea167" ON public.training_enrollments USING btree (tenant_id);


--
-- Name: IDX_31400bd808c90728a5de085ac5; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_31400bd808c90728a5de085ac5" ON public.fixed_assets USING btree (serial_number) WHERE ((deleted_at IS NULL) AND (serial_number IS NOT NULL));


--
-- Name: IDX_31abe1cedd6056aa6d5588ffa0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_31abe1cedd6056aa6d5588ffa0" ON public.finance_audit_log USING btree (created_at);


--
-- Name: IDX_31b0e677d1904b7b9a05e13096; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_31b0e677d1904b7b9a05e13096" ON public.rfqs USING btree (tenant_id);


--
-- Name: IDX_33afb49b87d26353a0c641f904; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_33afb49b87d26353a0c641f904" ON public.encounters USING btree (patient_id, status);


--
-- Name: IDX_33efa5e44c1adf8b0555e7863c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_33efa5e44c1adf8b0555e7863c" ON public.petty_cash_funds USING btree (tenant_id);


--
-- Name: IDX_341128a1ab209145a2763b6679; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_341128a1ab209145a2763b6679" ON public.item_units USING btree (facility_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_349c6ac6386ed60438fa138b2a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_349c6ac6386ed60438fa138b2a" ON public.budget_lines USING btree (tenant_id);


--
-- Name: IDX_34eeab5d3072bfe3f3b30e67ac; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_34eeab5d3072bfe3f3b30e67ac" ON public.facility_configs USING btree (tenant_id);


--
-- Name: IDX_352fe12cbb7b070c3a62029e5e; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_352fe12cbb7b070c3a62029e5e" ON public.vendor_contracts USING btree (contract_number);


--
-- Name: IDX_3646da1f1054fc317c3fa23297; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_3646da1f1054fc317c3fa23297" ON public.item_formulations USING btree (facility_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_36f7c0445f64194c8caec1b472; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_36f7c0445f64194c8caec1b472" ON public.purchase_requests USING btree (request_number);


--
-- Name: IDX_3a1d99219e2ee3e060570b7fc6; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_3a1d99219e2ee3e060570b7fc6" ON public.temperature_sensors USING btree (sensor_id, tenant_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_3a6aa90859d51b79ab0e1ad138; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3a6aa90859d51b79ab0e1ad138" ON public.sync_queue USING btree (facility_id, status);


--
-- Name: IDX_3b5a3d6d26ec92cbdd54a81ae3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b5a3d6d26ec92cbdd54a81ae3" ON public.drug_label_templates USING btree (is_default, tenant_id);


--
-- Name: IDX_3b8a82d847521d8a9dab4a83f3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3b8a82d847521d8a9dab4a83f3" ON public.shift_swap_requests USING btree (tenant_id);


--
-- Name: IDX_3c08db71bcace96573e92a7d6d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3c08db71bcace96573e92a7d6d" ON public.support_access_requests USING btree (tenant_id);


--
-- Name: IDX_3cb4a479ca23af321ace9fd8b1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3cb4a479ca23af321ace9fd8b1" ON public.sms_templates USING btree (tenant_id);


--
-- Name: IDX_3cd0cff920447f68ec75f7285a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3cd0cff920447f68ec75f7285a" ON public.update_rollouts USING btree ("startDate", "endDate");


--
-- Name: IDX_3d2d56f44cb68b68c69d031c40; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3d2d56f44cb68b68c69d031c40" ON public.drug_interactions USING btree (tenant_id);


--
-- Name: IDX_3ee250c72c56ceba79294f22d4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3ee250c72c56ceba79294f22d4" ON public.finance_audit_log USING btree (entity_type, entity_id);


--
-- Name: IDX_3f92bb44026cedfe235c8b9124; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3f92bb44026cedfe235c8b9124" ON public.purchase_order_items USING btree (purchase_order_id);


--
-- Name: IDX_3fa49d653ed14b97f0ebe27573; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_3fa49d653ed14b97f0ebe27573" ON public.treatment_plans USING btree (tenant_id);


--
-- Name: IDX_406c43f66775b0c2c018f18ae6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_406c43f66775b0c2c018f18ae6" ON public.medication_adherence_records USING btree (prescription_item_id);


--
-- Name: IDX_41295d1470b1d179ab4812cfc4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_41295d1470b1d179ab4812cfc4" ON public.emergency_cases USING btree (triage_level, status);


--
-- Name: IDX_4134a0bbb939e97749265733f0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4134a0bbb939e97749265733f0" ON public.invoices USING btree (status, created_at);


--
-- Name: IDX_416055516c115bc14cf34f012d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_416055516c115bc14cf34f012d" ON public.prescriptions USING btree (tenant_id);


--
-- Name: IDX_4193b1ae4de709f9e69be23a3e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4193b1ae4de709f9e69be23a3e" ON public.staff_rosters USING btree (facility_id, roster_date);


--
-- Name: IDX_438f5776907c64de775246ceae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_438f5776907c64de775246ceae" ON public.patient_notes USING btree (patient_id, created_at);


--
-- Name: IDX_43d4f969c030c4a0b227db37a2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_43d4f969c030c4a0b227db37a2" ON public.patient_reminders USING btree (status, scheduled_for);


--
-- Name: IDX_440f531f452dcc4389d201b9d4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_440f531f452dcc4389d201b9d4" ON public.invoices USING btree (tenant_id);


--
-- Name: IDX_44e5b4fea05cbfcf133f5cf47d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_44e5b4fea05cbfcf133f5cf47d" ON public.stores USING btree (facility_id);


--
-- Name: IDX_44fc0d9b3686ea65023d34a91e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_44fc0d9b3686ea65023d34a91e" ON public.vendor_ratings USING btree (supplier_id);


--
-- Name: IDX_451f004e5dea3e423a13c5d08f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_451f004e5dea3e423a13c5d08f" ON public.reagent_lots USING btree (reagent_id, lot_number) WHERE (deleted_at IS NULL);


--
-- Name: IDX_461a0baffd0357a783a85ff76a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_461a0baffd0357a783a85ff76a" ON public.lab_equipment USING btree (tenant_id);


--
-- Name: IDX_461e33406159b8db0e3905cffa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_461e33406159b8db0e3905cffa" ON public.tax_exemptions USING btree (tenant_id);


--
-- Name: IDX_47063252baa40ac5a7f988798a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_47063252baa40ac5a7f988798a" ON public.replication_logs USING btree ("entityType", "operationType");


--
-- Name: IDX_4874cb226d4c3720c990c1ecee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4874cb226d4c3720c990c1ecee" ON public.supplier_return_items USING btree (tenant_id);


--
-- Name: IDX_491dfaf10d4e5e08ed2fe13f9c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_491dfaf10d4e5e08ed2fe13f9c" ON public.pharmacy_sale_items USING btree (sale_id);


--
-- Name: IDX_4939b6f4e5eb70f769607ac2a3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4939b6f4e5eb70f769607ac2a3" ON public.billing_points USING btree (tenant_id);


--
-- Name: IDX_496910b6f719ba5dbf30976c04; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_496910b6f719ba5dbf30976c04" ON public.purchase_request_items USING btree (tenant_id);


--
-- Name: IDX_4c0727a131644d680e44c3d2aa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4c0727a131644d680e44c3d2aa" ON public.leave_requests USING btree (tenant_id);


--
-- Name: IDX_4c7da0c5b0fe844ff979a87e00; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4c7da0c5b0fe844ff979a87e00" ON public.patient_merges USING btree (primary_patient_id);


--
-- Name: IDX_4cd67c1d8104d7d3a27ec567f8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4cd67c1d8104d7d3a27ec567f8" ON public.supplier_returns USING btree (status);


--
-- Name: IDX_4da628e59801421274e35355b1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4da628e59801421274e35355b1" ON public.deployments USING btree (tenant_id);


--
-- Name: IDX_4e62e2a04d421c8196608b9a50; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4e62e2a04d421c8196608b9a50" ON public.service_prices USING btree (tenant_id);


--
-- Name: IDX_4ea9bc5674d2aae38f1dc6f976; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4ea9bc5674d2aae38f1dc6f976" ON public.tenant_feature_modules USING btree (tenant_id, module_key);


--
-- Name: IDX_4edc8c4aa67dfa393e72fe2fb1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4edc8c4aa67dfa393e72fe2fb1" ON public.asset_transfers USING btree (tenant_id);


--
-- Name: IDX_4f5dfa0066c8d538aa731bf684; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4f5dfa0066c8d538aa731bf684" ON public.insurance_claims USING btree (tenant_id);


--
-- Name: IDX_4fa5fc0d6692944ede4284e921; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4fa5fc0d6692944ede4284e921" ON public.lab_reagents USING btree (tenant_id);


--
-- Name: IDX_4fb3b680797d764fa6c9a40887; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_4fb3b680797d764fa6c9a40887" ON public.qc_results USING btree (tenant_id);


--
-- Name: IDX_502fb4878c10a60fef801c82e5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_502fb4878c10a60fef801c82e5" ON public.lab_samples USING btree (status, created_at);


--
-- Name: IDX_50ca21beefce71173cb579417e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_50ca21beefce71173cb579417e" ON public.supplier_return_items USING btree (supplier_return_id);


--
-- Name: IDX_50d98326f4b32d22cd4e10b720; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_50d98326f4b32d22cd4e10b720" ON public.discharge_summaries USING btree (tenant_id);


--
-- Name: IDX_50dc15c325df2b7f1ab73c9d7b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_50dc15c325df2b7f1ab73c9d7b" ON public.referrals USING btree (created_at);


--
-- Name: IDX_5164f330018a8eed6ca3300cab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5164f330018a8eed6ca3300cab" ON public.goods_receipt_items USING btree (tenant_id);


--
-- Name: IDX_5272ac3aa931eedb14cd8789d6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5272ac3aa931eedb14cd8789d6" ON public.purchase_orders USING btree (status);


--
-- Name: IDX_527dd6efd5f3402f729c6b3e82; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_527dd6efd5f3402f729c6b3e82" ON public.orders USING btree (tenant_id);


--
-- Name: IDX_52a92000cae40f9f051ba0d545; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_52a92000cae40f9f051ba0d545" ON public.orders USING btree (encounter_id, order_type);


--
-- Name: IDX_52c751423b8e150103613b2999; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_52c751423b8e150103613b2999" ON public.storage_conditions USING btree (tenant_id);


--
-- Name: IDX_53067ed5ea77dc71f4cac07427; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_53067ed5ea77dc71f4cac07427" ON public.users USING btree (username, tenant_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_5442fbf60b0dccb137f13dd012; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5442fbf60b0dccb137f13dd012" ON public.clinical_notes USING btree (tenant_id);


--
-- Name: IDX_548b1ee5c913d2cb1666ebb088; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_548b1ee5c913d2cb1666ebb088" ON public.lab_reagents USING btree (code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_548d16709a88eece700ce66620; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_548d16709a88eece700ce66620" ON public.purchase_request_items USING btree (purchase_request_id);


--
-- Name: IDX_554d20493f45b04d3cf42e35d1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_554d20493f45b04d3cf42e35d1" ON public.expiry_alerts USING btree (status);


--
-- Name: IDX_563a5e248518c623eebd987d43; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_563a5e248518c623eebd987d43" ON public.payments USING btree (invoice_id);


--
-- Name: IDX_56e83e90b2824c561db07feb70; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_56e83e90b2824c561db07feb70" ON public.finance_audit_log USING btree (user_id);


--
-- Name: IDX_5747865497f7b75c27f21ea897; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5747865497f7b75c27f21ea897" ON public.qc_materials USING btree (tenant_id);


--
-- Name: IDX_57922f8f4cfeb25283a7301594; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_57922f8f4cfeb25283a7301594" ON public.rx_notification_logs USING btree (tenant_id, prescription_id);


--
-- Name: IDX_57cf365176c056c01f7b1d0ec9; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_57cf365176c056c01f7b1d0ec9" ON public.fixed_assets USING btree (asset_code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_580629cb45849fe216eabfb43f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_580629cb45849fe216eabfb43f" ON public.supplier_payment_items USING btree (tenant_id);


--
-- Name: IDX_587d8d9d60394238411fb73b0e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_587d8d9d60394238411fb73b0e" ON public.delivery_outcomes USING btree (tenant_id);


--
-- Name: IDX_588a2cdb38303a709030628ad9; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_588a2cdb38303a709030628ad9" ON public.cost_centers USING btree (facility_id, code);


--
-- Name: IDX_58da714016354f054ba45f689e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_58da714016354f054ba45f689e" ON public.release_candidates USING btree ("appVersionId", stage);


--
-- Name: IDX_596a1ba8a0d1347f12441cd1aa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_596a1ba8a0d1347f12441cd1aa" ON public.temperature_logs USING btree (tenant_id, facility_id);


--
-- Name: IDX_59ce1569bf874abf7f84b2e5f7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_59ce1569bf874abf7f84b2e5f7" ON public.pricing_rules USING btree (rule_type, is_active);


--
-- Name: IDX_5a531e025fdbcfb9e6bd7badb0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5a531e025fdbcfb9e6bd7badb0" ON public.drug_label_templates USING btree (language, label_type, tenant_id);


--
-- Name: IDX_5ab25ecb2bd5f0f6b491d11f24; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_5ab25ecb2bd5f0f6b491d11f24" ON public.lab_equipment USING btree (asset_code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_5abab802842fe19f375431c1bd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5abab802842fe19f375431c1bd" ON public.replication_logs USING btree ("tenantId", "deploymentId", status);


--
-- Name: IDX_5b5720d9645cee7396595a16c9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5b5720d9645cee7396595a16c9" ON public.suppliers USING btree (name);


--
-- Name: IDX_5ba6ece39b3a6299a3d4906c30; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5ba6ece39b3a6299a3d4906c30" ON public.sample_referrals USING btree ("toFacilityId", stage);


--
-- Name: IDX_5c26d013040d1599a5e52aada8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5c26d013040d1599a5e52aada8" ON public.goods_receipt_notes USING btree (tenant_id);


--
-- Name: IDX_5c4b79d0d16577b4e82031dd20; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5c4b79d0d16577b4e82031dd20" ON public.patient_problems USING btree (patient_id, diagnosis_id, status) WHERE (deleted_at IS NULL);


--
-- Name: IDX_5c769a69258f19c4906dabffd7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5c769a69258f19c4906dabffd7" ON public.dispensations USING btree (tenant_id);


--
-- Name: IDX_5cba72118c885bcdaa0fb39efa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5cba72118c885bcdaa0fb39efa" ON public.stock_transfer_items USING btree (item_id);


--
-- Name: IDX_5dba072d183419e94fcd04b946; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5dba072d183419e94fcd04b946" ON public.equipment_calibrations USING btree (tenant_id);


--
-- Name: IDX_5ec57aa71c97d2447c6db60adb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5ec57aa71c97d2447c6db60adb" ON public.patient_reminders USING btree (patient_id, scheduled_for);


--
-- Name: IDX_5fe2ad1be70082e680f43e5d2e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_5fe2ad1be70082e680f43e5d2e" ON public.change_sets USING btree ("tenantId", status);


--
-- Name: IDX_6112f5e4e1430579916d555d0c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6112f5e4e1430579916d555d0c" ON public.pharmacy_sales USING btree (patient_id);


--
-- Name: IDX_614c777675e9bd6a7e5d4772a4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_614c777675e9bd6a7e5d4772a4" ON public.facilities USING btree (tenant_id);


--
-- Name: IDX_6280f7fcfacde09941cc195e6d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6280f7fcfacde09941cc195e6d" ON public.budgets USING btree (facility_id, fiscal_year);


--
-- Name: IDX_6295c28e3a121947ccb5c0fdb2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6295c28e3a121947ccb5c0fdb2" ON public.rfq_vendors USING btree (tenant_id);


--
-- Name: IDX_62a9da407f96d3697b1a9a64ee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_62a9da407f96d3697b1a9a64ee" ON public.update_rollouts USING btree ("releaseCandidateId", status);


--
-- Name: IDX_62aadf1ec52822d2ba8dfe3f4e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_62aadf1ec52822d2ba8dfe3f4e" ON public.disposal_records USING btree (facility_id, created_at);


--
-- Name: IDX_62c121bace6104e4fca67eb430; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_62c121bace6104e4fca67eb430" ON public.doctor_duties USING btree (facility_id, duty_date);


--
-- Name: IDX_62cafbd269bbc61bbc8bc07a88; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_62cafbd269bbc61bbc8bc07a88" ON public.theatres USING btree (tenant_id);


--
-- Name: IDX_62cddd61d7f7a3f855464290a1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_62cddd61d7f7a3f855464290a1" ON public.vendor_contracts USING btree (tenant_id);


--
-- Name: IDX_632285b8098b7082139991eb16; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_632285b8098b7082139991eb16" ON public.bank_reconciliation_items USING btree (tenant_id);


--
-- Name: IDX_63b70b2b7f36ddc0724b35dfed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_63b70b2b7f36ddc0724b35dfed" ON public.beds USING btree (tenant_id);


--
-- Name: IDX_63e0235e3caae08bf2300fc1ed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_63e0235e3caae08bf2300fc1ed" ON public.item_brands USING btree (tenant_id);


--
-- Name: IDX_63f821bc7f521e4f122b07f2c1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_63f821bc7f521e4f122b07f2c1" ON public.item_brands USING btree (facility_id, name);


--
-- Name: IDX_6409bb21bd8f5fc2691cec8a42; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_6409bb21bd8f5fc2691cec8a42" ON public.providers USING btree (license_number) WHERE ((deleted_at IS NULL) AND (license_number IS NOT NULL));


--
-- Name: IDX_64d09e6c0808ee40d03befed64; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_64d09e6c0808ee40d03befed64" ON public.deliveries USING btree (tenant_id, sale_id);


--
-- Name: IDX_65745cd061c375a010689657cc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_65745cd061c375a010689657cc" ON public.prescription_templates USING btree (tenant_id);


--
-- Name: IDX_65cb96f7573dd182ad4ec259f9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_65cb96f7573dd182ad4ec259f9" ON public.delegations USING btree (delegator_id);


--
-- Name: IDX_65e78a521cbef64720491f3a0d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_65e78a521cbef64720491f3a0d" ON public.stock_transfers USING btree (tenant_id);


--
-- Name: IDX_662c9875a22cb1e3c51d034b39; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_662c9875a22cb1e3c51d034b39" ON public.interfacility_transactions USING btree (tenant_id);


--
-- Name: IDX_666098f947b59847c765614172; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_666098f947b59847c765614172" ON public.finance_audit_log USING btree (tenant_id);


--
-- Name: IDX_671c29371b50870cc61de767b1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_671c29371b50870cc61de767b1" ON public.icd10_codes USING btree (description);


--
-- Name: IDX_675d778eb03abb50eb4e519bb8; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_675d778eb03abb50eb4e519bb8" ON public.qc_materials USING btree (code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_684c0b598d96dd13c543d5f662; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_684c0b598d96dd13c543d5f662" ON public.rx_notification_logs USING btree (tenant_id, notification_type);


--
-- Name: IDX_686f84b1b1f136a49560e33075; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_686f84b1b1f136a49560e33075" ON public.permission_groups USING btree (tenant_id);


--
-- Name: IDX_68a7d17162b78d0edb680ca944; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_68a7d17162b78d0edb680ca944" ON public.common_drug_translations USING btree (tenant_id);


--
-- Name: IDX_6940a8be277e1c374283023c1c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6940a8be277e1c374283023c1c" ON public.medication_administrations USING btree (prescription_item_id);


--
-- Name: IDX_69514139889223d5b2611e3a3b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_69514139889223d5b2611e3a3b" ON public.pos_shifts USING btree (tenant_id);


--
-- Name: IDX_6a0f024e84c92b964c516aa7b7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6a0f024e84c92b964c516aa7b7" ON public.stock_transfer_items USING btree (transfer_id);


--
-- Name: IDX_6adb2697055c2c58c01d2865f6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6adb2697055c2c58c01d2865f6" ON public.imaging_modalities USING btree (tenant_id);


--
-- Name: IDX_6ae39352c06295d45ecd5639f3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6ae39352c06295d45ecd5639f3" ON public.drug_label_templates USING btree (tenant_id);


--
-- Name: IDX_6b40e30cff4faac455f7665c01; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6b40e30cff4faac455f7665c01" ON public.price_agreements USING btree (status);


--
-- Name: IDX_6b72fa7bb13736644bb1e68a4a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6b72fa7bb13736644bb1e68a4a" ON public.insurance_policies USING btree (tenant_id);


--
-- Name: IDX_6b7a18b94b9bb55b2ac44baee8; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_6b7a18b94b9bb55b2ac44baee8" ON public.patients USING btree (national_id) WHERE ((national_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: IDX_6bbf0b8664e146bfd40c81c0df; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6bbf0b8664e146bfd40c81c0df" ON public.stock_transfer_items USING btree (tenant_id);


--
-- Name: IDX_6c6417a85e501f13776bb0fec2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6c6417a85e501f13776bb0fec2" ON public.follow_ups USING btree (tenant_id);


--
-- Name: IDX_6c7ddbe4432bb899ab29c1ec6c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6c7ddbe4432bb899ab29c1ec6c" ON public.item_categories USING btree (facility_id, name);


--
-- Name: IDX_6d8df26e261f4e1a678a5b4c84; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6d8df26e261f4e1a678a5b4c84" ON public.pos_shifts USING btree (tenant_id, cashier_id);


--
-- Name: IDX_6dbd057ba141c991e18ed594cb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6dbd057ba141c991e18ed594cb" ON public.drug_allergy_classes USING btree (tenant_id);


--
-- Name: IDX_6dce028f7d762dcf5766472882; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6dce028f7d762dcf5766472882" ON public.sample_referrals USING btree ("fromFacilityId", stage);


--
-- Name: IDX_6dea22d022554e7169a47468d6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6dea22d022554e7169a47468d6" ON public.master_data_versions USING btree (tenant_id);


--
-- Name: IDX_6e6bf1b3c55be6c2073ec5d856; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_6e6bf1b3c55be6c2073ec5d856" ON public.treatment_plans USING btree (plan_number);


--
-- Name: IDX_6e7e30b7985d7e9fe6e86aa30c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6e7e30b7985d7e9fe6e86aa30c" ON public.delegations USING btree (tenant_id);


--
-- Name: IDX_6ed953a2c457e2e41a6893706a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6ed953a2c457e2e41a6893706a" ON public.items USING btree (brand_id);


--
-- Name: IDX_6f01a03dcb1aa33822e19534cd; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_6f01a03dcb1aa33822e19534cd" ON public.suppliers USING btree (code);


--
-- Name: IDX_6f18d459490bb48923b1f40bdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_6f18d459490bb48923b1f40bdb" ON public.audit_logs USING btree (tenant_id);


--
-- Name: IDX_72bdebc754d6a689b3c169cab8; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_72bdebc754d6a689b3c169cab8" ON public.stores USING btree (code);


--
-- Name: IDX_73a438a05759b8bb8788b4e789; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_73a438a05759b8bb8788b4e789" ON public.notification_configs USING btree (facility_id, type) WHERE (deleted_at IS NULL);


--
-- Name: IDX_73e68c202915f885e01c8cca61; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_73e68c202915f885e01c8cca61" ON public.patient_reminders USING btree (tenant_id);


--
-- Name: IDX_7421efc125d95e413657efa3c6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: IDX_749ea9947305db9cabe40994df; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_749ea9947305db9cabe40994df" ON public.service_categories USING btree (tenant_id);


--
-- Name: IDX_75e4f41c6468c29951d83c7cc7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_75e4f41c6468c29951d83c7cc7" ON public.medication_administrations USING btree (tenant_id);


--
-- Name: IDX_76a72a12e5ae5f47e8567d4019; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_76a72a12e5ae5f47e8567d4019" ON public.delegations USING btree (delegate_id, status);


--
-- Name: IDX_77238a809cc22f0b30ad936613; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_77238a809cc22f0b30ad936613" ON public.supplier_returns USING btree (tenant_id);


--
-- Name: IDX_7848ab97e1ac9dddf781103de5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7848ab97e1ac9dddf781103de5" ON public.payments USING btree (paid_at);


--
-- Name: IDX_79a87dfdaefd30b4abafe4e486; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_79a87dfdaefd30b4abafe4e486" ON public.patient_memberships USING btree (patient_id, scheme_id);


--
-- Name: IDX_79ad369e166eed5891194664da; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_79ad369e166eed5891194664da" ON public.insurance_price_lists USING btree (tenant_id);


--
-- Name: IDX_79c0f287e6ba19a06a1c157ac7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_79c0f287e6ba19a06a1c157ac7" ON public.drug_sync_logs USING btree (tenant_id);


--
-- Name: IDX_7a18b411af6fb0a10451f6ba77; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7a18b411af6fb0a10451f6ba77" ON public.pricing_rules USING btree (tenant_id);


--
-- Name: IDX_7b03ddf986540d9a5ee21930a0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7b03ddf986540d9a5ee21930a0" ON public.fixed_assets USING btree (tenant_id);


--
-- Name: IDX_7c2fb57935a624580038678762; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7c2fb57935a624580038678762" ON public.treatment_plans USING btree (patient_id, status);


--
-- Name: IDX_7c34800d5bc9ba4bae34dddab7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7c34800d5bc9ba4bae34dddab7" ON public.controlled_substance_logs USING btree (dispensation_id);


--
-- Name: IDX_7c6cd1a4b0e51861d177c255ad; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7c6cd1a4b0e51861d177c255ad" ON public.invoice_match_items USING btree (match_id);


--
-- Name: IDX_7d3b96053a6175f8a4f03b345a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7d3b96053a6175f8a4f03b345a" ON public.encounters USING btree (facility_id, created_at);


--
-- Name: IDX_7dfb3aa3e81c772a4deaa8f132; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7dfb3aa3e81c772a4deaa8f132" ON public.controlled_substance_logs USING btree (tenant_id);


--
-- Name: IDX_7eaeb8c7fe1005ad825935e7ba; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7eaeb8c7fe1005ad825935e7ba" ON public.bed_transfers USING btree (tenant_id);


--
-- Name: IDX_7eb39faf870f04185a90b2b9eb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7eb39faf870f04185a90b2b9eb" ON public.medication_administrations USING btree (administered_at);


--
-- Name: IDX_7f8efc8030d08e1c1e62d49e3c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7f8efc8030d08e1c1e62d49e3c" ON public.deployment_health USING btree (status, "updatedAt");


--
-- Name: IDX_7fb56ad20f62b0cd892d1f9003; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7fb56ad20f62b0cd892d1f9003" ON public.item_subcategories USING btree (tenant_id);


--
-- Name: IDX_7fe1518dc780fd777669b5cb7a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_7fe1518dc780fd777669b5cb7a" ON public.patients USING btree (user_id);


--
-- Name: IDX_80071fdeb7261104ee9beec649; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_80071fdeb7261104ee9beec649" ON public.budget_lines USING btree (budget_id, account_id, cost_center_id);


--
-- Name: IDX_805b66ef8a08d0eeec064900aa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_805b66ef8a08d0eeec064900aa" ON public.pos_payment_splits USING btree (tenant_id, sale_id);


--
-- Name: IDX_805c88d36b5c45068e3269d3c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_805c88d36b5c45068e3269d3c8" ON public.batch_stock_balances USING btree (batch_number);


--
-- Name: IDX_8102519fa071fe6b459d311932; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8102519fa071fe6b459d311932" ON public.emergency_cases USING btree (facility_id, created_at);


--
-- Name: IDX_826338b4579a2977a434519fed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_826338b4579a2977a434519fed" ON public.lab_results USING btree ("sampleId");


--
-- Name: IDX_82d82a95dd807d0d327b538f36; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_82d82a95dd807d0d327b538f36" ON public.patient_memberships USING btree (membership_number);


--
-- Name: IDX_8335b97d094d92bbc25b38a6f7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8335b97d094d92bbc25b38a6f7" ON public.pricing_rules USING btree (priority);


--
-- Name: IDX_84004eeaa39e7346921c319d96; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_84004eeaa39e7346921c319d96" ON public.stock_transfers USING btree (status);


--
-- Name: IDX_847c3b57ab049376d3380329a9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_847c3b57ab049376d3380329a9" ON public.services USING btree (tenant_id);


--
-- Name: IDX_856079bf9836dc5e11c0a2dffd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_856079bf9836dc5e11c0a2dffd" ON public.item_categories USING btree (tenant_id);


--
-- Name: IDX_8696c0b02eeb6bd8af03662f22; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8696c0b02eeb6bd8af03662f22" ON public.patient_merges USING btree (secondary_patient_id);


--
-- Name: IDX_86c432daa97b7990c50730dd3b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_86c432daa97b7990c50730dd3b" ON public.disposal_records USING btree (compliance_status);


--
-- Name: IDX_874b86a2b21d69fd32e48250f3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_874b86a2b21d69fd32e48250f3" ON public.patient_memberships USING btree (tenant_id);


--
-- Name: IDX_8834fea8e53514afd02b4f0833; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8834fea8e53514afd02b4f0833" ON public.update_notifications USING btree ("notificationType", "createdAt");


--
-- Name: IDX_88cb50448ce7e266c3b2a602d3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_88cb50448ce7e266c3b2a602d3" ON public.login_history USING btree (login_at);


--
-- Name: IDX_8a5b46bdb20592381fff448c02; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8a5b46bdb20592381fff448c02" ON public.rfqs USING btree (status);


--
-- Name: IDX_8afeef2c89652fabc03b3a9fe2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8afeef2c89652fabc03b3a9fe2" ON public.diagnoses USING btree (tenant_id);


--
-- Name: IDX_8b2d5188d6de43af0216875cb1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8b2d5188d6de43af0216875cb1" ON public.invoice_matches USING btree (due_date);


--
-- Name: IDX_8d9e9dabf824fdafdf4a205e42; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8d9e9dabf824fdafdf4a205e42" ON public.purchase_requests USING btree (status);


--
-- Name: IDX_8da4fffcf3770d1ac3920f4b5b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8da4fffcf3770d1ac3920f4b5b" ON public.bank_reconciliations USING btree (tenant_id);


--
-- Name: IDX_8da518e1929ed453cbcfe4dd81; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_8da518e1929ed453cbcfe4dd81" ON public.discharge_summaries USING btree (encounter_id);


--
-- Name: IDX_8dd1bbed895c2c191034ff6c55; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8dd1bbed895c2c191034ff6c55" ON public.pos_payment_splits USING btree (tenant_id);


--
-- Name: IDX_8df858ad55eba6dd3cbe035c9a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8df858ad55eba6dd3cbe035c9a" ON public.lab_results USING btree ("abnormalFlag");


--
-- Name: IDX_8e8e6b29f954d02d0cf410dbaf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8e8e6b29f954d02d0cf410dbaf" ON public.patients USING btree (phone);


--
-- Name: IDX_8f46660b7a0f3a412996fdf0ab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8f46660b7a0f3a412996fdf0ab" ON public.treatment_plans USING btree (created_at);


--
-- Name: IDX_8f9926f717ee0c78621b48a721; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_8f9926f717ee0c78621b48a721" ON public.invoice_matches USING btree (tenant_id);


--
-- Name: IDX_900fe77c3821aef9480b1045dc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_900fe77c3821aef9480b1045dc" ON public.cost_centers USING btree (tenant_id);


--
-- Name: IDX_9057940c4364457372df6b57ed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9057940c4364457372df6b57ed" ON public.budgets USING btree (tenant_id);


--
-- Name: IDX_90e6b360508d143e71fc996aae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_90e6b360508d143e71fc996aae" ON public.antenatal_registrations USING btree (tenant_id);


--
-- Name: IDX_9109b53fca5cef7720aca72974; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9109b53fca5cef7720aca72974" ON public.payments USING btree (tenant_id);


--
-- Name: IDX_911af38e8989ec6e2d5eb75efc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_911af38e8989ec6e2d5eb75efc" ON public.sample_referrals USING btree (tenant_id);


--
-- Name: IDX_920e9bd8b48b69f62a9f2f09dd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_920e9bd8b48b69f62a9f2f09dd" ON public.feature_flags USING btree (feature_key);


--
-- Name: IDX_9385f44097c2451f79e1340fc0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9385f44097c2451f79e1340fc0" ON public.password_policies USING btree (tenant_id);


--
-- Name: IDX_93e5e4a04685180ac66cab1870; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_93e5e4a04685180ac66cab1870" ON public.admissions USING btree (tenant_id);


--
-- Name: IDX_9675366aed16a56e6c9322805f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9675366aed16a56e6c9322805f" ON public.tax_rates USING btree (tenant_id);


--
-- Name: IDX_974c7328493fb0cc25fdbc434d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_974c7328493fb0cc25fdbc434d" ON public.follow_ups USING btree (scheduled_date, status);


--
-- Name: IDX_975977b19d534867b12c6836a5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_975977b19d534867b12c6836a5" ON public.item_strengths USING btree (tenant_id);


--
-- Name: IDX_977341d0392cb21a06f4230cbb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_977341d0392cb21a06f4230cbb" ON public.prescription_templates USING btree (tenant_id, scope);


--
-- Name: IDX_988b9e434a536256a4fee3ad68; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_988b9e434a536256a4fee3ad68" ON public.sessions USING btree (user_id, is_active);


--
-- Name: IDX_9937a58023b90428e58faa6716; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_9937a58023b90428e58faa6716" ON public.insurance_price_lists USING btree (insurance_provider_id, service_id) WHERE (service_id IS NOT NULL);


--
-- Name: IDX_99789ba8227e407abab1ddb0ec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_99789ba8227e407abab1ddb0ec" ON public.rx_notification_logs USING btree (created_at);


--
-- Name: IDX_99c6b6b31327e646db59b6aff6; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_99c6b6b31327e646db59b6aff6" ON public.item_tags USING btree (facility_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_9a4476cc54cd63075f8259f658; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9a4476cc54cd63075f8259f658" ON public.rx_notification_logs USING btree (tenant_id);


--
-- Name: IDX_9aa8c8a1e8314cec9d2f0e1be9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9aa8c8a1e8314cec9d2f0e1be9" ON public.support_access_grants USING btree (tenant_id);


--
-- Name: IDX_9ab338bab73e8d2adb4bb269a2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9ab338bab73e8d2adb4bb269a2" ON public.stock_transfers USING btree (to_facility_id);


--
-- Name: IDX_9ad31cda2d277f9c891e336878; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_9ad31cda2d277f9c891e336878" ON public.vendor_rating_summaries USING btree (supplier_id);


--
-- Name: IDX_9ad7af2c1b1fb279a897bf7acc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9ad7af2c1b1fb279a897bf7acc" ON public.deployment_alerts USING btree ("deploymentId", status);


--
-- Name: IDX_9c945a3d28cd08889e6332dd5a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9c945a3d28cd08889e6332dd5a" ON public.item_tag_assignments USING btree (tenant_id);


--
-- Name: IDX_9cca78578227ff985e02712839; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9cca78578227ff985e02712839" ON public.vendor_contracts USING btree (status);


--
-- Name: IDX_9cf81393d93a501021efa999e9; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_9cf81393d93a501021efa999e9" ON public.item_tag_assignments USING btree (item_id, tag_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_9cfad82840e94d6c519b9fa8cc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9cfad82840e94d6c519b9fa8cc" ON public.follow_ups USING btree (facility_id, scheduled_date);


--
-- Name: IDX_9de766ec31e80f2d60c474a2d6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9de766ec31e80f2d60c474a2d6" ON public.dispensations USING btree (prescription_id);


--
-- Name: IDX_9e82a630741bb9071fae260da7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9e82a630741bb9071fae260da7" ON public.rfqs USING btree (created_at);


--
-- Name: IDX_9f11d71153f8565078302fed8c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_9f11d71153f8565078302fed8c" ON public.purchase_requests USING btree (created_at);


--
-- Name: IDX_a07e3e3af8ac40e957bd7d3ba2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_a07e3e3af8ac40e957bd7d3ba2" ON public.billing_points USING btree (code);


--
-- Name: IDX_a08e35400faff299cfcdb657c9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a08e35400faff299cfcdb657c9" ON public.lab_tests USING btree (tenant_id);


--
-- Name: IDX_a21edbb253430d072025b99083; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a21edbb253430d072025b99083" ON public.master_data_versions USING btree (entity_type, entity_id);


--
-- Name: IDX_a24bb53614cf26348612d5a421; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a24bb53614cf26348612d5a421" ON public.petty_cash_transactions USING btree (tenant_id);


--
-- Name: IDX_a27c903784b4b0e614fe9d7381; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a27c903784b4b0e614fe9d7381" ON public.replication_logs USING btree ("createdAt", status);


--
-- Name: IDX_a3a8db878f13a479816a714e0c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a3a8db878f13a479816a714e0c" ON public.in_app_notifications USING btree (is_read);


--
-- Name: IDX_a3e1fe095ee6ef49d4dd360281; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a3e1fe095ee6ef49d4dd360281" ON public.deployments USING btree (tenant_id, status);


--
-- Name: IDX_a42370d4664321206fd78f1375; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a42370d4664321206fd78f1375" ON public.batch_stock_balances USING btree (item_id, facility_id);


--
-- Name: IDX_a603d92d4a8459db5fbe45a4ae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a603d92d4a8459db5fbe45a4ae" ON public.prescription_items USING btree (prescription_id);


--
-- Name: IDX_a6659e5eb1bf3b467c819e7f16; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_a6659e5eb1bf3b467c819e7f16" ON public.payments USING btree (receipt_number);


--
-- Name: IDX_a698f67e986866063907fe7200; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a698f67e986866063907fe7200" ON public.invoice_match_items USING btree (tenant_id);


--
-- Name: IDX_a6ecf404655a6a38cb0205ad08; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a6ecf404655a6a38cb0205ad08" ON public.password_history USING btree (tenant_id);


--
-- Name: IDX_a7301969f14469d235593c91c2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a7301969f14469d235593c91c2" ON public.drug_classifications USING btree (tenant_id);


--
-- Name: IDX_a7838d2ba25be1342091b6695f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_a7838d2ba25be1342091b6695f" ON public.refresh_tokens USING btree (token_hash);


--
-- Name: IDX_a79262fc08bedb2c6485e6fc0e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a79262fc08bedb2c6485e6fc0e" ON public.stock_balances USING btree (tenant_id);


--
-- Name: IDX_a7d34a86ce688b29a2b996cdbb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a7d34a86ce688b29a2b996cdbb" ON public.group_permissions USING btree (tenant_id);


--
-- Name: IDX_a7d91212f46de6b7db22618e27; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a7d91212f46de6b7db22618e27" ON public.expiry_alerts USING btree (item_id, batch_number);


--
-- Name: IDX_a7e6e36b5d52d1b9bb4f539b4f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a7e6e36b5d52d1b9bb4f539b4f" ON public.facility_modules USING btree (tenant_id);


--
-- Name: IDX_a8434edf444b16959019a0bcfd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a8434edf444b16959019a0bcfd" ON public.performance_appraisals USING btree (tenant_id);


--
-- Name: IDX_a88a24e8ec109e6ec9fb483f98; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a88a24e8ec109e6ec9fb483f98" ON public.change_sets USING btree ("deploymentId", status);


--
-- Name: IDX_a9621456421ee23161ddfa6a57; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a9621456421ee23161ddfa6a57" ON public.sync_conflicts USING btree (tenant_id);


--
-- Name: IDX_a9a9b222dad2d29f5ff411e2cc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_a9a9b222dad2d29f5ff411e2cc" ON public.update_rollouts USING btree (status, "currentPhase");


--
-- Name: IDX_ab12419532625b431aac950ad5; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_ab12419532625b431aac950ad5" ON public.users USING btree (employee_number, tenant_id) WHERE ((employee_number IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: IDX_ab4280dd83664cc9de965504fc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ab4280dd83664cc9de965504fc" ON public.change_sets USING btree ("createdAt", status);


--
-- Name: IDX_ac0684944580bfd2f692f56661; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ac0684944580bfd2f692f56661" ON public.vitals USING btree (tenant_id);


--
-- Name: IDX_ac5d90e5bd42482d262dd98b8d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ac5d90e5bd42482d262dd98b8d" ON public.baby_wellness_checks USING btree (tenant_id);


--
-- Name: IDX_ad9ce49cb73c0b33746a56b6bd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ad9ce49cb73c0b33746a56b6bd" ON public.login_history USING btree (user_id);


--
-- Name: IDX_af44045cc6bab6314c6ea96e64; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_af44045cc6bab6314c6ea96e64" ON public.temperature_sensors USING btree (tenant_id);


--
-- Name: IDX_af488a6dcb68a82b8a2063167f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_af488a6dcb68a82b8a2063167f" ON public.replication_logs USING btree ("deploymentId", status);


--
-- Name: IDX_af6fb77c67577f74841d564349; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_af6fb77c67577f74841d564349" ON public.deployment_health USING btree ("deploymentId", status);


--
-- Name: IDX_afbdbcabad44c286c423ab84b5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_afbdbcabad44c286c423ab84b5" ON public.patient_notes USING btree (tenant_id);


--
-- Name: IDX_b0564fcd9cfb5b4b9bd00429de; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b0564fcd9cfb5b4b9bd00429de" ON public.feature_flags USING btree (tenant_id);


--
-- Name: IDX_b0d0350059126fa08fddc3c7a4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b0d0350059126fa08fddc3c7a4" ON public.suppliers USING btree (tenant_id);


--
-- Name: IDX_b0f1de027a85442d3c1e8bd0ff; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b0f1de027a85442d3c1e8bd0ff" ON public.group_permissions USING btree (group_id, permission_id);


--
-- Name: IDX_b14306af4a03fdee1ee01aa002; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b14306af4a03fdee1ee01aa002" ON public.drug_sync_logs USING btree (tenant_id, sync_type);


--
-- Name: IDX_b19e346f96ffd54c4d436a9586; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b19e346f96ffd54c4d436a9586" ON public.rfqs USING btree (rfq_number);


--
-- Name: IDX_b1c9c7f6f733b3a8a3501b0cb8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b1c9c7f6f733b3a8a3501b0cb8" ON public.supplier_payments USING btree (tenant_id);


--
-- Name: IDX_b297010fff05faf7baf4e67afa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b297010fff05faf7baf4e67afa" ON public.purchase_orders USING btree (order_number);


--
-- Name: IDX_b2b6d6a31f8339a278321362f8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b2b6d6a31f8339a278321362f8" ON public.invoice_matches USING btree (status);


--
-- Name: IDX_b33fa04c8414d89cd3f18ac5be; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b33fa04c8414d89cd3f18ac5be" ON public.deployment_alerts USING btree (status, severity);


--
-- Name: IDX_b38342b53a657453921c603719; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b38342b53a657453921c603719" ON public.patient_credit_notes USING btree (tenant_id);


--
-- Name: IDX_b3db0e2331e03f7a899d1c9b00; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b3db0e2331e03f7a899d1c9b00" ON public.user_roles USING btree (user_id, role_id, facility_id);


--
-- Name: IDX_b40fae4ce3b28ef3fda8421ebe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b40fae4ce3b28ef3fda8421ebe" ON public.supplier_credit_note_items USING btree (tenant_id);


--
-- Name: IDX_b45eb9eabff9ea147084be68a6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b45eb9eabff9ea147084be68a6" ON public.temperature_logs USING btree (sensor_id, recorded_at);


--
-- Name: IDX_b472f05b5400ed4d7ba9c967fe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b472f05b5400ed4d7ba9c967fe" ON public.reagent_consumptions USING btree (tenant_id);


--
-- Name: IDX_b47a1c7a67240c58a03923858f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b47a1c7a67240c58a03923858f" ON public.deployment_health USING btree ("deploymentId", "createdAt");


--
-- Name: IDX_b52e0fa65c881cf13f89f9498c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b52e0fa65c881cf13f89f9498c" ON public.supplier_return_items USING btree (item_id);


--
-- Name: IDX_b578bf7e7810bf63924590a7c8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b578bf7e7810bf63924590a7c8" ON public.equipment_maintenances USING btree (tenant_id);


--
-- Name: IDX_b5d59b64d04b7ee93e0a49fb82; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b5d59b64d04b7ee93e0a49fb82" ON public.goods_receipt_notes USING btree (received_at);


--
-- Name: IDX_b5fd4999ee16d8a7d4c0040eff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b5fd4999ee16d8a7d4c0040eff" ON public.vendor_ratings USING btree (tenant_id);


--
-- Name: IDX_b65b13e803690c2055e7620caf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b65b13e803690c2055e7620caf" ON public.stores USING btree (tenant_id);


--
-- Name: IDX_b7e0d05b960105dbd73a04b8c9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b7e0d05b960105dbd73a04b8c9" ON public.deposit_applications USING btree (tenant_id);


--
-- Name: IDX_b8519c6ee4851e1c9bc18328b4; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_b8519c6ee4851e1c9bc18328b4" ON public.role_permission_groups USING btree (role_id, group_id);


--
-- Name: IDX_b9e6a20a51f4b19d0c084c7255; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_b9e6a20a51f4b19d0c084c7255" ON public.prescription_templates USING btree (tenant_id, condition);


--
-- Name: IDX_ba3bd69c8ad1e799c0256e9e50; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ba3bd69c8ad1e799c0256e9e50" ON public.refresh_tokens USING btree (expires_at);


--
-- Name: IDX_bb9ff2b69c1ef137e1722eedbd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bb9ff2b69c1ef137e1722eedbd" ON public.medication_adherence_records USING btree (status, scheduled_date);


--
-- Name: IDX_bd131152589c5e5f0aa9182d0c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bd131152589c5e5f0aa9182d0c" ON public.encounters USING btree (tenant_id);


--
-- Name: IDX_bd230c23f0013079854cf4037b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bd230c23f0013079854cf4037b" ON public.update_notifications USING btree ("deploymentId", status);


--
-- Name: IDX_bd2726fd31b35443f2245b93ba; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bd2726fd31b35443f2245b93ba" ON public.audit_logs USING btree (user_id);


--
-- Name: IDX_bd79fdea42d616290e86461da6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bd79fdea42d616290e86461da6" ON public.contract_amendments USING btree (tenant_id);


--
-- Name: IDX_bd9d53fb1686e85de185f247c7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bd9d53fb1686e85de185f247c7" ON public.purchase_requests USING btree (tenant_id);


--
-- Name: IDX_be63576ab21bab1fedee663b65; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_be63576ab21bab1fedee663b65" ON public.update_notifications USING btree ("updateRolloutId", status);


--
-- Name: IDX_bee5174492d1118152b0322d0c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bee5174492d1118152b0322d0c" ON public.pharmacy_sales USING btree (prescription_id);


--
-- Name: IDX_bfb9f93b36ae56d52b8de2446f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_bfb9f93b36ae56d52b8de2446f" ON public.antenatal_visits USING btree (tenant_id);


--
-- Name: IDX_c1e4e90cd20a8261689c266d33; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c1e4e90cd20a8261689c266d33" ON public.release_candidates USING btree (stage, "createdAt");


--
-- Name: IDX_c2022d02597591eb4779d8d76e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c2022d02597591eb4779d8d76e" ON public.temperature_logs USING btree (tenant_id);


--
-- Name: IDX_c2d9e2b0eb6f5f315023c8dcbc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c2d9e2b0eb6f5f315023c8dcbc" ON public.queues USING btree (patient_id, facility_id, queue_date, status);


--
-- Name: IDX_c3b6aa9bca6ec206286348b379; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c3b6aa9bca6ec206286348b379" ON public.stock_transfers USING btree (from_facility_id);


--
-- Name: IDX_c45c5f5bb2a1469b5d7f3e303f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_c45c5f5bb2a1469b5d7f3e303f" ON public.units USING btree (department_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_c48c91281e46b27fa9bb9afdc9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c48c91281e46b27fa9bb9afdc9" ON public.pharmacy_sales USING btree (store_id, created_at);


--
-- Name: IDX_c696453a5f82d230833025f9bc; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_c696453a5f82d230833025f9bc" ON public.supplier_credit_notes USING btree (note_number) WHERE (deleted_at IS NULL);


--
-- Name: IDX_c7f3789cfe68c120ab91b9f322; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c7f3789cfe68c120ab91b9f322" ON public.referrals USING btree (patient_id, status);


--
-- Name: IDX_c81cdd8affc0c4c4877edd5e4f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c81cdd8affc0c4c4877edd5e4f" ON public.queues USING btree (priority, created_at);


--
-- Name: IDX_c8f82490b1a2b973da9acbef28; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c8f82490b1a2b973da9acbef28" ON public.approval_requests USING btree (tenant_id);


--
-- Name: IDX_c9a165696c45629ffa192189d4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c9a165696c45629ffa192189d4" ON public.expiry_alert_history USING btree (acknowledged);


--
-- Name: IDX_c9d5c0d09e27afdb707a2a8837; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_c9d5c0d09e27afdb707a2a8837" ON public.permissions USING btree (tenant_id);


--
-- Name: IDX_ca7b0ad66dc52dad217484bdca; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ca7b0ad66dc52dad217484bdca" ON public.follow_ups USING btree (patient_id, status);


--
-- Name: IDX_cabe07116f6d3e03ecef231aa5; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_cabe07116f6d3e03ecef231aa5" ON public.supplier_payments USING btree (voucher_number) WHERE (deleted_at IS NULL);


--
-- Name: IDX_cad246d7110b2f7cb05225b4ea; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_cad246d7110b2f7cb05225b4ea" ON public.service_packages USING btree (code);


--
-- Name: IDX_cb92d56c6064cf0abb2d6dd476; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cb92d56c6064cf0abb2d6dd476" ON public.patient_problems USING btree (facility_id, status);


--
-- Name: IDX_cc46d89ad723e0cfb06ef43832; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_cc46d89ad723e0cfb06ef43832" ON public.referrals USING btree (referral_number);


--
-- Name: IDX_cd2b9dcc25b43a198218297728; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_cd2b9dcc25b43a198218297728" ON public.item_brands USING btree (facility_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_cd3259c81a787bf5754b823ef1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_cd3259c81a787bf5754b823ef1" ON public.sms_templates USING btree (facility_id, type) WHERE (deleted_at IS NULL);


--
-- Name: IDX_cd5c8c9cc7f46a450896074a69; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cd5c8c9cc7f46a450896074a69" ON public.cashier_sessions USING btree (cashier_id, status);


--
-- Name: IDX_cdb10d328a89782b9b46d7e0e7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cdb10d328a89782b9b46d7e0e7" ON public.qc_levey_jennings_data USING btree (tenant_id);


--
-- Name: IDX_cde2ede409ddea9d486b50b834; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_cde2ede409ddea9d486b50b834" ON public.app_versions USING btree (version);


--
-- Name: IDX_ce152bd6a55de15af8e4fb50c0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ce152bd6a55de15af8e4fb50c0" ON public.patients USING btree (date_of_birth);


--
-- Name: IDX_cf5130c0c9525575ded5eb8cc0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf5130c0c9525575ded5eb8cc0" ON public.goods_receipt_notes USING btree (status);


--
-- Name: IDX_cf6de82862a09e5984a962e05f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cf6de82862a09e5984a962e05f" ON public.surgery_consumables USING btree (tenant_id);


--
-- Name: IDX_cfb108a87c72b440ab60b59a37; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cfb108a87c72b440ab60b59a37" ON public.insurance_providers USING btree (tenant_id);


--
-- Name: IDX_cfb52129fb407ddfb62050ebdd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_cfb52129fb407ddfb62050ebdd" ON public.patient_chronic_conditions USING btree (tenant_id);


--
-- Name: IDX_d013f113228dc39673239ba2a9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d013f113228dc39673239ba2a9" ON public.service_packages USING btree (tenant_id);


--
-- Name: IDX_d16a885aa88447ccfd010e739b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d16a885aa88447ccfd010e739b" ON public.purchase_orders USING btree (supplier_id);


--
-- Name: IDX_d238312c7c45087c2b382a5871; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d238312c7c45087c2b382a5871" ON public.postnatal_visits USING btree (tenant_id);


--
-- Name: IDX_d25e91897a47f5422f33245d4a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d25e91897a47f5422f33245d4a" ON public.controlled_substance_logs USING btree (prescription_item_id);


--
-- Name: IDX_d2b77e27dc1654786ce5c2bcbc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d2b77e27dc1654786ce5c2bcbc" ON public.pos_registers USING btree (tenant_id);


--
-- Name: IDX_d36f3fbbb01a5d7ce3a295deb1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d36f3fbbb01a5d7ce3a295deb1" ON public.vendor_quotations USING btree (tenant_id);


--
-- Name: IDX_d39dd89d89fe12aa86872b7865; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d39dd89d89fe12aa86872b7865" ON public.orders USING btree (status, created_at);


--
-- Name: IDX_d3cfa55f59299067d5b980eebc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d3cfa55f59299067d5b980eebc" ON public.stock_ledger USING btree (item_id, facility_id);


--
-- Name: IDX_d40418509c8ef63c97f16af595; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d40418509c8ef63c97f16af595" ON public.discharge_summaries USING btree (discharge_date);


--
-- Name: IDX_d4a17975fbace96cff7cae938e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d4a17975fbace96cff7cae938e" ON public.patient_deposits USING btree (tenant_id);


--
-- Name: IDX_d4bbd31b999b44acee80b4012e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d4bbd31b999b44acee80b4012e" ON public.price_agreements USING btree (supplier_id, item_code);


--
-- Name: IDX_d4d2daa5eafb9c88a55ed1c654; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d4d2daa5eafb9c88a55ed1c654" ON public.invoices USING btree (encounter_id);


--
-- Name: IDX_d5458b78738ad68b27003839ea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d5458b78738ad68b27003839ea" ON public.deployment_alerts USING btree ("alertType", "createdAt");


--
-- Name: IDX_d601ff7ddfd1b27a4ed9340dad; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_d601ff7ddfd1b27a4ed9340dad" ON public.discharge_summaries USING btree (discharge_number);


--
-- Name: IDX_d6c187cbf5d226806008612782; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d6c187cbf5d226806008612782" ON public.sync_queue USING btree (tenant_id);


--
-- Name: IDX_d6d0dd83a92c57ab1026a3a251; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d6d0dd83a92c57ab1026a3a251" ON public.patient_merges USING btree (tenant_id);


--
-- Name: IDX_d6fcb39857e2116aff96b97df0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d6fcb39857e2116aff96b97df0" ON public.role_permissions USING btree (tenant_id);


--
-- Name: IDX_d7a8da96aef64c5f0ebb469b0f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d7a8da96aef64c5f0ebb469b0f" ON public.prescription_items USING btree (tenant_id);


--
-- Name: IDX_d7d027b642add7f0e77c36b874; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d7d027b642add7f0e77c36b874" ON public.items USING btree (tenant_id);


--
-- Name: IDX_d8272fb1c1580238d299f5d9ae; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d8272fb1c1580238d299f5d9ae" ON public.patient_chronic_conditions USING btree (facility_id, status);


--
-- Name: IDX_d8dbc1c0a6f5a2f3b77e21ef9e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d8dbc1c0a6f5a2f3b77e21ef9e" ON public.batch_stock_balances USING btree (tenant_id);


--
-- Name: IDX_d8f8d3788694e1b3f96c42c36f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_d8f8d3788694e1b3f96c42c36f" ON public.invoices USING btree (invoice_number);


--
-- Name: IDX_d91dd41e37dc30bffc7beb6956; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d91dd41e37dc30bffc7beb6956" ON public.vendor_quotation_items USING btree (quotation_id);


--
-- Name: IDX_d92835f81936df54cf27826dd1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d92835f81936df54cf27826dd1" ON public.patient_problems USING btree (patient_id, onset_date);


--
-- Name: IDX_d93a9b5fc8284b56f79b001e0d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d93a9b5fc8284b56f79b001e0d" ON public.queues USING btree (encounter_id);


--
-- Name: IDX_d99cc62cc2830b7acdb751efb0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_d99cc62cc2830b7acdb751efb0" ON public.controlled_substance_logs USING btree (drug_schedule, created_at);


--
-- Name: IDX_daf8b06bccd2b421dc8fe241ec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_daf8b06bccd2b421dc8fe241ec" ON public.common_drug_translations USING btree (drug_name, language, tenant_id);


--
-- Name: IDX_dc991d555664682cfe892eea2c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dc991d555664682cfe892eea2c" ON public.invoice_items USING btree (invoice_id);


--
-- Name: IDX_dcd4429cdb71d3ae8bab106aec; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dcd4429cdb71d3ae8bab106aec" ON public.supplier_credit_notes USING btree (tenant_id);


--
-- Name: IDX_dd7a7fbcf65baaac1a5f5dd13a; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_dd7a7fbcf65baaac1a5f5dd13a" ON public.providers USING btree (registration_number) WHERE ((deleted_at IS NULL) AND (registration_number IS NOT NULL));


--
-- Name: IDX_dd8110bf0232d98c717dd4a1ba; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dd8110bf0232d98c717dd4a1ba" ON public.vendor_rating_summaries USING btree (tenant_id);


--
-- Name: IDX_de3778370453c82e6319a78df7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_de3778370453c82e6319a78df7" ON public.queue_displays USING btree (tenant_id);


--
-- Name: IDX_de7ad460ced11ff9ca38c4514d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_de7ad460ced11ff9ca38c4514d" ON public.qc_results USING btree (facility_id, test_code, run_date);


--
-- Name: IDX_deaeb7940633a09af4c6c14df8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_deaeb7940633a09af4c6c14df8" ON public.invoice_items USING btree (tenant_id);


--
-- Name: IDX_df76ba52b3c5f7267dcdc260c4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_df76ba52b3c5f7267dcdc260c4" ON public.facility_configs USING btree (facility_id);


--
-- Name: IDX_dfc3fe2db03af2e60601ca2685; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dfc3fe2db03af2e60601ca2685" ON public.units USING btree (tenant_id);


--
-- Name: IDX_dfeb6aeceb3e3ffa6035ace4d1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_dfeb6aeceb3e3ffa6035ace4d1" ON public.deliveries USING btree (tenant_id, customer_id);


--
-- Name: IDX_e01a226ce2d4eb14c57b9c0097; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_e01a226ce2d4eb14c57b9c0097" ON public.membership_schemes USING btree (code);


--
-- Name: IDX_e07c347f0508a94ea97714ef8c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e07c347f0508a94ea97714ef8c" ON public.expiry_alert_history USING btree (tenant_id);


--
-- Name: IDX_e11aeb1f84c3febab5d398f81e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e11aeb1f84c3febab5d398f81e" ON public.patient_problems USING btree (tenant_id);


--
-- Name: IDX_e259919f3bf18a5c54dcac65fd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e259919f3bf18a5c54dcac65fd" ON public.supplier_returns USING btree (supplier_id);


--
-- Name: IDX_e2b1c5b6415f7a7c671c093fb4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e2b1c5b6415f7a7c671c093fb4" ON public.sync_queue USING btree (entity_type, entity_id);


--
-- Name: IDX_e30fefad97652ffaec898d8935; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e30fefad97652ffaec898d8935" ON public.sample_referrals USING btree (stage, created_at);


--
-- Name: IDX_e3be0c11f4ce66b9b352477cb0; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e3be0c11f4ce66b9b352477cb0" ON public.invoices USING btree (patient_id);


--
-- Name: IDX_e3c3ded02ffe206062ade0ef31; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e3c3ded02ffe206062ade0ef31" ON public.contract_amendments USING btree (contract_id);


--
-- Name: IDX_e415ed22462f17d6955a4c42d3; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_e415ed22462f17d6955a4c42d3" ON public.follow_ups USING btree (appointment_number);


--
-- Name: IDX_e522ce79e328c2c3c0b5d2ae76; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e522ce79e328c2c3c0b5d2ae76" ON public.waivers USING btree (tenant_id);


--
-- Name: IDX_e59a01f4fe46ebbece575d9a0f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e59a01f4fe46ebbece575d9a0f" ON public.roles USING btree (tenant_id);


--
-- Name: IDX_e5d8a8462e042e46630b69b120; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e5d8a8462e042e46630b69b120" ON public.sync_conflicts USING btree (entity_type, entity_id);


--
-- Name: IDX_e5e7bd1999bf33cbbcb9547057; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e5e7bd1999bf33cbbcb9547057" ON public.referrals USING btree (to_facility_id, status);


--
-- Name: IDX_e5f71b98d1d3a6eed075c16bd3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e5f71b98d1d3a6eed075c16bd3" ON public.item_tags USING btree (tenant_id);


--
-- Name: IDX_e660b824be916e448462bcd88a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e660b824be916e448462bcd88a" ON public.asset_maintenances USING btree (tenant_id);


--
-- Name: IDX_e6943db71fc295dca9bbe16b85; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_e6943db71fc295dca9bbe16b85" ON public.stock_transfers USING btree (transfer_number);


--
-- Name: IDX_e6ce83373dd750534943cb7deb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e6ce83373dd750534943cb7deb" ON public.item_formulations USING btree (tenant_id);


--
-- Name: IDX_e6d0590f7a610f2fa1e4831ae7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e6d0590f7a610f2fa1e4831ae7" ON public.pharmacy_sales USING btree (tenant_id);


--
-- Name: IDX_e781bfaccf4aff67bc16b51630; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e781bfaccf4aff67bc16b51630" ON public.expiry_alert_configs USING btree (facility_id);


--
-- Name: IDX_e7c08c7d540d402e8d261ffc7c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e7c08c7d540d402e8d261ffc7c" ON public.pharmacy_sale_items USING btree (tenant_id);


--
-- Name: IDX_e7c6976c9cda13f7bb6daac8b5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_e7c6976c9cda13f7bb6daac8b5" ON public.billing_points USING btree (facility_id);


--
-- Name: IDX_ead2621476e573819ee3756e7e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ead2621476e573819ee3756e7e" ON public.price_agreements USING btree (valid_to);


--
-- Name: IDX_eb5c23a47f0f5a14b3bc543b0f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_eb5c23a47f0f5a14b3bc543b0f" ON public.patient_documents USING btree (tenant_id);


--
-- Name: IDX_eb7780518ad1d58bb195ee3edd; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_eb7780518ad1d58bb195ee3edd" ON public.pharmacy_sales USING btree (sale_number);


--
-- Name: IDX_ebc5b6180d05491eb0efbde76f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ebc5b6180d05491eb0efbde76f" ON public.rx_notification_logs USING btree (tenant_id, patient_id);


--
-- Name: IDX_ebc88abc8354e1b1548222470d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ebc88abc8354e1b1548222470d" ON public.claim_items USING btree (tenant_id);


--
-- Name: IDX_edec625b809618d5a9ac3e048b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_edec625b809618d5a9ac3e048b" ON public.deployment_versions USING btree (deployment_id, status);


--
-- Name: IDX_ef08571c8fbda1b699530afe6d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ef08571c8fbda1b699530afe6d" ON public.service_prices USING btree (service_id, tier);


--
-- Name: IDX_ef1ff063ba5d7fc9dba81cb830; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ef1ff063ba5d7fc9dba81cb830" ON public.dispensations USING btree (dispensed_at);


--
-- Name: IDX_ef33604b07e9ccb9b04ea78eda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ef33604b07e9ccb9b04ea78eda" ON public.supplier_returns USING btree (facility_id, created_at);


--
-- Name: IDX_ef8f022c5f4d9e27e47e03a120; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ef8f022c5f4d9e27e47e03a120" ON public.rfq_items USING btree (rfq_id);


--
-- Name: IDX_f019a17cb439406ab185382df9; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_f019a17cb439406ab185382df9" ON public.services USING btree (code);


--
-- Name: IDX_f09b4189e7145df4fe7565246c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f09b4189e7145df4fe7565246c" ON public.prescriptions USING btree (encounter_id);


--
-- Name: IDX_f12bf6de3ef1c64d507064423f; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f12bf6de3ef1c64d507064423f" ON public.prescription_templates USING btree (usage_count);


--
-- Name: IDX_f14ad0251e56151fed79d0e2dd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f14ad0251e56151fed79d0e2dd" ON public.change_sets USING btree ("batchId");


--
-- Name: IDX_f1ff806a8543badfe2a94b458b; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_f1ff806a8543badfe2a94b458b" ON public.users USING btree (email, tenant_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_f26c9800dce0250004131d3e22; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f26c9800dce0250004131d3e22" ON public.membership_schemes USING btree (tenant_id);


--
-- Name: IDX_f29258d2f5f4dcf3f6f9c7267a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f29258d2f5f4dcf3f6f9c7267a" ON public.support_access_grants USING btree (tenant_id, granted_to_id);


--
-- Name: IDX_f2b572da5f102e80e9684268b2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f2b572da5f102e80e9684268b2" ON public.controlled_substance_logs USING btree (facility_id, created_at);


--
-- Name: IDX_f2ea95b0269683d260cd80fc99; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f2ea95b0269683d260cd80fc99" ON public.deployment_configs USING btree (deployment_id, config_key);


--
-- Name: IDX_f32018ec64e849ca990e10a35e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f32018ec64e849ca990e10a35e" ON public.login_history USING btree (tenant_id);


--
-- Name: IDX_f37f9b13605888fe2da030a47c; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f37f9b13605888fe2da030a47c" ON public.vitals USING btree (encounter_id, recorded_at);


--
-- Name: IDX_f3d2a7898204ee83311632f760; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_f3d2a7898204ee83311632f760" ON public.patients USING btree (mrn) WHERE (deleted_at IS NULL);


--
-- Name: IDX_f455ed8ffc710ef8cf5513bf82; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_f455ed8ffc710ef8cf5513bf82" ON public.icd10_codes USING btree (code);


--
-- Name: IDX_f6025f29988e9f2cfdac668dbd; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f6025f29988e9f2cfdac668dbd" ON public.donor_funds USING btree (tenant_id);


--
-- Name: IDX_f68291208759899b77b4a29834; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f68291208759899b77b4a29834" ON public.queues USING btree (facility_id, "servicePoint", status, queue_date);


--
-- Name: IDX_f6a302387bdff4423be6b12b50; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_f6a302387bdff4423be6b12b50" ON public.item_categories USING btree (facility_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_f7edfc4fe9f2a59335dde80ab6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f7edfc4fe9f2a59335dde80ab6" ON public.queues USING btree (patient_id);


--
-- Name: IDX_f7fef8e6e8197bdcfab6224c3a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f7fef8e6e8197bdcfab6224c3a" ON public.prescription_templates USING btree (tenant_id, department);


--
-- Name: IDX_f82e5247f248ce9f23dc51d821; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f82e5247f248ce9f23dc51d821" ON public.price_agreements USING btree (tenant_id);


--
-- Name: IDX_f83139454634a79ca6240ba6b2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f83139454634a79ca6240ba6b2" ON public.staff_rosters USING btree (tenant_id);


--
-- Name: IDX_f8b0dabff20be179cbe51f0454; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f8b0dabff20be179cbe51f0454" ON public.expiry_alert_configs USING btree (tenant_id);


--
-- Name: IDX_f8dd0daeeb64f0520a99adc885; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f8dd0daeeb64f0520a99adc885" ON public.licenses USING btree (tenant_id);


--
-- Name: IDX_f95ac9926e8b7b0c5a5d84b478; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_f95ac9926e8b7b0c5a5d84b478" ON public.biometric_data USING btree (user_id);


--
-- Name: IDX_fa8e5034d4e454f1564fa6042c; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_fa8e5034d4e454f1564fa6042c" ON public.service_categories USING btree (code);


--
-- Name: IDX_fab5d9789b426edf48a8015cda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fab5d9789b426edf48a8015cda" ON public.pos_registers USING btree (tenant_id, store_id);


--
-- Name: IDX_fc954fa8859907acb9fcdebf47; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fc954fa8859907acb9fcdebf47" ON public.prescriptions USING btree (status, created_at);


--
-- Name: IDX_fcaf6e658610326f536de2faaf; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_fcaf6e658610326f536de2faaf" ON public.goods_receipt_notes USING btree (grn_number);


--
-- Name: IDX_fd093069612c68830a9669fa2b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fd093069612c68830a9669fa2b" ON public.notification_configs USING btree (tenant_id);


--
-- Name: IDX_fda7d74c2fd28a57430e5238f7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fda7d74c2fd28a57430e5238f7" ON public.medication_adherence_records USING btree (patient_id, scheduled_date);


--
-- Name: IDX_fdb64e37ebda90e6c803ebf220; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fdb64e37ebda90e6c803ebf220" ON public.phone_home_records USING btree (license_id);


--
-- Name: IDX_fdbf08d9bb4e315e49bbdda2aa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fdbf08d9bb4e315e49bbdda2aa" ON public.staff_documents USING btree (tenant_id);


--
-- Name: IDX_fe01f55e560f93bfc14fa7f3a7; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_fe01f55e560f93bfc14fa7f3a7" ON public.patient_chronic_conditions USING btree (patient_id, diagnosis_id) WHERE (deleted_at IS NULL);


--
-- Name: IDX_fe3915c07e5f6294f8026caf5e; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fe3915c07e5f6294f8026caf5e" ON public.training_programs USING btree (tenant_id);


--
-- Name: IDX_fe74af40ab0fcd9039eb357311; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fe74af40ab0fcd9039eb357311" ON public.rfq_vendors USING btree (rfq_id, supplier_id);


--
-- Name: IDX_fe8549c4d2d27454389dfb9e9b; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fe8549c4d2d27454389dfb9e9b" ON public.stock_ledger USING btree (batch_number);


--
-- Name: IDX_ffaab45f3e8ff3c4d250d6ff95; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ffaab45f3e8ff3c4d250d6ff95" ON public.nursing_notes USING btree (tenant_id);


--
-- Name: IDX_ffc5be9093df532d0e179bd8ea; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ffc5be9093df532d0e179bd8ea" ON public.deployments USING btree (deployment_type);


--
-- Name: IDX_ffd58fb18e1d3dfcbe21a0f04d; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ffd58fb18e1d3dfcbe21a0f04d" ON public.doctor_duties USING btree (tenant_id);


--
-- Name: IDX_ffe9c8af02a0aa0c604b9e594a; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ffe9c8af02a0aa0c604b9e594a" ON public.deployment_alerts USING btree ("deploymentId", "createdAt");


--
-- Name: IDX_fff3b71ed7da9833cba978104f; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "IDX_fff3b71ed7da9833cba978104f" ON public.item_strengths USING btree (facility_id, code) WHERE (deleted_at IS NULL);


--
-- Name: IDX_fffc29469a124b6c6b6a74dcdb; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_fffc29469a124b6c6b6a74dcdb" ON public.user_permissions USING btree (tenant_id);


--
-- Name: idx_patient_documents_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_documents_category ON public.patient_documents USING btree (category);


--
-- Name: idx_patient_documents_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_documents_patient_id ON public.patient_documents USING btree (patient_id);


--
-- Name: idx_staff_documents_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_documents_document_type ON public.staff_documents USING btree (document_type);


--
-- Name: idx_staff_documents_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_documents_user_id ON public.staff_documents USING btree (user_id);


--
-- Name: providers FK_00a3fd09ea5e958c27b6057e805; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT "FK_00a3fd09ea5e958c27b6057e805" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: pre_authorizations FK_01f2cc1ecab2e003ce57e3994f7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorizations
    ADD CONSTRAINT "FK_01f2cc1ecab2e003ce57e3994f7" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: medication_administrations FK_035aab7878145d57efbe175cf84; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT "FK_035aab7878145d57efbe175cf84" FOREIGN KEY (administered_by_id) REFERENCES public.users(id);


--
-- Name: in_app_notifications FK_046713440a98830b619c4c649b4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.in_app_notifications
    ADD CONSTRAINT "FK_046713440a98830b619c4c649b4" FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: item_tags FK_05008c58881f1862b9a0204f2d2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_tags
    ADD CONSTRAINT "FK_05008c58881f1862b9a0204f2d2" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: update_notifications FK_057b3ce2d928708a8612913fe10; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_notifications
    ADD CONSTRAINT "FK_057b3ce2d928708a8612913fe10" FOREIGN KEY (update_rollout_id) REFERENCES public.update_rollouts(id) ON DELETE SET NULL;


--
-- Name: goods_receipt_notes FK_05cff8d5dfcc4a67a2fdc428447; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "FK_05cff8d5dfcc4a67a2fdc428447" FOREIGN KEY (inspected_by_id) REFERENCES public.users(id);


--
-- Name: patient_merges FK_061f67cc2715951314e4083c323; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merges
    ADD CONSTRAINT "FK_061f67cc2715951314e4083c323" FOREIGN KEY (merged_by_id) REFERENCES public.users(id);


--
-- Name: purchase_orders FK_074eb55a200215bdadc42ddee6b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "FK_074eb55a200215bdadc42ddee6b" FOREIGN KEY (quotation_id) REFERENCES public.vendor_quotations(id);


--
-- Name: invoice_matches FK_078b785b987775adf3150e07441; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_matches
    ADD CONSTRAINT "FK_078b785b987775adf3150e07441" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: sessions FK_085d540d9f418cfbdc7bd55bb19; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cashier_sessions FK_08a27585dc4401d222fcbd14a1f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_sessions
    ADD CONSTRAINT "FK_08a27585dc4401d222fcbd14a1f" FOREIGN KEY (cashier_id) REFERENCES public.users(id);


--
-- Name: deployment_versions FK_08f7d5e04b578c76c8b79c1ffb9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_versions
    ADD CONSTRAINT "FK_08f7d5e04b578c76c8b79c1ffb9" FOREIGN KEY (app_version_id) REFERENCES public.app_versions(id);


--
-- Name: users FK_0921d1972cf861d568f5271cd85; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_0921d1972cf861d568f5271cd85" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: stores FK_0935835219e12e170ad79137da2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT "FK_0935835219e12e170ad79137da2" FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: insurance_price_lists FK_0a4c5b1a522a574d4329689ce5f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_price_lists
    ADD CONSTRAINT "FK_0a4c5b1a522a574d4329689ce5f" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: items FK_0c4aa809ddf5b0c6ca45d8a8e80; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_0c4aa809ddf5b0c6ca45d8a8e80" FOREIGN KEY (category_id) REFERENCES public.item_categories(id);


--
-- Name: departments FK_0d2c3c44e1eae5d90576dadf048; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "FK_0d2c3c44e1eae5d90576dadf048" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: deployment_health FK_0d5733ca27d2a09478c60644583; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_health
    ADD CONSTRAINT "FK_0d5733ca27d2a09478c60644583" FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE CASCADE;


--
-- Name: surgery_cases FK_0da6685ba1a0d721476df55dc1e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_0da6685ba1a0d721476df55dc1e" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: lab_samples FK_0da7c80cb8b7d64e60dbf11dd9c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "FK_0da7c80cb8b7d64e60dbf11dd9c" FOREIGN KEY ("patientId") REFERENCES public.patients(id);


--
-- Name: fixed_assets FK_0dc7a5b6000667fd08f59132080; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT "FK_0dc7a5b6000667fd08f59132080" FOREIGN KEY (custodian_id) REFERENCES public.users(id);


--
-- Name: queue_displays FK_0e2a877267e53de8d58f784049a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_displays
    ADD CONSTRAINT "FK_0e2a877267e53de8d58f784049a" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: labour_records FK_0ea20655341ba324ad13a2cfbae; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labour_records
    ADD CONSTRAINT "FK_0ea20655341ba324ad13a2cfbae" FOREIGN KEY (delivered_by_id) REFERENCES public.users(id);


--
-- Name: supplier_payments FK_0fb030f944062e7c63d5beeb0db; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT "FK_0fb030f944062e7c63d5beeb0db" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: asset_maintenances FK_10441c1a2936c2a22ae047cc480; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenances
    ADD CONSTRAINT "FK_10441c1a2936c2a22ae047cc480" FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id);


--
-- Name: users FK_109638590074998bb72a2f2cf08; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_109638590074998bb72a2f2cf08" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: sample_referrals FK_11eda929c6e4f9d543b4270f914; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_referrals
    ADD CONSTRAINT "FK_11eda929c6e4f9d543b4270f914" FOREIGN KEY ("fromFacilityId") REFERENCES public.facilities(id);


--
-- Name: sync_conflicts FK_11f9974db48c26d5a22b663079c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_conflicts
    ADD CONSTRAINT "FK_11f9974db48c26d5a22b663079c" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: nursing_notes FK_11faf1c77deaf866df7a5244f99; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_notes
    ADD CONSTRAINT "FK_11faf1c77deaf866df7a5244f99" FOREIGN KEY ("nurseId") REFERENCES public.users(id);


--
-- Name: follow_ups FK_1290c5ede1d59b7c33b4cee47aa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_1290c5ede1d59b7c33b4cee47aa" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: beds FK_12c4b045ef8d740bb4fe8051429; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beds
    ADD CONSTRAINT "FK_12c4b045ef8d740bb4fe8051429" FOREIGN KEY ("wardId") REFERENCES public.wards(id);


--
-- Name: purchase_requests FK_1394b51318ce182284cc0bb4471; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT "FK_1394b51318ce182284cc0bb4471" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: purchase_orders FK_13978d65359b4969947011159f7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "FK_13978d65359b4969947011159f7" FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id);


--
-- Name: goods_receipt_notes FK_149b6d1e7008c084cb78726744b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "FK_149b6d1e7008c084cb78726744b" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: pharmacy_sales FK_14f3840e27c6ef2684a4f9ec615; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT "FK_14f3840e27c6ef2684a4f9ec615" FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: services FK_15e243a5134e46206e55652256c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "FK_15e243a5134e46206e55652256c" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: sync_queue FK_1605c43d06cf9c9c3059eaa4e62; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_queue
    ADD CONSTRAINT "FK_1605c43d06cf9c9c3059eaa4e62" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: role_permissions FK_17022daf3f885f7d35423e9971e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: lab_samples FK_170d927f2dad6e79b9099212c9e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "FK_170d927f2dad6e79b9099212c9e" FOREIGN KEY ("facilityId") REFERENCES public.facilities(id);


--
-- Name: prescriptions FK_171f5ca65994fc73c2d16588f10; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT "FK_171f5ca65994fc73c2d16588f10" FOREIGN KEY (prescribed_by_id) REFERENCES public.users(id);


--
-- Name: role_permissions FK_178199805b901ccd220ab7740ec; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: discharge_summaries FK_1997bfe011e0c157333a00703dd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summaries
    ADD CONSTRAINT "FK_1997bfe011e0c157333a00703dd" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: patient_documents FK_1a2f2efebe9442fc0c64c5d8db3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT "FK_1a2f2efebe9442fc0c64c5d8db3" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: admissions FK_1ac2aad90812783de1104bf9a19; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_1ac2aad90812783de1104bf9a19" FOREIGN KEY ("encounterId") REFERENCES public.encounters(id);


--
-- Name: antenatal_visits FK_1ad73a9929fb26e3dab19f146d0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_visits
    ADD CONSTRAINT "FK_1ad73a9929fb26e3dab19f146d0" FOREIGN KEY (registration_id) REFERENCES public.antenatal_registrations(id);


--
-- Name: discharge_summaries FK_1ae93499f625db9298e8db79c54; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summaries
    ADD CONSTRAINT "FK_1ae93499f625db9298e8db79c54" FOREIGN KEY (discharged_by_id) REFERENCES public.users(id);


--
-- Name: equipment_calibrations FK_1bd9353a38b0c4154a781278641; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_calibrations
    ADD CONSTRAINT "FK_1bd9353a38b0c4154a781278641" FOREIGN KEY (equipment_id) REFERENCES public.lab_equipment(id);


--
-- Name: goods_receipt_items FK_1be5b5db098cafc5cd45bbd34b4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT "FK_1be5b5db098cafc5cd45bbd34b4" FOREIGN KEY (goods_receipt_note_id) REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE;


--
-- Name: purchase_requests FK_1d4b6cb24916cf6382b516715a5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT "FK_1d4b6cb24916cf6382b516715a5" FOREIGN KEY (requested_by_id) REFERENCES public.users(id);


--
-- Name: bed_transfers FK_1e11620cc575fcbfaf8651bae04; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_transfers
    ADD CONSTRAINT "FK_1e11620cc575fcbfaf8651bae04" FOREIGN KEY ("admissionId") REFERENCES public.admissions(id);


--
-- Name: invoice_matches FK_1e443ed44e11f1156d111b5e21c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_matches
    ADD CONSTRAINT "FK_1e443ed44e11f1156d111b5e21c" FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);


--
-- Name: vitals FK_1e555351a4549045116e2fc05e3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT "FK_1e555351a4549045116e2fc05e3" FOREIGN KEY (recorded_by_id) REFERENCES public.users(id);


--
-- Name: supplier_credit_notes FK_1f04428e85af800d54af2e85508; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_credit_notes
    ADD CONSTRAINT "FK_1f04428e85af800d54af2e85508" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: vendor_contracts FK_1f066fbdd97e14f005262ab0b61; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_contracts
    ADD CONSTRAINT "FK_1f066fbdd97e14f005262ab0b61" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: job_applications FK_1f0ed6a45088ef95236af37a5f4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT "FK_1f0ed6a45088ef95236af37a5f4" FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id);


--
-- Name: services FK_1f8d1173481678a035b4a81a4ec; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "FK_1f8d1173481678a035b4a81a4ec" FOREIGN KEY (category_id) REFERENCES public.service_categories(id);


--
-- Name: purchase_orders FK_1fdd0d65d22a9a9b3d43d7392d1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "FK_1fdd0d65d22a9a9b3d43d7392d1" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: immunization_schedules FK_203cfcff4bb0e4e55756eceaebb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.immunization_schedules
    ADD CONSTRAINT "FK_203cfcff4bb0e4e55756eceaebb" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: units FK_20d142e148f4a9934daa7ee5108; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT "FK_20d142e148f4a9934daa7ee5108" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: postnatal_visits FK_211f8356ab4e624758f4ae17150; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_visits
    ADD CONSTRAINT "FK_211f8356ab4e624758f4ae17150" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: rfq_vendors FK_215c12c2e823761738e5070c9b9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_vendors
    ADD CONSTRAINT "FK_215c12c2e823761738e5070c9b9" FOREIGN KEY (rfq_id) REFERENCES public.rfqs(id) ON DELETE CASCADE;


--
-- Name: journal_entries FK_215f2fd608ea86d19d93fad6445; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "FK_215f2fd608ea86d19d93fad6445" FOREIGN KEY (posted_by_id) REFERENCES public.users(id);


--
-- Name: lab_equipment FK_2194fa8348e1bc523d4a3f16ad6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_equipment
    ADD CONSTRAINT "FK_2194fa8348e1bc523d4a3f16ad6" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: storage_conditions FK_21a93b2e375f4160121b49c22b4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storage_conditions
    ADD CONSTRAINT "FK_21a93b2e375f4160121b49c22b4" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: supplier_payments FK_220694212ec38b4aa2fb02ed622; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT "FK_220694212ec38b4aa2fb02ed622" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: items FK_22375ca9f9867a6370267d928a3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_22375ca9f9867a6370267d928a3" FOREIGN KEY (subcategory_id) REFERENCES public.item_subcategories(id);


--
-- Name: stock_ledger FK_22545b7462f87beb57342e370dd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "FK_22545b7462f87beb57342e370dd" FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: lab_samples FK_22d54ac9bf1e4d4c2a7e8af0daa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "FK_22d54ac9bf1e4d4c2a7e8af0daa" FOREIGN KEY ("collectedById") REFERENCES public.users(id);


--
-- Name: baby_wellness_checks FK_24a80703aaa480452340ce419d9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baby_wellness_checks
    ADD CONSTRAINT "FK_24a80703aaa480452340ce419d9" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: pharmacy_sales FK_24e04500da8cc59b7a8bf75b61a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT "FK_24e04500da8cc59b7a8bf75b61a" FOREIGN KEY (sold_by_id) REFERENCES public.users(id);


--
-- Name: master_data_versions FK_2521cbb0089bfe6ac71f00d7749; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_versions
    ADD CONSTRAINT "FK_2521cbb0089bfe6ac71f00d7749" FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: emergency_cases FK_25f4c6605be16beb3bed48c4771; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "FK_25f4c6605be16beb3bed48c4771" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: deposit_applications FK_262298a59a1c44599e633c059e8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deposit_applications
    ADD CONSTRAINT "FK_262298a59a1c44599e633c059e8" FOREIGN KEY (deposit_id) REFERENCES public.patient_deposits(id);


--
-- Name: salary_history FK_26d718313d46ac444457aa9b6c4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_history
    ADD CONSTRAINT "FK_26d718313d46ac444457aa9b6c4" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: admissions FK_27092279805e1574ae4aaff49c6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_27092279805e1574ae4aaff49c6" FOREIGN KEY ("wardId") REFERENCES public.wards(id);


--
-- Name: budget_lines FK_27df932d047b7ab0b9efd5f5632; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT "FK_27df932d047b7ab0b9efd5f5632" FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: change_sets FK_28136da8985ac3c01a52869e6c7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_sets
    ADD CONSTRAINT "FK_28136da8985ac3c01a52869e6c7" FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE SET NULL;


--
-- Name: controlled_substance_logs FK_2899de35f3980d82ac28f085319; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_logs
    ADD CONSTRAINT "FK_2899de35f3980d82ac28f085319" FOREIGN KEY (dispensed_by_id) REFERENCES public.users(id);


--
-- Name: insurance_claims FK_2a16b02fd36b51f40ff958267d7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "FK_2a16b02fd36b51f40ff958267d7" FOREIGN KEY (submitted_by_id) REFERENCES public.users(id);


--
-- Name: support_access_grants FK_2a5973b908d819825b947fd0e0a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_access_grants
    ADD CONSTRAINT "FK_2a5973b908d819825b947fd0e0a" FOREIGN KEY (granted_to_id) REFERENCES public.users(id);


--
-- Name: units FK_2ad3e7fac1ea8a6997b11331c12; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT "FK_2ad3e7fac1ea8a6997b11331c12" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: onboarding_tasks FK_2b196535c767e1c1dda73b55343; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT "FK_2b196535c767e1c1dda73b55343" FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: orders FK_2b485e7dc7421f196a628b3e40e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_2b485e7dc7421f196a628b3e40e" FOREIGN KEY (completed_by_id) REFERENCES public.users(id);


--
-- Name: contract_amendments FK_2b835a4cd87e9e3dfc68661b0b7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_amendments
    ADD CONSTRAINT "FK_2b835a4cd87e9e3dfc68661b0b7" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: system_settings FK_2c211a073170ae051bb52e66853; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT "FK_2c211a073170ae051bb52e66853" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: roles FK_2c6e71b96bff7b9230de9dda83b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "FK_2c6e71b96bff7b9230de9dda83b" FOREIGN KEY (parent_role_id) REFERENCES public.roles(id);


--
-- Name: supplier_payments FK_2c7a57b5e0abd785200110ee6fb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT "FK_2c7a57b5e0abd785200110ee6fb" FOREIGN KEY (prepared_by) REFERENCES public.users(id);


--
-- Name: onboarding_tasks FK_2c810dc8dc144dce7c456c37edd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT "FK_2c810dc8dc144dce7c456c37edd" FOREIGN KEY (assigned_to_id) REFERENCES public.users(id);


--
-- Name: replication_logs FK_2cc01ba78f6f7a0e297678c6752; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replication_logs
    ADD CONSTRAINT "FK_2cc01ba78f6f7a0e297678c6752" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: quotation_approvals FK_2ce53d4299f3ed09bf0c4b8da33; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_approvals
    ADD CONSTRAINT "FK_2ce53d4299f3ed09bf0c4b8da33" FOREIGN KEY (quotation_id) REFERENCES public.vendor_quotations(id);


--
-- Name: employees FK_2d83c53c3e553a48dadb9722e38; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "FK_2d83c53c3e553a48dadb9722e38" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: password_policies FK_2dc70abfab12b9bfdecfef50eca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_policies
    ADD CONSTRAINT "FK_2dc70abfab12b9bfdecfef50eca" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: insurance_policies FK_2e43f57ec047088040442585256; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT "FK_2e43f57ec047088040442585256" FOREIGN KEY (provider_id) REFERENCES public.insurance_providers(id);


--
-- Name: staff_rosters FK_2ee6a1e904566b8f606ef38a21b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_rosters
    ADD CONSTRAINT "FK_2ee6a1e904566b8f606ef38a21b" FOREIGN KEY (original_employee_id) REFERENCES public.employees(id);


--
-- Name: bank_reconciliation_items FK_2f33895a1447b65d4be68b19b5e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliation_items
    ADD CONSTRAINT "FK_2f33895a1447b65d4be68b19b5e" FOREIGN KEY (reconciliation_id) REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE;


--
-- Name: lab_samples FK_2fae81ac3fe1d52d50b96a58cff; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "FK_2fae81ac3fe1d52d50b96a58cff" FOREIGN KEY ("processedById") REFERENCES public.users(id);


--
-- Name: queues FK_312d09e1f20b955ceddf51fd94b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "FK_312d09e1f20b955ceddf51fd94b" FOREIGN KEY (assigned_doctor_id) REFERENCES public.users(id);


--
-- Name: follow_ups FK_319a222eeda4e02827fc97d6cac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_319a222eeda4e02827fc97d6cac" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: price_agreements FK_324e354115331ee366c4a02d9b5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_agreements
    ADD CONSTRAINT "FK_324e354115331ee366c4a02d9b5" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: appointments FK_3330f054416745deaa2cc130700; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "FK_3330f054416745deaa2cc130700" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: vendor_contracts FK_33d2abd0b5f5f249f6a26f3dceb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_contracts
    ADD CONSTRAINT "FK_33d2abd0b5f5f249f6a26f3dceb" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: patient_chronic_conditions FK_33ff5ff482e5c31e3d2aef97dac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_chronic_conditions
    ADD CONSTRAINT "FK_33ff5ff482e5c31e3d2aef97dac" FOREIGN KEY (diagnosis_id) REFERENCES public.diagnoses(id);


--
-- Name: support_access_grants FK_34275dea3d4d96c83c3a9d4f10f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_access_grants
    ADD CONSTRAINT "FK_34275dea3d4d96c83c3a9d4f10f" FOREIGN KEY (granted_by_id) REFERENCES public.users(id);


--
-- Name: insurance_policies FK_3436a40a737ad4cd1831f1dbd96; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT "FK_3436a40a737ad4cd1831f1dbd96" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: delegations FK_343ec2641e2831522ca623b7d80; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT "FK_343ec2641e2831522ca623b7d80" FOREIGN KEY (delegate_id) REFERENCES public.users(id);


--
-- Name: user_permissions FK_3495bd31f1862d02931e8e8d2e8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT "FK_3495bd31f1862d02931e8e8d2e8" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_ledger FK_349cc44be4e2c79a3df0e646693; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "FK_349cc44be4e2c79a3df0e646693" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: insurance_providers FK_353eb02c3549d39647b163c1fb3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_providers
    ADD CONSTRAINT "FK_353eb02c3549d39647b163c1fb3" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: staff_rosters FK_3547d845d76e1137d3ae73592f1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_rosters
    ADD CONSTRAINT "FK_3547d845d76e1137d3ae73592f1" FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: support_access_requests FK_36a641d339228c238686545fc07; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_access_requests
    ADD CONSTRAINT "FK_36a641d339228c238686545fc07" FOREIGN KEY (reviewed_by_id) REFERENCES public.users(id);


--
-- Name: billing_points FK_38b6b7cd8d325aa55581e0a3cc4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_points
    ADD CONSTRAINT "FK_38b6b7cd8d325aa55581e0a3cc4" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: group_permissions FK_3924be6485a5b5d0d2fe1a94c08; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permissions
    ADD CONSTRAINT "FK_3924be6485a5b5d0d2fe1a94c08" FOREIGN KEY (group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: admissions FK_395762cd5d815a28ecf1f46f89f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_395762cd5d815a28ecf1f46f89f" FOREIGN KEY ("dischargedById") REFERENCES public.users(id);


--
-- Name: supplier_credit_notes FK_3a5812a0a2f799f73897ccf4498; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_credit_notes
    ADD CONSTRAINT "FK_3a5812a0a2f799f73897ccf4498" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: patient_notes FK_3a88b654dceb39a4986d1fefdad; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT "FK_3a88b654dceb39a4986d1fefdad" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: employees FK_3c1edfd3fbbb520397285feb64e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "FK_3c1edfd3fbbb520397285feb64e" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: antenatal_registrations FK_3c39d7199e74c42340906dc6ca3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_registrations
    ADD CONSTRAINT "FK_3c39d7199e74c42340906dc6ca3" FOREIGN KEY (registered_by_id) REFERENCES public.users(id);


--
-- Name: encounters FK_3c6121c55f8a534b7fabe8967b4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "FK_3c6121c55f8a534b7fabe8967b4" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: performance_appraisals FK_3c79fd080218711d89d6673a2cd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_appraisals
    ADD CONSTRAINT "FK_3c79fd080218711d89d6673a2cd" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: payslips FK_3ca6cde51127cd649278d038ca9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT "FK_3ca6cde51127cd649278d038ca9" FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: refresh_tokens FK_3ddc983c5f7bcf132fd8732c3f4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: stock_balances FK_3dedc9490997427f90baa397b8b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT "FK_3dedc9490997427f90baa397b8b" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: supplier_payments FK_3ec69c61d48541a12f3f2a211c5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT "FK_3ec69c61d48541a12f3f2a211c5" FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: purchase_requests FK_3ee8e94c75dcdbe9029954d0f87; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT "FK_3ee8e94c75dcdbe9029954d0f87" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: purchase_order_items FK_3f92bb44026cedfe235c8b91244; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT "FK_3f92bb44026cedfe235c8b91244" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: role_permission_groups FK_3fb1dbefbcb81ef1a480cb1095a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission_groups
    ADD CONSTRAINT "FK_3fb1dbefbcb81ef1a480cb1095a" FOREIGN KEY (group_id) REFERENCES public.permission_groups(id) ON DELETE CASCADE;


--
-- Name: lab_results FK_3fb2e555067192da46fc3fc9ec5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT "FK_3fb2e555067192da46fc3fc9ec5" FOREIGN KEY ("validatedById") REFERENCES public.users(id);


--
-- Name: medication_adherence_records FK_406c43f66775b0c2c018f18ae67; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_adherence_records
    ADD CONSTRAINT "FK_406c43f66775b0c2c018f18ae67" FOREIGN KEY (prescription_item_id) REFERENCES public.prescription_items(id);


--
-- Name: fixed_assets FK_40d641e86981a0b9fc8a61eac29; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT "FK_40d641e86981a0b9fc8a61eac29" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: sync_conflicts FK_41192642654f303d88c0a996fdf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_conflicts
    ADD CONSTRAINT "FK_41192642654f303d88c0a996fdf" FOREIGN KEY (resolved_by_id) REFERENCES public.users(id);


--
-- Name: vendor_ratings FK_42bd80c01f976b8622e3df69264; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT "FK_42bd80c01f976b8622e3df69264" FOREIGN KEY (rated_by_id) REFERENCES public.users(id);


--
-- Name: lab_samples FK_437ec47b252067259b8860edc52; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "FK_437ec47b252067259b8860edc52" FOREIGN KEY ("orderId") REFERENCES public.orders(id);


--
-- Name: shift_definitions FK_442ef53abdd5fe224cff5b6b5dd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT "FK_442ef53abdd5fe224cff5b6b5dd" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: pos_shifts FK_446dfea36d5d6987823b6fc1b0b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT "FK_446dfea36d5d6987823b6fc1b0b" FOREIGN KEY (cashier_id) REFERENCES public.users(id);


--
-- Name: stores FK_44e5b4fea05cbfcf133f5cf47df; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT "FK_44e5b4fea05cbfcf133f5cf47df" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: expiry_alerts FK_44f701237dc29cef03cda5eecd1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alerts
    ADD CONSTRAINT "FK_44f701237dc29cef03cda5eecd1" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: vendor_ratings FK_44fc0d9b3686ea65023d34a91e9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT "FK_44fc0d9b3686ea65023d34a91e9" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: membership_schemes FK_450a7b1b369002d617606fe983c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membership_schemes
    ADD CONSTRAINT "FK_450a7b1b369002d617606fe983c" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: dispensations FK_455b5fc6feba092bfa680eedeff; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT "FK_455b5fc6feba092bfa680eedeff" FOREIGN KEY (prescription_item_id) REFERENCES public.prescription_items(id);


--
-- Name: antenatal_registrations FK_45871ca22e7cf0c064ad229a5a3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_registrations
    ADD CONSTRAINT "FK_45871ca22e7cf0c064ad229a5a3" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: items FK_462598b17a3933e30f762c232cd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_462598b17a3933e30f762c232cd" FOREIGN KEY (strength_id) REFERENCES public.item_strengths(id);


--
-- Name: treatment_plans FK_480223041d1028a9d7eaba81223; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT "FK_480223041d1028a9d7eaba81223" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: patient_documents FK_4824c700787a2b74aff640415ea; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_documents
    ADD CONSTRAINT "FK_4824c700787a2b74aff640415ea" FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: pharmacy_sale_items FK_491dfaf10d4e5e08ed2fe13f9cf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_sale_items
    ADD CONSTRAINT "FK_491dfaf10d4e5e08ed2fe13f9cf" FOREIGN KEY (sale_id) REFERENCES public.pharmacy_sales(id);


--
-- Name: orders FK_4a03420fd7fb7136daa038bd2ea; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_4a03420fd7fb7136daa038bd2ea" FOREIGN KEY (reviewed_by_id) REFERENCES public.users(id);


--
-- Name: journal_entry_lines FK_4a4fcd732e7b109880444ebc9c1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT "FK_4a4fcd732e7b109880444ebc9c1" FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: goods_receipt_notes FK_4a67ac080537031a23ff6efd869; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "FK_4a67ac080537031a23ff6efd869" FOREIGN KEY (received_by_id) REFERENCES public.users(id);


--
-- Name: doctor_duties FK_4a7e0ea9867cd2fd0db2edd5ead; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_duties
    ADD CONSTRAINT "FK_4a7e0ea9867cd2fd0db2edd5ead" FOREIGN KEY (marked_by_id) REFERENCES public.users(id);


--
-- Name: facility_modules FK_4c1a72205cddd2626d531c5688a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_modules
    ADD CONSTRAINT "FK_4c1a72205cddd2626d531c5688a" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: master_data_approval_rules FK_4c4742a169c55b66b63b6c2f207; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_approval_rules
    ADD CONSTRAINT "FK_4c4742a169c55b66b63b6c2f207" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: patient_merges FK_4c7da0c5b0fe844ff979a87e006; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merges
    ADD CONSTRAINT "FK_4c7da0c5b0fe844ff979a87e006" FOREIGN KEY (primary_patient_id) REFERENCES public.patients(id);


--
-- Name: appointments FK_4cf26c3f972d014df5c68d503d2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "FK_4cf26c3f972d014df5c68d503d2" FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: doctor_duties FK_4d2c92736343cf7ea144f7e7098; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_duties
    ADD CONSTRAINT "FK_4d2c92736343cf7ea144f7e7098" FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: encounters FK_4d43017f93be86c15b5636c51a6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "FK_4d43017f93be86c15b5636c51a6" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: deployments FK_4da628e59801421274e35355b15; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployments
    ADD CONSTRAINT "FK_4da628e59801421274e35355b15" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: baby_wellness_checks FK_4df7e893795dcfebc537752c513; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baby_wellness_checks
    ADD CONSTRAINT "FK_4df7e893795dcfebc537752c513" FOREIGN KEY (delivery_outcome_id) REFERENCES public.delivery_outcomes(id);


--
-- Name: update_rollouts FK_4ed3f8246f7613eb8c6a99b5a20; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_rollouts
    ADD CONSTRAINT "FK_4ed3f8246f7613eb8c6a99b5a20" FOREIGN KEY (release_candidate_id) REFERENCES public.release_candidates(id) ON DELETE CASCADE;


--
-- Name: imaging_orders FK_4ef9a9940c180d7e01382280149; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "FK_4ef9a9940c180d7e01382280149" FOREIGN KEY (modality_id) REFERENCES public.imaging_modalities(id);


--
-- Name: supplier_returns FK_500787fcab288ee556f2a18c227; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT "FK_500787fcab288ee556f2a18c227" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: supplier_return_items FK_50ca21beefce71173cb579417ed; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT "FK_50ca21beefce71173cb579417ed" FOREIGN KEY (supplier_return_id) REFERENCES public.supplier_returns(id);


--
-- Name: cashier_sessions FK_519a7cd72505daec541ba7bab78; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cashier_sessions
    ADD CONSTRAINT "FK_519a7cd72505daec541ba7bab78" FOREIGN KEY (billing_point_id) REFERENCES public.billing_points(id);


--
-- Name: leave_requests FK_52b4b7c7d295e204add6dbe0a09; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT "FK_52b4b7c7d295e204add6dbe0a09" FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: invoice_matches FK_52d678851faf361d2e83bb1d226; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_matches
    ADD CONSTRAINT "FK_52d678851faf361d2e83bb1d226" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: item_units FK_534e5feb3c5336130d56ec07de3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_units
    ADD CONSTRAINT "FK_534e5feb3c5336130d56ec07de3" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: purchase_request_items FK_548d16709a88eece700ce66620e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_request_items
    ADD CONSTRAINT "FK_548d16709a88eece700ce66620e" FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id) ON DELETE CASCADE;


--
-- Name: insurance_price_lists FK_54b62d3d7e540a61a74f4c8beb3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_price_lists
    ADD CONSTRAINT "FK_54b62d3d7e540a61a74f4c8beb3" FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;


--
-- Name: service_prices FK_54c57a28f90f96866f99874f7ca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_prices
    ADD CONSTRAINT "FK_54c57a28f90f96866f99874f7ca" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: follow_ups FK_550d093b0b785092ba5b6701c58; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_550d093b0b785092ba5b6701c58" FOREIGN KEY (completed_by_id) REFERENCES public.users(id);


--
-- Name: bed_transfers FK_55463d56186860726ad40a2272f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_transfers
    ADD CONSTRAINT "FK_55463d56186860726ad40a2272f" FOREIGN KEY ("transferredById") REFERENCES public.users(id);


--
-- Name: payments FK_563a5e248518c623eebd987d43e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "FK_563a5e248518c623eebd987d43e" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: journal_entries FK_57f12db31e55e2ae18c0e235ad3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "FK_57f12db31e55e2ae18c0e235ad3" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: pricing_rules FK_58306629e6b33068ef4b48d0fc7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT "FK_58306629e6b33068ef4b48d0fc7" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: suppliers FK_5837cb046dac22a8b4f854509ea; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT "FK_5837cb046dac22a8b4f854509ea" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: approval_requests FK_583d55f85471d6c6453c4724569; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT "FK_583d55f85471d6c6453c4724569" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: follow_ups FK_58883ef0fb21c829f48fee3523c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_58883ef0fb21c829f48fee3523c" FOREIGN KEY (scheduled_by_id) REFERENCES public.users(id);


--
-- Name: postnatal_visits FK_58edbebdd19a730bc8cef9faeb5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_visits
    ADD CONSTRAINT "FK_58edbebdd19a730bc8cef9faeb5" FOREIGN KEY (registration_id) REFERENCES public.antenatal_registrations(id);


--
-- Name: items FK_5973ee13e40bbda821302da37a6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_5973ee13e40bbda821302da37a6" FOREIGN KEY (formulation_id) REFERENCES public.item_formulations(id);


--
-- Name: training_programs FK_59ee3c8f9ef58d577d33b748f09; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT "FK_59ee3c8f9ef58d577d33b748f09" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: surgery_consumables FK_5b25083f16387a2d2bad71b0f5d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_consumables
    ADD CONSTRAINT "FK_5b25083f16387a2d2bad71b0f5d" FOREIGN KEY (recorded_by_id) REFERENCES public.users(id);


--
-- Name: clinical_notes FK_5c039351664d9d1e9a87b34f822; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT "FK_5c039351664d9d1e9a87b34f822" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: vendor_ratings FK_5c145960bb205acf0ce6ed8e1d7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT "FK_5c145960bb205acf0ce6ed8e1d7" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: medication_administrations FK_5c4dac094de5df62f741bf7b5d7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT "FK_5c4dac094de5df62f741bf7b5d7" FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: journal_entries FK_5c689f5bfe2e71513eac991d0e5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "FK_5c689f5bfe2e71513eac991d0e5" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: imaging_modalities FK_5ca869a71b6e07c14fbdfd0cdf7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_modalities
    ADD CONSTRAINT "FK_5ca869a71b6e07c14fbdfd0cdf7" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: stock_transfer_items FK_5cba72118c885bcdaa0fb39efa9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT "FK_5cba72118c885bcdaa0fb39efa9" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: pre_authorizations FK_5cc556bc1b50856140daecefc3b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorizations
    ADD CONSTRAINT "FK_5cc556bc1b50856140daecefc3b" FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id);


--
-- Name: users FK_5cce3415d144173ca33ed1d8626; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_5cce3415d144173ca33ed1d8626" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: item_formulations FK_5d136e94a2861d98c85132c574a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_formulations
    ADD CONSTRAINT "FK_5d136e94a2861d98c85132c574a" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: supplier_payments FK_5e3f9443818b705f6ab86b44764; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT "FK_5e3f9443818b705f6ab86b44764" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: payroll_runs FK_5f33cf8f96f3966dbaca54c372a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT "FK_5f33cf8f96f3966dbaca54c372a" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: training_enrollments FK_5f3e6ad2eaa08adfca73d493d02; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_enrollments
    ADD CONSTRAINT "FK_5f3e6ad2eaa08adfca73d493d02" FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: orders FK_5f9bab60cd8d6f0b6b91e4d53f3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_5f9bab60cd8d6f0b6b91e4d53f3" FOREIGN KEY (ordered_by_id) REFERENCES public.users(id);


--
-- Name: patient_notes FK_6060341814bac5ef96161430924; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_notes
    ADD CONSTRAINT "FK_6060341814bac5ef96161430924" FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: rfq_vendors FK_607099c4ce95cea216b3729f921; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_vendors
    ADD CONSTRAINT "FK_607099c4ce95cea216b3729f921" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: pharmacy_sales FK_6112f5e4e1430579916d555d0c1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_sales
    ADD CONSTRAINT "FK_6112f5e4e1430579916d555d0c1" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: facilities FK_614c777675e9bd6a7e5d4772a4d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT "FK_614c777675e9bd6a7e5d4772a4d" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: onboarding_tasks FK_620cf23cb5dc7bf98aac0325db1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_tasks
    ADD CONSTRAINT "FK_620cf23cb5dc7bf98aac0325db1" FOREIGN KEY (completed_by_id) REFERENCES public.users(id);


--
-- Name: vendor_quotations FK_62825605ba8f5af2fd40c2389d8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_quotations
    ADD CONSTRAINT "FK_62825605ba8f5af2fd40c2389d8" FOREIGN KEY (rfq_id) REFERENCES public.rfqs(id);


--
-- Name: pos_shifts FK_62bc3ca685907e29d6349c2bb60; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT "FK_62bc3ca685907e29d6349c2bb60" FOREIGN KEY (register_id) REFERENCES public.pos_registers(id);


--
-- Name: stock_transfers FK_637ba099943690399ec34399963; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "FK_637ba099943690399ec34399963" FOREIGN KEY (from_store_id) REFERENCES public.stores(id);


--
-- Name: items FK_63c905fb820f9ce57df96624d74; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_63c905fb820f9ce57df96624d74" FOREIGN KEY (unit_id) REFERENCES public.item_units(id);


--
-- Name: sample_referrals FK_63e91ed766fa4559abd399a0511; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_referrals
    ADD CONSTRAINT "FK_63e91ed766fa4559abd399a0511" FOREIGN KEY ("toFacilityId") REFERENCES public.facilities(id);


--
-- Name: supplier_credit_notes FK_645efa2c05aca5b47f48262bb33; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_credit_notes
    ADD CONSTRAINT "FK_645efa2c05aca5b47f48262bb33" FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: supplier_payment_items FK_6511242c952bb3d96145e8fe607; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment_items
    ADD CONSTRAINT "FK_6511242c952bb3d96145e8fe607" FOREIGN KEY (payment_id) REFERENCES public.supplier_payments(id);


--
-- Name: admissions FK_6515e5bb9805a58aa4bba8cdd84; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_6515e5bb9805a58aa4bba8cdd84" FOREIGN KEY ("admittedById") REFERENCES public.users(id);


--
-- Name: delegations FK_65cb96f7573dd182ad4ec259f9a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT "FK_65cb96f7573dd182ad4ec259f9a" FOREIGN KEY (delegator_id) REFERENCES public.users(id);


--
-- Name: shift_swap_requests FK_65f5caaac33767e09ae4d9c3814; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT "FK_65f5caaac33767e09ae4d9c3814" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: dispensations FK_666565f610dcb7af23c47450617; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT "FK_666565f610dcb7af23c47450617" FOREIGN KEY (dispensed_by_id) REFERENCES public.users(id);


--
-- Name: imaging_results FK_666a89128d0c5a7a09875da6dd0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_results
    ADD CONSTRAINT "FK_666a89128d0c5a7a09875da6dd0" FOREIGN KEY (imaging_order_id) REFERENCES public.imaging_orders(id);


--
-- Name: goods_receipt_notes FK_669c9fe0248ddaf8f673d076414; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "FK_669c9fe0248ddaf8f673d076414" FOREIGN KEY (posted_by_id) REFERENCES public.users(id);


--
-- Name: imaging_results FK_66f954cd22e45006beadc170af8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_results
    ADD CONSTRAINT "FK_66f954cd22e45006beadc170af8" FOREIGN KEY (reported_by_id) REFERENCES public.users(id);


--
-- Name: insurance_claims FK_671d4b8cc352e88797b8f11119a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "FK_671d4b8cc352e88797b8f11119a" FOREIGN KEY (provider_id) REFERENCES public.insurance_providers(id);


--
-- Name: vitals FK_68ac15cc3683d1ac50e3bc57066; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT "FK_68ac15cc3683d1ac50e3bc57066" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: patient_chronic_conditions FK_68df5a6ef072e0114eef0e1e474; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_chronic_conditions
    ADD CONSTRAINT "FK_68df5a6ef072e0114eef0e1e474" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: medication_administrations FK_6940a8be277e1c374283023c1cb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medication_administrations
    ADD CONSTRAINT "FK_6940a8be277e1c374283023c1cb" FOREIGN KEY (prescription_item_id) REFERENCES public.prescription_items(id);


--
-- Name: chart_of_accounts FK_696136b16d41cbf47ff3db72f75; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT "FK_696136b16d41cbf47ff3db72f75" FOREIGN KEY ("parentId") REFERENCES public.chart_of_accounts(id);


--
-- Name: master_data_versions FK_6986a84b5b7f2e7f91ca447c18c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_versions
    ADD CONSTRAINT "FK_6986a84b5b7f2e7f91ca447c18c" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: treatment_plans FK_69e82223582d0bd8560c6271735; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT "FK_69e82223582d0bd8560c6271735" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: stock_transfer_items FK_6a0f024e84c92b964c516aa7b79; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_items
    ADD CONSTRAINT "FK_6a0f024e84c92b964c516aa7b79" FOREIGN KEY (transfer_id) REFERENCES public.stock_transfers(id);


--
-- Name: surgery_cases FK_6b7366df64ca943ce6f5b137ed2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_6b7366df64ca943ce6f5b137ed2" FOREIGN KEY (theatre_id) REFERENCES public.theatres(id);


--
-- Name: emergency_cases FK_6b8eb7e8f9cce6393707c7c53a3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "FK_6b8eb7e8f9cce6393707c7c53a3" FOREIGN KEY (attending_doctor_id) REFERENCES public.users(id);


--
-- Name: referrals FK_6c89e54f86fe57e5692818e94f7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "FK_6c89e54f86fe57e5692818e94f7" FOREIGN KEY (source_encounter_id) REFERENCES public.encounters(id);


--
-- Name: lab_equipment FK_6cf50935776ba37fb836ccfca77; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_equipment
    ADD CONSTRAINT "FK_6cf50935776ba37fb836ccfca77" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: baby_wellness_checks FK_6d25bb8066b50d9b7308b67ae4c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baby_wellness_checks
    ADD CONSTRAINT "FK_6d25bb8066b50d9b7308b67ae4c" FOREIGN KEY (postnatal_visit_id) REFERENCES public.postnatal_visits(id);


--
-- Name: supplier_credit_note_items FK_6d77e6369daaf0499266d4d75f1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_credit_note_items
    ADD CONSTRAINT "FK_6d77e6369daaf0499266d4d75f1" FOREIGN KEY (credit_note_id) REFERENCES public.supplier_credit_notes(id);


--
-- Name: surgery_cases FK_6d8457536f75ffb1b5832550fe3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_6d8457536f75ffb1b5832550fe3" FOREIGN KEY (assistant_surgeon_id) REFERENCES public.users(id);


--
-- Name: vendor_contracts FK_6e864202b9f4893c564d368b3dd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_contracts
    ADD CONSTRAINT "FK_6e864202b9f4893c564d368b3dd" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: items FK_6ed953a2c457e2e41a6893706a2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_6ed953a2c457e2e41a6893706a2" FOREIGN KEY (brand_id) REFERENCES public.item_brands(id);


--
-- Name: disposal_records FK_6ff5be29c5a95e50e8ca61de662; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_records
    ADD CONSTRAINT "FK_6ff5be29c5a95e50e8ca61de662" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: departments FK_700b0b13f494cb37b6ca929e79b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "FK_700b0b13f494cb37b6ca929e79b" FOREIGN KEY (parent_id) REFERENCES public.departments(id);


--
-- Name: immunization_schedules FK_70abb8feaa7ee6a1d70f5435aa7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.immunization_schedules
    ADD CONSTRAINT "FK_70abb8feaa7ee6a1d70f5435aa7" FOREIGN KEY (administered_by_id) REFERENCES public.users(id);


--
-- Name: qc_results FK_70c3ba9795f14efae78b88a72bb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_results
    ADD CONSTRAINT "FK_70c3ba9795f14efae78b88a72bb" FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: qc_levey_jennings_data FK_7185954065f953a2008e47f66e2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_levey_jennings_data
    ADD CONSTRAINT "FK_7185954065f953a2008e47f66e2" FOREIGN KEY (qc_material_id) REFERENCES public.qc_materials(id);


--
-- Name: sync_queue FK_72929a42746f728c85c39873f3b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_queue
    ADD CONSTRAINT "FK_72929a42746f728c85c39873f3b" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: insurance_price_lists FK_72a284e34d15a9b3647dbf8c3fa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_price_lists
    ADD CONSTRAINT "FK_72a284e34d15a9b3647dbf8c3fa" FOREIGN KEY (lab_test_id) REFERENCES public.lab_tests(id) ON DELETE CASCADE;


--
-- Name: expiry_alert_history FK_738db3186dc2a02af3e1dc73181; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alert_history
    ADD CONSTRAINT "FK_738db3186dc2a02af3e1dc73181" FOREIGN KEY (acknowledged_by_id) REFERENCES public.users(id);


--
-- Name: training_enrollments FK_746b5967d7f57c2dd556f9b6700; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_enrollments
    ADD CONSTRAINT "FK_746b5967d7f57c2dd556f9b6700" FOREIGN KEY (training_program_id) REFERENCES public.training_programs(id);


--
-- Name: expiry_alerts FK_748427c0ea5eafb9c2c1cad5b5e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alerts
    ADD CONSTRAINT "FK_748427c0ea5eafb9c2c1cad5b5e" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: group_permissions FK_7514fdc446a1fdcf5b2d39cda60; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_permissions
    ADD CONSTRAINT "FK_7514fdc446a1fdcf5b2d39cda60" FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: theatres FK_753a3526ef3e4f4d32db4b5bdbe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theatres
    ADD CONSTRAINT "FK_753a3526ef3e4f4d32db4b5bdbe" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: clinical_notes FK_75ba6f7ce6c3f62e9a778812965; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT "FK_75ba6f7ce6c3f62e9a778812965" FOREIGN KEY (provider_id) REFERENCES public.users(id);


--
-- Name: staff_rosters FK_7761ef03ec3e0e58a9e351c9ff4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_rosters
    ADD CONSTRAINT "FK_7761ef03ec3e0e58a9e351c9ff4" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: controlled_substance_logs FK_7783b89b762c7427d4fd62f1f44; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_logs
    ADD CONSTRAINT "FK_7783b89b762c7427d4fd62f1f44" FOREIGN KEY (double_check_by_id) REFERENCES public.users(id);


--
-- Name: performance_appraisals FK_79bb7e43261d2f65f6f664c9433; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_appraisals
    ADD CONSTRAINT "FK_79bb7e43261d2f65f6f664c9433" FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: expiry_alert_history FK_7a59d50fba65f5584afa8fba4bb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alert_history
    ADD CONSTRAINT "FK_7a59d50fba65f5584afa8fba4bb" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: batch_stock_balances FK_7bf2b3ed02651af09336bf6e3c4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_stock_balances
    ADD CONSTRAINT "FK_7bf2b3ed02651af09336bf6e3c4" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: controlled_substance_logs FK_7c34800d5bc9ba4bae34dddab73; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_logs
    ADD CONSTRAINT "FK_7c34800d5bc9ba4bae34dddab73" FOREIGN KEY (dispensation_id) REFERENCES public.dispensations(id);


--
-- Name: invoice_match_items FK_7c6cd1a4b0e51861d177c255ad5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_match_items
    ADD CONSTRAINT "FK_7c6cd1a4b0e51861d177c255ad5" FOREIGN KEY (match_id) REFERENCES public.invoice_matches(id) ON DELETE CASCADE;


--
-- Name: encounters FK_7d26ff2efa24f107929c5856ae1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "FK_7d26ff2efa24f107929c5856ae1" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: invoices FK_7e369959f4952d563122ef12f11; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_7e369959f4952d563122ef12f11" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: patients FK_7fe1518dc780fd777669b5cb7a0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT "FK_7fe1518dc780fd777669b5cb7a0" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: invoice_matches FK_807e1fd68eef33ed9ce1307220e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_matches
    ADD CONSTRAINT "FK_807e1fd68eef33ed9ce1307220e" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: staff_rosters FK_80b4278e5d28bc2ff4496cc85ae; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_rosters
    ADD CONSTRAINT "FK_80b4278e5d28bc2ff4496cc85ae" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: postnatal_visits FK_81055c56ad51218e0332531cbbd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_visits
    ADD CONSTRAINT "FK_81055c56ad51218e0332531cbbd" FOREIGN KEY (delivery_outcome_id) REFERENCES public.delivery_outcomes(id);


--
-- Name: pre_authorizations FK_812713f07574b9d1cce83c676b7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorizations
    ADD CONSTRAINT "FK_812713f07574b9d1cce83c676b7" FOREIGN KEY (requested_by_id) REFERENCES public.users(id);


--
-- Name: user_permissions FK_8145f5fadacd311693c15e41f10; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT "FK_8145f5fadacd311693c15e41f10" FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: stores FK_819287309f6cbcc387c0707a83e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT "FK_819287309f6cbcc387c0707a83e" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: lab_samples FK_8225cff70cfa8a19f790027085e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_samples
    ADD CONSTRAINT "FK_8225cff70cfa8a19f790027085e" FOREIGN KEY ("labTestId") REFERENCES public.lab_tests(id);


--
-- Name: lab_results FK_826338b4579a2977a434519fedb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT "FK_826338b4579a2977a434519fedb" FOREIGN KEY ("sampleId") REFERENCES public.lab_samples(id);


--
-- Name: budgets FK_839d22c669f85f4403c14686ffc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT "FK_839d22c669f85f4403c14686ffc" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: role_permission_groups FK_83fd28a8aa421e2ab76acd62345; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission_groups
    ADD CONSTRAINT "FK_83fd28a8aa421e2ab76acd62345" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: providers FK_842a46f6b0079a69520561eeb62; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT "FK_842a46f6b0079a69520561eeb62" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: follow_ups FK_8596ae3fc61e9d08536db431d5e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_8596ae3fc61e9d08536db431d5e" FOREIGN KEY (follow_up_encounter_id) REFERENCES public.encounters(id);


--
-- Name: imaging_orders FK_85ef4e93076ccba7cabcbb75aa1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "FK_85ef4e93076ccba7cabcbb75aa1" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: petty_cash_transactions FK_8644c881af517e4e1707c5aeb41; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petty_cash_transactions
    ADD CONSTRAINT "FK_8644c881af517e4e1707c5aeb41" FOREIGN KEY (fund_id) REFERENCES public.petty_cash_funds(id);


--
-- Name: patient_merges FK_8696c0b02eeb6bd8af03662f22d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_merges
    ADD CONSTRAINT "FK_8696c0b02eeb6bd8af03662f22d" FOREIGN KEY (secondary_patient_id) REFERENCES public.patients(id);


--
-- Name: staff_rosters FK_86c41e7c461ba2cdedfac4adbdc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_rosters
    ADD CONSTRAINT "FK_86c41e7c461ba2cdedfac4adbdc" FOREIGN KEY (shift_definition_id) REFERENCES public.shift_definitions(id);


--
-- Name: service_prices FK_874b2f636cc2cb53ec02f80399c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_prices
    ADD CONSTRAINT "FK_874b2f636cc2cb53ec02f80399c" FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: deliveries FK_877aa24b5ed9c2adae60b1a169d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT "FK_877aa24b5ed9c2adae60b1a169d" FOREIGN KEY (sale_id) REFERENCES public.pharmacy_sales(id);


--
-- Name: user_roles FK_87b8888186ca9769c960e926870; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: bed_transfers FK_88efbf3790360527fd4f167c3f4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_transfers
    ADD CONSTRAINT "FK_88efbf3790360527fd4f167c3f4" FOREIGN KEY ("toBedId") REFERENCES public.beds(id);


--
-- Name: referrals FK_88f1d497ee5c5c092fdb44ee5e6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "FK_88f1d497ee5c5c092fdb44ee5e6" FOREIGN KEY (accepted_by_id) REFERENCES public.users(id);


--
-- Name: deliveries FK_89c5783be020ff65d2d8dd0da85; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT "FK_89c5783be020ff65d2d8dd0da85" FOREIGN KEY (customer_id) REFERENCES public.wholesale_customers(id);


--
-- Name: insurance_claims FK_8a4ca31994dc7685cd9cf7943c4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "FK_8a4ca31994dc7685cd9cf7943c4" FOREIGN KEY (policy_id) REFERENCES public.insurance_policies(id);


--
-- Name: pre_authorizations FK_8a66dd530448d45c0f179ea7afe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pre_authorizations
    ADD CONSTRAINT "FK_8a66dd530448d45c0f179ea7afe" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: patient_problems FK_8b1b712a14c0ae2f990cb7b4546; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_problems
    ADD CONSTRAINT "FK_8b1b712a14c0ae2f990cb7b4546" FOREIGN KEY (diagnosis_id) REFERENCES public.diagnoses(id);


--
-- Name: disposal_records FK_8c9ce6ed213c57355da2a199f59; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_records
    ADD CONSTRAINT "FK_8c9ce6ed213c57355da2a199f59" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: discharge_summaries FK_8da518e1929ed453cbcfe4dd81f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summaries
    ADD CONSTRAINT "FK_8da518e1929ed453cbcfe4dd81f" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: insurance_claims FK_8e48a5f00b242cae3c2bb2c9f20; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "FK_8e48a5f00b242cae3c2bb2c9f20" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: rfqs FK_8f5a278b08cdee89b0a4023ec55; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT "FK_8f5a278b08cdee89b0a4023ec55" FOREIGN KEY (purchase_request_id) REFERENCES public.purchase_requests(id);


--
-- Name: baby_wellness_checks FK_90c1699aebb767674286c5d37ac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baby_wellness_checks
    ADD CONSTRAINT "FK_90c1699aebb767674286c5d37ac" FOREIGN KEY (checked_by_id) REFERENCES public.users(id);


--
-- Name: queues FK_90f4eb9d2b2450c3648e9daeb97; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "FK_90f4eb9d2b2450c3648e9daeb97" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: payslips FK_9163ff0bcaf0212ce23e8f7c5ff; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT "FK_9163ff0bcaf0212ce23e8f7c5ff" FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id);


--
-- Name: pos_registers FK_92e7abb5ab33f4fe1351ae5a7c3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_registers
    ADD CONSTRAINT "FK_92e7abb5ab33f4fe1351ae5a7c3" FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: appointments FK_94a5d22901092a3dd14b5b38d69; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "FK_94a5d22901092a3dd14b5b38d69" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: sample_referrals FK_97bb21b64efb90629ecafe08d53; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_referrals
    ADD CONSTRAINT "FK_97bb21b64efb90629ecafe08d53" FOREIGN KEY ("patientId") REFERENCES public.patients(id);


--
-- Name: treatment_plans FK_98284772518d40ae0007178d064; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT "FK_98284772518d40ae0007178d064" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: supplier_returns FK_988230927607a99cbda998a0846; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT "FK_988230927607a99cbda998a0846" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: controlled_substance_logs FK_98fde551c3ad54549a6f1d4cce2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_logs
    ADD CONSTRAINT "FK_98fde551c3ad54549a6f1d4cce2" FOREIGN KEY (witness_id) REFERENCES public.users(id);


--
-- Name: invoice_matches FK_9947a493cc01392c101021ba181; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_matches
    ADD CONSTRAINT "FK_9947a493cc01392c101021ba181" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: lab_results FK_994e849edb268a87b15449da40a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT "FK_994e849edb268a87b15449da40a" FOREIGN KEY ("releasedById") REFERENCES public.users(id);


--
-- Name: follow_ups FK_998be7cf5b7cd4e63e58332944a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_998be7cf5b7cd4e63e58332944a" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: journal_entry_lines FK_9a54f62140d93c608634baad589; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT "FK_9a54f62140d93c608634baad589" FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: support_access_grants FK_9aa8c8a1e8314cec9d2f0e1be9f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_access_grants
    ADD CONSTRAINT "FK_9aa8c8a1e8314cec9d2f0e1be9f" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: stock_transfers FK_9ab338bab73e8d2adb4bb269a2b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "FK_9ab338bab73e8d2adb4bb269a2b" FOREIGN KEY (to_facility_id) REFERENCES public.facilities(id);


--
-- Name: vendor_rating_summaries FK_9ad31cda2d277f9c891e336878a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_rating_summaries
    ADD CONSTRAINT "FK_9ad31cda2d277f9c891e336878a" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: imaging_orders FK_9b439fe9c7b6ebdb94b1f2b984e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "FK_9b439fe9c7b6ebdb94b1f2b984e" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: imaging_orders FK_9b59448ac06b58bfe7bae960814; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "FK_9b59448ac06b58bfe7bae960814" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: items FK_9be0cfb84868eb8c5d7240a723f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_9be0cfb84868eb8c5d7240a723f" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: antenatal_visits FK_9bf091447b2bba6689226d89f62; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_visits
    ADD CONSTRAINT "FK_9bf091447b2bba6689226d89f62" FOREIGN KEY (seen_by_id) REFERENCES public.users(id);


--
-- Name: price_agreements FK_9cfe0b817cea206df4415deb5c1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_agreements
    ADD CONSTRAINT "FK_9cfe0b817cea206df4415deb5c1" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: dispensations FK_9de766ec31e80f2d60c474a2d68; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dispensations
    ADD CONSTRAINT "FK_9de766ec31e80f2d60c474a2d68" FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: user_roles FK_9e274d8f947fa1546f769f9ea47; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "FK_9e274d8f947fa1546f769f9ea47" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: sync_conflicts FK_9f751698016de35de82afeeedf3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_conflicts
    ADD CONSTRAINT "FK_9f751698016de35de82afeeedf3" FOREIGN KEY (client_user_id) REFERENCES public.users(id);


--
-- Name: pricing_rules FK_a03dbe2dfbe9b45b9bcda89c6d5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT "FK_a03dbe2dfbe9b45b9bcda89c6d5" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: follow_ups FK_a047e9a019ffee283eb908670d4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_a047e9a019ffee283eb908670d4" FOREIGN KEY (provider_id) REFERENCES public.users(id);


--
-- Name: patient_reminders FK_a195425c90acb19febc0faa901a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_reminders
    ADD CONSTRAINT "FK_a195425c90acb19febc0faa901a" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: insurance_claims FK_a2690fd66a9bb7ea23a06fdf133; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "FK_a2690fd66a9bb7ea23a06fdf133" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: item_brands FK_a29bbb75ead0d934e38c3f33b23; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_brands
    ADD CONSTRAINT "FK_a29bbb75ead0d934e38c3f33b23" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: queues FK_a3424b5e8b73bb0ff259f1d44ec; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "FK_a3424b5e8b73bb0ff259f1d44ec" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: users FK_a44521795aa6fdfb21e360d1ad2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_a44521795aa6fdfb21e360d1ad2" FOREIGN KEY (reports_to_id) REFERENCES public.users(id);


--
-- Name: deployment_alerts FK_a4b38b8d07ecb167069debf6038; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_alerts
    ADD CONSTRAINT "FK_a4b38b8d07ecb167069debf6038" FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE CASCADE;


--
-- Name: asset_depreciations FK_a58097bdc7473fd1ae66a265e55; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_depreciations
    ADD CONSTRAINT "FK_a58097bdc7473fd1ae66a265e55" FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id);


--
-- Name: prescription_items FK_a603d92d4a8459db5fbe45a4aea; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT "FK_a603d92d4a8459db5fbe45a4aea" FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id);


--
-- Name: stock_transfers FK_a6051c0d73bff61007ab67b9e0b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "FK_a6051c0d73bff61007ab67b9e0b" FOREIGN KEY (received_by_id) REFERENCES public.users(id);


--
-- Name: claim_items FK_a661895ee5fe5dda21a2d287c97; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claim_items
    ADD CONSTRAINT "FK_a661895ee5fe5dda21a2d287c97" FOREIGN KEY (claim_id) REFERENCES public.insurance_claims(id) ON DELETE CASCADE;


--
-- Name: staff_rosters FK_a66a1e66b0fa905ddf94aedd307; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_rosters
    ADD CONSTRAINT "FK_a66a1e66b0fa905ddf94aedd307" FOREIGN KEY (confirmed_by_id) REFERENCES public.users(id);


--
-- Name: immunization_schedules FK_a918906ca0f31b34e7309569774; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.immunization_schedules
    ADD CONSTRAINT "FK_a918906ca0f31b34e7309569774" FOREIGN KEY (delivery_outcome_id) REFERENCES public.delivery_outcomes(id);


--
-- Name: fixed_assets FK_a946d22a52bdf0213ea1f7b61b3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT "FK_a946d22a52bdf0213ea1f7b61b3" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: doctor_schedules FK_a9562c0e3b99e62425d3356c88b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT "FK_a9562c0e3b99e62425d3356c88b" FOREIGN KEY (doctor_id) REFERENCES public.users(id);


--
-- Name: emergency_cases FK_a95acb80854b85b9aac1f03d70c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "FK_a95acb80854b85b9aac1f03d70c" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: expiry_alert_configs FK_aa6a1cc6734dd45526533a02c21; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alert_configs
    ADD CONSTRAINT "FK_aa6a1cc6734dd45526533a02c21" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: budget_lines FK_ab9e9f1ceb877c6455bd62969ee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT "FK_ab9e9f1ceb877c6455bd62969ee" FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: stock_transfers FK_ac2177e7ac513e920b7335a23d8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "FK_ac2177e7ac513e920b7335a23d8" FOREIGN KEY (requested_by_id) REFERENCES public.users(id);


--
-- Name: equipment_maintenances FK_ad4422cd0cd26c2591ea210e2b4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment_maintenances
    ADD CONSTRAINT "FK_ad4422cd0cd26c2591ea210e2b4" FOREIGN KEY (equipment_id) REFERENCES public.lab_equipment(id);


--
-- Name: departments FK_ad56c1268186fb36cb745443f07; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "FK_ad56c1268186fb36cb745443f07" FOREIGN KEY (head_user_id) REFERENCES public.users(id);


--
-- Name: login_history FK_ad9ce49cb73c0b33746a56b6bd1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT "FK_ad9ce49cb73c0b33746a56b6bd1" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: staff_documents FK_adad17a3eb077df33bf0c3eb261; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_documents
    ADD CONSTRAINT "FK_adad17a3eb077df33bf0c3eb261" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: fiscal_periods FK_aecdd780e3aa4e6a5d0eabd74b0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT "FK_aecdd780e3aa4e6a5d0eabd74b0" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: lab_equipment FK_b060f486219adeeac96176c4e6b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_equipment
    ADD CONSTRAINT "FK_b060f486219adeeac96176c4e6b" FOREIGN KEY (responsible_person_id) REFERENCES public.users(id);


--
-- Name: doctor_duties FK_b087ff713e6ce52c1d6c4c4ca1c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_duties
    ADD CONSTRAINT "FK_b087ff713e6ce52c1d6c4c4ca1c" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: stock_transfers FK_b1da27bfa576e23508308a06cc5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "FK_b1da27bfa576e23508308a06cc5" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: item_strengths FK_b20468d532b89475f6904c4e509; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_strengths
    ADD CONSTRAINT "FK_b20468d532b89475f6904c4e509" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: user_roles FK_b23c65e50a758245a33ee35fda1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: price_agreements FK_b2b15bf59b4f233dc99ad3b3ac5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_agreements
    ADD CONSTRAINT "FK_b2b15bf59b4f233dc99ad3b3ac5" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: shift_definitions FK_b328129ecf267b02331a6bcde2e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_definitions
    ADD CONSTRAINT "FK_b328129ecf267b02331a6bcde2e" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: disciplinary_actions FK_b3bb1bdff0a3c8ac8c289af952b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinary_actions
    ADD CONSTRAINT "FK_b3bb1bdff0a3c8ac8c289af952b" FOREIGN KEY (issued_by_id) REFERENCES public.users(id);


--
-- Name: surgery_cases FK_b4e7e68f3ee193e3d1c3f343085; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_b4e7e68f3ee193e3d1c3f343085" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: supplier_return_items FK_b52e0fa65c881cf13f89f9498c7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_items
    ADD CONSTRAINT "FK_b52e0fa65c881cf13f89f9498c7" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: purchase_requests FK_b62895c963cf1203dce4a4dcc77; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT "FK_b62895c963cf1203dce4a4dcc77" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: disposal_records FK_b62fb871a798766108bd3f3346b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_records
    ADD CONSTRAINT "FK_b62fb871a798766108bd3f3346b" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: release_candidates FK_b70b6820fb2ac71fdbe86f0e86e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.release_candidates
    ADD CONSTRAINT "FK_b70b6820fb2ac71fdbe86f0e86e" FOREIGN KEY (app_version_id) REFERENCES public.app_versions(id) ON DELETE CASCADE;


--
-- Name: encounters FK_b73926d1d0956910b09afea267d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "FK_b73926d1d0956910b09afea267d" FOREIGN KEY (insurance_policy_id) REFERENCES public.insurance_policies(id);


--
-- Name: wards FK_b7a6d4818a6a7d2cbd4b169d09a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wards
    ADD CONSTRAINT "FK_b7a6d4818a6a7d2cbd4b169d09a" FOREIGN KEY ("facilityId") REFERENCES public.facilities(id);


--
-- Name: service_categories FK_b7de58e20d83c95c929ccba97ce; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT "FK_b7de58e20d83c95c929ccba97ce" FOREIGN KEY (parent_id) REFERENCES public.service_categories(id);


--
-- Name: payroll_runs FK_b892add2a9b412f34d2ac184d62; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT "FK_b892add2a9b412f34d2ac184d62" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: nursing_notes FK_b8ae70c8a70839e668a0b728576; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nursing_notes
    ADD CONSTRAINT "FK_b8ae70c8a70839e668a0b728576" FOREIGN KEY ("admissionId") REFERENCES public.admissions(id);


--
-- Name: queue_displays FK_ba86790544bff27fd2f705d1dd6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_displays
    ADD CONSTRAINT "FK_ba86790544bff27fd2f705d1dd6" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: cost_centers FK_bb107bb9e2c030d09d68f520ad2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT "FK_bb107bb9e2c030d09d68f520ad2" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: discharge_summaries FK_bb38b6f05c86cbd77b6d6459297; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summaries
    ADD CONSTRAINT "FK_bb38b6f05c86cbd77b6d6459297" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: referrals FK_bb61873c1c10fe8662f540f0625; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "FK_bb61873c1c10fe8662f540f0625" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: encounters FK_bb9694e5661b8635d77020d9529; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "FK_bb9694e5661b8635d77020d9529" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: qc_materials FK_bccd40ffb1af4347f91cfb439cb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_materials
    ADD CONSTRAINT "FK_bccd40ffb1af4347f91cfb439cb" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: audit_logs FK_bd2726fd31b35443f2245b93ba0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: master_data_versions FK_be3dc87f1aad6c5f183301b3a72; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_data_versions
    ADD CONSTRAINT "FK_be3dc87f1aad6c5f183301b3a72" FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: delivery_outcomes FK_be4879768d8c8a1d3b756f20732; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_outcomes
    ADD CONSTRAINT "FK_be4879768d8c8a1d3b756f20732" FOREIGN KEY (labour_record_id) REFERENCES public.labour_records(id);


--
-- Name: providers FK_be963b92dbaaadd670c44c53117; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT "FK_be963b92dbaaadd670c44c53117" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: chart_of_accounts FK_bf04a9e4d45df5811ab8c40ac27; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT "FK_bf04a9e4d45df5811ab8c40ac27" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: vendor_quotations FK_c08dd36c84b314b1a10ff5ad3e7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_quotations
    ADD CONSTRAINT "FK_c08dd36c84b314b1a10ff5ad3e7" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: imaging_orders FK_c0b0b927da3356773db7cdd32b1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "FK_c0b0b927da3356773db7cdd32b1" FOREIGN KEY (ordered_by_id) REFERENCES public.users(id);


--
-- Name: emergency_cases FK_c1d69994286f7d735fd9ec0c74a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_cases
    ADD CONSTRAINT "FK_c1d69994286f7d735fd9ec0c74a" FOREIGN KEY (triage_nurse_id) REFERENCES public.users(id);


--
-- Name: referrals FK_c21986f62eb2d10c1df4f72472c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "FK_c21986f62eb2d10c1df4f72472c" FOREIGN KEY (to_facility_id) REFERENCES public.facilities(id);


--
-- Name: antenatal_registrations FK_c389cd9ab8a4b491ceb582255ac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.antenatal_registrations
    ADD CONSTRAINT "FK_c389cd9ab8a4b491ceb582255ac" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: stock_transfers FK_c3b6aa9bca6ec206286348b379a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "FK_c3b6aa9bca6ec206286348b379a" FOREIGN KEY (from_facility_id) REFERENCES public.facilities(id);


--
-- Name: orders FK_c3d7b70495779cae48b3d3d4454; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "FK_c3d7b70495779cae48b3d3d4454" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: disposal_records FK_c457104651d289396dfeffed939; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disposal_records
    ADD CONSTRAINT "FK_c457104651d289396dfeffed939" FOREIGN KEY (disposed_by_id) REFERENCES public.users(id);


--
-- Name: referrals FK_c641708ad8e99fa9d2ecffc2f15; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "FK_c641708ad8e99fa9d2ecffc2f15" FOREIGN KEY (destination_encounter_id) REFERENCES public.encounters(id);


--
-- Name: surgery_consumables FK_c6b9c7dd39b875226da97f63d1c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_consumables
    ADD CONSTRAINT "FK_c6b9c7dd39b875226da97f63d1c" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: salary_history FK_c70621f2e600c3f966898714db3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_history
    ADD CONSTRAINT "FK_c70621f2e600c3f966898714db3" FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: queues FK_c787c4aa1c32474ba15d1e958ac; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "FK_c787c4aa1c32474ba15d1e958ac" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: surgery_cases FK_c82f34dcbd7d0e230e97525d130; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_c82f34dcbd7d0e230e97525d130" FOREIGN KEY (lead_surgeon_id) REFERENCES public.users(id);


--
-- Name: stock_ledger FK_c8e793007ab7741c3a1eeb3c9f9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "FK_c8e793007ab7741c3a1eeb3c9f9" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: imaging_results FK_cad091aae96794bd32af131b5e5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_results
    ADD CONSTRAINT "FK_cad091aae96794bd32af131b5e5" FOREIGN KEY (verified_by_id) REFERENCES public.users(id);


--
-- Name: bed_transfers FK_cb2d9249de4ea0fdf1582bff2ef; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_transfers
    ADD CONSTRAINT "FK_cb2d9249de4ea0fdf1582bff2ef" FOREIGN KEY ("toWardId") REFERENCES public.wards(id);


--
-- Name: encounters FK_cbc0424a6a9483680fd0625c1b2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT "FK_cbc0424a6a9483680fd0625c1b2" FOREIGN KEY (attending_provider_id) REFERENCES public.users(id);


--
-- Name: goods_receipt_notes FK_ccbfcfc53eb38170569335d95a1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "FK_ccbfcfc53eb38170569335d95a1" FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id);


--
-- Name: imaging_orders FK_cd78e4bfcc9894b7e6d4e3bf499; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_orders
    ADD CONSTRAINT "FK_cd78e4bfcc9894b7e6d4e3bf499" FOREIGN KEY (performed_by_id) REFERENCES public.users(id);


--
-- Name: immunization_schedules FK_ce53817e2ea16458a69f30d225d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.immunization_schedules
    ADD CONSTRAINT "FK_ce53817e2ea16458a69f30d225d" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: bed_transfers FK_ce78cdb86abe313c9e5239da1ff; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_transfers
    ADD CONSTRAINT "FK_ce78cdb86abe313c9e5239da1ff" FOREIGN KEY ("fromBedId") REFERENCES public.beds(id);


--
-- Name: treatment_plans FK_cf20ed00213b29efc673183d741; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_plans
    ADD CONSTRAINT "FK_cf20ed00213b29efc673183d741" FOREIGN KEY (primary_provider_id) REFERENCES public.users(id);


--
-- Name: job_postings FK_cf838f9c48f90ad76d0f2d231e5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_postings
    ADD CONSTRAINT "FK_cf838f9c48f90ad76d0f2d231e5" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: support_access_requests FK_cfa902586b7333a7968970b37f5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_access_requests
    ADD CONSTRAINT "FK_cfa902586b7333a7968970b37f5" FOREIGN KEY (requested_by_id) REFERENCES public.users(id);


--
-- Name: shift_swap_requests FK_cfb3ef5f7e53c406f875198867b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT "FK_cfb3ef5f7e53c406f875198867b" FOREIGN KEY (target_roster_id) REFERENCES public.staff_rosters(id);


--
-- Name: insurance_price_lists FK_cfd37ba963aa607246fd1620f53; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_price_lists
    ADD CONSTRAINT "FK_cfd37ba963aa607246fd1620f53" FOREIGN KEY (insurance_provider_id) REFERENCES public.insurance_providers(id) ON DELETE CASCADE;


--
-- Name: doctor_schedules FK_d04e243cb01f8c8921e6780ed59; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT "FK_d04e243cb01f8c8921e6780ed59" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: purchase_orders FK_d16a885aa88447ccfd010e739b0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "FK_d16a885aa88447ccfd010e739b0" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_orders FK_d22726686627539726874f183ef; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "FK_d22726686627539726874f183ef" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: attendance_records FK_d25dd89bc4fa1c955e953a0151d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT "FK_d25dd89bc4fa1c955e953a0151d" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: patient_memberships FK_d25e7b334f37938971579a759b7; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_memberships
    ADD CONSTRAINT "FK_d25e7b334f37938971579a759b7" FOREIGN KEY (scheme_id) REFERENCES public.membership_schemes(id);


--
-- Name: controlled_substance_logs FK_d25e91897a47f5422f33245d4a3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.controlled_substance_logs
    ADD CONSTRAINT "FK_d25e91897a47f5422f33245d4a3" FOREIGN KEY (prescription_item_id) REFERENCES public.prescription_items(id);


--
-- Name: insurance_claims FK_d43026209f6dfad76c2954f02fb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_claims
    ADD CONSTRAINT "FK_d43026209f6dfad76c2954f02fb" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: shift_swap_requests FK_d45c73e61a0bb253e66c24bf31e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT "FK_d45c73e61a0bb253e66c24bf31e" FOREIGN KEY (requester_id) REFERENCES public.employees(id);


--
-- Name: invoices FK_d4d2daa5eafb9c88a55ed1c654f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_d4d2daa5eafb9c88a55ed1c654f" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: deployment_versions FK_d4f2e1dfa98cc0a95422535ca66; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_versions
    ADD CONSTRAINT "FK_d4f2e1dfa98cc0a95422535ca66" FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE CASCADE;


--
-- Name: doctor_duties FK_d5493ca65912f0135b01e4d0011; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_duties
    ADD CONSTRAINT "FK_d5493ca65912f0135b01e4d0011" FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: surgery_cases FK_d567d4c2d6658a53633360a5394; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_d567d4c2d6658a53633360a5394" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: discharge_summaries FK_d581fab89ebf98d85151dd442f8; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discharge_summaries
    ADD CONSTRAINT "FK_d581fab89ebf98d85151dd442f8" FOREIGN KEY (attending_physician_id) REFERENCES public.users(id);


--
-- Name: supplier_payments FK_d5c07c4e48016eafc476272b19b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT "FK_d5c07c4e48016eafc476272b19b" FOREIGN KEY (paid_by) REFERENCES public.users(id);


--
-- Name: stock_ledger FK_d5df8e062a07221b2e96e8d0720; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_ledger
    ADD CONSTRAINT "FK_d5df8e062a07221b2e96e8d0720" FOREIGN KEY (item_id) REFERENCES public.items(id);


--
-- Name: patient_problems FK_d6a420fc319bac23137b5d2144b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_problems
    ADD CONSTRAINT "FK_d6a420fc319bac23137b5d2144b" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: reagent_lots FK_d7b8a648b6ddbf3dec7cfd44e80; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_lots
    ADD CONSTRAINT "FK_d7b8a648b6ddbf3dec7cfd44e80" FOREIGN KEY (reagent_id) REFERENCES public.lab_reagents(id);


--
-- Name: appointments FK_d7ca5e722b384f282042d92f4c1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT "FK_d7ca5e722b384f282042d92f4c1" FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: surgery_cases FK_d8bd75725f452d057e97dfb0ada; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_d8bd75725f452d057e97dfb0ada" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: vendor_quotation_items FK_d91dd41e37dc30bffc7beb69565; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_quotation_items
    ADD CONSTRAINT "FK_d91dd41e37dc30bffc7beb69565" FOREIGN KEY (quotation_id) REFERENCES public.vendor_quotations(id) ON DELETE CASCADE;


--
-- Name: queues FK_d93a9b5fc8284b56f79b001e0d6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "FK_d93a9b5fc8284b56f79b001e0d6" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: item_subcategories FK_d93ddd419bdf384d8b82c420425; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_subcategories
    ADD CONSTRAINT "FK_d93ddd419bdf384d8b82c420425" FOREIGN KEY (category_id) REFERENCES public.item_categories(id);


--
-- Name: deployment_configs FK_da61cec820b5a7ee7d62e21bf64; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_configs
    ADD CONSTRAINT "FK_da61cec820b5a7ee7d62e21bf64" FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE CASCADE;


--
-- Name: vendor_ratings FK_dabb805583ca2d539fd3bad0d72; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_ratings
    ADD CONSTRAINT "FK_dabb805583ca2d539fd3bad0d72" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: qc_results FK_db47ef7a7fd30218aacd51b90e9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_results
    ADD CONSTRAINT "FK_db47ef7a7fd30218aacd51b90e9" FOREIGN KEY (qc_material_id) REFERENCES public.qc_materials(id);


--
-- Name: qc_results FK_dc398fe2811396cd5632b75b736; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_results
    ADD CONSTRAINT "FK_dc398fe2811396cd5632b75b736" FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: reagent_consumptions FK_dc522064b2727552551b2d6b130; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reagent_consumptions
    ADD CONSTRAINT "FK_dc522064b2727552551b2d6b130" FOREIGN KEY (lot_id) REFERENCES public.reagent_lots(id);


--
-- Name: invoice_items FK_dc991d555664682cfe892eea2c1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT "FK_dc991d555664682cfe892eea2c1" FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: referrals FK_dcd416635cde260e02ccc123f17; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "FK_dcd416635cde260e02ccc123f17" FOREIGN KEY (from_facility_id) REFERENCES public.facilities(id);


--
-- Name: supplier_credit_notes FK_dcd4a4d95052dccb04da0d4000d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_credit_notes
    ADD CONSTRAINT "FK_dcd4a4d95052dccb04da0d4000d" FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: bed_transfers FK_df027ecae3d49e6dd450e539afa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bed_transfers
    ADD CONSTRAINT "FK_df027ecae3d49e6dd450e539afa" FOREIGN KEY ("fromWardId") REFERENCES public.wards(id);


--
-- Name: purchase_orders FK_df76a2fa8253e1afe3a33470f35; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "FK_df76a2fa8253e1afe3a33470f35" FOREIGN KEY (rfq_id) REFERENCES public.rfqs(id);


--
-- Name: facility_configs FK_df76ba52b3c5f7267dcdc260c4e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_configs
    ADD CONSTRAINT "FK_df76ba52b3c5f7267dcdc260c4e" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: journal_entries FK_dfb001500889ba5445dcebedf7e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT "FK_dfb001500889ba5445dcebedf7e" FOREIGN KEY (fiscal_period_id) REFERENCES public.fiscal_periods(id);


--
-- Name: change_sets FK_e0192b3bcd621108c466b334ebf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_sets
    ADD CONSTRAINT "FK_e0192b3bcd621108c466b334ebf" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: supplier_returns FK_e259919f3bf18a5c54dcac65fd0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_returns
    ADD CONSTRAINT "FK_e259919f3bf18a5c54dcac65fd0" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: asset_transfers FK_e2d6d8e86215ecc773584a9c213; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_transfers
    ADD CONSTRAINT "FK_e2d6d8e86215ecc773584a9c213" FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id);


--
-- Name: invoices FK_e3be0c11f4ce66b9b352477cb06; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_e3be0c11f4ce66b9b352477cb06" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: contract_amendments FK_e3c3ded02ffe206062ade0ef31d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_amendments
    ADD CONSTRAINT "FK_e3c3ded02ffe206062ade0ef31d" FOREIGN KEY (contract_id) REFERENCES public.vendor_contracts(id) ON DELETE CASCADE;


--
-- Name: pos_payment_splits FK_e4a7128aa0e70a0b3863859fdad; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_payment_splits
    ADD CONSTRAINT "FK_e4a7128aa0e70a0b3863859fdad" FOREIGN KEY (sale_id) REFERENCES public.pharmacy_sales(id);


--
-- Name: referrals FK_e4a89973d1060a37af497571bb5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT "FK_e4a89973d1060a37af497571bb5" FOREIGN KEY (referred_by_id) REFERENCES public.users(id);


--
-- Name: follow_ups FK_e4bae13ececc10aabe24cd37b66; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follow_ups
    ADD CONSTRAINT "FK_e4bae13ececc10aabe24cd37b66" FOREIGN KEY (source_encounter_id) REFERENCES public.encounters(id);


--
-- Name: rfqs FK_e5370309b5416e99c9622d47022; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT "FK_e5370309b5416e99c9622d47022" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: surgery_cases FK_e60012ffb6e8d3463d1e2c26f46; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_cases
    ADD CONSTRAINT "FK_e60012ffb6e8d3463d1e2c26f46" FOREIGN KEY (anesthesiologist_id) REFERENCES public.users(id);


--
-- Name: quotation_approvals FK_e694f61547d3eaf47e48976c3ae; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotation_approvals
    ADD CONSTRAINT "FK_e694f61547d3eaf47e48976c3ae" FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: expiry_alert_configs FK_e781bfaccf4aff67bc16b51630e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expiry_alert_configs
    ADD CONSTRAINT "FK_e781bfaccf4aff67bc16b51630e" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: user_roles FK_e7c006bb827f6ee9520153b106f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT "FK_e7c006bb827f6ee9520153b106f" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: billing_points FK_e7c6976c9cda13f7bb6daac8b5b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_points
    ADD CONSTRAINT "FK_e7c6976c9cda13f7bb6daac8b5b" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: qc_results FK_e7d5172729b1bf3c439bfd511c5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qc_results
    ADD CONSTRAINT "FK_e7d5172729b1bf3c439bfd511c5" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: surgery_consumables FK_e7efa839076c266ae4a736e24d2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surgery_consumables
    ADD CONSTRAINT "FK_e7efa839076c266ae4a736e24d2" FOREIGN KEY (surgery_case_id) REFERENCES public.surgery_cases(id);


--
-- Name: performance_appraisals FK_e8ccee2d7a1bdf76b0b41909d34; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_appraisals
    ADD CONSTRAINT "FK_e8ccee2d7a1bdf76b0b41909d34" FOREIGN KEY (reviewer_id) REFERENCES public.users(id);


--
-- Name: delegations FK_e920505c7f29d466c5d65af5a28; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delegations
    ADD CONSTRAINT "FK_e920505c7f29d466c5d65af5a28" FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: shift_swap_requests FK_e980c4a2e13d2d052b70193a36a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT "FK_e980c4a2e13d2d052b70193a36a" FOREIGN KEY (target_employee_id) REFERENCES public.employees(id);


--
-- Name: admissions FK_e9893be1fc23af2a753b82d52af; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_e9893be1fc23af2a753b82d52af" FOREIGN KEY ("attendingDoctorId") REFERENCES public.users(id);


--
-- Name: bank_reconciliations FK_e9a86a8d49e6a26d1c260c8571c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT "FK_e9a86a8d49e6a26d1c260c8571c" FOREIGN KEY (bank_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: admissions FK_e9eac43b40763c55ca076e4d011; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_e9eac43b40763c55ca076e4d011" FOREIGN KEY ("bedId") REFERENCES public.beds(id);


--
-- Name: labour_records FK_eabcaea163e7f54e3b916db9a1a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labour_records
    ADD CONSTRAINT "FK_eabcaea163e7f54e3b916db9a1a" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: update_notifications FK_eb59b940e3a8a174036c78913ee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.update_notifications
    ADD CONSTRAINT "FK_eb59b940e3a8a174036c78913ee" FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE CASCADE;


--
-- Name: tenant_feature_modules FK_ebcd7386073501b986db6e1e36e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_feature_modules
    ADD CONSTRAINT "FK_ebcd7386073501b986db6e1e36e" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: stock_balances FK_ec43c7dc9911a253cbc6636ef6a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT "FK_ec43c7dc9911a253cbc6636ef6a" FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: queues FK_ed0a9af6a859f53bc78a2e13e80; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "FK_ed0a9af6a859f53bc78a2e13e80" FOREIGN KEY (serving_user_id) REFERENCES public.users(id);


--
-- Name: sample_referrals FK_ee9291efb68a5a8ef8d1d580fbf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sample_referrals
    ADD CONSTRAINT "FK_ee9291efb68a5a8ef8d1d580fbf" FOREIGN KEY ("sampleId") REFERENCES public.lab_samples(id);


--
-- Name: leave_requests FK_eef6f2beeb96d468621f22e0f29; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT "FK_eef6f2beeb96d468621f22e0f29" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: user_permissions FK_ef71071c7832d547c1b966a20c3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT "FK_ef71071c7832d547c1b966a20c3" FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: rfq_items FK_ef8f022c5f4d9e27e47e03a1202; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_items
    ADD CONSTRAINT "FK_ef8f022c5f4d9e27e47e03a1202" FOREIGN KEY (rfq_id) REFERENCES public.rfqs(id) ON DELETE CASCADE;


--
-- Name: prescriptions FK_f09b4189e7145df4fe7565246cc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT "FK_f09b4189e7145df4fe7565246cc" FOREIGN KEY (encounter_id) REFERENCES public.encounters(id);


--
-- Name: clinical_notes FK_f12920767e0d46d81dc0a03931c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinical_notes
    ADD CONSTRAINT "FK_f12920767e0d46d81dc0a03931c" FOREIGN KEY (last_edited_by_id) REFERENCES public.users(id);


--
-- Name: item_categories FK_f34dfea50ca494e41ea71bfd82f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_categories
    ADD CONSTRAINT "FK_f34dfea50ca494e41ea71bfd82f" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: lab_reagents FK_f432ef674bb9ae6e5ad830f7227; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_reagents
    ADD CONSTRAINT "FK_f432ef674bb9ae6e5ad830f7227" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: items FK_f4afc37bbfb8358df70660c3d31; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT "FK_f4afc37bbfb8358df70660c3d31" FOREIGN KEY (storage_condition_id) REFERENCES public.storage_conditions(id);


--
-- Name: stock_balances FK_f4c42c9c650112fde4ffac26b5f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_balances
    ADD CONSTRAINT "FK_f4c42c9c650112fde4ffac26b5f" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: stock_transfers FK_f50804547823f16758ea5f894ee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT "FK_f50804547823f16758ea5f894ee" FOREIGN KEY (to_store_id) REFERENCES public.stores(id);


--
-- Name: job_postings FK_f5a439eaafaa702dd4caa727ed2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_postings
    ADD CONSTRAINT "FK_f5a439eaafaa702dd4caa727ed2" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: item_tag_assignments FK_f7c3b8d69b15834b85d0200d606; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_tag_assignments
    ADD CONSTRAINT "FK_f7c3b8d69b15834b85d0200d606" FOREIGN KEY (tag_id) REFERENCES public.item_tags(id);


--
-- Name: queues FK_f7edfc4fe9f2a59335dde80ab6f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queues
    ADD CONSTRAINT "FK_f7edfc4fe9f2a59335dde80ab6f" FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: licenses FK_f8dd0daeeb64f0520a99adc885c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT "FK_f8dd0daeeb64f0520a99adc885c" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: biometric_data FK_f95ac9926e8b7b0c5a5d84b4789; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.biometric_data
    ADD CONSTRAINT "FK_f95ac9926e8b7b0c5a5d84b4789" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: shift_swap_requests FK_f968b6d6a16bfc8b71b0b6e4c97; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT "FK_f968b6d6a16bfc8b71b0b6e4c97" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: attendance_records FK_f97d7be854091ef9ab5d75c0de3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT "FK_f97d7be854091ef9ab5d75c0de3" FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: insurance_price_lists FK_f9a05d75f6c8d29cf0004f53138; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_price_lists
    ADD CONSTRAINT "FK_f9a05d75f6c8d29cf0004f53138" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: admissions FK_f9d5de8d7dd020123a3c76f0a2e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admissions
    ADD CONSTRAINT "FK_f9d5de8d7dd020123a3c76f0a2e" FOREIGN KEY ("patientId") REFERENCES public.patients(id);


--
-- Name: replication_logs FK_fa06852a6d7cc22abcd1b7dea12; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replication_logs
    ADD CONSTRAINT "FK_fa06852a6d7cc22abcd1b7dea12" FOREIGN KEY (deployment_id) REFERENCES public.deployments(id) ON DELETE SET NULL;


--
-- Name: disciplinary_actions FK_fa1e22569a54fb283d7d0fd5c9a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disciplinary_actions
    ADD CONSTRAINT "FK_fa1e22569a54fb283d7d0fd5c9a" FOREIGN KEY (employee_id) REFERENCES public.users(id);


--
-- Name: shift_swap_requests FK_fa5b87d760144f027582097df6e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swap_requests
    ADD CONSTRAINT "FK_fa5b87d760144f027582097df6e" FOREIGN KEY (requester_roster_id) REFERENCES public.staff_rosters(id);


--
-- Name: postnatal_visits FK_fb038095127af84cc3c23825260; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postnatal_visits
    ADD CONSTRAINT "FK_fb038095127af84cc3c23825260" FOREIGN KEY (seen_by_id) REFERENCES public.users(id);


--
-- Name: purchase_orders FK_fc976210717def7ce55b4313629; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT "FK_fc976210717def7ce55b4313629" FOREIGN KEY (approved_by_id) REFERENCES public.users(id);


--
-- Name: in_app_notifications FK_fca9f4b31e14399316b2ca309ca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.in_app_notifications
    ADD CONSTRAINT "FK_fca9f4b31e14399316b2ca309ca" FOREIGN KEY (sender_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: labour_records FK_fcc6957ffa5fe53f3573109bc78; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.labour_records
    ADD CONSTRAINT "FK_fcc6957ffa5fe53f3573109bc78" FOREIGN KEY (registration_id) REFERENCES public.antenatal_registrations(id);


--
-- Name: vendor_contracts FK_fd757ea702fea705026f26e05db; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_contracts
    ADD CONSTRAINT "FK_fd757ea702fea705026f26e05db" FOREIGN KEY (renewed_from_id) REFERENCES public.vendor_contracts(id);


--
-- Name: goods_receipt_notes FK_fd8dc8064931260f783a20f6bc9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.goods_receipt_notes
    ADD CONSTRAINT "FK_fd8dc8064931260f783a20f6bc9" FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: phone_home_records FK_fdb64e37ebda90e6c803ebf220c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_home_records
    ADD CONSTRAINT "FK_fdb64e37ebda90e6c803ebf220c" FOREIGN KEY (license_id) REFERENCES public.licenses(id);


--
-- Name: payments FK_fdb95dd85ac02027afaed80f139; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "FK_fdb95dd85ac02027afaed80f139" FOREIGN KEY (received_by_id) REFERENCES public.users(id);


--
-- Name: price_agreements FK_fdda4378bb70a497f9e46f210e3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_agreements
    ADD CONSTRAINT "FK_fdda4378bb70a497f9e46f210e3" FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: rfqs FK_fe0ff5feee91d386cbd92a88ecc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT "FK_fe0ff5feee91d386cbd92a88ecc" FOREIGN KEY (facility_id) REFERENCES public.facilities(id);


--
-- Name: approval_requests FK_fe1fd51dc3f183b37762a01458e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT "FK_fe1fd51dc3f183b37762a01458e" FOREIGN KEY (requested_by_id) REFERENCES public.users(id);


--
-- Name: lab_results FK_fee5b68e13c17ea98ea0482bf5f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT "FK_fee5b68e13c17ea98ea0482bf5f" FOREIGN KEY ("enteredById") REFERENCES public.users(id);


--
-- Name: facilities FK_ff7eeee51fd9b78f6ff6307b2e9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT "FK_ff7eeee51fd9b78f6ff6307b2e9" FOREIGN KEY (parent_facility_id) REFERENCES public.facilities(id);


--
-- PostgreSQL database dump complete
--

\unrestrict 14fnwvxvfnbj8gVfq4Xm6l9aupNuDGshWkXWDLamCdFTLNuA3eVTLx9Jys3gDgp

