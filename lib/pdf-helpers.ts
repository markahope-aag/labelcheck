/**
 * Extract text content from a PDF buffer
 * @param buffer - PDF file as a Buffer
 * @returns Extracted text content
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdf = require('pdf-parse-fork');
    const data = await pdf(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF. Please ensure the file is a valid PDF.');
  }
}

/**
 * Extract metadata from a PDF buffer
 * @param buffer - PDF file as a Buffer
 * @returns PDF metadata including page count, title, etc.
 */
export async function extractPDFMetadata(buffer: Buffer): Promise<{
  pages: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
}> {
  try {
    const pdf = require('pdf-parse-fork');
    const data = await pdf(buffer);
    return {
      pages: data.numpages,
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      creator: data.info?.Creator,
    };
  } catch (error) {
    console.error('Error extracting PDF metadata:', error);
    throw new Error('Failed to extract PDF metadata.');
  }
}

/**
 * Validate if a buffer is a valid PDF
 * @param buffer - File buffer to validate
 * @returns true if valid PDF, false otherwise
 */
export function isValidPDF(buffer: Buffer): boolean {
  // PDF files start with %PDF-
  const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D]); // %PDF-
  return buffer.slice(0, 5).equals(pdfSignature);
}

/**
 * Clean extracted text by removing excessive whitespace and formatting
 * @param text - Raw extracted text
 * @returns Cleaned text
 */
export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .replace(/[ \t]{2,}/g, ' ') // Remove excessive spaces
    .trim();
}
