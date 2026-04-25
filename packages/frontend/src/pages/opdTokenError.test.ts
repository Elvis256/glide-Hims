import { describe, it, expect } from 'vitest';
import { mapQueueIssueError, formatQueueIssueError } from './opdTokenError';

describe('mapQueueIssueError', () => {
  it('maps facility context error to actionable message', () => {
    expect(mapQueueIssueError('Facility context is required. Please select a facility or re-login.')).toBe(
      'No active facility selected. Please select a facility or re-login.',
    );
  });

  it('preserves already-in-queue message from backend', () => {
    const msg = 'Patient John Doe is already in queue with token C001';
    expect(mapQueueIssueError(msg)).toBe(msg);
  });

  it('maps doctor off-duty message', () => {
    expect(mapQueueIssueError('Selected doctor is not currently checked in. Please choose another doctor or set Any Available Doctor.')).toBe(
      'Selected doctor is not checked in. Choose another doctor or select Any Available Doctor.',
    );
  });

  it('falls back to original message for unknown text', () => {
    expect(mapQueueIssueError('Some backend validation detail')).toBe('Some backend validation detail');
  });

  it('uses default fallback when message is empty', () => {
    expect(mapQueueIssueError('')).toBe('Failed to issue token. Please try again.');
  });
});

describe('formatQueueIssueError', () => {
  it('appends request reference id when present', () => {
    expect(formatQueueIssueError('Selected department is invalid for this facility', 'req_abc123')).toBe(
      'Selected department is invalid for your facility. Please reselect department. (Ref: req_abc123)',
    );
  });

  it('returns mapped message without reference id when absent', () => {
    expect(formatQueueIssueError('session expired')).toBe('Session expired. Please login again.');
  });
});
