import { describe, expect, it } from "vitest";
import {
  autoRepairResponse,
  generatePrompt,
  normalizeResponse,
  parseWordResponse,
  validateWordResponse,
} from "@/lib/ai/aiParser";

const VALID_RESPONSE = `[BEGIN_RESPONSE]
[BEGIN_WORD]
word=分享
pinyin=fēnxiǎng
meaning=to share something with others, such as experiences, feelings, ideas, or objects, so that more than one person can benefit or enjoy it together
word_class=verb
hsk_level=HSK 4
usage_note=分享 is commonly used when talking about giving others access to your ideas, experiences, feelings, or things.
paired_words_note=Paired words show common expressions built with the target word that help you use it in real conversations.
[END_WORD]
[BEGIN_PAIRS]
1|分享经验|分享+经验|to share experiences
2|分享快乐|分享+快乐|to share happiness
3|分享食物|分享+食物|to share food
[END_PAIRS]
[BEGIN_EXAMPLES]
[EXAMPLE_1]
pair_text=分享经验
sentence=他喜欢跟大家分享经验。
pinyin=Tā xǐhuān gēn dàjiā fēnxiǎng jīngyàn.
translation=He likes to share experiences with everyone.
[BEGIN_TOKENS]
1|他|tā|he
2|喜欢|xǐhuān|to like
3|跟|gēn|with
4|大家|dàjiā|everyone
5|分享经验|fēnxiǎng jīngyàn|to share experiences
[END_TOKENS]
[BEGIN_GRAMMAR]
1|跟大家|recipient marker|Use when saying who you are sharing something with.|This helps the listener identify the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.
[END_GRAMMAR]
[END_EXAMPLE_1]
[EXAMPLE_2]
pair_text=分享快乐
sentence=我们一起分享快乐。
pinyin=Wǒmen yìqǐ fēnxiǎng kuàilè.
translation=We share happiness together.
[BEGIN_TOKENS]
1|我们|wǒmen|we
2|一起|yìqǐ|together
3|分享快乐|fēnxiǎng kuàilè|to share happiness
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享快乐|common object pattern|Use when the shared content is the main focus.|This makes the content easy to state directly after 分享.|分享 + object|uses 分享 before the object to name the shared content directly|In this sentence, 分享 takes 快乐 as its object, so the phrase states exactly what is being shared. That keeps the focus on the shared feeling.
[END_GRAMMAR]
[END_EXAMPLE_2]
[EXAMPLE_3]
pair_text=分享食物
sentence=大家常常分享食物。
pinyin=Dàjiā chángcháng fēnxiǎng shíwù.
translation=People often share food.
[BEGIN_TOKENS]
1|大家|dàjiā|everyone
2|常常|chángcháng|often
3|分享食物|fēnxiǎng shíwù|to share food
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享食物|transitive verb|Use when naming the thing being shared directly.|This shows the core object slot that 分享 usually needs.|分享 + object|uses 分享 with a direct object|In this sentence, 分享 takes 食物 as its object, so 食物 is named directly after the verb. That keeps the shared content explicit in this sentence.
[END_GRAMMAR]
[END_EXAMPLE_3]
[END_EXAMPLES]
[BEGIN_PRACTICE]
instruction=Write each answer from memory, then reveal the expected answer to check yourself.
[QUESTION_1]
aspect=pinyin
prompt=Write the pinyin for 分享.
answer=fēnxiǎng
[END_QUESTION_1]
[QUESTION_2]
aspect=meaning
prompt=Write a natural English meaning for 分享.
answer=to share something with others
[END_QUESTION_2]
[QUESTION_3]
aspect=paired_word
prompt=Write one common paired word that uses 分享 and means "to share experiences."
answer=分享经验
[END_QUESTION_3]
[QUESTION_4]
aspect=word
prompt=Write the target word used in the core phrase 分享经验.
answer=分享
[END_QUESTION_4]
[END_PRACTICE]
[END_RESPONSE]`;

const FOUR_EXAMPLE_RESPONSE = `[BEGIN_RESPONSE]
[BEGIN_WORD]
word=分享
pinyin=fēnxiǎng
meaning=to share something with others, such as experiences, feelings, ideas, or objects, so that more than one person can benefit or enjoy it together
word_class=verb
hsk_level=HSK 4
usage_note=分享 is commonly used when talking about giving others access to your ideas, experiences, feelings, or things.
paired_words_note=Paired words show common expressions built with the target word that help you use it in real conversations.
[END_WORD]
[BEGIN_PAIRS]
1|分享经验|分享+经验|to share experiences
2|分享快乐|分享+快乐|to share happiness
3|分享照片|分享+照片|to share photos
4|分享想法|分享+想法|to share ideas
[END_PAIRS]
[BEGIN_EXAMPLES]
[EXAMPLE_1]
pair_text=分享经验
sentence=老师请大家分享经验。
pinyin=Lǎoshī qǐng dàjiā fēnxiǎng jīngyàn.
translation=The teacher asked everyone to share their experience.
[BEGIN_TOKENS]
1|老师|lǎoshī|teacher
2|请|qǐng|to ask politely
3|大家|dàjiā|everyone
4|分享经验|fēnxiǎng jīngyàn|to share experience
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享经验|transitive verb|Use when naming the thing being shared directly.|This shows the core object slot that 分享 usually depends on.|分享 + object|uses 分享 with a direct object|In this sentence, 分享 takes 经验 as its object, so 经验 names the content being shared directly. That keeps the sentence centered on the shared experience.
[END_GRAMMAR]
[END_EXAMPLE_1]
[EXAMPLE_2]
pair_text=分享快乐
sentence=她总是和朋友分享快乐。
pinyin=Tā zǒngshì hé péngyou fēnxiǎng kuàilè.
translation=She always shares happiness with her friends.
[BEGIN_TOKENS]
1|她|tā|she
2|总是|zǒngshì|always
3|和|hé|with
4|朋友|péngyou|friend
5|分享快乐|fēnxiǎng kuàilè|to share happiness
[END_TOKENS]
[BEGIN_GRAMMAR]
1|和朋友|recipient marker|Use when saying who you are sharing something with.|This foregrounds the receiver before the shared content appears.|和 + recipient + 分享 + object|uses 和 before 分享 to mark the receiver|In this sentence, 和 comes before 分享 to show who receives the shared content, while 快乐 stays the thing being shared. That keeps the recipient clear before the verb phrase continues.
[END_GRAMMAR]
[END_EXAMPLE_2]
[EXAMPLE_3]
pair_text=分享照片
sentence=我们在群里分享照片。
pinyin=Wǒmen zài qún lǐ fēnxiǎng zhàopiàn.
translation=We share photos in the group chat.
[BEGIN_TOKENS]
1|我们|wǒmen|we
2|在|zài|at; in
3|群里|qún lǐ|in the group chat
4|分享照片|fēnxiǎng zhàopiàn|to share photos
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享照片|common object pattern|Use when the main focus is the thing being shared.|This makes the shared item easy to name directly after 分享.|分享 + object|uses 分享 before the object to state the shared item|In this sentence, 分享 takes 照片 as its object, so the shared item is named directly after the verb. That keeps the sentence centered on what is being shared.
[END_GRAMMAR]
[END_EXAMPLE_3]
[EXAMPLE_4]
pair_text=分享想法
sentence=会议上大家分享想法。
pinyin=Huìyì shàng dàjiā fēnxiǎng xiǎngfǎ.
translation=Everyone shares ideas during the meeting.
[BEGIN_TOKENS]
1|会议上|huìyì shàng|during the meeting
2|大家|dàjiā|everyone
3|分享想法|fēnxiǎng xiǎngfǎ|to share ideas
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享想法|verb-object structure|Use when the main focus is the thing being shared.|This lets the speaker state the shared idea directly after 分享.|分享 + object|uses 分享 before the object to state the shared content|In this sentence, 分享 takes 想法 as its object, so the sentence names the shared content directly. That makes the idea being shared clear right after the verb.
[END_GRAMMAR]
[END_EXAMPLE_4]
[END_EXAMPLES]
[BEGIN_PRACTICE]
instruction=Write each answer from memory, then reveal the expected answer to check yourself.
[QUESTION_1]
aspect=pinyin
prompt=Write the pinyin for 分享.
answer=fēnxiǎng
[END_QUESTION_1]
[QUESTION_2]
aspect=meaning
prompt=What does 分享想法 mean in natural English?
answer=to share ideas
[END_QUESTION_2]
[QUESTION_3]
aspect=example
prompt=Which paired word is used in this sentence: 会议上大家分享想法。
answer=分享想法
[END_QUESTION_3]
[QUESTION_4]
aspect=word
prompt=Write the target word used in the phrase 分享想法.
answer=分享
[END_QUESTION_4]
[END_PRACTICE]
[END_RESPONSE]`;

const LEGACY_PRACTICE_RESPONSE = `[BEGIN_RESPONSE]
[BEGIN_WORD]
word=分享
pinyin=fēnxiǎng
meaning=to share something with other people so they can know it, feel it, or enjoy it together; it is often used for experiences, ideas, feelings, information, or digital content
word_class=verb
hsk_level=HSK 4
usage_note=分享 is commonly used for giving others access to your thoughts, experiences, feelings, or content.
paired_words_note=Paired words are common expressions built with 分享 that help you use the word in natural everyday phrases.
[END_WORD]
[BEGIN_PAIRS]
1|分享经验|分享+经验|to share experience or practical know-how
2|分享快乐|分享+快乐|to share happiness
3|分享照片|分享+照片|to share photos
4|分享看法|分享+看法|to share one's views
[END_PAIRS]
[BEGIN_EXAMPLES]
[EXAMPLE_1]
pair_text=分享经验
sentence=老师常常在课上分享经验。
pinyin=Lǎoshī chángcháng zài kè shàng fēnxiǎng jīngyàn.
translation=The teacher often shares experience in class.
[BEGIN_TOKENS]
1|老师|lǎoshī|teacher
2|常常|chángcháng|often
3|在|zài|at; in
4|课上|kè shàng|in class
5|分享经验|fēnxiǎng jīngyàn|share experience
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享经验|transitive verb|Use when naming the thing being shared directly.|This shows the core object slot that 分享 usually depends on.|分享 + object|uses 分享 with a direct object|In this sentence, 分享 takes 经验 as its object, so 经验 shows the content directly after the verb. That keeps the sentence focused on what is being shared.
[END_GRAMMAR]
[END_EXAMPLE_1]
[EXAMPLE_2]
pair_text=分享快乐
sentence=我想跟家人分享快乐。
pinyin=Wǒ xiǎng gēn jiārén fēnxiǎng kuàilè.
translation=I want to share happiness with my family.
[BEGIN_TOKENS]
1|我|wǒ|I
2|想|xiǎng|want to
3|跟|gēn|with
4|家人|jiārén|family
5|分享快乐|fēnxiǎng kuàilè|share happiness
[END_TOKENS]
[BEGIN_GRAMMAR]
1|跟家人|recipient marker|Use when saying who you are sharing something with.|This foregrounds the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|In this sentence, 跟 comes before 分享 to show that 家人 are the recipients, while 快乐 remains the thing being shared. That keeps the receiver clear before the shared content appears.
[END_GRAMMAR]
[END_EXAMPLE_2]
[EXAMPLE_3]
pair_text=分享照片
sentence=她旅行回来以后，马上在群里分享照片。
pinyin=Tā lǚxíng huílái yǐhòu, mǎshàng zài qún lǐ fēnxiǎng zhàopiàn.
translation=After coming back from her trip, she immediately shared photos in the group chat.
[BEGIN_TOKENS]
1|她|tā|she
2|旅行|lǚxíng|to travel; trip
3|回来|huílái|to come back
4|以后|yǐhòu|after
5|马上|mǎshàng|right away
6|在|zài|in; at
7|群里|qún lǐ|in the group chat
8|分享照片|fēnxiǎng zhàopiàn|share photos
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享照片|common object pattern|Use when the main focus is the thing being shared.|This makes the shared item easy to state directly after 分享.|分享 + object|uses 分享 before the object to state the shared item|In this sentence, 分享 takes 照片 as its object, so the shared content is stated directly after the verb. That keeps the sentence focused on the photos being shared.
[END_GRAMMAR]
[END_EXAMPLE_3]
[EXAMPLE_4]
pair_text=分享看法
sentence=开会的时候，大家都会分享看法。
pinyin=Kāihuì de shíhou, dàjiā dōu huì fēnxiǎng kànfǎ.
translation=During meetings, everyone shares their views.
[BEGIN_TOKENS]
1|开会|kāihuì|to have a meeting
2|的时候|de shíhou|when; during
3|大家|dàjiā|everyone
4|都|dōu|all
5|会|huì|will; tend to
6|分享看法|fēnxiǎng kànfǎ|share one's views
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享看法|verb-object structure|Use when the main focus is the thing being shared.|This lets the speaker state the shared opinion directly after 分享.|分享 + object|uses 分享 before the object to state the shared content|In this sentence, 分享 takes 看法 as its object, so the sentence names the shared opinion directly. That keeps the focus on the viewpoint being shared.
[END_GRAMMAR]
[END_EXAMPLE_4]
[END_EXAMPLES]
[BEGIN_PRACTICE]
task_type=best_completion
target_pair=分享经验
instruction=Choose the option that best completes the sentence with the target pair.
question=老师常常在课上____。
answer_index=2
[BEGIN_OPTIONS]
1|分享快乐
2|分享经验
3|分享照片
[END_OPTIONS]
explanation=分享经验 fits best because teachers often share experience in class.
[END_PRACTICE]
[END_RESPONSE]`;

const AI_LABEL_VARIANT_RESPONSE = `[BEGIN_RESPONSE]
[BEGIN_WORD]
word=分享
pinyin=fēnxiǎng
meaning=to let other people take part in something you have, know, feel, or experience, such as ideas, stories, happiness, or useful information
word_class=verb
hsk_level=HSK 4
usage_note=分享 often introduces what is being shared, and sometimes also who receives it.
paired_words_note=Paired words are common combinations or sentence frames that show how 分享 is naturally used.
[END_WORD]
[BEGIN_PAIRS]
1|分享经验|分享+经验|to share experience
2|分享故事|分享+故事|to share a story
3|跟朋友分享|跟+朋友+分享|to share with friends
4|分享给大家|分享+给+大家|to share with everyone
[END_PAIRS]
[BEGIN_EXAMPLES]
[EXAMPLE_1]
pair_text=分享经验
sentence=老师常常在会上分享经验。
pinyin=Lǎoshī chángcháng zài huì shàng fēnxiǎng jīngyàn.
translation=The teacher often shares experience at meetings.
[BEGIN_TOKENS]
1|老师|lǎoshī|teacher
2|常常|chángcháng|often
3|在|zài|at; in
4|会上|huì shàng|at the meeting
5|分享经验|fēnxiǎng jīngyàn|share experience
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享经验|object collocation|Use when naming the thing being shared directly.|This shows a common content type that naturally follows 分享.|分享 + object|uses 分享 before the object to show the shared content|In this sentence, 分享 takes 经验 as its object, so the phrase states exactly what the teacher is sharing. That keeps the meaning centered on the shared experience.
[END_GRAMMAR]
[END_EXAMPLE_1]
[EXAMPLE_2]
pair_text=分享故事
sentence=她喜欢在网上分享故事。
pinyin=Tā xǐhuān zài wǎng shàng fēnxiǎng gùshi.
translation=She likes to share stories online.
[BEGIN_TOKENS]
1|她|tā|she
2|喜欢|xǐhuān|to like
3|在|zài|on; at
4|网上|wǎng shàng|online
5|分享故事|fēnxiǎng gùshi|share stories
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享故事|object collocation|Use when naming the thing being shared directly.|This shows a common content type that naturally follows 分享.|分享 + object|uses 分享 before the object to show the shared content|In this sentence, 分享 takes 故事 as its object, so the sentence names the shared content directly. That keeps the focus on the story being shared.
[END_GRAMMAR]
[END_EXAMPLE_2]
[EXAMPLE_3]
pair_text=跟朋友分享
sentence=我最想跟朋友分享这个好消息。
pinyin=Wǒ zuì xiǎng gēn péngyou fēnxiǎng zhège hǎo xiāoxi.
translation=I most want to share this good news with my friends.
[BEGIN_TOKENS]
1|我|wǒ|I
2|最|zuì|most
3|想|xiǎng|to want
4|跟朋友分享|gēn péngyou fēnxiǎng|share with friends
5|这个|zhège|this
6|好消息|hǎo xiāoxi|good news
[END_TOKENS]
[BEGIN_GRAMMAR]
1|跟朋友分享|recipient pattern|Use when saying who you are sharing something with.|This foregrounds the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|In this sentence, 跟 comes before 分享 to show who receives the shared content, while 这个好消息 stays the thing being shared. That makes the recipient clear early in the sentence.
[END_GRAMMAR]
[END_EXAMPLE_3]
[EXAMPLE_4]
pair_text=分享给大家
sentence=他把旅行照片分享给大家看。
pinyin=Tā bǎ lǚxíng zhàopiàn fēnxiǎng gěi dàjiā kàn.
translation=He shared the travel photos with everyone to look at.
[BEGIN_TOKENS]
1|他|tā|he
2|把|bǎ|marks the object before the verb
3|旅行照片|lǚxíng zhàopiàn|travel photos
4|分享给大家|fēnxiǎng gěi dàjiā|share with everyone
5|看|kàn|to look
[END_TOKENS]
[BEGIN_GRAMMAR]
1|分享给大家|sharing target pattern|Use when saying both what is shared and who receives it.|This lets the sentence add the receiver after the shared item.|分享 + object + 给 + recipient|uses 给 after 分享 and the object to add the receiver|In this sentence, 给大家 comes after 分享 to add the receiving group after the shared item is introduced. That keeps the photos first and the receiver second.
[END_GRAMMAR]
[END_EXAMPLE_4]
[END_EXAMPLES]
[BEGIN_PRACTICE]
instruction=Type each answer from memory based on what you learned about 分享.
[QUESTION_1]
aspect=word
prompt=Write the target word that means to let other people take part in something you have, know, or feel.
answer=分享
[END_QUESTION_1]
[QUESTION_2]
aspect=pinyin
prompt=Write the pinyin for 分享 with tone marks and no spaces.
answer=fēnxiǎng
[END_QUESTION_2]
[QUESTION_3]
aspect=paired_word
prompt=Which paired word means “to share experience”?
answer=分享经验
[END_QUESTION_3]
[QUESTION_4]
aspect=example
prompt=Which paired word is used in this sentence: 老师常常分享经验。
answer=分享经验
[END_QUESTION_4]
[QUESTION_5]
aspect=word
prompt=Write the target word used in the phrase 分享经验.
answer=分享
[END_QUESTION_5]
[END_PRACTICE]
[END_RESPONSE]`;

describe("normalizeResponse", () => {
  it("normalizes line endings, trims whitespace, removes BOM, and collapses excessive blank lines", () => {
    expect(
      normalizeResponse("\uFEFF\r\n\r\nhello\r\n\r\n\r\nworld  \r\n"),
    ).toBe("hello\n\nworld");
  });
});

describe("generatePrompt", () => {
  it("tells the AI to teach all major grammar rules through the example set", () => {
    const prompt = generatePrompt("分享");

    expect(prompt).toContain("FORMAT PRIORITY RULE");
    expect(prompt).toContain("INSTRUCTIONAL TYPE DECISION LAYER");
    expect(prompt).toContain("grammar-sensitive word");
    expect(prompt).toContain("lexically simple word");
    expect(prompt).toContain(
      "Do not stop at only 3-4 obvious patterns if the word has additional major learner-useful patterns that are common, natural, and distinct",
    );
    expect(prompt).toContain(
      "Maximize instructional coverage, not superficial variety",
    );
    expect(prompt).toContain(
      "If the pair limit prevents full exhaustiveness, choose patterns by this priority order: core sentence pattern, core object types, recipient patterns, 给 pattern, aspect usage, softened usage such as 一下, modal or negation usage, then other common frames",
    );
    expect(prompt).toContain(
      "Pair 1 must be the most natural phrase or usage frame embedded inside the main sentence for first teaching the target word",
    );
    expect(prompt).toContain(
      "[EXAMPLE_1] must be the single main sentence shown on the card and must teach the target word through Pair 1 in a low-grammar-load way",
    );
    expect(prompt).toContain(
      "Do NOT make [EXAMPLE_1] depend on receiver-order contrasts, 给 contrasts, 把 contrasts, or other explicit structural comparisons unless that structure is the only truly natural basic use of the word",
    );
    expect(prompt).toContain(
      "The practice section must stay focused on the main word and the key phrase from Pair 1 inside [EXAMPLE_1]",
    );
    expect(prompt).toContain(
      "Do NOT treat Pair 1 as a separate mini example, pop-up sentence, slogan, or headline that competes with the main sentence",
    );
    expect(prompt).toContain(
      "pair text is support material for the main sentence, not an additional sentence",
    );
    expect(prompt).toContain(
      "pair text should be a concise canonical chunk built directly with the target word, not a full clause or a decorated phrase",
    );
    expect(prompt).toContain(
      "If several candidate pairs teach the same frame with interchangeable nouns, keep the broadest or highest-frequency representative unless another noun teaches a genuinely different object class",
    );
    expect(prompt).toContain(
      "Distinguish two pair types before selecting rows",
    );
    expect(prompt).toContain(
      "For a lexical or collocation pair, choose a natural high-frequency chunk that teaches what kinds of nouns or complements commonly occur with the target word",
    );
    expect(prompt).toContain(
      "For a grammar or structure pair, choose a reusable frame that teaches word order, marker placement, aspect compatibility, softening, negation, or recipient behavior",
    );
    expect(prompt).toContain(
      "Before keeping a pair, ask: does this row teach a distinct, high-frequency, reusable behavior of the target word? If not, exclude it",
    );
    expect(prompt).toContain(
      "Prefer the most practical and reusable learner-facing label that helps the student produce a new sentence",
    );
    expect(prompt).toContain(
      "Every grammar row must teach through four distinct layers in this order: WHY_TO_USE, PATTERN, FUNCTION, ANALYSIS",
    );
    expect(prompt).toContain(
      "why_to_use is the Why to use field shown on the flashcard",
    );
    expect(prompt).toContain(
      "why_to_use must explain why this pattern is useful, helpful, or appropriate for the communicative goal of the sentence",
    );
    expect(prompt).toContain(
      "why_to_use should clarify the benefit of choosing this structure, such as clearer receiver marking, softer tone, completed-action meaning, or stronger sentence organization",
    );
    expect(prompt).toContain(
      "structure must describe structural shape clearly and must show the Chinese word or marker in the sentence that the pattern is related to",
    );
    expect(prompt).toContain(
      "Prefer mixed pattern wording such as 分享 + object, 跟 + recipient + 分享 + object, 分享 + object + 给 + recipient, 分享 + 了 + object, 分享 + 一下 + object, or 不想 + 分享 + object",
    );
    expect(prompt).toContain(
      "Do NOT write opaque all-Chinese formulas such as 跟+人+分享+内容 or 分享+内容+给+人 without structural labels",
    );
    expect(prompt).toContain(
      "function must explicitly name the relevant Chinese character, marker, or word that does the grammatical work, such as 跟, 给, 了, 一下, 不想, or 分享",
    );
    expect(prompt).toContain(
      "Do not write vague function lines such as marks the recipient before 分享 to show who receives the shared content if the key Chinese form is actually 跟",
    );
    expect(prompt).toContain(
      "The Analysis must explain only the main thing the highlighted pattern is doing in that exact sentence",
    );
    expect(prompt).toContain(
      "Keep the Analysis tight: explain the direct role of the target word or pattern in this sentence, then stop",
    );
    expect(prompt).toContain(
      "Do NOT add broader productivity notes, semantic class lists, extra example categories, or reusable-frame summaries after the main sentence-specific point is clear",
    );
    expect(prompt).toContain(
      "Do NOT add phrases such as nouns like..., can also follow..., commonly works with..., or is the basic reusable frame unless that information is absolutely required to explain the exact sentence",
    );
    expect(prompt).toContain(
      "If the highlighted item is mainly a lexical or collocation example, the Analysis should explain the direct role of that collocation in this sentence and stop once the main point is clear",
    );
    expect(prompt).toContain(
      "If the highlighted item is mainly a grammar or structure example, the Analysis should explain the direct sentence role of the marker or word order in this sentence and stop once the main point is clear",
    );
    expect(prompt).toContain(
      "The Analysis must explain only the main thing the highlighted pattern is doing in that exact sentence",
    );
    expect(prompt).toContain(
      "The Analysis must be sentence-bound, not generic, not dictionary-like, and not a paraphrase of function",
    );
    expect(prompt).toContain(
      "The Analysis may omit the target-word Chinese form when naming the pattern, but if the pattern depends on a visible marker such as 跟, 给, 了, 一下, 把, 不, or 没, the Analysis must keep that marker in the pattern wording it uses",
    );
    expect(prompt).toContain(
      "The Analysis must refer to the Pattern using matching structure wording, especially preserving any marker that defines the pattern, rather than switching to a different formula",
    );
    expect(prompt).toContain(
      "Do not write vague phrases such as this pattern when the exact English structure can be named",
    );
    expect(prompt).toContain(
      "Include all major common and pedagogically useful collocations and usage frames for modern learner Mandarin that can realistically fit within the allowed pair limit",
    );
    expect(prompt).toContain(
      "For grammar-sensitive words, prioritize pairs that cover the word’s major learner-useful usage behaviors",
    );
    expect(prompt).toContain(
      "For grammar-sensitive words, behavior coverage is more important than semantic variety alone",
    );
    expect(prompt).toContain(
      "For lexically simple words, prioritize the most common and useful collocations, realistic learner-useful contexts, and core semantic range",
    );
    expect(prompt).toContain(
      "For lexically simple words, common collocations and natural contexts are more important than forced grammar variation",
    );
    expect(prompt).toContain(
      "If the target word has several distinct major learner-useful usage behaviors, prioritize behavior coverage before adding extra collocations",
    );
    expect(prompt).toContain(
      "Across the examples, cover all major learner-useful usage behaviors that belong to the target word itself, as far as they can be naturally represented within the allowed number of pair rows",
    );
    expect(prompt).toContain(
      "For grammar-sensitive words, the example set should function like a compact usage map of the word",
    );
    expect(prompt).toContain(
      "For lexically simple words, the example set should function like a compact meaning-and-collocation map of the word",
    );
    expect(prompt).toContain(
      "Generate example sentences to demonstrate the target word’s own usage patterns, not to showcase unrelated grammar",
    );
    expect(prompt).toContain(
      "In each [EXAMPLE_N] block, write pair_text=, sentence=, pinyin=, and translation= on four separate lines in that exact order",
    );
    expect(prompt).toContain(
      "Do NOT merge example metadata fields onto one line",
    );
    expect(prompt).toContain(
      "Do NOT use pipe separators inside example metadata lines",
    );
    expect(prompt).toContain(
      "Only include grammar points that directly define, constrain, or illustrate how the target word itself is naturally used",
    );
    expect(prompt).toContain(
      "Do NOT treat general sentence grammar as a grammar point for the target word just because the target word appears in the sentence",
    );
    expect(prompt).toContain("it is too general and must NOT be included");
    expect(prompt).toContain("Reject any grammar row that mainly teaches:");
    expect(prompt).toContain(
      "if the grammar explanation would remain valid even after replacing the target word with many other common words, delete that grammar row or replace it with NONE",
    );
    expect(prompt).toContain(
      "Now generate the real response for this word:\n\n分享",
    );
  });
});

describe("autoRepairResponse", () => {
  it("repairs code fences, prose, malformed headers, and spacing", () => {
    const repaired = autoRepairResponse(`Before
\`\`\`
[BEGIN RESPONSE]
[BEGIN WORD]
word = 分享
pinyin = fēnxiǎng
meaning = learner-friendly meaning
word_class = verb
usage_note = common sharing verb
paired_words_note = shows common combinations
[END WORD]
[BEGIN PAIRS]
1 ｜ 分享经验 ｜ 分享+经验 ｜ to share experience
[END PAIRS]
[BEGIN EXAMPLES]
[EXAMPLE 1]
pair_text = 分享经验
sentence = 老师请大家分享经验。
pinyin = Lǎoshī qǐng dàjiā fēnxiǎng jīngyàn.
translation = The teacher asked everyone to share their experience.
[BEGIN TOKENS]
1 ｜ 老师 ｜ lǎoshī ｜ teacher
2 ｜ 请 ｜ qǐng ｜ to ask politely
3 ｜ 大家 ｜ dàjiā ｜ everyone
4 ｜ 分享经验 ｜ fēnxiǎng jīngyàn ｜ to share experience
[END TOKENS]
[BEGIN GRAMMAR]
NONE
[END GRAMMAR]
[END EXAMPLE 1]
[END EXAMPLES]
[BEGIN PRACTICE]
instruction = Write each answer from memory.
[QUESTION 1]
aspect = pinyin
prompt = Write the pinyin for 分享.
answer = fēnxiǎng
[END QUESTION 1]
[QUESTION 2]
aspect = meaning
prompt = Write a natural English meaning for 分享.
answer = to share
[END QUESTION 2]
[QUESTION 3]
aspect = paired_word
prompt = Write one common paired word that uses 分享.
answer = 分享经验
[END QUESTION 3]
[END PRACTICE]
[END RESPONSE]
\`\`\`
After`);

    expect(repaired.repaired).toBe(true);
    expect(repaired.repairedText).toContain("[BEGIN_WORD]");
    expect(repaired.repairedText).toContain("[QUESTION_1]");
    expect(repaired.repairedText).toContain("word=分享");
    expect(repaired.repairedText).toContain(
      "1|分享经验|分享+经验|to share experience",
    );
  });

  it("splits a merged pair_text and sentence metadata line", () => {
    const malformed = VALID_RESPONSE.replace(
      "pair_text=分享快乐\nsentence=我们一起分享快乐。",
      "pair_text=分享快乐|我们一起分享快乐。",
    );

    const repaired = autoRepairResponse(malformed);
    const parsed = parseWordResponse(repaired.repairedText);

    expect(repaired.repaired).toBe(true);
    expect(repaired.repairedText).toContain(
      "pair_text=分享快乐\nsentence=我们一起分享快乐。",
    );
    expect(parsed.examples[1].pairText).toBe("分享快乐");
    expect(parsed.examples[1].sentence).toBe("我们一起分享快乐。");
  });
});

describe("parseWordResponse", () => {
  it("parses a valid full word response including written recall practice", () => {
    const parsed = parseWordResponse(VALID_RESPONSE);

    expect(parsed.wordEntry.word).toBe("分享");
    expect(parsed.wordEntry.hskLevel).toBe("HSK 4");
    expect(parsed.wordEntry.pairedWordsNote).toContain("common expressions");
    expect(parsed.pairs).toHaveLength(3);
    expect(parsed.examples).toHaveLength(3);
    expect(parsed.examples[0].tokens[4].text).toBe("分享经验");
    expect(parsed.practice.questions).toHaveLength(4);
    expect(parsed.practice.questions[0].aspect).toBe("pinyin");
    expect(parsed.practice.questions[3].answer).toBe("分享");
  });

  it("parses a variable number of examples", () => {
    const parsed = parseWordResponse(FOUR_EXAMPLE_RESPONSE);
    expect(parsed.examples).toHaveLength(4);
    expect(parsed.examples[3].pairText).toBe("分享想法");
    expect(parsed.practice.questions[2].aspect).toBe("example");
  });

  it("parses repaired content wrapped in code fences", () => {
    const repaired = autoRepairResponse(`\`\`\`\n${VALID_RESPONSE}\n\`\`\``);
    const parsed = parseWordResponse(repaired.repairedText);
    expect(parsed.practice.questions[0].prompt).toContain("pinyin");
  });

  it("parses a legacy best-completion practice block by converting it to written recall questions", () => {
    const parsed = parseWordResponse(LEGACY_PRACTICE_RESPONSE);

    expect(parsed.practice.questions.length).toBe(4);
    expect(parsed.practice.questions[0].aspect).toBe("pinyin");
    expect(parsed.practice.questions[2].aspect).toBe("example");
    expect(parsed.practice.questions[2].answer).toBe("分享经验");
    expect(parsed.practice.questions[3].aspect).toBe("word");
  });

  it("normalizes grammar label variants before validation", () => {
    const parsed = parseWordResponse(
      LEGACY_PRACTICE_RESPONSE.replace(
        "common object pattern|Use when the main focus is the thing being shared.|This makes the shared item easy to state directly after 分享.|分享 + object|uses 分享 before the object to state the shared item",
        "After Clause|Use when the main focus is the thing being shared.|This makes the shared item easy to state directly after 分享.|分享 + object|uses 分享 before the object to state the shared item",
      ),
    );

    expect(parsed.examples[2].grammar[0].grammarName).toBe("after-clause");
    expect(validateWordResponse(parsed).isValid).toBe(true);
  });

  it("normalizes AI-generated usage-label variants that still teach the target word correctly", () => {
    const parsed = parseWordResponse(AI_LABEL_VARIANT_RESPONSE);

    expect(parsed.examples[0].grammar[0].grammarName).toBe(
      "object collocation",
    );
    expect(parsed.examples[2].grammar[0].grammarName).toBe("recipient pattern");
    expect(parsed.examples[3].grammar[0].grammarName).toBe(
      "sharing target pattern",
    );
    expect(validateWordResponse(parsed).isValid).toBe(true);
  });

  it("accepts learner-facing grammar labels directly", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("recipient marker", "recipient pattern").replace(
        "common object pattern",
        "object collocation",
      ),
    );

    expect(parsed.examples[0].grammar[0].grammarName).toBe("recipient pattern");
    expect(parsed.examples[1].grammar[0].grammarName).toBe(
      "object collocation",
    );
    expect(validateWordResponse(parsed).isValid).toBe(true);
  });

  it("accepts analysis that names the exact collocation for non-marker patterns", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "In this sentence, 分享 takes 快乐 as its object, so the phrase states exactly what is being shared. That keeps the focus on the shared feeling.",
        "In this sentence, 分享 takes 快乐 as its object, so the phrase states exactly what is being shared. That keeps the focus on the shared feeling rather than on another sentence pattern.",
      ),
    );

    expect(validateWordResponse(parsed).isValid).toBe(true);
  });

  it("accepts analysis that names the defining marker and target word for marker-based patterns", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.",
        "In this sentence, 跟 comes before 分享 to show who receives the shared content, while 经验 stays the thing being shared. This keeps the recipient clear early in the sentence.",
      ),
    );

    expect(validateWordResponse(parsed).isValid).toBe(true);
  });

  it("rejects analysis that adds broad usage generalization after the main point", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "In this sentence, 分享 takes 食物 as its object, so 食物 is named directly after the verb. That keeps the shared content explicit in this sentence.",
        "In this sentence, 分享 takes 食物 as its object, so the phrase tells us exactly what is being shared. This verb commonly works with content nouns like experiences, ideas, stories, or feelings, and 分享 + object is the basic reusable frame.",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[2].grammar[0].explanation",
          message:
            "Grammar explanation in [EXAMPLE_3] must stay on the main sentence-specific point and avoid broad follow-up generalizations.",
        }),
      ]),
    );
  });

  it("fails when [BEGIN_WORD] is missing", () => {
    expect(() =>
      parseWordResponse(VALID_RESPONSE.replace("[BEGIN_WORD]\n", "")),
    ).toThrow("Missing [BEGIN_WORD] block.");
  });

  it("fails when a token row has the wrong field count", () => {
    expect(() =>
      parseWordResponse(
        VALID_RESPONSE.replace(
          "5|分享经验|fēnxiǎng jīngyàn|to share experiences",
          "5|分享经验|fēnxiǎng jīngyàn",
        ),
      ),
    ).toThrow("Malformed token row in [EXAMPLE_1]: expected 4 fields.");
  });

  it("fails when [BEGIN_TOKENS] is missing", () => {
    expect(() =>
      parseWordResponse(VALID_RESPONSE.replace("[BEGIN_TOKENS]\n", "")),
    ).toThrow("Missing [BEGIN_TOKENS] block in [EXAMPLE_1].");
  });

  it("fails when [BEGIN_PRACTICE] is missing", () => {
    expect(() =>
      parseWordResponse(
        VALID_RESPONSE.replace(
          /\[BEGIN_PRACTICE\][\s\S]*?\[END_PRACTICE\]\n/,
          "",
        ),
      ),
    ).toThrow("Missing [BEGIN_PRACTICE] block.");
  });
});

describe("validateWordResponse", () => {
  it("accepts a prompt-compatible response", () => {
    const parsed = parseWordResponse(VALID_RESPONSE);
    expect(validateWordResponse(parsed).isValid).toBe(true);
  });

  it("rejects an hsk_level label outside the allowed list", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("hsk_level=HSK 4", "hsk_level=HSK4"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wordEntry.hskLevel",
          message: "hsk_level in [BEGIN_WORD] must use an allowed label.",
        }),
      ]),
    );
  });

  it("rejects a meaning that is not exactly one sentence", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "meaning=to share something with others, such as experiences, feelings, ideas, or objects, so that more than one person can benefit or enjoy it together",
        "meaning=To share something with others. It is often used for ideas and experiences.",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wordEntry.meaning",
          message: "meaning in [BEGIN_WORD] must be exactly one sentence.",
        }),
      ]),
    );
  });

  it("rejects a usage_note that is not exactly one sentence", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "usage_note=分享 is commonly used when talking about giving others access to your ideas, experiences, feelings, or things.",
        "usage_note=分享 is commonly used for sharing content. It often appears in learner Mandarin.",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wordEntry.usageNote",
          message: "usage_note in [BEGIN_WORD] must be exactly one sentence.",
        }),
      ]),
    );
  });

  it("rejects a paired_words_note that is not exactly one sentence", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "paired_words_note=Paired words show common expressions built with the target word that help you use it in real conversations.",
        "paired_words_note=Paired words show common expressions built with the target word. They help you use it in real conversations.",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wordEntry.pairedWordsNote",
          message:
            "paired_words_note in [BEGIN_WORD] must be exactly one sentence.",
        }),
      ]),
    );
  });

  it("rejects grammar notes that focus on unrelated supporting phrases", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "1|跟大家|recipient marker|Use when saying who you are sharing something with.|This helps the listener identify the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.",
        "1|跟大家|location phrase|Use when talking about the surrounding group.|This only adds scene information instead of teaching a core 分享 pattern.|跟 + noun phrase|uses 跟 to show the surrounding group|跟大家 only shows the surrounding people in the sentence. It explains the setting around the sentence, not the main usage pattern being studied here. This kind of note is less useful for learning the core word usage.",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[0].grammar[0]",
          message:
            "Grammar in [EXAMPLE_1] must focus on how the target word or pair_text is used, not on unrelated supporting phrases.",
        }),
      ]),
    );
  });

  it("accepts a legacy best-completion response after normalization", () => {
    const parsed = parseWordResponse(LEGACY_PRACTICE_RESPONSE);
    expect(validateWordResponse(parsed).isValid).toBe(true);
  });

  it("rejects duplicate pair indices", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "2|分享快乐|分享+快乐|to share happiness",
        "1|分享快乐|分享+快乐|to share happiness",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "pairs",
          message: "Duplicate pair indices are not allowed.",
        }),
      ]),
    );
  });

  it("rejects pair compositions that do not use plus separators", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "1|分享经验|分享+经验|to share experiences",
        "1|分享经验|分享经验|to share experiences",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "pairs[0].composition",
          message:
            "Pair composition must show how the pair or frame is built using + between parts.",
        }),
      ]),
    );
  });

  it("rejects pair text that is not built directly with the target word", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "1|分享经验|分享+经验|to share experiences",
        "1|交流经验|交流+经验|to exchange experiences",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "pairs[0].text",
          message: "Pair text must be built directly with the target word.",
        }),
      ]),
    );
  });

  it("rejects a word_class label outside the allowed list", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("word_class=verb", "word_class=action verb"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "wordEntry.wordClass",
          message: "word_class in [BEGIN_WORD] must use an allowed label.",
        }),
      ]),
    );
  });

  it("rejects duplicate grammar indices inside one example", () => {
    const parsed = parseWordResponse(
      FOUR_EXAMPLE_RESPONSE.replace(
        "[BEGIN_GRAMMAR]\n1|分享经验|transitive verb|Use when naming the thing being shared directly.|This shows the core object slot that 分享 usually depends on.|分享 + object|uses 分享 with a direct object|In this sentence, 分享 takes 经验 as its object, so 经验 names the content being shared directly. That keeps the sentence centered on the shared experience.\n[END_GRAMMAR]",
        "[BEGIN_GRAMMAR]\n1|分享经验|transitive verb|Use when naming the thing being shared directly.|This shows the core object slot that 分享 usually depends on.|分享 + object|uses 分享 with a direct object|In this sentence, 分享 takes 经验 as its object, so 经验 names the content being shared directly. That keeps the sentence centered on the shared experience.\n1|分享经验|transitive verb|Use when naming the thing being shared directly.|This shows the core object slot that 分享 usually depends on.|分享 + object|uses 分享 with a direct object|Here, 分享 takes 经验 as its object again, so the second row still points to the same sentence content. That explanation is sentence-specific, but the duplicate index is still invalid.\n[END_GRAMMAR]",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[0].grammar",
          message:
            "Duplicate grammar indices inside [EXAMPLE_1] are not allowed.",
        }),
      ]),
    );
  });

  it("rejects more than one grammar row in a single example even when indices differ", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "[BEGIN_GRAMMAR]\n1|跟大家|recipient marker|Use when saying who you are sharing something with.|This helps the listener identify the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.\n[END_GRAMMAR]",
        "[BEGIN_GRAMMAR]\n1|跟大家|recipient marker|Use when saying who you are sharing something with.|This helps the listener identify the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.\n2|分享经验|transitive verb|Use when naming the thing being shared directly.|This shows the core object slot that 分享 usually depends on.|分享 + object|uses 分享 with a direct object|In this sentence, 分享 takes 经验 as its object, so the sentence also names the shared content directly. That keeps the focus on what is being shared in this example.\n[END_GRAMMAR]",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[0].grammar",
          message:
            "Each [EXAMPLE_1] must contain exactly 1 grammar row or NONE.",
        }),
      ]),
    );
  });

  it("rejects a grammar_name label outside the allowed list", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "1|跟大家|recipient marker|Use when saying who you are sharing something with.|This helps the listener identify the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.",
        "1|跟大家|sequence connector|Use when saying who you are sharing something with.|This helps the listener identify the receiver before the shared content appears.|跟 + recipient + 分享 + object|uses 跟 before 分享 to mark the receiver|Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[0].grammar[0].grammarName",
          message: "grammar_name in [EXAMPLE_1] must use an allowed label.",
        }),
      ]),
    );
  });

  it("rejects grammar explanations that are not 2 or 3 sentences", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "Here, the 跟 + recipient + verb + object structure introduces 大家 before 分享, while 经验 stays the content being shared. With 分享, this makes the receiver easy to identify before the action itself. The row stays focused on how 分享 marks the recipient in this sentence.",
        "With 分享, 跟大家 marks the recipient.",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[0].grammar[0].explanation",
          message:
            "Grammar explanation in [EXAMPLE_1] must contain 2 or 3 sentences.",
        }),
      ]),
    );
  });

  it("rejects duplicate token indices inside one example", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        "5|分享经验|fēnxiǎng jīngyàn|to share experiences",
        "4|分享经验|fēnxiǎng jīngyàn|to share experiences",
      ),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[0].tokens",
          message:
            "Duplicate token indices inside [EXAMPLE_1] are not allowed.",
        }),
      ]),
    );
  });

  it("rejects verb example sets that repeat only one grammar pattern", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("recipient marker", "verb-object structure")
        .replace("common object pattern", "verb-object structure")
        .replace("transitive verb", "verb-object structure"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples",
          message:
            "Verb example sets must cover at least 2 distinct target-word usage patterns across grammar notes.",
        }),
      ]),
    );
  });

  it("rejects when pair count and example count do not match", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("3|分享食物|分享+食物|to share food\n", ""),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples",
          message:
            "Pair count and example count must match. Found 2 pairs and 3 examples.",
        }),
      ]),
    );
  });

  it("rejects when pair_text does not match the corresponding pair", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("pair_text=分享快乐", "pair_text=分享照片"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[1].pairText",
          message: "pair_text in [EXAMPLE_2] must match pair 2 text.",
        }),
      ]),
    );
  });

  it("rejects when pair_text does not appear in the sentence", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("我们一起分享快乐。", "我们一起很开心。"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[1].sentence",
          message: "Pair text does not appear in [EXAMPLE_2] sentence.",
        }),
      ]),
    );
  });

  it("rejects when the target word does not appear in the example sentence", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("我们一起分享快乐。", "我们一起很开心。"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples[1].sentence",
          message: "Target word does not appear in [EXAMPLE_2] sentence.",
        }),
      ]),
    );
  });

  it("rejects when there are fewer than three practice questions", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace(
        /\[QUESTION_4\][\s\S]*?\[END_QUESTION_4\]\n/,
        "",
      ).replace(/\[QUESTION_3\][\s\S]*?\[END_QUESTION_3\]\n/, ""),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "practice.questions",
          message: "[BEGIN_PRACTICE] must contain 3 to 5 questions. Found 2.",
        }),
      ]),
    );
  });

  it("rejects when practice does not cover at least three aspects", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("aspect=meaning", "aspect=pinyin")
        .replace("aspect=paired_word", "aspect=pinyin")
        .replace("aspect=word", "aspect=pinyin"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "practice.questions",
          message: "[BEGIN_PRACTICE] must cover at least 3 different aspects.",
        }),
      ]),
    );
  });

  it("rejects an unsupported practice aspect", () => {
    const parsed = parseWordResponse(
      VALID_RESPONSE.replace("aspect=paired_word", "aspect=collocation"),
    );

    expect(validateWordResponse(parsed).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "practice.questions[2].aspect",
          message: "aspect in [QUESTION_3] must use an allowed label.",
        }),
      ]),
    );
  });
});
