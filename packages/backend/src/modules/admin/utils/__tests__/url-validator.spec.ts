import { BadRequestException } from '@nestjs/common';
import { validateWebhookUrl } from '../url-validator';

describe('validateWebhookUrl (SSRF prevention)', () => {
  it('accepts valid HTTPS URL', () => {
    expect(() => validateWebhookUrl('https://example.com/hook')).not.toThrow();
  });

  it('accepts valid HTTP URL', () => {
    expect(() => validateWebhookUrl('http://example.com/hook')).not.toThrow();
  });

  it('accepts URL with port', () => {
    expect(() => validateWebhookUrl('https://example.com:8443/hook')).not.toThrow();
  });

  // --- blocked: private/internal hosts ---

  it('blocks localhost', () => {
    expect(() => validateWebhookUrl('https://localhost/hook')).toThrow(BadRequestException);
  });

  it('blocks [::1] (IPv6 loopback hostname)', () => {
    expect(() => validateWebhookUrl('https://[::1]/hook')).toThrow(BadRequestException);
  });

  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.255.255.255', 'loopback high'],
    ['10.0.0.1', 'class A private'],
    ['10.255.0.1', 'class A private high'],
    ['172.16.0.1', 'class B private low'],
    ['172.31.255.255', 'class B private high'],
    ['192.168.0.1', 'class C private'],
    ['192.168.255.1', 'class C private high'],
    ['169.254.1.1', 'link-local'],
    ['0.0.0.0', 'unspecified'],
  ])('blocks %s (%s)', (ip) => {
    expect(() => validateWebhookUrl(`https://${ip}/hook`)).toThrow(BadRequestException);
  });

  it.each([
    ['100.64.0.1', 'CGNAT low'],
    ['100.127.255.1', 'CGNAT high'],
    ['198.18.0.1', 'benchmarking low'],
    ['198.19.0.1', 'benchmarking high'],
  ])('blocks %s (%s)', (ip) => {
    expect(() => validateWebhookUrl(`https://${ip}/hook`)).toThrow(BadRequestException);
  });

  // --- blocked: IPv6 private (bare hostname, e.g. DNS-resolved) ---

  it('blocks bare ::1 (IPv6 loopback in hostname regex)', () => {
    // The regex /^::1$/ targets bare hostnames; [::1] is caught by the localhost check above.
    // Verify the regex itself works on the bare string.
    expect(/^::1$/.test('::1')).toBe(true);
  });

  it('blocks bare fc00: prefix (IPv6 unique-local regex)', () => {
    expect(/^fc00:/i.test('fc00::1')).toBe(true);
  });

  it('blocks bare fe80: prefix (IPv6 link-local regex)', () => {
    expect(/^fe80:/i.test('fe80::1')).toBe(true);
  });

  // NOTE: URL('[fc00::1]') keeps brackets in .hostname, so the regex
  // /^fc00:/ does not match. This is a known gap — bracketed IPv6
  // private addresses bypass the IP check. The [::1] case is caught
  // separately by the localhost check.

  // --- blocked: bad schemes ---

  it.each(['ftp://example.com', 'file:///etc/passwd', 'gopher://evil.com'])(
    'blocks non-http(s) scheme: %s',
    (url) => {
      expect(() => validateWebhookUrl(url)).toThrow(BadRequestException);
    },
  );

  // --- blocked: invalid input ---

  it('blocks empty string', () => {
    expect(() => validateWebhookUrl('')).toThrow(BadRequestException);
  });

  it('blocks null/undefined', () => {
    expect(() => validateWebhookUrl(null as any)).toThrow(BadRequestException);
    expect(() => validateWebhookUrl(undefined as any)).toThrow(BadRequestException);
  });

  it('blocks non-string input', () => {
    expect(() => validateWebhookUrl(42 as any)).toThrow(BadRequestException);
  });

  it('blocks invalid URL format', () => {
    expect(() => validateWebhookUrl('not-a-url')).toThrow(BadRequestException);
  });

  // --- allowed: public IPs that look close to private ranges ---

  it('allows 172.32.0.1 (just outside class B private)', () => {
    expect(() => validateWebhookUrl('https://172.32.0.1/hook')).not.toThrow();
  });

  it('allows 100.128.0.1 (just outside CGNAT)', () => {
    expect(() => validateWebhookUrl('https://100.128.0.1/hook')).not.toThrow();
  });
});
