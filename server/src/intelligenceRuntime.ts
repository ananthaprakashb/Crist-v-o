import {
  analyzeI797File,
  analyzeSyntheticI797,
  structureIntake as baseStructureIntake,
  type StructuredIntakeResult,
} from './intelligence.js';

export { analyzeI797File, analyzeSyntheticI797 };

const HUMAN_DATE = String.raw`(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2}|20\d{2}-\d{2}-\d{2})`;

const MONTHS: Record<string, string> = {
  jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03', apr: '04', april: '04',
  may: '05', jun: '06', june: '06', jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09',
  oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
};

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  const iso = trimmed.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const numeric = trimmed.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (numeric) return `${numeric[3]}-${numeric[1].padStart(2, '0')}-${numeric[2].padStart(2, '0')}`;
  const words = trimmed.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (!words) return trimmed;
  const month = MONTHS[words[1].toLowerCase()];
  return month ? `${words[3]}-${month}-${words[2].padStart(2, '0')}` : trimmed;
}

function extractDate(input: string, prefix: string) {
  const match = input.match(new RegExp(`${prefix}[\\s:]*(${HUMAN_DATE})`, 'i'));
  return normalizeDate(match?.[1]);
}

export async function structureIntake(input: string): Promise<StructuredIntakeResult> {
  const result = await baseStructureIntake(input);
  if (result.method !== 'deterministic-fallback') return result;

  const petitionValidTo = extractDate(
    input,
    String.raw`(?:latest\s+)?(?:approval|petition)[^.;\n]{0,45}?(?:valid\s+through|expires?|expiration(?:\s+date)?\s*(?:is|:)?)`,
  );
  const i94Expiration = extractDate(
    input,
    String.raw`i-?94[^.;\n]{0,35}?(?:expires?|expiration(?:\s+date)?\s*(?:is|:)?)`,
  );

  const missing = result.missingCriticalFacts.filter((item) => {
    if (petitionValidTo && item === 'Latest petition / approval validity date') return false;
    if (i94Expiration && item === 'Current I-94 expiration date') return false;
    return true;
  });

  return {
    ...result,
    petitionValidTo: petitionValidTo ?? result.petitionValidTo,
    i94Expiration: i94Expiration ?? result.i94Expiration,
    missingCriticalFacts: missing,
  };
}
