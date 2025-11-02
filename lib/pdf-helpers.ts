import { logger } from './logger';

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
    logger.error('PDF text extraction failed', { error, bufferSize: buffer.length });
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
    logger.error('PDF metadata extraction failed', { error, bufferSize: buffer.length });
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
  const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  return buffer.slice(0, 5).equals(pdfSignature);
}

/**
 * Clean extracted text by removing excessive whitespace and formatting
 * @param text - Raw extracted text
 * @returns Cleaned text
 */
export function cleanExtractedText(text: string): string {
  return text
    .normalize('NFKD') // Normalize Unicode to decomposed form
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^\x00-\x7F]/g, (char) => {
      // Replace common special characters
      const replacements: Record<string, string> = {
        ǥ: 'o',
        ö: 'o',
        ä: 'a',
        ü: 'u',
        Ö: 'O',
        Ä: 'A',
        Ü: 'U',
        '€': 'EUR',
        '©': '(c)',
        '®': '(R)',
        '™': '(TM)',
      };
      return replacements[char] || char;
    })
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .replace(/[ \t]{2,}/g, ' ') // Remove excessive spaces
    .trim();
}

/**
 * Convert PDF to JPG using CloudConvert API
 * @param buffer - PDF file as a Buffer
 * @returns JPG image buffer
 */
export async function convertPdfToJpgViaCloudConvert(buffer: Buffer): Promise<Buffer> {
  try {
    // CloudConvert v3 uses default export
    const CloudConvert = require('cloudconvert').default;

    const apiKey = process.env.CLOUDCONVERT_API_KEY;
    if (!apiKey) {
      throw new Error('CLOUDCONVERT_API_KEY environment variable is not set');
    }

    const cloudConvert = new CloudConvert(apiKey);

    // Create a job to convert PDF to JPG
    const job = await cloudConvert.jobs.create({
      tasks: {
        'import-pdf': {
          operation: 'import/upload',
        },
        'convert-to-jpg': {
          operation: 'convert',
          input: 'import-pdf',
          output_format: 'jpg',
          some_other_option: 'value',
        },
        'export-jpg': {
          operation: 'export/url',
          input: 'convert-to-jpg',
        },
      },
    });

    // Upload the PDF
    const uploadTask = job.tasks.filter((task: any) => task.name === 'import-pdf')[0];
    await cloudConvert.tasks.upload(uploadTask, buffer, 'label.pdf');

    // Wait for job completion
    const completedJob = await cloudConvert.jobs.wait(job.id);

    // Download the converted JPG
    const exportTask = completedJob.tasks.filter((task: any) => task.name === 'export-jpg')[0];
    const file = exportTask.result.files[0];

    // CloudConvert v3 API: use axios to download the file URL
    const axios = require('axios');
    const response = await axios.get(file.url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    logger.error('CloudConvert PDF conversion failed', { error, bufferSize: buffer.length });
    throw new Error('Failed to convert PDF to image using CloudConvert.');
  }
}

/**
 * Hybrid PDF processing: Try text extraction first, fallback to CloudConvert if insufficient text
 * @param buffer - PDF file as a Buffer
 * @param minTextLength - Minimum text length to consider extraction successful (default: 100)
 * @returns Object with either extracted text or image buffer, plus metadata
 */
export async function processPdfForAnalysis(
  buffer: Buffer,
  minTextLength: number = 100
): Promise<{
  type: 'text' | 'image';
  content: string | Buffer;
  method: 'text_extraction' | 'cloudconvert';
}> {
  try {
    // Step 1: Try text extraction first (free, fast)
    logger.debug('Attempting PDF text extraction', { bufferSize: buffer.length, minTextLength });
    const rawText = await extractTextFromPDF(buffer);
    const cleanedText = cleanExtractedText(rawText);

    if (cleanedText.length >= minTextLength) {
      logger.info('PDF text extraction successful', {
        textLength: cleanedText.length,
        method: 'text_extraction',
      });
      return {
        type: 'text',
        content: cleanedText,
        method: 'text_extraction',
      };
    }

    // Step 2: Insufficient text, use CloudConvert (paid, visual analysis)
    logger.warn('Insufficient text extracted from PDF, converting to image', {
      extractedTextLength: cleanedText.length,
      minTextLength,
      method: 'cloudconvert',
    });
    const imageBuffer = await convertPdfToJpgViaCloudConvert(buffer);
    logger.info('PDF converted to JPG via CloudConvert', { imageSize: imageBuffer.length });

    return {
      type: 'image',
      content: imageBuffer,
      method: 'cloudconvert',
    };
  } catch (error) {
    logger.error('PDF processing failed', { error });
    throw new Error('Failed to process PDF for analysis.');
  }
}
