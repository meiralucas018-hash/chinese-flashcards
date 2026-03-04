import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface CharacterInfo {
  char: string;
  pinyin: string;
  meaning: string;
}

interface WordInfo {
  word: string;
  pinyin: string;
  meaning: string;
  chars: CharacterInfo[];
}

interface SearchResult {
  characters: CharacterInfo[];
  words: WordInfo[];
  sentences: {
    chinese: string;
    pinyin: string;
    translation: string;
    breakdown: {
      chars: CharacterInfo[];
      combinedMeaning: string;
      isWord: boolean;
    }[];
  }[];
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
  // Format: Traditional Simplified [pin1 yin1] /meaning/
  const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+?)\//);
  if (!match) return null;

  return {
    traditional: match[1],
    simplified: match[2],
    pinyin: match[3].trim(),
    meaning: match[4].split('/')[0].trim() // Take only first meaning
  };
}

function searchCedict(query: string): { characters: CharacterInfo[]; words: WordInfo[] } {
  const characters: CharacterInfo[] = [];
  const words: WordInfo[] = [];
  const foundChars = new Set<string>();

  // Extract Chinese characters from query
  const chineseChars = query.match(/[\u4e00-\u9fff]/g) || [];

  console.log('Searching for:', query, 'Characters:', chineseChars, 'cedictData length:', cedictData.length);

  // Search for exact matches in the dictionary
  for (const line of cedictData) {
    const entry = parseCedictLine(line);
    if (!entry) continue;

    // Check for word matches (both traditional and simplified)
    if ((entry.simplified === query || entry.traditional === query) && query.length > 1) {
      console.log('Found word match:', entry);
      words.push({
        word: entry.simplified,
        pinyin: entry.pinyin,
        meaning: entry.meaning,
        chars: entry.simplified.split('').map(char => ({ char, pinyin: '', meaning: '' }))
      });
      break; // Found the main word, stop searching
    }

    // Check for individual character matches
    for (const char of chineseChars) {
      if ((entry.simplified === char || entry.traditional === char) && !foundChars.has(char)) {
        characters.push({
          char: char,
          pinyin: entry.pinyin,
          meaning: entry.meaning
        });
        foundChars.add(char);
        console.log('Found character:', char, entry);
        break;
      }
    }
  }

  return { characters, words };
}

export async function POST(request: NextRequest) {
  try {
    const { query, type = 'auto' } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (cedictData.length === 0) {
      return NextResponse.json({
        error: 'Dictionary not loaded',
        characters: query.match(/[\u4e00-\u9fff]/g)?.map(char => ({
          char,
          pinyin: '',
          meaning: 'Dictionary not available'
        })) || [],
        words: [],
        sentences: []
      }, { status: 500 });
    }

    const result = searchCedict(query);

    return NextResponse.json({
      characters: result.characters,
      words: result.words,
      sentences: []
    });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
