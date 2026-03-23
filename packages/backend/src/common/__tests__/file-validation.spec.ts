import { validateFileContent } from '../file-validation';

describe('validateFileContent', () => {
  it('should accept valid PDF files', () => {
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(validateFileContent(pdfHeader, 'application/pdf')).toBe(true);
  });

  it('should reject non-PDF content declared as PDF', () => {
    const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ (PE executable)
    expect(validateFileContent(exeHeader, 'application/pdf')).toBe(false);
  });

  it('should accept valid JPEG files', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateFileContent(jpegHeader, 'image/jpeg')).toBe(true);
  });

  it('should reject non-JPEG content declared as JPEG', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(validateFileContent(pngHeader, 'image/jpeg')).toBe(false);
  });

  it('should accept valid PNG files', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateFileContent(pngHeader, 'image/png')).toBe(true);
  });

  it('should accept unknown MIME types (passthrough)', () => {
    const randomData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(validateFileContent(randomData, 'text/plain')).toBe(true);
  });

  it('should reject empty buffer for known MIME types', () => {
    const empty = Buffer.alloc(0);
    expect(validateFileContent(empty, 'application/pdf')).toBe(false);
  });

  it('should reject truncated header', () => {
    const truncated = Buffer.from([0x25, 0x50]); // Only first 2 bytes of PDF
    expect(validateFileContent(truncated, 'application/pdf')).toBe(false);
  });
});
