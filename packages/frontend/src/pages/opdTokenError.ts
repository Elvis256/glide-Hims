export function mapQueueIssueError(rawMessage: string): string {
  const message = (rawMessage || '').toLowerCase();

  if (message.includes('facility context is required')) {
    return 'No active facility selected. Please select a facility or re-login.';
  }
  if (message.includes('already in queue with token')) {
    return rawMessage;
  }
  if (message.includes('capacity') && message.includes('queue at')) {
    return rawMessage;
  }
  if (message.includes('selected department is invalid')) {
    return 'Selected department is invalid for your facility. Please reselect department.';
  }
  if (
    message.includes('department') &&
    message.includes('currently') &&
    message.includes('select an active department')
  ) {
    return rawMessage;
  }
  if (message.includes('selected doctor is not currently checked in')) {
    return 'Selected doctor is not checked in. Choose another doctor or select Any Available Doctor.';
  }
  if (message.includes('session expired')) {
    return 'Session expired. Please login again.';
  }

  return rawMessage || 'Failed to issue token. Please try again.';
}

export function formatQueueIssueError(rawMessage: string, requestId?: string): string {
  const mapped = mapQueueIssueError(rawMessage);
  return requestId ? `${mapped} (Ref: ${requestId})` : mapped;
}
