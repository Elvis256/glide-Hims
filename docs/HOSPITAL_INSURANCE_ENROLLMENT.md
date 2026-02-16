# Hospital Insurance Scheme & User Linking - Implementation Guide

## Overview

This document explains how patients get enrolled in the Hospital Insurance Scheme with biometric verification, and how staff insurance works.

---

## The Problem You Had

**Before**: When issuing OPD tokens with "Hospital Scheme" payment, you saw:
```
⚠️ Patient must have a linked user account for biometric verification
```

But there was **NO WAY** to create that user account or link it to the patient.

---

## The Solution: Separate Enrollment Process

### ✅ New Workflow

```
1. Patient Registers → Creates patient record (MRN assigned)
   ↓
2. Patient Enrolls in Hospital Insurance → Creates user account + registers fingerprints
   ↓
3. Issue OPD Token with "Hospital Scheme" → VERIFY fingerprint (already enrolled)
```

---

## How to Enroll a Patient in Hospital Insurance

### Step 1: Navigate to Enrollment Page
- URL: `/patients/hospital-scheme-enroll`
- Or from OPD Token page: Click "Enroll Patient Now" button

### Step 2: Search for Patient
- Enter patient's MRN (e.g., `MRN26000002`)
- System checks if patient is already enrolled
- If already enrolled → shows error
- If not enrolled → proceeds to account creation

### Step 3: Create User Account
The system auto-fills:
- **Username**: Patient's MRN in lowercase (e.g., `mrn26000002`)
- **Email**: From patient record (if available)
- **Phone**: From patient record

You need to:
- Set a **password** (minimum 8 characters)
- Confirm the password
- Verify contact information

**Important**: Give the username and password to the patient!

### Step 4: Register Fingerprint
- System prompts to register at least one fingerprint
- Use fingerprint scanner to capture
- Patient must be present for this step
- Registers fingerprint to the user account

### Step 5: Complete
- User account is automatically linked to patient
- Patient is now enrolled in Hospital Insurance Scheme
- Can now use biometric verification for OPD tokens

---

## How to Use Hospital Scheme (After Enrollment)

### Issue OPD Token
1. Select patient (must be enrolled)
2. Choose payment method: **"Hospital Scheme"**
3. Click **"Verify Fingerprint"** button
4. Patient places finger on scanner
5. If verified → Issue token
6. If not verified → Show error

**Note**: System only VERIFIES, does NOT register during token issuance.

---

## Staff Insurance Enrollment

### Current Status
Staff enrollment with biometrics is **NOT YET IMPLEMENTED** in the HR module.

### Planned Workflow
When registering an employee in HR:
1. Create employee record
2. Auto-create user account (username = employee ID)
3. Register fingerprints during onboarding
4. Set insurance coverage details
5. Link employee user to patient record when they visit

### Temporary Workaround
For now, enroll staff members using the Hospital Scheme enrollment page:
1. Register staff as patient first
2. Enroll in Hospital Insurance Scheme
3. Manually update database to add employee record

---

## Database Schema Changes

### New Column in `patients` Table
```sql
ALTER TABLE patients 
ADD COLUMN user_id UUID NULL,
ADD CONSTRAINT fk_patients_user 
FOREIGN KEY (user_id) REFERENCES users(id);
```

### Migration
File: `1771277200000-AddUserIdToPatients.ts`

Run migration:
```bash
cd /home/avis/Hospital/glide-Hims/packages/backend
npm run typeorm migration:run
```

---

## API Endpoints

### Link User to Patient
```http
POST /patients/{patientId}/link-user
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "uuid-of-user-account"
}
```

**Response**:
```json
{
  "message": "User linked to patient successfully",
  "data": { /* patient object with userId */ }
}
```

### Unlink User from Patient
```http
DELETE /patients/{patientId}/unlink-user
Authorization: Bearer {token}
```

### Get Linked User Info
```http
GET /patients/{patientId}/linked-user
Authorization: Bearer {token}
```

**Response**:
```json
{
  "data": {
    "linked": true,
    "user": {
      "id": "uuid",
      "username": "mrn26000002",
      "fullName": "Patient Name",
      "email": "patient@email.com",
      "phone": "+256742020610"
    }
  }
}
```

---

## Frontend Routes

### Hospital Scheme Enrollment Page
- **Route**: `/patients/hospital-scheme-enroll`
- **Component**: `HospitalSchemeEnrollmentPage.tsx`
- **Permission**: Receptionist/Admin

### Usage Example
```tsx
// Link from OPD Token page
<button onClick={() => navigate(`/patients/hospital-scheme-enroll?mrn=${patient.mrn}`)}>
  Enroll Patient Now →
</button>
```

---

## Security & Best Practices

### Password Management
- ✅ Minimum 8 characters
- ✅ Must be confirmed
- ⚠️ Give credentials to patient securely
- ⚠️ Advise patient to change password on first login

### Biometric Data
- ✅ Stored encrypted in database
- ✅ Never transmitted over network (client-side matching)
- ✅ At least one fingerprint required
- ✅ Can register multiple fingers

### Access Control
- ✅ Only users with `patients.update` permission can enroll
- ✅ Only users with `patients.read` can verify enrollment
- ✅ Audit logs track all enrollment actions

---

## Troubleshooting

### Error: "Patient already has a linked user account"
**Solution**: Patient is already enrolled. Check linked user info:
```
GET /patients/{patientId}/linked-user
```

### Error: "Patient not found"
**Solution**: Patient must be registered first. Go to `/patients/new`.

### Error: "No fingerprints registered"
**Solution**: During enrollment, fingerprint registration step was skipped or failed.
- Re-register fingerprints using biometrics module
- Or unlink and re-enroll the patient

### Fingerprint Verification Fails
**Possible Causes**:
1. Fingerprint quality is poor → Re-register with better quality
2. Wrong finger used → Try other registered fingers
3. Scanner not working → Check hardware connection

---

## Testing Checklist

### Hospital Insurance Enrollment
- [ ] Navigate to enrollment page
- [ ] Search for non-enrolled patient → Success
- [ ] Search for already-enrolled patient → Error shown
- [ ] Create user account with valid password
- [ ] Register fingerprint successfully
- [ ] Check patient record shows linked user
- [ ] Verify linked user info endpoint returns correct data

### OPD Token with Hospital Scheme
- [ ] Select enrolled patient
- [ ] Choose "Hospital Scheme" payment
- [ ] Verify fingerprint → Success
- [ ] Try with non-enrolled patient → Shows "Enroll Now" button
- [ ] Click "Enroll Now" → Redirects to enrollment page with MRN pre-filled

### API Endpoints
- [ ] POST /patients/{id}/link-user → Links successfully
- [ ] GET /patients/{id}/linked-user → Returns user info
- [ ] DELETE /patients/{id}/unlink-user → Unlinks successfully
- [ ] Try linking when already linked → Shows conflict error

---

## Next Steps & Enhancements

### Short Term
1. **Add to Dashboard**: Quick link to enrollment page
2. **Bulk Enrollment**: Upload CSV of patients to enroll
3. **Patient Portal**: Let patients login and view their records

### Medium Term
1. **HR Integration**: Auto-enroll employees during onboarding
2. **Self-Service Kiosks**: Patients enroll themselves
3. **Mobile App**: Enroll via mobile with phone camera biometric

### Long Term
1. **Facial Recognition**: Alternative to fingerprints
2. **Insurance Claims**: Auto-file claims for hospital scheme
3. **Analytics Dashboard**: Track enrollment rates

---

## Support & Documentation

### Files Modified/Created
**Backend**:
- `patient.entity.ts` - Added userId and user relation
- `patients.service.ts` - Added linking methods
- `patients.controller.ts` - Added linking endpoints
- `1771277200000-AddUserIdToPatients.ts` - Migration

**Frontend**:
- `HospitalSchemeEnrollmentPage.tsx` - New enrollment page
- `patients.ts` - Added linking API calls
- `OPDTokenPage.tsx` - Updated with enrollment instructions
- `App.tsx` - Added enrollment route

### Related Documentation
- Biometric System: See biometrics module documentation
- User Management: See users service documentation
- Patient Management: See patients module documentation

---

**Date**: February 16, 2026  
**Status**: ✅ Implemented & Ready for Testing  
**Version**: 1.0
