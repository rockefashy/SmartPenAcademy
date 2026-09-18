import fs from 'fs';
import path from 'path';

/**
 * Persists a base64 data URI image to disk safely and returns its relative public URL.
 * If the input is already a relative URL or empty, returns it untouched.
 */
export function saveBase64Image(
  imageData: string | undefined | null,
  targetDir: string,
  fileNamePrefix: string
): string | undefined {
  if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
    return imageData || undefined;
  }

  try {
    const commaIdx = imageData.indexOf(',');
    if (commaIdx === -1) return imageData;

    const metaPart = imageData.substring(0, commaIdx);
    const base64Data = imageData.substring(commaIdx + 1).replace(/\s/g, '');
    const extMatch = metaPart.match(/data:image\/([a-zA-Z0-9+.-]+);/);
    let rawExt = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    if (rawExt === 'jpeg') rawExt = 'jpg';
    if (rawExt === 'svg+xml') rawExt = 'svg';

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = `${fileNamePrefix}_${Date.now()}.${rawExt}`;
    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const dirName = path.basename(targetDir);
    return `/${dirName}/${fileName}`;
  } catch (err) {
    console.error(`[FILE_HELPER] Failed to save base64 image to ${targetDir}:`, err);
    return imageData;
  }
}
