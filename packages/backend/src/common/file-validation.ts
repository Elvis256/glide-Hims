/**
 * Validate uploaded file content by checking magic bytes.
 * Prevents disguised executables from being uploaded as documents/images.
 */

interface MagicSignature {
  bytes: number[];
  offset?: number;
}

const MAGIC_BYTES: Record<string, MagicSignature[]> = {
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47] }],
  'application/msword': [{ bytes: [0xd0, 0xcf, 0x11, 0xe0] }], // OLE2 compound
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // ZIP (OOXML)
  ],
};

export function validateFileContent(buffer: Buffer, declaredMime: string): boolean {
  const signatures = MAGIC_BYTES[declaredMime];
  if (!signatures) return true; // Unknown type — rely on MIME filter only

  return signatures.some((sig) => {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) return false;
    return sig.bytes.every((b, i) => buffer[offset + i] === b);
  });
}
