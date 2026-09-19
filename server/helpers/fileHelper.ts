import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ValidationError } from '../errors.ts';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp'
};

/**
 * Validates magic-byte signature headers for image buffers.
 */
function validateMagicBytes(buffer: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buffer.length < 12) return null;

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  // WebP signature: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Persists a base64 data URI image to disk safely and returns its relative public URL.
 * Validates strict MIME allowlist (PNG, JPEG, WebP only), checks magic bytes,
 * enforces a 5MB size limit, generates unguessable random UUID filenames,
 * and performs non-blocking async file writes.
 */
export async function saveBase64Image(
  imageData: string | undefined | null,
  targetDir: string,
  fileNamePrefix: string = 'img'
): Promise<string | undefined> {
  if (!imageData || typeof imageData !== 'string') {
    return undefined;
  }

  // If already a relative path, validate and return
  if (!imageData.startsWith('data:image/')) {
    return imageData;
  }

  const commaIdx = imageData.indexOf(',');
  if (commaIdx === -1) {
    throw new ValidationError('Invalid image data URL format.');
  }

  const metaPart = imageData.substring(0, commaIdx).toLowerCase();
  const mimeMatch = metaPart.match(/^data:(image\/[a-z0-9+.-]+);base64$/i);
  if (!mimeMatch) {
    throw new ValidationError('Invalid or unsupported image encoding. Only base64 is supported.');
  }

  const mimeType = mimeMatch[1].toLowerCase();

  // Strict MIME type allowlist: Forbid SVG, HTML, and executable formats entirely
  if (!ALLOWED_MIME_TYPES[mimeType]) {
    throw new ValidationError(
      `Unsupported image type '${mimeType}'. Only PNG, JPEG, and WebP images are permitted.`
    );
  }

  const base64Data = imageData.substring(commaIdx + 1).replace(/\s/g, '');
  const buffer = Buffer.from(base64Data, 'base64');

  // Payload size cap: 5MB
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ValidationError(
      `Image size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB.`
    );
  }

  // Magic-byte signature verification
  const detectedExt = validateMagicBytes(buffer);
  if (!detectedExt) {
    throw new ValidationError('Image payload failed magic-byte validation. Corrupted or forged image file.');
  }

  // Ensure target directory exists asynchronously
  await fs.promises.mkdir(targetDir, { recursive: true });

  // Cryptographically random unguessable filename
  const randomSuffix = crypto.randomUUID();
  const fileName = `${fileNamePrefix}_${randomSuffix}.${detectedExt}`;
  const filePath = path.join(targetDir, fileName);

  // Non-blocking async file write
  await fs.promises.writeFile(filePath, buffer);

  const dirName = path.basename(targetDir);
  return `/${dirName}/${fileName}`;
}
