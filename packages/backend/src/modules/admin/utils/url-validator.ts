import { BadRequestException } from '@nestjs/common';
import { URL } from 'url';

/**
 * SSRF prevention: reject URLs pointing to private/internal networks.
 * Blocks private IPs (RFC 1918), loopback, link-local, and non-http(s) schemes.
 */
export function validateWebhookUrl(urlStr: string): void {
  if (!urlStr || typeof urlStr !== 'string') {
    throw new BadRequestException('Webhook URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new BadRequestException('Invalid URL format');
  }

  // Only allow http and https schemes
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (hostname === 'localhost' || hostname === '[::1]') {
    throw new BadRequestException('URLs pointing to localhost are not allowed');
  }

  // Block private/reserved IP ranges
  const ipPatterns = [
    /^127\./, // Loopback
    /^10\./, // Class A private
    /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
    /^192\.168\./, // Class C private
    /^169\.254\./, // Link-local
    /^0\.0\.0\.0$/, // Unspecified
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT
    /^198\.1[89]\./, // Benchmarking
    /^::1$/, // IPv6 loopback
    /^fc00:/i, // IPv6 unique local
    /^fe80:/i, // IPv6 link-local
  ];

  for (const pattern of ipPatterns) {
    if (pattern.test(hostname)) {
      throw new BadRequestException('URLs pointing to private/internal networks are not allowed');
    }
  }
}
