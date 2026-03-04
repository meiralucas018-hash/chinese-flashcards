// Pinyin Tone Conversion Library
// Converts pinyin with tone numbers to pinyin with tone marks
// Example: ni3 hao3 → nǐ hǎo

const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à', 'a'],
  e: ['ē', 'é', 'ě', 'è', 'e'],
  i: ['ī', 'í', 'ǐ', 'ì', 'i'],
  o: ['ō', 'ó', 'ǒ', 'ò', 'o'],
  u: ['ū', 'ú', 'ǔ', 'ù', 'u'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
  v: ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
  A: ['Ā', 'Á', 'Ǎ', 'À', 'A'],
  E: ['Ē', 'É', 'Ě', 'È', 'E'],
  I: ['Ī', 'Í', 'Ǐ', 'Ì', 'I'],
  O: ['Ō', 'Ó', 'Ǒ', 'Ò', 'O'],
  U: ['Ū', 'Ú', 'Ǔ', 'Ù', 'U'],
  Ü: ['Ǖ', 'Ǘ', 'Ǚ', 'Ǜ', 'Ü'],
  V: ['Ǖ', 'Ǘ', 'Ǚ', 'Ǜ', 'Ü'],
};

// Order of priority for placing tone marks
const TONE_PRIORITY = ['a', 'o', 'e', 'i', 'u', 'ü', 'v', 'A', 'O', 'E', 'I', 'U', 'Ü', 'V'];

/**
 * Convert a single pinyin syllable with tone number to tone mark
 */
export function convertTone(syllable: string): string {
  // Handle empty or neutral tone
  if (!syllable || syllable.endsWith('5') || syllable.endsWith('0')) {
    return syllable.replace(/[0-5]$/, '').replace(/v/g, 'ü').replace(/V/g, 'Ü');
  }

  // Extract tone number (1-4)
  const match = syllable.match(/([a-zA-ZüÜ]+)([1-4])$/);
  if (!match) {
    return syllable.replace(/v/g, 'ü').replace(/V/g, 'Ü');
  }

  const [, base, toneStr] = match;
  const tone = parseInt(toneStr, 10) - 1; // Convert to 0-indexed

  // Handle ü/v specially
  let normalized = base.replace(/v/g, 'ü').replace(/V/g, 'Ü');

  // Find the vowel to place the tone mark on
  for (const vowel of TONE_PRIORITY) {
    const index = normalized.indexOf(vowel);
    if (index !== -1) {
      const toneMarks = TONE_MARKS[vowel];
      if (toneMarks) {
        normalized = normalized.slice(0, index) + toneMarks[tone] + normalized.slice(index + 1);
        break;
      }
    }
  }

  return normalized;
}

/**
 * Convert a full pinyin string with tone numbers to tone marks
 * Example: "ni3 hao3 ma5" → "nǐ hǎo ma"
 */
export function convertPinyinTones(pinyin: string): string {
  if (!pinyin) return '';

  // Split by spaces or apostrophes
  const syllables = pinyin.split(/\s+/);

  return syllables
    .map((syl) => {
      // Handle syllables with apostrophes like "xi'an"
      if (syl.includes("'")) {
        return syl
          .split("'")
          .map((part) => convertTone(part))
          .join("'");
      }
      return convertTone(syl);
    })
    .join(' ');
}

/**
 * Get tone color class based on tone number
 * Tone 1: Blue, Tone 2: Green, Tone 3: Yellow, Tone 4: Red, Neutral: Gray
 */
export function getToneColor(tone: number | string): string {
  const toneNum = typeof tone === 'string' ? parseInt(tone, 10) : tone;

  switch (toneNum) {
    case 1:
      return 'text-blue-400';
    case 2:
      return 'text-green-400';
    case 3:
      return 'text-yellow-400';
    case 4:
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Extract tone number from pinyin syllable
 */
export function extractTone(syllable: string): number {
  const match = syllable.match(/([a-zA-ZüÜ]+)([1-5])$/);
  if (!match) return 5; // Neutral tone
  return parseInt(match[2], 10);
}

/**
 * Get the CSS color variable for a tone
 */
export function getToneColorVar(tone: number | string): string {
  const toneNum = typeof tone === 'string' ? parseInt(tone, 10) : tone;

  switch (toneNum) {
    case 1:
      return 'var(--tone-1, #60a5fa)'; // Blue
    case 2:
      return 'var(--tone-2, #4ade80)'; // Green
    case 3:
      return 'var(--tone-3, #facc15)'; // Yellow
    case 4:
      return 'var(--tone-4, #f87171)'; // Red
    default:
      return 'var(--tone-5, #94a3b8)'; // Gray
  }
}
