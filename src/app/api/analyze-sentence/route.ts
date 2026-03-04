import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface CharacterInfo {
  char: string;
  pinyin: string;
  meaning: string;
}

interface WordSegment {
  word: string;
  pinyin: string;
  meaning: string;
  startIndex: number;
  endIndex: number;
  chars: CharacterInfo[];
}

interface SentenceAnalysis {
  sentence: string;
  translation: string;
  segments: WordSegment[];
  characters: CharacterInfo[];
}

// Load CC-CEDICT dictionary
let cedictData: string[] = [];
try {
  const cedictPath = path.join(process.cwd(), 'public', 'data', 'cedict.txt');
  if (fs.existsSync(cedictPath)) {
    cedictData = fs.readFileSync(cedictPath, 'utf-8').split('\n').filter(line =>
      line.trim() && !line.startsWith('#')
    );
  }
} catch (error) {
  console.error('Failed to load CC-CEDICT dictionary:', error);
}

function parseCedictLine(line: string): { traditional: string; simplified: string; pinyin: string; meaning: string } | null {
  const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+?)\//);
  if (!match) return null;

  return {
    traditional: match[1],
    simplified: match[2],
    pinyin: match[3].trim(),
    meaning: match[4].split('/')[0].trim()
  };
}

function segmentSentence(sentence: string): WordSegment[] {
  const segments: WordSegment[] = [];
  let i = 0;

  // Helper function to get character info
  const getCharInfo = (char: string): CharacterInfo => {
    for (const line of cedictData) {
      const entry = parseCedictLine(line);
      if (!entry) continue;
      if (entry.simplified === char) {
        return {
          char,
          pinyin: entry.pinyin,
          meaning: entry.meaning,
        };
      }
    }
    return { char, pinyin: '', meaning: '' };
  };

  while (i < sentence.length) {
    let matched = false;

    // Try to match longer words first (up to 4 characters)
    for (let len = Math.min(4, sentence.length - i); len >= 1; len--) {
      const substring = sentence.substring(i, i + len);
      
      for (const line of cedictData) {
        const entry = parseCedictLine(line);
        if (!entry) continue;

        if (entry.simplified === substring) {
          segments.push({
            word: substring,
            pinyin: entry.pinyin,
            meaning: entry.meaning,
            startIndex: i,
            endIndex: i + len,
            chars: substring.split('').map(char => getCharInfo(char))
          });
          i += len;
          matched = true;
          break;
        }
      }

      if (matched) break;
    }

    // If no word match, treat single character
    if (!matched) {
      const char = sentence[i];
      const charInfo = getCharInfo(char);

      segments.push({
        word: char,
        pinyin: charInfo.pinyin,
        meaning: charInfo.meaning,
        startIndex: i,
        endIndex: i + 1,
        chars: [charInfo]
      });
      i++;
    }
  }

  return segments;
}

function generateTranslation(segments: WordSegment[]): string {
  // Simple translation by combining word meanings
  return segments.map(s => s.meaning).join('; ');
}

export async function POST(request: NextRequest) {
  try {
    const { sentence } = await request.json();

    if (!sentence || typeof sentence !== 'string') {
      return NextResponse.json({ error: 'Sentence is required' }, { status: 400 });
    }

    if (cedictData.length === 0) {
      return NextResponse.json({
        error: 'Dictionary not loaded',
        sentence: sentence,
        translation: 'Dictionary not available',
        segments: [],
        characters: []
      }, { status: 500 });
    }

    const segments = segmentSentence(sentence);
    const translation = generateTranslation(segments);

    // Get unique characters
    const charMap = new Map<string, CharacterInfo>();
    for (const segment of segments) {
      for (const char of segment.chars) {
        if (char.char && !charMap.has(char.char)) {
          charMap.set(char.char, char);
        }
      }
    }

    const analysis: SentenceAnalysis = {
      sentence,
      translation,
      segments,
      characters: Array.from(charMap.values())
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Sentence analysis failed:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
