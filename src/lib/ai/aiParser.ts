import type {
  AutoRepairResult,
  ExampleSentence,
  GrammarItem,
  PairItem,
  PracticeQuestion,
  PracticeQuestionAspect,
  PracticeTask,
  ParsedWordResponse,
  TokenItem,
  ValidationError,
  ValidationResult,
  WordEntry,
} from "./types";

const PROMPT_TEMPLATE = `You are generating parser input for a Chinese learning application.

Your output will be pasted directly into a deterministic parser.
Any deviation from the required format may break the parser.

Follow these rules exactly.

FORMAT PRIORITY RULE

If any instruction seems to conflict with another, prioritize exact output format, section presence, field order, row field counts, and parser safety over pedagogical richness.

GLOBAL RULES
2. Output ONLY the response block.
3. Do NOT write any text before [BEGIN_RESPONSE].
4. Do NOT write any text after [END_RESPONSE].
5. Do NOT use markdown.
6. Do NOT use code fences.
7. Preserve all section names exactly.
8. Preserve all field names exactly.
9. Use plain text only.
10. Use pipe-separated fields for indexed rows.
11. Do NOT omit any required section.
12. Do NOT invent extra sections.
13. Do NOT change field order.
14. Do NOT output sentence difficulty, grammar difficulty, vocabulary difficulty, or any similar metadata beyond the required hsk_level field.

TARGET WORD RULES
15. The target entry is a Chinese WORD, not a full sentence.
16. The flashcard front contains only the target word.
17. The back of the flashcard must teach the target word through one calm main example sentence.
17a. Pair 1 is only the key phrase or usage frame extracted from that main sentence, not a second sentence-like teaching surface.
17b. Do NOT treat Pair 1 as a separate mini example, pop-up sentence, slogan, or headline that competes with the main sentence.
18. The word meaning must be AI-generated, learner-friendly, and more insightful than a short dictionary gloss.
18a. Do NOT begin meaning by repeating the target word, writing forms such as <word> means..., or restating the headword inside the gloss.
19. The meaning must be exactly one sentence.
19a. Write the meaning as one compact English gloss that combines the direct translation with the main usage boundary, so the learner understands not just what the word can mean, but what kind of thing it is used for.
19b. Prefer a compact gloss that includes both the core translation and the usage boundary in the same line.
19c. Target style examples:
认识 = know a person, be familiar with someone/something, recognize who someone or something is
知道 = know a fact, know information, know that something is the case
会 = know how to, be able to from learned skill
能 = be able to, can because it is possible, allowed, or within one’s ability
认出 = recognize someone or something in that moment, identify successfully
19d. Discourage vague one-word glosses when the word is more specific; use one-word glosses only when the word is genuinely broad and no clearer boundary is needed.
20. usage_note must be one short learner-friendly sentence.
20a. Do NOT begin usage_note by repeating the target word or turning it into a heading-like sentence.
21. paired_words_note must be one short simple sentence explaining what paired words means for the student.
22. Use tone-mark pinyin, not numbered pinyin.
23. For the main word header, word-level pinyin must be written as one continuous word with no spaces between syllables.
24. For token rows and sentence pinyin, normal word spacing is allowed.
25. hsk_level must be included in [BEGIN_WORD] using exactly one of these labels: HSK 1, HSK 2, HSK 3, HSK 4, HSK 5, HSK 6, HSK 7, HSK 8, HSK 9, or Not in HSK.
26. Do NOT include a character breakdown section.

INSTRUCTIONAL TYPE DECISION LAYER
27. Before generating [BEGIN_PAIRS] and [BEGIN_EXAMPLES], first classify the target word into one of these instructional types:
a) grammar-sensitive word
b) lexically simple word
28. A grammar-sensitive word is one whose main learner value depends strongly on how it behaves in sentences, such as object restrictions, recipient marking, aspect compatibility, modal compatibility, negation behavior, softened forms, question behavior, separable behavior, fixed usage frames, or other major sentence-level patterns tied to the word itself.
29. A lexically simple word is one whose main learner value depends mostly on meaning, common collocations, and realistic contexts, not on several distinct sentence-behavior patterns.
30. After classifying the word, choose the pair-selection and example-selection strategy that fits that type.
31. Maximize instructional coverage, not superficial variety.
32. Do not stop at only 3-4 obvious patterns if the word has additional major learner-useful patterns that are common, natural, and distinct.
33. If the pair limit prevents full exhaustiveness, choose patterns by this priority order: core sentence pattern, core object types, recipient patterns, 给 pattern, aspect usage, softened usage such as 一下, modal or negation usage, then other common frames.
33a. Pair 1 must be the most natural phrase or usage frame embedded inside the main sentence for first teaching the target word.
33b. Pair 1 should support the learner's understanding of the main sentence without first comparing several competing sentence structures.

PAIRS RULES
34. "Pairs" means common collocations or common usage frames built directly with the target word.
35. A pair may be either:
a) a collocation such as verb + object
b) a common usage frame such as 跟+人+verb or verb+给+人
36. Include all major common and pedagogically useful collocations and usage frames for modern learner Mandarin that can realistically fit within the allowed pair limit.
37. Prefer broad, realistic, and as-complete-as-possible coverage of the word’s real usage, not artificial variation.
38. Include enough pairs to teach the word well, but include no fewer than 2 and no more than 8 pair rows.
39. If the word genuinely has fewer than 2 strong common pairs or frames, include only the truly valid ones.
40. Do NOT include duplicate pairs or near-duplicate pairs.
41. Do NOT include pairs that are rare, literary, archaic, overly poetic, or unnatural.
42. Pair rows must use exactly 4 fields: index|text|composition|meaning
43. composition must clearly show how the pair or frame is built using + between parts.
43a. pair text should be a concise canonical chunk built directly with the target word, not a full clause or a decorated phrase.
43aa. pair text is support material for the main sentence, not an additional sentence.
43ab. Do NOT write pair text like a standalone teaching line, mini example, or sentence substitute.
43b. Do NOT pad pair text with time words, location words, adverbs, pronouns, classifiers, or extra modifiers unless they are central to the usage pattern being taught.
43c. If the pair mainly teaches a grammar frame, pair text should show the reusable frame in a concise canonical form.
43d. If the pair mainly teaches a collocation, pair text should show a natural high-frequency collocation with a representative noun or complement.
43e. Each pair must earn its slot by teaching a distinct reusable collocation or usage frame.
43f. If several candidate pairs teach the same frame with interchangeable nouns, keep the broadest or highest-frequency representative unless another noun teaches a genuinely different object class.

PAIR SELECTION STRATEGY
44. For grammar-sensitive words, prioritize pairs that cover the word’s major learner-useful usage behaviors.
45. For grammar-sensitive words, use pair rows for either collocations or usage frames, whichever better captures the word’s real behavior.
46. For grammar-sensitive words, prioritize distinct behaviors such as:
a) core object pattern
b) object range or common object types
c) recipient patterns
d) 给 patterns
e) 把 constructions, if truly natural for this word
f) aspect-marked usage
g) softened usage such as 一下
h) modal compatibility
i) negation compatibility
j) question use
k) other fixed or common frames tied to the word
47. For grammar-sensitive words, include only the patterns that are natural and instructionally useful for that specific word.
48. For grammar-sensitive words, do not force every category if the word does not genuinely support it.
49. For grammar-sensitive words, do not spend multiple pair slots on near-duplicate collocations if important behavior coverage is still missing.
50. For grammar-sensitive words, behavior coverage is more important than semantic variety alone.
51. If the target word is lexically simple, do not force grammar-slot diversity.
52. For lexically simple words, prioritize the most common and useful collocations, realistic learner-useful contexts, and core semantic range.
53. For lexically simple words, do not artificially create negation, question, aspect, modal, polite, recipient, or disposal patterns unless they teach something genuinely important about the target word itself.
54. For lexically simple words, common collocations and natural contexts are more important than forced grammar variation.
54a. Distinguish two pair types before selecting rows:
a) lexical or collocation pair
b) grammar or structure pair
54b. For a lexical or collocation pair, choose a natural high-frequency chunk that teaches what kinds of nouns or complements commonly occur with the target word.
54c. For a grammar or structure pair, choose a reusable frame that teaches word order, marker placement, aspect compatibility, softening, negation, or recipient behavior.
54d. For lexically simple words, most pair rows should be collocations, not manufactured grammar frames.
54e. For grammar-sensitive words, use frame-style pairs when the learner’s main difficulty is structural behavior rather than vocabulary meaning alone.
54f. Do NOT spend multiple pair rows on several content nouns that only show the same underlying frame unless those nouns represent genuinely different common object classes.
54g. Before keeping a pair, ask: does this row teach a distinct, high-frequency, reusable behavior of the target word? If not, exclude it.

ANTI-REDUNDANCY RULE
55. If two candidate pairs mainly teach the same usage behavior of the target word, keep only the stronger, broader, or more frequent one.
56. Only keep multiple similar pairs if they teach clearly different usage behavior.
57. Semantic variation alone is not enough reason to keep multiple near-duplicate pairs.
58. If the target word has several distinct major learner-useful usage behaviors, prioritize behavior coverage before adding extra collocations.
59. If the target word does not have several distinct usage behaviors, prioritize the most common collocations and natural contexts instead.
60. For verbs, the selected pair rows should collectively cover the word’s major learner-useful behavior set whenever natural, including core object pattern, recipient marking, 给 pattern if natural, 把 construction if natural, aspect-marked usage if natural, softened usage such as 一下 if natural, common modal or negation frames if natural, and the main noun or object types that commonly occur with the verb.
60a. Even for grammar-sensitive words, the first pair must still be the calmest and most self-contained default teaching phrase.

EXAMPLE RULES
61. The number of examples must exactly match the number of paired words listed in [BEGIN_PAIRS].
62. Each example must correspond to one paired word from [BEGIN_PAIRS], in the same order.
62a. [EXAMPLE_1] is the default learning sentence shown first on the card.
62b. [EXAMPLE_1] must be the single main sentence shown on the card and must teach the target word through Pair 1 in a low-grammar-load way.
62c. [EXAMPLE_1] should feel self-contained and easy to understand without comparing alternative sentence patterns.
62d. Do NOT make [EXAMPLE_1] depend on receiver-order contrasts, 给 contrasts, 把 contrasts, or other explicit structural comparisons unless that structure is the only truly natural basic use of the word.
63. Every example sentence must naturally contain the target word exactly as written.
64. Every example sentence must naturally contain the paired word assigned to that example exactly as written.
65. The paired word in each example must appear as one continuous intact string in the sentence.
66. Do NOT split the paired word by inserting particles, aspect markers, modifiers, classifiers, or any other words inside it.
67. Example sentences must be natural, common, learner-friendly Mandarin.
68. Avoid rare, literary, archaic, overly poetic, or unnatural examples.
69. Keep translations natural and concise.
70. The example set must function like a mini usage lesson for the target word, not a collection of random sentences.
70a. Generate example sentences to demonstrate the target word’s own usage patterns, not to showcase unrelated grammar.
70b. After the learner understands [EXAMPLE_1], the remaining examples may expand into related patterns.
70c. When feasible, keep later examples semantically close enough to the core use that the learner can compare sentence structure without relearning the word from scratch.
71. Across the examples, cover all major learner-useful usage behaviors that belong to the target word itself, as far as they can be naturally represented within the allowed number of pair rows.
72. Prefer each example to highlight a different useful usage pattern when that is natural.
73. If the target word has a common rule about who receives the action, what kinds of objects it takes, whether it is transitive or intransitive, how aspect markers attach to it, whether reduplication is natural, whether 一下 is common, whether serial action frames are common, or what negation or modality frames it commonly appears in, use the examples to teach those rules whenever natural.
74. Every example must earn its place by teaching something specific about how the target word behaves.
75. Do not include a sentence whose main lesson is unrelated surrounding grammar.
76. Question, negation, aspect, modal, polite, recipient, and disposal patterns should appear only when they reveal something useful about the target word’s own usage.
77. Do not include a pattern just to create surface diversity.
78. For grammar-sensitive words, the example set should function like a compact usage map of the word.
79. For lexically simple words, the example set should function like a compact meaning-and-collocation map of the word.
80. Do NOT include an example whose main lesson is a general construction such as 把, topic-comment, time phrase, location phrase, or sentence-final particles unless that construction directly changes or constrains how the target word itself is used.
81. Prefer examples that reveal the target word’s valency, object range, recipient behavior, aspect compatibility, softening compatibility, modal compatibility, negation compatibility, and common collocations.
82. If not all major learner-useful patterns can fit within the pair limit, prioritize the highest-frequency and most instructionally valuable ones, and avoid spending example slots on minor or redundant patterns.
83. Do NOT force unnatural diversity if the word does not support it.
83a. In each [EXAMPLE_N] block, write pair_text=, sentence=, pinyin=, and translation= on four separate lines in that exact order.
83b. Do NOT merge example metadata fields onto one line.
83c. Do NOT use pipe separators inside example metadata lines.

TOKENS RULES
84. Do NOT skip [BEGIN_TOKENS] / [END_TOKENS].
85. Do NOT write NONE inside [BEGIN_TOKENS].
86. Every example sentence must have token rows.
87. Token rows must use exactly 4 fields: index|text|pinyin|meaning
88. Tokenization must use natural word segmentation.
89. In [BEGIN_TOKENS], include the paired word as one single token exactly as it appears in the sentence.
90. Do NOT split the paired word into separate tokens if it appears as a listed pair_text.
91. Do NOT include punctuation as a token unless it is part of a real lexical item.
92. Token meanings should be short contextual glosses suitable for helping a learner understand the sentence.

GRAMMAR RULES
93. Do NOT skip [BEGIN_GRAMMAR] / [END_GRAMMAR].
94. Grammar rows must use exactly 7 fields: index|text_span|grammar_name|why_to_use|structure|function|explanation
95. If a section has no valid grammar rows, write NONE inside [BEGIN_GRAMMAR].
96. Only include grammar points that directly define, constrain, or illustrate how the target word itself is naturally used.
97. A grammar point is valid only if it teaches a usage property of the target word, such as:
a) whether it is transitive or intransitive
b) what object types it naturally takes
c) whether and how it can take a recipient
d) whether it naturally combines with 给, 跟, 和, etc. as part of the word’s own usage pattern
e) whether it naturally combines with aspect markers such as 了, 过, 着
f) whether it naturally combines with softened forms such as 一下
g) whether it naturally combines with modal or negation patterns such as 想, 要, 能, 不, 没
h) whether it has fixed collocational or usage-frame behavior
98. Do NOT include grammar points whose main teaching value belongs to another word or construction rather than to the target word.
99. Do NOT treat general sentence grammar as a grammar point for the target word just because the target word appears in the sentence.
100. A helper item such as 给, 跟, 和, 把, 了, 过, 着, 一下, 想, 能, 不, 没 may be explained only when the explanation is specifically about how the target word combines with that item.
101. If the explanation would still be equally useful after replacing the target word with many unrelated words, it is too general and must NOT be included.
102. In [BEGIN_GRAMMAR], explain only grammar that is strictly tied to the target word or the listed pair_text as a usage property of that word.
103. Do NOT explain surrounding sentence grammar unless it directly governs the target word’s usage.
104. If a sentence contains extra grammar that is not specific to the target word, ignore it.
105. If there is a useful target-word-focused grammar point, include exactly 1 grammar row for that example.
106. If no strictly target-word-specific grammar point is present, write NONE inside [BEGIN_GRAMMAR].
107. Reject any grammar row that mainly teaches:
a) how 把 works in general
b) how 给 works in general
c) how 跟 or 和 work in general
d) how 了 works in general
e) how modal verbs work in general
f) how negation works in general
g) how question forms work in general
h) how time, location, topic, or discourse framing works in general
108. These may appear only when the explanation is explicitly about the target word’s compatibility or behavior with them.
109. grammar_name must use exactly one of these labels:
verb usage
transitive verb
intransitive verb
aspect particle
degree construction
result complement
potential complement
modal particle
negative necessity structure
negation
topic-comment
question word
serial verb construction
verb-object structure
recipient marker
verb reduplication
common object pattern
disposal construction
modifier particle
noun phrase
time expression
location phrase
comparison
emphasis pattern
fixed expression usage
polite expression usage
modal verb
after-clause
adverb of inclusion
object collocation
recipient pattern
sharing target pattern
completion pattern
softening pattern
refusal pattern
110. grammar_name is the learner-facing pattern label shown on the flashcard.
111. Prefer the most practical and reusable learner-facing label that helps the student produce a new sentence.
112. Prefer labels such as object collocation, recipient pattern, sharing target pattern, completion pattern, softening pattern, and refusal pattern when they describe the example more clearly than a broader abstract label.
112a. Avoid weak or overly broad labels when a more concrete learner-facing label is possible.
112b. Every grammar row must teach through four distinct layers in this order: WHY_TO_USE, PATTERN, FUNCTION, ANALYSIS.
112c. why_to_use is the Why to use field shown on the flashcard.
112d. why_to_use must explain why this pattern is useful, helpful, or appropriate for the communicative goal of the sentence.
112e. why_to_use should be short, learner-friendly, and practical.
112f. why_to_use should clarify the benefit of choosing this structure, such as clearer receiver marking, softer tone, completed-action meaning, or stronger sentence organization.
112g. structure is the Pattern field shown on the flashcard.
112h. structure must describe structural shape clearly and must show the Chinese word or marker in the sentence that the pattern is related to.
112i. structure should use English structural terms plus the central Chinese element that defines the pattern.
112j. Prefer mixed pattern wording such as 分享 + object, 跟 + recipient + 分享 + object, 分享 + object + 给 + recipient, 分享 + 了 + object, 分享 + 一下 + object, or 不想 + 分享 + object when those patterns match the real sentence.
112k. Use plain structural terms such as verb, object, recipient, completed-action marker, softener, modal, subject, time phrase, and location phrase where useful, but keep the relevant Chinese form visible.
112l. Do NOT write opaque all-Chinese formulas such as 跟+人+分享+内容 or 分享+内容+给+人 without structural labels.
112m. Every structure line MUST include at least one structural placeholder word in English (for example: subject, verb, object, recipient, modal, marker, time phrase, location phrase).
112n. Do NOT output structure as only Chinese words plus symbols, even if it looks understandable.
112o. Keep structure short, reusable, learner-readable, and specific to the exact structure being taught.
112p. If the example is mainly a collocation, structure may still include the target word in Chinese, such as 分享 + object, so the learner can immediately see which word the pattern belongs to.
112q. function is the one-line grammatical job description of the highlighted chunk in this sentence.
112r. function must stay brief and precise and must not turn into a full sentence analysis.
112s. function must explicitly name the relevant Chinese character, marker, or word that does the grammatical work, such as 跟, 给, 了, 一下, 不想, or 分享, so the learner can see exactly what form is responsible for the function.
112t. Do not write vague function lines such as marks the recipient before 分享 to show who receives the shared content if the key Chinese form is actually 跟; instead write function lines that explicitly identify the Chinese form doing that job.
112u. explanation is the Analysis field shown on the flashcard.
112v. The Analysis must explain only the main thing the highlighted pattern is doing in that exact sentence.
112w. The Analysis must be sentence-bound, not generic, not dictionary-like, and not a paraphrase of function.
112x. The Analysis must stay focused on the highlighted chunk and must not drift into broad Chinese grammar unrelated to that example.
112y. Keep the Analysis tight: explain the direct role of the target word or pattern in this sentence, then stop.
112z. Do NOT add broader productivity notes, semantic class lists, extra example categories, or reusable-frame summaries after the main sentence-specific point is clear.
112za. Do NOT add phrases such as nouns like..., can also follow..., commonly works with..., or is the basic reusable frame unless that information is absolutely required to explain the exact sentence.
112zb. The Analysis may omit the target-word Chinese form when naming the pattern, but if the pattern depends on a visible marker such as 跟, 给, 了, 一下, 把, 不, or 没, the Analysis must keep that marker in the pattern wording it uses.
112zc. The Analysis must refer to the Pattern using matching structure wording, especially preserving any marker that defines the pattern, rather than switching to a different formula.
112zd. Do not write vague phrases such as this pattern when the exact English structure can be named, such as the verb + object structure or the recipient + verb + object structure.
112ze. If the highlighted item is mainly a lexical or collocation example, the Analysis should explain the direct role of that collocation in this sentence and stop once the main point is clear.
112zf. If the highlighted item is mainly a grammar or structure example, the Analysis should explain the direct sentence role of the marker or word order in this sentence and stop once the main point is clear.
112zg. Avoid empty statements that could fit many unrelated sentences containing the target word.
112zh. Prioritize the main sentence-specific point over abstract grammar terminology.
112zi. Grammar explanations must explain why the target word or pair_text is used that way in the exact sentence.
112zj. Grammar explanations must be educational, specific, and learner-friendly.
112zk. Grammar explanations must contain 1 or 2 sentences only.
112zl. The Analysis must explicitly reuse the Pattern wording (or a clearly matching structural paraphrase) and must preserve all defining Chinese markers from that Pattern.
112zm. If Pattern includes markers such as 跟, 给, 把, 了, 过, 着, 一下, 不, or 没, the Analysis must include those same marker characters directly, not a marker-free paraphrase.

PRACTICE RULES
113. Include exactly one practice section in [BEGIN_PRACTICE].
114. The practice section must contain 3 to 5 written-recall questions.
115. Every practice question must require the learner to type the answer from memory.
116. The questions must cover at least 3 different aspects chosen from: word, pinyin, meaning, paired_word, example.
116a. The practice section must stay focused on the main word and the key phrase from Pair 1 inside [EXAMPLE_1].
116b. Do NOT ask practice questions about grammar contrasts, secondary patterns, or later examples.
117. Each question must have one clear expected answer.
118. Do NOT use multiple choice, options, answer_index, or any alternative-answer format.
118a. Every [QUESTION_N] block MUST be closed with a matching [END_QUESTION_N] block.
118b. The number N in [QUESTION_N] and [END_QUESTION_N] must match exactly.
118c. Do NOT omit any [END_QUESTION_N] block.
118d. Do NOT use [END_QUESTION] without an index.
118e. After the last question block, close with [END_PRACTICE].

PARSER-COMPATIBILITY CRITICAL SAFETY SECTION
118f. In every [EXAMPLE_N], pair_text must appear verbatim as one continuous exact substring inside sentence.
118g. Do NOT alter pair_text form in sentence; do not split it, inflect it, or insert words inside it.
118h. Every structure in [BEGIN_GRAMMAR] must include the relevant Chinese target word or a relevant Chinese marker that appears in that sentence.
118i. In Analysis, preserve every defining Chinese marker used by Pattern wording; do not rewrite marker-based patterns into marker-free paraphrases.
118j. Before output, re-check all [QUESTION_N] blocks and ensure each one has a matching [END_QUESTION_N] with identical N.

SELF-CHECK RULES
119. Before outputting, verify that:
a) the number of examples exactly matches the number of pair rows
b) every example contains its pair_text exactly
c) every example contains the target word exactly
d) every example has token rows
e) every example has a grammar section
f) every pair row has exactly 4 fields
g) every token row has exactly 4 fields
h) every grammar row has exactly 7 fields
i) no extra text appears outside the response block
j) the selected pairs and examples collectively cover all major learner-useful patterns of the word that reasonably fit within the allowed pair limit
k) for every grammar row, verify that the row teaches a rule about how the target word is used, not a general rule about surrounding grammar
l) if the grammar explanation would remain valid even after replacing the target word with many other common words, delete that grammar row or replace it with NONE
m) grammar_name is learner-facing and specific when a clearer practical label is available
 n) why_to_use explains why this pattern is useful for that sentence
 o) structure shows a reusable structural template and includes the relevant Chinese word or marker from the sentence
 oa) structure includes at least one English structural placeholder such as verb, object, recipient, subject, modal, or marker
 ob) structure is not written as only Chinese words plus symbols
  p) function explicitly names the Chinese character, marker, or word that does the grammatical job
 q) explanation is sentence-specific and stops after the main point is clear
 r) explanation preserves any defining marker when it references the Pattern wording
 s) pair rows teach distinct learner-useful behaviors rather than several obvious variants of the same pattern
 t) pair text is a concise canonical chunk, not a full clause with extra surrounding material
 u) pair rows prefer reusable frames when structure is the point and representative collocations when collocation is the point
 v) Pair 1 and [EXAMPLE_1] provide a calm default lesson with low grammar load
 w) practice questions stay on the main word and the key phrase inside the main sentence rather than testing grammar comparison
 x) every [QUESTION_N] has a matching [END_QUESTION_N], with identical N
 y) no [END_QUESTION] tag appears without an index
 z) analysis text preserves every defining marker present in Pattern wording
 aa) pair_text appears verbatim inside every corresponding example sentence
 ab) every grammar Pattern line contains the relevant Chinese target word or marker from that sentence
120. After this self-check, output the final response only once.

REQUIRED OUTPUT FORMAT

[BEGIN_RESPONSE]

[BEGIN_WORD]
word=
pinyin=
meaning=
word_class=
hsk_level=
usage_note=
paired_words_note=
[END_WORD]

[BEGIN_PAIRS]
1|text|composition|meaning
[END_PAIRS]

[BEGIN_EXAMPLES]

[EXAMPLE_1]
pair_text=
sentence=
pinyin=
translation=
[BEGIN_TOKENS]
1|text|pinyin|meaning
[END_TOKENS]
[BEGIN_GRAMMAR]
1|text_span|grammar_name|why_to_use|structure|function|explanation
[END_GRAMMAR]
[END_EXAMPLE_1]

[END_EXAMPLES]

[BEGIN_PRACTICE]
instruction=
[QUESTION_1]
aspect=
prompt=
answer=
[END_QUESTION_1]
[END_PRACTICE]

[END_RESPONSE]

Now generate the real response for this word:

{TARGET_WORD}`;

const HEADER_MAP: Record<string, string> = {
  BEGIN_RESPONSE: "[BEGIN_RESPONSE]",
  END_RESPONSE: "[END_RESPONSE]",
  BEGIN_WORD: "[BEGIN_WORD]",
  END_WORD: "[END_WORD]",
  BEGIN_PAIRS: "[BEGIN_PAIRS]",
  END_PAIRS: "[END_PAIRS]",
  BEGIN_EXAMPLES: "[BEGIN_EXAMPLES]",
  END_EXAMPLES: "[END_EXAMPLES]",
  BEGIN_TOKENS: "[BEGIN_TOKENS]",
  END_TOKENS: "[END_TOKENS]",
  BEGIN_GRAMMAR: "[BEGIN_GRAMMAR]",
  END_GRAMMAR: "[END_GRAMMAR]",
  BEGIN_PRACTICE: "[BEGIN_PRACTICE]",
  END_PRACTICE: "[END_PRACTICE]",
};

const REQUIRED_WORD_FIELDS = [
  "word",
  "pinyin",
  "meaning",
  "word_class",
  "hsk_level",
  "usage_note",
  "paired_words_note",
] as const;

const REQUIRED_EXAMPLE_FIELDS = [
  "pair_text",
  "sentence",
  "pinyin",
  "translation",
] as const;

const REQUIRED_PRACTICE_FIELDS = ["instruction"] as const;

const REQUIRED_PRACTICE_QUESTION_FIELDS = [
  "aspect",
  "prompt",
  "answer",
] as const;

const ALLOWED_WORD_CLASSES = new Set([
  "verb",
  "noun",
  "adjective",
  "adverb",
  "pronoun",
  "particle",
  "conjunction",
  "preposition",
  "fixed expression",
  "greeting",
  "polite expression",
  "question word",
  "measure word",
  "time expression",
]);

const ALLOWED_HSK_LEVELS = new Set([
  "HSK 1",
  "HSK 2",
  "HSK 3",
  "HSK 4",
  "HSK 5",
  "HSK 6",
  "HSK 7",
  "HSK 8",
  "HSK 9",
  "Not in HSK",
]);

const ALLOWED_GRAMMAR_LABELS = new Set([
  "verb usage",
  "transitive verb",
  "intransitive verb",
  "aspect particle",
  "degree construction",
  "result complement",
  "potential complement",
  "modal particle",
  "negative necessity structure",
  "negation",
  "topic-comment",
  "question word",
  "serial verb construction",
  "verb-object structure",
  "recipient marker",
  "verb reduplication",
  "common object pattern",
  "disposal construction",
  "modifier particle",
  "noun phrase",
  "time expression",
  "location phrase",
  "comparison",
  "emphasis pattern",
  "fixed expression usage",
  "polite expression usage",
  "modal verb",
  "after-clause",
  "adverb of inclusion",
  "object collocation",
  "recipient pattern",
  "sharing target pattern",
  "completion pattern",
  "softening pattern",
  "refusal pattern",
]);

const ALLOWED_PRACTICE_ASPECTS = new Set<PracticeQuestionAspect>([
  "word",
  "pinyin",
  "meaning",
  "paired_word",
  "example",
]);

const GRAMMAR_LABEL_ALIASES = new Map<string, string>([
  ["modal verb usage", "modal verb"],
  ["after clause", "after-clause"],
  ["after-clause", "after-clause"],
  ["adverb of inclusion", "adverb of inclusion"],
  ["verb-object collocation", "verb-object structure"],
  ["verb object collocation", "verb-object structure"],
  ["verb-object pattern", "verb-object structure"],
  ["object collocation", "object collocation"],
  ["recipient pattern", "recipient pattern"],
  ["recipient phrase", "recipient marker"],
  ["share with pattern", "recipient pattern"],
  ["recipient marking", "recipient marker"],
  ["recipient marking with 跟", "recipient marker"],
  ["recipient marking with 和", "recipient marker"],
  ["recipient marking with 给", "recipient marker"],
  ["giving pattern", "recipient marker"],
  ["giving pattern with 给", "recipient marker"],
  ["给 recipient pattern", "recipient marker"],
  ["sharing target pattern", "sharing target pattern"],
  ["completion pattern", "completion pattern"],
  ["softening pattern", "softening pattern"],
  ["refusal pattern", "refusal pattern"],
  ["reduplication", "verb reduplication"],
  ["verb reduplication", "verb reduplication"],
  ["object pattern", "common object pattern"],
  ["common object pattern", "common object pattern"],
  ["disposal pattern", "disposal construction"],
  ["location time phrase", "location phrase"],
  ["location/time phrase", "location phrase"],
]);

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeHeaderToken(line: string): string | null {
  const match = line.match(/^\[\s*([A-Za-z0-9 _-]+)\s*\]$/);
  if (!match) {
    return null;
  }

  return match[1].trim().replace(/[- ]+/g, "_").toUpperCase();
}

function normalizeHeaderLine(line: string): string {
  const token = normalizeHeaderToken(line);
  if (!token) {
    return line;
  }

  if (HEADER_MAP[token]) {
    return HEADER_MAP[token];
  }

  const exampleMatch = token.match(/^(END_)?EXAMPLE_(\d+)$/);
  if (exampleMatch) {
    return `[${exampleMatch[1] ? "END_" : ""}EXAMPLE_${exampleMatch[2]}]`;
  }

  const questionMatch = token.match(/^(END_)?QUESTION_(\d+)$/);
  if (questionMatch) {
    return `[${questionMatch[1] ? "END_" : ""}QUESTION_${questionMatch[2]}]`;
  }

  return line;
}

function toValidationResult(errors: ValidationError[]): ValidationResult {
  return {
    isValid: errors.length === 0,
    errors,
  };
}

function requiredIndex(
  lines: string[],
  token: string,
  message: string,
): number {
  const index = lines.indexOf(token);
  if (index === -1) {
    throw new Error(message);
  }
  return index;
}

function extractBoundedBlock(
  lines: string[],
  startToken: string,
  endToken: string,
  missingStartMessage: string,
  missingEndMessage: string,
): string[] {
  const startIndex = requiredIndex(lines, startToken, missingStartMessage);
  const endIndex = requiredIndex(lines, endToken, missingEndMessage);

  if (endIndex <= startIndex) {
    throw new Error(`${endToken} must appear after ${startToken}.`);
  }

  return lines.slice(startIndex + 1, endIndex);
}

function parsePipeRow(
  line: string,
  expectedFields: number,
  errorMessage: string,
): string[] {
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length !== expectedFields) {
    throw new Error(errorMessage);
  }
  return parts;
}

function normalizeComparableText(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function countSentences(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const matches = trimmed.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [];
  return matches.map((part) => part.trim()).filter(Boolean).length;
}

function containsChineseCharacters(value: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(value);
}

function isOpaqueChineseFormula(value: string): boolean {
  return containsChineseCharacters(value) && !/[a-z]/i.test(value);
}

function normalizeStructureReference(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s*\+\s*/g, " + ")
    .replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractChineseForms(value: string): string[] {
  return value.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/gu) ?? [];
}

function extractDefiningMarkers(structure: string, word: string): string[] {
  const markerCandidates = extractChineseForms(structure).filter(
    (form) => form !== word,
  );

  return Array.from(new Set(markerCandidates));
}

function functionReferencesChineseForm(
  functionText: string,
  textSpan: string,
  structure: string,
  word: string,
): boolean {
  const relevantForms = [textSpan, structure, word]
    .flatMap(
      (value) =>
        value.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+/gu) ?? [],
    )
    .filter(Boolean);

  if (relevantForms.length === 0) {
    return true;
  }

  return relevantForms.some((form) => functionText.includes(form));
}

function analysisReferencesPattern(
  word: string,
  textSpan: string,
  structure: string,
  explanation: string,
): boolean {
  const normalizedStructure = normalizeStructureReference(structure);
  const normalizedExplanation = normalizeStructureReference(explanation);
  const normalizedTextSpan = normalizeStructureReference(textSpan);
  const normalizedWord = normalizeStructureReference(word);

  const normalizedVerbAbstraction = normalizeStructureReference(
    structure.replace(new RegExp(escapeRegExp(word), "g"), "verb"),
  );

  const definingMarkers = extractDefiningMarkers(structure, word);
  const chineseForms = extractChineseForms(textSpan).filter(
    (form) => normalizeStructureReference(form) !== normalizedWord,
  );
  const residualTextSpanForms = extractChineseForms(
    textSpan.replaceAll(word, " "),
  );
  const relevantTextSpanForms = Array.from(
    new Set([...chineseForms, ...residualTextSpanForms]),
  );
  const preservesDefiningMarker =
    definingMarkers.length === 0 ||
    definingMarkers.some((marker) => explanation.includes(marker));
  const referencesMarkerPatternByBehavior =
    definingMarkers.length > 0 &&
    preservesDefiningMarker &&
    (normalizedExplanation.includes(normalizedWord) ||
      normalizedExplanation.includes(normalizedTextSpan));
  const referencesObjectRoleByBehavior =
    definingMarkers.length === 0 &&
    normalizedExplanation.includes(normalizedWord) &&
    /direct object|its object|as its object|as the object|takes .* as (its )?object/i.test(
      explanation,
    ) &&
    (relevantTextSpanForms.length === 0 ||
      relevantTextSpanForms.some((form) => explanation.includes(form)));

  return (
    preservesDefiningMarker &&
    ((normalizedStructure.length > 0 &&
      normalizedExplanation.includes(normalizedStructure)) ||
      (normalizedVerbAbstraction.length > 0 &&
        normalizedExplanation.includes(normalizedVerbAbstraction)) ||
      (normalizedTextSpan.length > 0 &&
        normalizedExplanation.includes(normalizedTextSpan)) ||
      referencesMarkerPatternByBehavior ||
      referencesObjectRoleByBehavior)
  );
}

function analysisContainsBroadUsageGeneralization(
  explanation: string,
): boolean {
  const normalizedExplanation = explanation.toLowerCase();

  return [
    /nouns like/,
    /words like/,
    /things like/,
    /can also follow/,
    /can also come after/,
    /commonly works with/,
    /often works with/,
    /this pattern is very productive/,
    /this structure is very productive/,
    /basic reusable frame/,
    /reusable frame/,
  ].some((pattern) => pattern.test(normalizedExplanation));
}

function isAllowedHskLevel(value: string): boolean {
  return ALLOWED_HSK_LEVELS.has(value.trim());
}

function isGrammarAnchoredToTargetUsage(
  word: string,
  pairText: string,
  grammar: GrammarItem,
): boolean {
  const targets = [pairText, word].map(normalizeComparableText).filter(Boolean);

  if (targets.length === 0) {
    return false;
  }

  const searchableFields = [
    grammar.textSpan,
    grammar.structure,
    grammar.function,
    grammar.explanation,
  ]
    .map(normalizeComparableText)
    .filter(Boolean);

  return targets.some((target) =>
    searchableFields.some((field) => field.includes(target)),
  );
}

function normalizeGrammarLabel(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ");

  return GRAMMAR_LABEL_ALIASES.get(normalized) || normalized;
}

function getMinimumUsagePatternCount(
  wordClass: string,
  exampleCount: number,
): number {
  if (wordClass !== "verb" || exampleCount < 3) {
    return 0;
  }

  return 2;
}

function parseOrderedWordEntry(lines: string[]): WordEntry {
  const keyValues = lines.map((line) => {
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      throw new Error("Malformed [BEGIN_WORD] block.");
    }

    return {
      key: line.slice(0, eqIndex).trim(),
      value: line.slice(eqIndex + 1).trim(),
    };
  });

  if (keyValues.length !== REQUIRED_WORD_FIELDS.length) {
    throw new Error("[BEGIN_WORD] block must contain exactly 7 fields.");
  }

  REQUIRED_WORD_FIELDS.forEach((field, index) => {
    if (keyValues[index]?.key !== field) {
      throw new Error(
        `[BEGIN_WORD] must contain fields in exact order. Expected ${field}=.`,
      );
    }
  });

  return {
    word: keyValues[0].value,
    pinyin: keyValues[1].value,
    meaning: keyValues[2].value,
    wordClass: keyValues[3].value,
    hskLevel: keyValues[4].value,
    usageNote: keyValues[5].value,
    pairedWordsNote: keyValues[6].value,
  };
}

function parsePairRows(lines: string[]): PairItem[] {
  if (lines.length === 1 && lines[0] === "NONE") {
    return [];
  }

  return lines.map((line, index) => {
    const [rawIndex, text, composition, meaning] = parsePipeRow(
      line,
      4,
      `Malformed pair row at line ${index + 1}: expected 4 fields.`,
    );

    return {
      index: Number(rawIndex),
      text,
      composition,
      meaning,
    };
  });
}

function parseTokenRows(lines: string[], exampleIndex: number): TokenItem[] {
  if (lines.length === 1 && lines[0] === "NONE") {
    throw new Error(
      `[BEGIN_TOKENS] in [EXAMPLE_${exampleIndex}] cannot be NONE.`,
    );
  }

  return lines.map((line) => {
    const [rawIndex, text, pinyin, meaning] = parsePipeRow(
      line,
      4,
      `Malformed token row in [EXAMPLE_${exampleIndex}]: expected 4 fields.`,
    );

    return {
      index: Number(rawIndex),
      text,
      pinyin,
      meaning,
    };
  });
}

function parseGrammarRows(
  lines: string[],
  exampleIndex: number,
): GrammarItem[] {
  if (lines.length === 1 && lines[0] === "NONE") {
    return [];
  }

  return lines.map((line) => {
    const values = line.split("|");

    if (values.length !== 7 && values.length !== 8) {
      throw new Error(
        `Malformed grammar row in [EXAMPLE_${exampleIndex}]: expected 7 fields.`,
      );
    }

    const [
      rawIndex,
      textSpan,
      grammarName,
      whyToUse,
      structure,
      grammarFunction,
      explanation,
    ] =
      values.length === 7
        ? values
        : [
            values[0],
            values[1],
            values[2],
            values[4],
            values[5],
            values[6],
            values[7],
          ];

    return {
      index: Number(rawIndex),
      textSpan,
      grammarName: normalizeGrammarLabel(grammarName),
      whyToUse,
      structure,
      function: grammarFunction,
      explanation,
    };
  });
}

function parseExampleMetadata(
  lines: string[],
  exampleIndex: number,
): Omit<ExampleSentence, "tokens" | "grammar"> {
  if (lines.length !== REQUIRED_EXAMPLE_FIELDS.length) {
    throw new Error(
      `[EXAMPLE_${exampleIndex}] must contain pair_text=, sentence=, pinyin=, and translation=.`,
    );
  }

  const values = lines.map((line) => {
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      throw new Error(`Malformed metadata field in [EXAMPLE_${exampleIndex}].`);
    }

    return {
      key: line.slice(0, eqIndex).trim(),
      value: line.slice(eqIndex + 1).trim(),
    };
  });

  REQUIRED_EXAMPLE_FIELDS.forEach((field, index) => {
    if (values[index]?.key !== field) {
      throw new Error(`Missing ${field} field in [EXAMPLE_${exampleIndex}].`);
    }
  });

  return {
    exampleIndex,
    pairText: values[0].value,
    sentence: values[1].value,
    pinyin: values[2].value,
    translation: values[3].value,
  };
}

function parseExampleBlock(
  lines: string[],
  exampleIndex: number,
): ExampleSentence {
  const beginTokensIndex = requiredIndex(
    lines,
    "[BEGIN_TOKENS]",
    `Missing [BEGIN_TOKENS] block in [EXAMPLE_${exampleIndex}].`,
  );
  const endTokensIndex = requiredIndex(
    lines,
    "[END_TOKENS]",
    `Missing [END_TOKENS] block in [EXAMPLE_${exampleIndex}].`,
  );
  const beginGrammarIndex = requiredIndex(
    lines,
    "[BEGIN_GRAMMAR]",
    `Missing [BEGIN_GRAMMAR] block in [EXAMPLE_${exampleIndex}].`,
  );
  const endGrammarIndex = requiredIndex(
    lines,
    "[END_GRAMMAR]",
    `Missing [END_GRAMMAR] block in [EXAMPLE_${exampleIndex}].`,
  );

  if (
    !(
      beginTokensIndex < endTokensIndex &&
      endTokensIndex < beginGrammarIndex &&
      beginGrammarIndex < endGrammarIndex
    )
  ) {
    throw new Error(
      `[EXAMPLE_${exampleIndex}] has malformed section ordering.`,
    );
  }

  const metadataLines = lines.slice(0, beginTokensIndex);
  const betweenBlocks = lines.slice(endTokensIndex + 1, beginGrammarIndex);
  const trailingLines = lines.slice(endGrammarIndex + 1);

  if (betweenBlocks.length > 0 || trailingLines.length > 0) {
    throw new Error(
      `[EXAMPLE_${exampleIndex}] contains unexpected lines outside its token or grammar blocks.`,
    );
  }

  const metadata = parseExampleMetadata(metadataLines, exampleIndex);
  const tokens = parseTokenRows(
    lines.slice(beginTokensIndex + 1, endTokensIndex),
    exampleIndex,
  );
  const grammar = parseGrammarRows(
    lines.slice(beginGrammarIndex + 1, endGrammarIndex),
    exampleIndex,
  );

  return {
    ...metadata,
    tokens,
    grammar,
  };
}

function parseExampleContainer(lines: string[]): ExampleSentence[] {
  const examples: ExampleSentence[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const header = lines[cursor];
    const startMatch = header.match(/^\[EXAMPLE_(\d+)\]$/);
    if (!startMatch) {
      throw new Error("Malformed example header inside [BEGIN_EXAMPLES].");
    }

    const exampleIndex = Number.parseInt(startMatch[1], 10);
    const endToken = `[END_EXAMPLE_${exampleIndex}]`;
    const endIndex = lines.indexOf(endToken, cursor + 1);

    if (endIndex === -1) {
      throw new Error(`Missing [END_EXAMPLE_${exampleIndex}] block.`);
    }

    examples.push(
      parseExampleBlock(lines.slice(cursor + 1, endIndex), exampleIndex),
    );
    cursor = endIndex + 1;
  }

  return examples;
}

function parsePracticeQuestionBlock(
  lines: string[],
  questionIndex: number,
): PracticeQuestion {
  if (lines.length !== REQUIRED_PRACTICE_QUESTION_FIELDS.length) {
    throw new Error(
      `[QUESTION_${questionIndex}] must contain aspect=, prompt=, and answer=.`,
    );
  }

  const values = lines.map((line) => {
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      throw new Error(`Malformed field in [QUESTION_${questionIndex}].`);
    }

    return {
      key: line.slice(0, eqIndex).trim(),
      value: line.slice(eqIndex + 1).trim(),
    };
  });

  REQUIRED_PRACTICE_QUESTION_FIELDS.forEach((field, index) => {
    if (values[index]?.key !== field) {
      throw new Error(
        `[QUESTION_${questionIndex}] must contain fields in exact order. Expected ${field}=.`,
      );
    }
  });

  return {
    index: questionIndex,
    aspect: values[0].value as PracticeQuestionAspect,
    prompt: values[1].value,
    answer: values[2].value,
  };
}

function parsePracticeQuestions(lines: string[]): PracticeQuestion[] {
  const questions: PracticeQuestion[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const header = lines[cursor];
    const startMatch = header.match(/^\[QUESTION_(\d+)\]$/);
    if (!startMatch) {
      throw new Error(
        "Malformed practice question header inside [BEGIN_PRACTICE].",
      );
    }

    const questionIndex = Number.parseInt(startMatch[1], 10);
    const endToken = `[END_QUESTION_${questionIndex}]`;
    const endIndex = lines.indexOf(endToken, cursor + 1);

    if (endIndex === -1) {
      throw new Error(`Missing [END_QUESTION_${questionIndex}] block.`);
    }

    questions.push(
      parsePracticeQuestionBlock(
        lines.slice(cursor + 1, endIndex),
        questionIndex,
      ),
    );
    cursor = endIndex + 1;
  }

  return questions;
}

function buildLegacyPracticeTask(
  lines: string[],
  context: {
    wordEntry: WordEntry;
    pairs: PairItem[];
    examples: ExampleSentence[];
  },
): PracticeTask {
  const legacyFields = [
    "task_type",
    "target_pair",
    "instruction",
    "question",
    "answer_index",
  ] as const;
  const beginOptionsIndex = requiredIndex(
    lines,
    "[BEGIN_OPTIONS]",
    "Missing [BEGIN_OPTIONS] block in [BEGIN_PRACTICE].",
  );
  const endOptionsIndex = requiredIndex(
    lines,
    "[END_OPTIONS]",
    "Missing [END_OPTIONS] block in [BEGIN_PRACTICE].",
  );

  if (beginOptionsIndex >= endOptionsIndex) {
    throw new Error("[BEGIN_OPTIONS] must appear before [END_OPTIONS].");
  }

  const metadataLines = lines.slice(0, beginOptionsIndex);
  const explanationLines = lines.slice(endOptionsIndex + 1);

  if (metadataLines.length !== legacyFields.length) {
    throw new Error(
      "[BEGIN_PRACTICE] legacy format must contain task_type=, target_pair=, instruction=, question=, and answer_index= before [BEGIN_OPTIONS].",
    );
  }

  const values = metadataLines.map((line) => {
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      throw new Error("Malformed metadata field in [BEGIN_PRACTICE].");
    }

    return {
      key: line.slice(0, eqIndex).trim(),
      value: line.slice(eqIndex + 1).trim(),
    };
  });

  legacyFields.forEach((field, index) => {
    if (values[index]?.key !== field) {
      throw new Error(
        `[BEGIN_PRACTICE] legacy format must contain fields in exact order. Expected ${field}=.`,
      );
    }
  });

  if (values[0].value !== "best_completion") {
    throw new Error(
      "[BEGIN_PRACTICE] legacy task_type must be best_completion.",
    );
  }

  if (explanationLines.length !== 1) {
    throw new Error(
      "[BEGIN_PRACTICE] legacy format must contain exactly one explanation= line after [END_OPTIONS].",
    );
  }

  const explanationLine = explanationLines[0];
  const explanationEqIndex = explanationLine.indexOf("=");
  if (explanationEqIndex <= 0) {
    throw new Error("Malformed explanation field in [BEGIN_PRACTICE].");
  }
  if (explanationLine.slice(0, explanationEqIndex).trim() !== "explanation") {
    throw new Error(
      "[BEGIN_PRACTICE] legacy format must end with explanation= after [END_OPTIONS].",
    );
  }

  const targetPair = values[1].value;
  const matchingPair = context.pairs.find((pair) => pair.text === targetPair);
  const matchingExample =
    context.examples.find((example) => example.pairText === targetPair) ||
    context.examples[0];

  const questions: PracticeQuestion[] = [
    {
      index: 1,
      aspect: "pinyin",
      prompt: `Write the pinyin for ${context.wordEntry.word}.`,
      answer: context.wordEntry.pinyin,
    },
    {
      index: 2,
      aspect: "meaning",
      prompt: `Write a natural English meaning for ${targetPair || context.wordEntry.word}.`,
      answer: matchingPair?.meaning || context.wordEntry.meaning,
    },
    {
      index: 3,
      aspect: "example",
      prompt: values[3].value.replace(/_{2,}/g, "____"),
      answer: targetPair || context.wordEntry.word,
    },
    {
      index: 4,
      aspect: "word",
      prompt: `Write the target word used in ${targetPair || matchingExample?.pairText || context.wordEntry.word}.`,
      answer: context.wordEntry.word,
    },
  ];

  return {
    instruction:
      "Recall the main word and the key phrase from the main sentence, then reveal the expected answer to check yourself.",
    questions,
  };
}

function parsePracticeBlock(
  lines: string[],
  context: {
    wordEntry: WordEntry;
    pairs: PairItem[];
    examples: ExampleSentence[];
  },
): PracticeTask {
  if (lines.length < 2) {
    throw new Error(
      "[BEGIN_PRACTICE] must contain instruction= followed by one or more [QUESTION_N] blocks.",
    );
  }

  if (lines[0].startsWith("task_type=")) {
    return buildLegacyPracticeTask(lines, context);
  }

  const instructionLine = lines[0];
  const eqIndex = instructionLine.indexOf("=");
  if (
    eqIndex <= 0 ||
    instructionLine.slice(0, eqIndex).trim() !== "instruction"
  ) {
    throw new Error("[BEGIN_PRACTICE] must start with instruction=.");
  }

  return {
    instruction: instructionLine.slice(eqIndex + 1).trim(),
    questions: parsePracticeQuestions(lines.slice(1)),
  };
}

function validatePositiveUniqueIndices(
  indices: number[],
  path: string,
  duplicateMessage: string,
  errors: ValidationError[],
): void {
  const seen = new Set<number>();

  for (const index of indices) {
    if (!Number.isInteger(index) || index <= 0) {
      errors.push({ path, message: "Indices must be positive integers." });
      continue;
    }

    if (seen.has(index)) {
      errors.push({ path, message: duplicateMessage });
    }

    seen.add(index);
  }
}

export function generatePrompt(word: string): string {
  return PROMPT_TEMPLATE.replace("{TARGET_WORD}", word.trim());
}

export function normalizeResponse(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function autoRepairResponse(text: string): AutoRepairResult {
  let repairedText = normalizeResponse(text);
  const repairNotes: string[] = [];

  if (/```/.test(repairedText)) {
    repairedText = repairedText
      .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
      .replace(/```/g, "");
    repairNotes.push("Stripped outer code fences.");
  }

  const blockMatch = repairedText.match(
    /\[BEGIN_RESPONSE\][\s\S]*\[END_RESPONSE\]/i,
  );
  if (blockMatch) {
    const trimmedBlock = blockMatch[0].trim();
    if (trimmedBlock !== repairedText) {
      repairedText = trimmedBlock;
      repairNotes.push("Removed prose outside the response block.");
    }
  }

  const normalizedLines = splitLines(repairedText).flatMap((line) => {
    const normalizedHeader = normalizeHeaderLine(line);
    if (normalizedHeader !== line) {
      repairNotes.push(`Normalized header ${line} to ${normalizedHeader}.`);
      return [normalizedHeader];
    }

    const normalizedLine = line
      .replace(/[｜￨│┃]/g, "|")
      .replace(/\s*=\s*/g, "=")
      .replace(/\s*\|\s*/g, "|");

    if (normalizedLine !== line) {
      repairNotes.push(`Normalized spacing in line: ${line}`);
    }

    if (
      normalizedLine.startsWith("pair_text=") &&
      normalizedLine.includes("|")
    ) {
      const [rawPairText, rawSentence] = normalizedLine
        .slice("pair_text=".length)
        .split(/\|(.+)/, 2);
      const pairText = rawPairText?.trim() ?? "";
      const sentence = rawSentence?.trim() ?? "";

      if (pairText && sentence) {
        repairNotes.push(
          "Split merged pair_text and sentence metadata into separate lines.",
        );
        return [`pair_text=${pairText}`, `sentence=${sentence}`];
      }
    }

    return [normalizedLine];
  });

  repairedText = normalizedLines.join("\n");

  return {
    repairedText,
    repaired: repairNotes.length > 0,
    repairNotes,
  };
}

export function parseWordResponse(text: string): ParsedWordResponse {
  const lines = splitLines(text);
  const beginResponseIndex = requiredIndex(
    lines,
    "[BEGIN_RESPONSE]",
    "Missing [BEGIN_RESPONSE] block.",
  );
  const endResponseIndex = requiredIndex(
    lines,
    "[END_RESPONSE]",
    "Missing [END_RESPONSE] block.",
  );

  if (endResponseIndex <= beginResponseIndex) {
    throw new Error("[END_RESPONSE] must appear after [BEGIN_RESPONSE].");
  }

  const bodyLines = lines.slice(beginResponseIndex + 1, endResponseIndex);
  const wordEntry = parseOrderedWordEntry(
    extractBoundedBlock(
      bodyLines,
      "[BEGIN_WORD]",
      "[END_WORD]",
      "Missing [BEGIN_WORD] block.",
      "Missing [END_WORD] block.",
    ),
  );
  const pairs = parsePairRows(
    extractBoundedBlock(
      bodyLines,
      "[BEGIN_PAIRS]",
      "[END_PAIRS]",
      "Missing [BEGIN_PAIRS] block.",
      "Missing [END_PAIRS] block.",
    ),
  );
  const examples = parseExampleContainer(
    extractBoundedBlock(
      bodyLines,
      "[BEGIN_EXAMPLES]",
      "[END_EXAMPLES]",
      "Missing [BEGIN_EXAMPLES] block.",
      "Missing [END_EXAMPLES] block.",
    ),
  );
  const practice = parsePracticeBlock(
    extractBoundedBlock(
      bodyLines,
      "[BEGIN_PRACTICE]",
      "[END_PRACTICE]",
      "Missing [BEGIN_PRACTICE] block.",
      "Missing [END_PRACTICE] block.",
    ),
    {
      wordEntry,
      pairs,
      examples,
    },
  );

  return {
    wordEntry,
    pairs,
    examples,
    practice,
    metadata: {
      parseMode: "word-entry-v3",
      repaired: false,
      repairNotes: [],
    },
  };
}

export function validateWordResponse(
  data: ParsedWordResponse,
): ValidationResult {
  const errors: ValidationError[] = [];
  const distinctGrammarPatterns = new Set<string>();
  const addError = (path: string, message: string) => {
    errors.push({ path, message });
  };
  const requireNonEmpty = (value: string, path: string, message: string) => {
    if (!value.trim()) {
      addError(path, message);
    }
  };

  requireNonEmpty(
    data.wordEntry.word,
    "wordEntry.word",
    "Missing word field in [BEGIN_WORD].",
  );
  requireNonEmpty(
    data.wordEntry.pinyin,
    "wordEntry.pinyin",
    "Missing pinyin field in [BEGIN_WORD].",
  );
  requireNonEmpty(
    data.wordEntry.meaning,
    "wordEntry.meaning",
    "Missing meaning field in [BEGIN_WORD].",
  );
  requireNonEmpty(
    data.wordEntry.wordClass,
    "wordEntry.wordClass",
    "Missing word_class field in [BEGIN_WORD].",
  );
  requireNonEmpty(
    data.wordEntry.hskLevel,
    "wordEntry.hskLevel",
    "Missing hsk_level field in [BEGIN_WORD].",
  );
  requireNonEmpty(
    data.wordEntry.usageNote,
    "wordEntry.usageNote",
    "Missing usage_note field in [BEGIN_WORD].",
  );
  requireNonEmpty(
    data.wordEntry.pairedWordsNote,
    "wordEntry.pairedWordsNote",
    "Missing paired_words_note field in [BEGIN_WORD].",
  );

  if (
    data.wordEntry.wordClass &&
    !ALLOWED_WORD_CLASSES.has(data.wordEntry.wordClass)
  ) {
    addError(
      "wordEntry.wordClass",
      "word_class in [BEGIN_WORD] must use an allowed label.",
    );
  }

  if (data.wordEntry.hskLevel && !isAllowedHskLevel(data.wordEntry.hskLevel)) {
    addError(
      "wordEntry.hskLevel",
      "hsk_level in [BEGIN_WORD] must use an allowed label.",
    );
  }

  if (countSentences(data.wordEntry.meaning) !== 1) {
    addError(
      "wordEntry.meaning",
      "meaning in [BEGIN_WORD] must be exactly one sentence.",
    );
  }

  if (countSentences(data.wordEntry.usageNote) !== 1) {
    addError(
      "wordEntry.usageNote",
      "usage_note in [BEGIN_WORD] must be exactly one sentence.",
    );
  }

  if (countSentences(data.wordEntry.pairedWordsNote) !== 1) {
    addError(
      "wordEntry.pairedWordsNote",
      "paired_words_note in [BEGIN_WORD] must be exactly one sentence.",
    );
  }

  if (data.pairs.length === 0) {
    addError("pairs", "Pairs section must include at least one pair row.");
  }

  if (data.pairs.length > 8) {
    addError("pairs", "Pairs section must include no more than 8 pair rows.");
  }

  validatePositiveUniqueIndices(
    data.pairs.map((item) => item.index),
    "pairs",
    "Duplicate pair indices are not allowed.",
    errors,
  );

  data.pairs.forEach((item, index) => {
    requireNonEmpty(
      item.text,
      `pairs[${index}].text`,
      "Pair rows must include text.",
    );
    requireNonEmpty(
      item.composition,
      `pairs[${index}].composition`,
      "Pair rows must include composition.",
    );
    requireNonEmpty(
      item.meaning,
      `pairs[${index}].meaning`,
      "Pair rows must include meaning.",
    );

    if (!item.composition.includes("+")) {
      addError(
        `pairs[${index}].composition`,
        "Pair composition must show how the pair or frame is built using + between parts.",
      );
    }

    if (item.text && !item.text.includes(data.wordEntry.word)) {
      addError(
        `pairs[${index}].text`,
        "Pair text must be built directly with the target word.",
      );
    }
  });

  if (data.examples.length !== data.pairs.length) {
    addError(
      "examples",
      `Pair count and example count must match. Found ${data.pairs.length} pairs and ${data.examples.length} examples.`,
    );
  }

  data.examples.forEach((example, index) => {
    const expectedIndex = index + 1;
    const correspondingPair = data.pairs[index];

    if (example.exampleIndex !== expectedIndex) {
      addError(
        `examples[${index}].exampleIndex`,
        `Example indices must be sequential starting at 1. Expected [EXAMPLE_${expectedIndex}].`,
      );
    }

    requireNonEmpty(
      example.pairText,
      `examples[${index}].pairText`,
      `Missing pair_text field in [EXAMPLE_${expectedIndex}].`,
    );
    requireNonEmpty(
      example.sentence,
      `examples[${index}].sentence`,
      `Missing sentence field in [EXAMPLE_${expectedIndex}].`,
    );
    requireNonEmpty(
      example.pinyin,
      `examples[${index}].pinyin`,
      `Missing pinyin field in [EXAMPLE_${expectedIndex}].`,
    );
    requireNonEmpty(
      example.translation,
      `examples[${index}].translation`,
      `Missing translation field in [EXAMPLE_${expectedIndex}].`,
    );

    if (correspondingPair && example.pairText !== correspondingPair.text) {
      addError(
        `examples[${index}].pairText`,
        `pair_text in [EXAMPLE_${expectedIndex}] must match pair ${expectedIndex} text.`,
      );
    }

    if (example.pairText && !example.sentence.includes(example.pairText)) {
      addError(
        `examples[${index}].sentence`,
        `Pair text does not appear in [EXAMPLE_${expectedIndex}] sentence.`,
      );
    }

    if (
      data.wordEntry.word &&
      !example.sentence.includes(data.wordEntry.word)
    ) {
      addError(
        `examples[${index}].sentence`,
        `Target word does not appear in [EXAMPLE_${expectedIndex}] sentence.`,
      );
    }

    if (example.tokens.length === 0) {
      addError(
        `examples[${index}].tokens`,
        `Missing token rows in [EXAMPLE_${expectedIndex}].`,
      );
    }

    validatePositiveUniqueIndices(
      example.tokens.map((item) => item.index),
      `examples[${index}].tokens`,
      `Duplicate token indices inside [EXAMPLE_${expectedIndex}] are not allowed.`,
      errors,
    );
    validatePositiveUniqueIndices(
      example.grammar.map((item) => item.index),
      `examples[${index}].grammar`,
      `Duplicate grammar indices inside [EXAMPLE_${expectedIndex}] are not allowed.`,
      errors,
    );

    if (example.grammar.length > 1) {
      addError(
        `examples[${index}].grammar`,
        `Each [EXAMPLE_${expectedIndex}] must contain exactly 1 grammar row or NONE.`,
      );
    }

    example.tokens.forEach((token, tokenIndex) => {
      requireNonEmpty(
        token.text,
        `examples[${index}].tokens[${tokenIndex}].text`,
        `Token row in [EXAMPLE_${expectedIndex}] must include text.`,
      );
      requireNonEmpty(
        token.pinyin,
        `examples[${index}].tokens[${tokenIndex}].pinyin`,
        `Token row in [EXAMPLE_${expectedIndex}] must include pinyin.`,
      );
      requireNonEmpty(
        token.meaning,
        `examples[${index}].tokens[${tokenIndex}].meaning`,
        `Token row in [EXAMPLE_${expectedIndex}] must include meaning.`,
      );
    });

    example.grammar.forEach((grammar, grammarIndex) => {
      requireNonEmpty(
        grammar.textSpan,
        `examples[${index}].grammar[${grammarIndex}].textSpan`,
        `Grammar row in [EXAMPLE_${expectedIndex}] must include text_span.`,
      );
      requireNonEmpty(
        grammar.grammarName,
        `examples[${index}].grammar[${grammarIndex}].grammarName`,
        `Grammar row in [EXAMPLE_${expectedIndex}] must include grammar_name.`,
      );
      requireNonEmpty(
        grammar.whyToUse,
        `examples[${index}].grammar[${grammarIndex}].whyToUse`,
        `Grammar row in [EXAMPLE_${expectedIndex}] must include why_to_use.`,
      );
      requireNonEmpty(
        grammar.structure,
        `examples[${index}].grammar[${grammarIndex}].structure`,
        `Grammar row in [EXAMPLE_${expectedIndex}] must include structure.`,
      );
      requireNonEmpty(
        grammar.function,
        `examples[${index}].grammar[${grammarIndex}].function`,
        `Grammar row in [EXAMPLE_${expectedIndex}] must include function.`,
      );
      requireNonEmpty(
        grammar.explanation,
        `examples[${index}].grammar[${grammarIndex}].explanation`,
        `Grammar row in [EXAMPLE_${expectedIndex}] must include explanation.`,
      );

      if (
        grammar.grammarName &&
        !ALLOWED_GRAMMAR_LABELS.has(grammar.grammarName)
      ) {
        addError(
          `examples[${index}].grammar[${grammarIndex}].grammarName`,
          `grammar_name in [EXAMPLE_${expectedIndex}] must use an allowed label.`,
        );
      }

      if (
        !isGrammarAnchoredToTargetUsage(
          data.wordEntry.word,
          example.pairText,
          grammar,
        )
      ) {
        addError(
          `examples[${index}].grammar[${grammarIndex}]`,
          `Grammar in [EXAMPLE_${expectedIndex}] must focus on how the target word or pair_text is used, not on unrelated supporting phrases.`,
        );
      }

      if (grammar.grammarName) {
        distinctGrammarPatterns.add(grammar.grammarName);
      }

      if (!containsChineseCharacters(grammar.structure)) {
        addError(
          `examples[${index}].grammar[${grammarIndex}].structure`,
          `Pattern in [EXAMPLE_${expectedIndex}] must include the relevant Chinese word or marker from the sentence.`,
        );
      } else if (isOpaqueChineseFormula(grammar.structure)) {
        addError(
          `examples[${index}].grammar[${grammarIndex}].structure`,
          `Pattern in [EXAMPLE_${expectedIndex}] must include structural labels, not only a raw Chinese-character formula.`,
        );
      }

      if (
        !functionReferencesChineseForm(
          grammar.function,
          grammar.textSpan,
          grammar.structure,
          data.wordEntry.word,
        )
      ) {
        addError(
          `examples[${index}].grammar[${grammarIndex}].function`,
          `Function in [EXAMPLE_${expectedIndex}] must explicitly name the relevant Chinese word or marker.`,
        );
      }

      if (
        !analysisReferencesPattern(
          data.wordEntry.word,
          grammar.textSpan,
          grammar.structure,
          grammar.explanation,
        )
      ) {
        addError(
          `examples[${index}].grammar[${grammarIndex}].explanation`,
          `Grammar explanation in [EXAMPLE_${expectedIndex}] must explicitly refer to the Pattern wording and preserve any defining marker.`,
        );
      }

      if (analysisContainsBroadUsageGeneralization(grammar.explanation)) {
        addError(
          `examples[${index}].grammar[${grammarIndex}].explanation`,
          `Grammar explanation in [EXAMPLE_${expectedIndex}] must stay on the main sentence-specific point and avoid broad follow-up generalizations.`,
        );
      }
    });
  });

  const minimumUsagePatternCount = getMinimumUsagePatternCount(
    data.wordEntry.wordClass,
    data.examples.length,
  );

  if (
    minimumUsagePatternCount > 0 &&
    distinctGrammarPatterns.size < minimumUsagePatternCount
  ) {
    addError(
      "examples",
      `Verb example sets must cover at least ${minimumUsagePatternCount} distinct target-word usage patterns across grammar notes.`,
    );
  }

  requireNonEmpty(
    data.practice.instruction,
    "practice.instruction",
    "Missing instruction field in [BEGIN_PRACTICE].",
  );
  if (
    data.practice.questions.length < 3 ||
    data.practice.questions.length > 5
  ) {
    addError(
      "practice.questions",
      `[BEGIN_PRACTICE] must contain 3 to 5 questions. Found ${data.practice.questions.length}.`,
    );
  }

  validatePositiveUniqueIndices(
    data.practice.questions.map((question) => question.index),
    "practice.questions",
    "Duplicate question indices inside [BEGIN_PRACTICE] are not allowed.",
    errors,
  );

  const expectedQuestionIndices = data.practice.questions.map(
    (_, index) => index + 1,
  );
  if (
    data.practice.questions.length > 0 &&
    data.practice.questions.some(
      (question, index) => question.index !== expectedQuestionIndices[index],
    )
  ) {
    addError(
      "practice.questions",
      "[BEGIN_PRACTICE] question blocks must be sequential starting at 1.",
    );
  }

  data.practice.questions.forEach((question, index) => {
    requireNonEmpty(
      question.aspect,
      `practice.questions[${index}].aspect`,
      `Question ${index + 1} in [BEGIN_PRACTICE] must include aspect.`,
    );
    requireNonEmpty(
      question.prompt,
      `practice.questions[${index}].prompt`,
      `Question ${index + 1} in [BEGIN_PRACTICE] must include prompt.`,
    );
    requireNonEmpty(
      question.answer,
      `practice.questions[${index}].answer`,
      `Question ${index + 1} in [BEGIN_PRACTICE] must include answer.`,
    );

    if (!ALLOWED_PRACTICE_ASPECTS.has(question.aspect)) {
      addError(
        `practice.questions[${index}].aspect`,
        `aspect in [QUESTION_${question.index}] must use an allowed label.`,
      );
    }
  });

  if (
    new Set(data.practice.questions.map((question) => question.aspect)).size < 3
  ) {
    addError(
      "practice.questions",
      "[BEGIN_PRACTICE] must cover at least 3 different aspects.",
    );
  }

  if (
    data.metadata.inputWord &&
    data.wordEntry.word.trim() !== data.metadata.inputWord.trim()
  ) {
    addError(
      "wordEntry.word",
      "Parsed word does not match the requested input word.",
    );
  }

  return toValidationResult(errors);
}

export const parseAiResponse = parseWordResponse;
export const validateAiResponse = (
  data: ParsedWordResponse,
): ValidationError[] => validateWordResponse(data).errors;
