import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

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

export async function POST(request: NextRequest) {
  try {
    const { query, type = 'auto' } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    let zai;
    try {
      zai = await ZAI.create();
    } catch (error) {
      console.error('ZAI initialization failed:', error);
      // Fallback: return basic character breakdown without meanings
      const chars = query.match(/[\u4e00-\u9fff]/g) || [];
      const result = {
        characters: chars.map(char => ({
          char,
          pinyin: '',
          meaning: 'API not configured - please set up ZAI config',
        })),
        words: [],
        sentences: [],
      };
      return NextResponse.json(result);
    }

    // Search the web for Chinese character/word meanings
    const searchQuery = type === 'sentence' 
      ? `Chinese sentence meaning pinyin: "${query}"` 
      : `Chinese character word meaning pinyin breakdown: "${query}"`;

    const searchResult = await zai.functions.invoke('web_search', {
      query: searchQuery,
      num: 10,
    });

    // Extract information from search results
    const searchContext = Array.isArray(searchResult) 
      ? searchResult.map((r: { snippet?: string; name?: string }) => r.snippet || r.name || '').join('\n')
      : '';

    // Use LLM to parse and structure the information
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a Chinese language expert. Parse the provided search results and extract structured information about Chinese characters, words, and sentences.

Return a JSON object with this structure:
{
  "characters": [{"char": "字", "pinyin": "zì4", "meaning": "character/word"}],
  "words": [{"word": "中国", "pinyin": "zhong1 guo2", "meaning": "China", "chars": [...]}],
  "sentences": [{
    "chinese": "你好吗？",
    "pinyin": "nǐ hǎo ma",
    "translation": "How are you?",
    "breakdown": [{"chars": [...], "combinedMeaning": "...", "isWord": true/false}]
  }]
}

For tone marks: use numbers 1-4 after the syllable (ma1, ma2, ma3, ma4).
For breakdown: group characters that form words together, mark isWord=true for multi-character words.

Only include information found in or reasonably inferred from the search results. If something is not found, return empty arrays.`,
        },
        {
          role: 'user',
          content: `Search results for "${query}":\n\n${searchContext}\n\nExtract the Chinese language information and return as JSON.`,
        },
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Parse the JSON from the response
    let result: SearchResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // Fallback: create basic result from the query
      result = {
        characters: [],
        words: [],
        sentences: [],
      };

      // Try to extract basic info
      const chars = query.match(/[\u4e00-\u9fff]/g) || [];
      for (const char of [...new Set(chars)]) {
        result.characters.push({
          char,
          pinyin: '',
          meaning: 'Meaning not found - please search again',
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Search characters error:', error);
    return NextResponse.json(
      { error: 'Failed to search characters', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'auto';

  if (!query) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
  }

  // Reuse POST logic
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ query, type }),
      headers: { 'Content-Type': 'application/json' },
    })
  );
}
