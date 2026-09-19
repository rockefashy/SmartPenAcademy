/**
 * Centralized WhatsApp URL generator with standardized phone number formatting.
 */
export function buildWhatsAppUrl(phone?: string | null, message?: string | null): string {
  if (!phone) return '';
  const digitsOnly = String(phone).replace(/\D/g, '');
  if (!digitsOnly) return '';

  let normalizedNumber = digitsOnly;
  if (digitsOnly.length === 10) {
    normalizedNumber = `91${digitsOnly}`;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    normalizedNumber = digitsOnly;
  } else if (digitsOnly.length > 10 && !digitsOnly.startsWith('91')) {
    normalizedNumber = `91${digitsOnly.slice(-10)}`;
  }

  const encodedMessage = message ? encodeURIComponent(message) : '';
  return encodedMessage
    ? `https://wa.me/${normalizedNumber}?text=${encodedMessage}`
    : `https://wa.me/${normalizedNumber}`;
}
