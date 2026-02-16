# Insurance Schemes Overview

## Two Types of Insurance Schemes

### 1. Hospital Insurance Scheme (General Public)

**For:** Any patient/person can enroll
**Purpose:** Biometric verification for medical services coverage
**User Account:** Patient user (NOT linked to employee)

#### Enrollment Process:
1. Patient registers at reception (or is already registered)
2. Staff enrolls patient via **Hospital Scheme Enrollment** page
3. Creates user account (username = MRN by default)
4. Registers patient's fingerprints
5. Links user account to patient record

#### How It Works:
- Patient comes for OPD/IPD service
- Selects "Hospital Scheme" as payment method
- Scans fingerprint to verify enrollment
- Services covered under hospital insurance

#### Key Points:
- ✅ Any person can enroll
- ✅ No employee record required
- ✅ User account is for biometric login only
- ✅ Patient record remains separate

---

### 2. Staff Insurance Scheme (Employees Only)

**For:** Hospital employees and their dependents
**Purpose:** Staff benefits and employee health coverage
**User Account:** Staff user (linked to employee record)

#### Enrollment Process:
1. Employee is hired and added to HR system (creates employee record)
2. During employee registration, fingerprints are captured
3. Employee user account is automatically created (linked to employee)
4. Benefits activated based on employment status

#### How It Works:
- Staff member comes for OPD/IPD service
- Selects "Staff" as payment method
- Scans fingerprint to verify employment
- Services covered under staff benefits

#### Key Points:
- ✅ Employees only
- ✅ Must have employee record in HR system
- ✅ User account linked to employee
- ✅ Enrollment happens during HR onboarding
- ⚠️ Staff enrollment via HR module (not Hospital Scheme Enrollment page)

---

## Summary Table

| Feature | Hospital Insurance | Staff Insurance |
|---------|-------------------|-----------------|
| **Who Can Enroll** | Any patient/person | Employees only |
| **Enrollment Page** | Hospital Scheme Enrollment | HR Module (during hiring) |
| **User Account Type** | Patient user | Staff user |
| **Employee Record** | Not required | Required |
| **Navigation** | Registration → Insurance Desk → Hospital Scheme Enrollment | HR → Employee Management |
| **Payment Method** | "Hospital Scheme" | "Staff" |
| **Verification** | Fingerprint scan | Fingerprint scan |

---

## Technical Implementation

### Database Structure

**Patient Users (Hospital Insurance):**
```
users table:
  - id (UUID)
  - username (e.g., "mrn26000001")
  - passwordHash
  - fullName
  - email, phone
  - employee_id: NULL ✅ Not linked

patients table:
  - id
  - user_id: references users.id ✅ Linked to user
  - mrn, fullName, etc.
```

**Staff Users (Employee Insurance):**
```
users table:
  - id (UUID)
  - username (e.g., "emp12345")
  - passwordHash
  - fullName
  - email, phone
  - employee_id: references employees.id ✅ Linked to employee

employees table:
  - id
  - user_id: references users.id ✅ Linked to user
  - employee_number
  - department, job_title, etc.
```

### API Endpoints

**Hospital Insurance Enrollment:**
- `POST /api/v1/users` - Create patient user (no employeeId required)
- `POST /api/v1/patients/:id/link-user` - Link user to patient
- `GET /api/v1/patients/:id/linked-user` - Check enrollment status

**Staff Insurance:**
- `POST /api/v1/employees` - Create employee (auto-creates user)
- `POST /api/v1/biometrics/register` - Register employee fingerprints during HR onboarding

---

## Workflow Diagrams

### Hospital Insurance Enrollment Flow
```
┌─────────────────────┐
│ Patient Registered  │
│ (has MRN)          │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Insurance Desk      │
│ Staff enrolls       │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Create User Account │
│ (username, password)│
│ NO employee link    │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Register Fingerprint│
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Link user → patient │
│ (patients.user_id)  │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ ✅ Enrollment Done  │
│ Patient can verify  │
│ with fingerprint    │
└─────────────────────┘
```

### Staff Insurance Enrollment Flow
```
┌─────────────────────┐
│ HR Hires Employee   │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Create Employee Rec │
│ (dept, job, etc)    │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Create User Account │
│ (auto-linked to emp)│
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Register Fingerprint│
│ (during onboarding) │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ ✅ Staff Enrolled   │
│ Can use benefits    │
└─────────────────────┘
```

---

## Important Notes

1. **Hospital Insurance ≠ Health Insurance Company**
   - Hospital Insurance = Hospital's own coverage program
   - Similar to a "hospital membership" or "prepaid health plan"
   - Managed internally by hospital

2. **Staff Insurance ≠ Hospital Insurance**
   - Staff insurance is employment benefit
   - Hospital insurance is for general public
   - Different coverage rules, different processes

3. **User Accounts for Biometrics Only**
   - Patient users: Login NOT used for main system
   - Only for fingerprint verification at OPD/payment
   - Main system login is for staff only

4. **Enrollment Locations**
   - Hospital Insurance: Registration → Insurance Desk → Hospital Scheme Enrollment
   - Staff Insurance: HR Module (future implementation)

---

## FAQ

**Q: Can employees use Hospital Insurance?**
A: Employees should use Staff Insurance (their employment benefit). Hospital Insurance is for non-employee patients.

**Q: Why do patient users need passwords if they only use fingerprints?**
A: Fallback authentication in case fingerprint scanner is unavailable or fingerprint fails.

**Q: Can family members of employees enroll in Staff Insurance?**
A: Yes, but this is configured in the HR module (dependents feature - future work).

**Q: What if a patient already has a user account from another system?**
A: Hospital Scheme Enrollment creates NEW user accounts specifically for biometric verification. Existing accounts are not reused.

**Q: Where is the Staff Insurance enrollment page?**
A: Staff insurance is enrolled via HR Module during employee onboarding (not yet implemented - use Hospital Scheme Enrollment as temporary workaround).

---

## Migration Path

If your system previously required ALL users to have employee records:

1. ✅ Backend now allows patient users without employee links
2. ✅ Hospital Scheme Enrollment creates standalone patient users
3. ⚠️ Existing patient users with employee links: No action needed (legacy data is fine)
4. ⚠️ Staff enrollment: Still needs HR module implementation

---

## Next Steps

- [ ] Implement Staff Insurance enrollment in HR module
- [ ] Add dependent management for staff insurance
- [ ] Create insurance coverage rules engine
- [ ] Build claims processing workflow
- [ ] Add insurance analytics dashboard
