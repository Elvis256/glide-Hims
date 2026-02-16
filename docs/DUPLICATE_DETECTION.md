# Duplicate Patient Detection System - Implementation Summary

## What is a Duplicate Patient?

A **duplicate patient** means **THE SAME PERSON registered multiple times** in the system.

### ✅ TRUE Duplicates (What We Detect)

1. **Same National ID** → 100% duplicate (government-issued unique identifier)
2. **Same Name + DOB + Gender** → Very high confidence (95%+)
3. **Very Similar Name + Same DOB** → High confidence (85%+, catches typos like "Elvis Ntuyo" vs "Ntuyo Elvis")
4. **Exact Name + Similar DOB (±3 days)** → Medium confidence (65%+, catches data entry errors)

### ❌ NOT Duplicates

- **Phone number alone** → Families share phones ✓
- **Name alone** → Common names exist
- **DOB alone** → Many people born on the same day

## Key Improvements Implemented

### 1. **Intelligent Fuzzy Matching** 🎯
- Uses Levenshtein distance algorithm (via fuzzball library)
- Catches typos, name variations, and different word orders
- Multiple matching strategies:
  - **Exact ratio**: Character-by-character comparison
  - **Partial ratio**: Substring matching
  - **Token sort ratio**: Word-order independent matching

### 2. **Confidence Scoring System** 📊
Each potential duplicate gets a confidence score (0-100%) and level:

- **HIGH (85%+)**: 
  - National ID match (100%)
  - Exact/similar name + exact DOB + same gender (95%)
  - Very similar name + exact DOB (85%)
  - **Action**: Strong warning, requires review

- **MEDIUM (60-84%)**:
  - Exact name + DOB within ±3 days
  - Similar name + exact DOB
  - **Action**: Warning with details

- **LOW (<60%)**:
  - Not shown to users (filtered out)

### 3. **Enhanced UI/UX** 💡

#### Side-by-Side Comparison
- Shows new registration data
- Lists all potential matches with color-coded confidence levels
- Red border = High confidence
- Yellow border = Medium confidence

#### Rich Match Information
- Confidence score percentage
- Match reasons (why it's flagged as duplicate)
- Last visit date
- Full patient details (Name, MRN, DOB, Gender, Phone, National ID)
- "View Full Record" button to inspect before deciding

#### Clear Guidance
- Explains that phone sharing is normal for families
- "Register Anyway" button for confirmed new patients

### 4. **Improved MRN Format** 🏥

**OLD Format**: `MRN26000001` (MRN + year + sequential)

**NEW Format**: `{HOSPITAL}{DATE}{RANDOM}`

Examples:
- Hospital: "Mulago Hospital" → `MUHO202602164523`
- Hospital: "St. Mary's" → `SM202602167891`
- Hospital: "General Hospital" → `GH20260216 2345`

**Advantages**:
- Hospital-specific prefix (branding)
- Full date (YYYYMMDD) for audit trails
- Random 4-digit number (collision-resistant)

### 5. **Audit Logging** 📝
Every patient registration is logged with:
- User who registered
- Action type: `PATIENT_CREATED`
- Patient details (MRN, name, DOB, etc.)
- Timestamp and IP tracking

Special logging for "Register Anyway" actions to track duplicate override patterns.

### 6. **Performance Optimizations** ⚡

#### Database Indexes
- `idx_patients_full_name` - Fast name lookups
- `idx_patients_date_of_birth` - Fast DOB searches
- `idx_patients_phone` - Phone number searches
- `idx_patients_full_name_dob` - Composite index for common query
- `idx_patients_full_name_trgm` - Trigram index for fuzzy matching

#### PostgreSQL Extension
- **pg_trgm** extension for `SIMILARITY()` function
- Enables fast fuzzy text matching at database level
- Graceful fallback to ILIKE if extension not available

## Configuration

### Hospital Name Setup
The MRN prefix comes from the hospital name in system settings:

```typescript
// Database: system_settings table
key: 'hospital_name'
value: { name: 'Your Hospital Name' }
```

Hospital name extraction logic:
1. **≤ 4 chars**: Use as-is (e.g., "MAYO" → `MAYO`)
2. **Multiple words**: Use initials (e.g., "Mulago National Referral Hospital" → `MNRH`)
3. **Single long word**: First 4 chars (e.g., "Comprehensive" → `COMP`)

### Confidence Thresholds
Configurable in `duplicate-detector.util.ts`:

```typescript
// Only flag duplicates with confidence >= 60%
if (score >= 60) {
  // Show warning
}
```

## Technical Details

### Backend Files Modified/Created
1. ✅ `duplicate-detector.util.ts` - Core detection logic
2. ✅ `patients.service.ts` - Updated checkDuplicates() and create()
3. ✅ `patients.controller.ts` - Updated response format
4. ✅ `patients.module.ts` - Added AuditLog, SystemSetting repos
5. ✅ `patient.entity.ts` - Added performance indexes
6. ✅ `1771276800000-AddDuplicateDetectionSupport.ts` - Migration

### Frontend Files Modified
1. ✅ `patients.ts` (services) - Updated DuplicateCheckResult interface
2. ✅ `PatientRegistrationPage.tsx` - Enhanced duplicate warning UI

### Dependencies Added
- **fuzzball** (backend) - Fuzzy string matching library

## Testing the System

### Test Cases

#### 1. National ID Match (100% duplicate)
```typescript
// Registration 1
{ fullName: "John Doe", nationalId: "CM123456" }

// Registration 2 (should block)
{ fullName: "John M. Doe", nationalId: "CM123456" }
// Result: 100% confidence - National ID match
```

#### 2. Name Typo Detection
```typescript
// Existing: "Elvis Ntuyo"
// New: "Ntuyo Elvis"
// Result: 85-95% confidence - Same name, different order + DOB match
```

#### 3. Data Entry Error (DOB)
```typescript
// Existing: "Mary Smith", DOB: "1990-05-15"
// New: "Mary Smith", DOB: "1990-05-17" (±2 days)
// Result: 70-75% confidence - Name match + close DOB
```

#### 4. Family Members (NOT duplicate)
```typescript
// Existing: "Jane Doe", phone: "+256700111222"
// New: "John Doe", phone: "+256700111222"
// Result: NO duplicate warning (phone alone doesn't trigger)
```

## Migration Instructions

### 1. Apply Database Migration
```bash
cd packages/backend
npm run typeorm migration:run
```

This will:
- Enable pg_trgm extension
- Create performance indexes
- Add trigram index for fuzzy matching

### 2. Set Hospital Name
Insert/update in system_settings:
```sql
INSERT INTO system_settings (id, key, value, description)
VALUES (
  gen_random_uuid(),
  'hospital_name',
  '{"name": "Your Hospital Name"}',
  'Hospital name for MRN prefix generation'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### 3. Restart Backend
```bash
pm2 restart glide-hims-backend
```

## Future Enhancements (Roadmap)

1. **Merge Duplicate Records**
   - UI to merge two patient records
   - Transfer encounters, prescriptions, etc.
   - Soft-delete duplicate, keep primary

2. **Machine Learning**
   - Train model on confirmed duplicates
   - Improve confidence scoring over time

3. **Analytics Dashboard**
   - Track duplicate detection accuracy
   - Monitor override patterns by user
   - Identify data quality issues

4. **Biometric Verification**
   - Fingerprint matching
   - Photo comparison using facial recognition

## Support

For questions or issues:
- Check logs: `pm2 logs glide-hims-backend`
- Review audit logs in `audit_logs` table
- Test duplicate detection in development first

---

**Implementation Date**: February 16, 2026  
**Version**: 1.0  
**Status**: ✅ Ready for Testing
