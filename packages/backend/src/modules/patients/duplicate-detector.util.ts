import * as fuzz from 'fuzzball';

export interface DuplicateMatch {
  patientId: string;
  matchReasons: string[];
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface PatientData {
  id: string;
  fullName: string;
  dateOfBirth: Date;
  gender: string;
  nationalId?: string;
  phone?: string;
}

/**
 * Normalize a name for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if two dates are within N days of each other
 */
function datesWithinDays(date1: Date, date2: Date, days: number): boolean {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

/**
 * Calculate confidence score for a potential duplicate
 * Returns a score from 0-100
 */
export function calculateDuplicateConfidence(
  newPatient: Omit<PatientData, 'id'>,
  existingPatient: PatientData,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // National ID match = 100% confidence (government-issued, unique identifier)
  if (newPatient.nationalId && existingPatient.nationalId) {
    if (newPatient.nationalId === existingPatient.nationalId) {
      score = 100;
      reasons.push('Identical National ID');
      return { score, reasons };
    }
  }

  // Name comparison using fuzzy matching
  const newNameNormalized = normalizeName(newPatient.fullName);
  const existingNameNormalized = normalizeName(existingPatient.fullName);
  const nameRatio = fuzz.ratio(newNameNormalized, existingNameNormalized);
  const partialRatio = fuzz.partial_ratio(newNameNormalized, existingNameNormalized);
  const tokenSortRatio = fuzz.token_sort_ratio(newNameNormalized, existingNameNormalized);

  // Use the highest matching score
  const bestNameMatch = Math.max(nameRatio, partialRatio, tokenSortRatio);

  // Date of birth comparison
  const dobMatch = newPatient.dateOfBirth.toISOString().split('T')[0] === 
                   existingPatient.dateOfBirth.toISOString().split('T')[0];
  const dobNearMatch = datesWithinDays(newPatient.dateOfBirth, existingPatient.dateOfBirth, 3);

  // Gender match
  const genderMatch = newPatient.gender === existingPatient.gender;

  // Scoring logic
  if (bestNameMatch >= 95 && dobMatch && genderMatch) {
    // Nearly identical name + exact DOB + same gender = very high confidence
    score = 95;
    reasons.push('Nearly identical name');
    reasons.push('Exact date of birth match');
    reasons.push('Same gender');
  } else if (bestNameMatch === 100 && dobMatch) {
    // Exact name + exact DOB = high confidence
    score = 90;
    reasons.push('Exact name match');
    reasons.push('Exact date of birth match');
  } else if (bestNameMatch >= 85 && dobMatch) {
    // Very similar name + exact DOB = high confidence
    score = 85;
    reasons.push('Very similar name (possible typo)');
    reasons.push('Exact date of birth match');
  } else if (bestNameMatch === 100 && dobNearMatch && genderMatch) {
    // Exact name + close DOB + same gender = medium-high confidence
    score = 75;
    reasons.push('Exact name match');
    reasons.push('Date of birth within 3 days (possible data entry error)');
    reasons.push('Same gender');
  } else if (bestNameMatch >= 90 && dobMatch) {
    // Similar name + exact DOB = medium confidence
    score = 70;
    reasons.push('Similar name');
    reasons.push('Exact date of birth match');
  } else if (bestNameMatch >= 85 && dobNearMatch) {
    // Similar name + close DOB = medium confidence
    score = 65;
    reasons.push('Similar name');
    reasons.push('Date of birth within 3 days');
  } else if (bestNameMatch === 100) {
    // Exact name only = low confidence (common names exist)
    score = 40;
    reasons.push('Exact name match only');
  } else if (bestNameMatch >= 85) {
    // Similar name only = very low confidence
    score = 30;
    reasons.push('Similar name only');
  }

  // Phone number is informational only - NOT used for duplicate detection
  // (families often share phones)

  return { score, reasons };
}

/**
 * Determine confidence level from score
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

/**
 * Check if a patient is a duplicate candidate
 * Only returns matches with confidence >= 60%
 */
export function checkDuplicates(
  newPatient: Omit<PatientData, 'id'>,
  existingPatients: PatientData[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const existing of existingPatients) {
    const { score, reasons } = calculateDuplicateConfidence(newPatient, existing);

    // Only flag as duplicate if confidence >= 60%
    if (score >= 60) {
      matches.push({
        patientId: existing.id,
        matchReasons: reasons,
        confidenceScore: score,
        confidenceLevel: getConfidenceLevel(score),
      });
    }
  }

  // Sort by confidence score (highest first)
  return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
}
