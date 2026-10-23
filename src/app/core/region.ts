/** Best guess at the viewer's country without a permission prompt: time zone first, then locale. */
const ZONES: Record<string, string> = {
  'Asia/Manila': 'PH',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Jakarta': 'ID',
  'Asia/Bangkok': 'TH',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Taipei': 'TW',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA',
  'Asia/Kolkata': 'IN',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ',
  'Europe/London': 'GB',
  'Europe/Dublin': 'IE',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR',
};

export function detectRegion(
  zone = safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  locales: readonly string[] = safe(() => navigator.languages) ?? [],
): string {
  if (zone && ZONES[zone]) return ZONES[zone];
  if (zone?.startsWith('America/') && !locales.some((l) => /-(CA|MX|BR|AR|CL|CO|PE)$/i.test(l)))
    return 'US';
  for (const l of locales) {
    const m = /-([A-Z]{2})$/i.exec(l);
    if (m) return m[1].toUpperCase();
  }
  return 'PH';
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
