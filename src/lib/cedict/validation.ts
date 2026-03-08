import { smoothFallbackTranslation } from "./english-utils";
import { loadCedict } from "./loader";
import { buildExampleBreakdown } from "./index";

export type CedictValidationCase = {
  sentence: string;
  expectedSource?: "exact" | "rule" | "fallback";
  expectedTranslationIncludes: string[];
  expectedTranslationExcludes?: string[];
};

export type EnglishPolishValidationCase = {
  sentence: string;
  input: string;
  expectedTranslationIncludes: string[];
  expectedTranslationExcludes?: string[];
};

export type CedictExploratoryValidationCase = {
  sentence: string;
  cluster:
    | "aspect"
    | "serial-verb"
    | "ba"
    | "bei"
    | "time-place-action"
    | "negation-modal"
    | "question"
    | "possession"
    | "multi-clause"
    | "conversation";
};

export type ExploratoryTranslationQuality =
  | "good"
  | "understandable but awkward"
  | "wrong / broken";

export type CedictExploratoryValidationResult = {
  sentence: string;
  cluster: CedictExploratoryValidationCase["cluster"];
  translation: string;
  translationSource: string;
  quality: ExploratoryTranslationQuality;
  note: string;
};

export const CEDICT_VALIDATION_CASES: CedictValidationCase[] = [
  {
    sentence: "你好吗？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["how are you"],
    expectedTranslationExcludes: ["you good", "you okay", "hello"],
  },
  {
    sentence: "你怎么样？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["how are you"],
    expectedTranslationExcludes: ["you how", "how do you look"],
  },
  {
    sentence: "最近怎么样？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["how have you been lately"],
    expectedTranslationExcludes: ["recently how", "lately how"],
  },
  {
    sentence: "早上好。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["good morning"],
    expectedTranslationExcludes: ["morning is good", "early morning good"],
  },
  {
    sentence: "晚上好。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["good evening"],
    expectedTranslationExcludes: ["night good", "evening is good"],
  },
  {
    sentence: "晚安。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["good night"],
    expectedTranslationExcludes: ["night peaceful", "late peace"],
  },
  {
    sentence: "谢谢。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["thank you"],
    expectedTranslationExcludes: ["thanks", "thankful"],
  },
  {
    sentence: "不客气。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["welcome"],
    expectedTranslationExcludes: ["not polite", "impolite"],
  },
  {
    sentence: "对不起。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["i'm sorry"],
    expectedTranslationExcludes: ["cannot face", "sorry to不起"],
  },
  {
    sentence: "没关系。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["it's okay"],
    expectedTranslationExcludes: ["no relation", "doesn't matter to"],
  },
  {
    sentence: "再见。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["goodbye"],
    expectedTranslationExcludes: ["see again", "again see"],
  },
  { sentence: "我是学生。", expectedTranslationIncludes: ["i am", "student"] },
  { sentence: "他不是老师。", expectedTranslationIncludes: ["he", "teacher"] },
  { sentence: "我在中国。", expectedTranslationIncludes: ["i am", "china"] },
  {
    sentence: "我有一个朋友。",
    expectedTranslationIncludes: ["i have", "friend"],
  },
  { sentence: "你喜欢什么？", expectedTranslationIncludes: ["what", "like"] },
  {
    sentence: "他在哪儿工作？",
    expectedTranslationIncludes: ["where", "work"],
  },
  { sentence: "我把书给他了。", expectedTranslationIncludes: ["gave", "book"] },
  {
    sentence: "他被老师批评了。",
    expectedTranslationIncludes: ["by", "teacher"],
  },
  {
    sentence: "我看得懂。",
    expectedTranslationIncludes: ["read", "understand"],
    expectedTranslationExcludes: ["look understand", "look can", "get"],
  },
  {
    sentence: "我看不懂。",
    expectedTranslationIncludes: ["cannot", "understand", "reading"],
    expectedTranslationExcludes: ["look understand", "look can", "get"],
  },
  { sentence: "今天我很忙。", expectedTranslationIncludes: ["today", "busy"] },
  { sentence: "明天见。", expectedTranslationIncludes: ["tomorrow"] },
  { sentence: "你住在哪里？", expectedTranslationIncludes: ["where", "you"] },
  {
    sentence: "你为什么学中文？",
    expectedTranslationIncludes: ["why", "study"],
  },
  {
    sentence: "你给谁打电话？",
    expectedTranslationIncludes: ["who", "call", "phone"],
    expectedTranslationExcludes: ["for who", "give"],
  },
  {
    sentence: "我在吃饭。",
    expectedTranslationIncludes: ["i am", "eating"],
    expectedTranslationExcludes: ["have a meal", "at eat", "to have"],
  },
  { sentence: "我们比他们忙。", expectedTranslationIncludes: ["more", "than"] },
  {
    sentence: "不要说话。",
    expectedTranslationIncludes: ["do not", "talk"],
    expectedTranslationExcludes: ["you do not", "speak", "don't!"],
  },
  {
    sentence: "他在看书。",
    expectedTranslationIncludes: ["he is", "reading"],
    expectedTranslationExcludes: ["to read", "see book", "at read"],
  },
  {
    sentence: "我们正在学习。",
    expectedTranslationIncludes: ["we are", "studying"],
    expectedTranslationExcludes: ["currently study", "just at"],
  },
  {
    sentence: "我在学校。",
    expectedTranslationIncludes: ["i am", "school"],
    expectedTranslationExcludes: ["studying", "eating"],
  },
  {
    sentence: "你在做什么？",
    expectedTranslationIncludes: ["what", "you", "doing"],
    expectedTranslationExcludes: ["doing what", "at do"],
  },
  {
    sentence: "别说话。",
    expectedTranslationIncludes: ["do not", "talk"],
    expectedTranslationExcludes: ["leave", "speak", "you do not"],
  },
  {
    sentence: "请坐。",
    expectedTranslationIncludes: ["please", "sit"],
    expectedTranslationExcludes: ["ask sit", "request"],
  },
  {
    sentence: "不要吃这个。",
    expectedTranslationIncludes: ["do not", "eat", "this"],
    expectedTranslationExcludes: ["you do not", "don't!"],
  },
  {
    sentence: "别担心。",
    expectedTranslationIncludes: ["do not", "worry"],
    expectedTranslationExcludes: ["leave anxious", "you do not"],
  },
  {
    sentence: "我找不到。",
    expectedTranslationIncludes: ["cannot find"],
    expectedTranslationExcludes: ["look for", "arrive at"],
  },
  {
    sentence: "我听得见。",
    expectedTranslationIncludes: ["can hear"],
    expectedTranslationExcludes: ["listen can", "get"],
  },
  {
    sentence: "我听不见。",
    expectedTranslationIncludes: ["cannot hear"],
    expectedTranslationExcludes: ["listen can", "get"],
  },
  {
    sentence: "我听得懂。",
    expectedTranslationIncludes: ["can", "understand"],
    expectedTranslationExcludes: ["listen can", "get"],
  },
  {
    sentence: "我听不懂。",
    expectedTranslationIncludes: ["cannot", "understand", "when i hear it"],
    expectedTranslationExcludes: ["listen can", "get", "when hearing it"],
  },
  {
    sentence: "我做得到。",
    expectedTranslationIncludes: ["can do it"],
    expectedTranslationExcludes: ["arrive at", "reach", "get"],
  },
  {
    sentence: "我做不到。",
    expectedTranslationIncludes: ["cannot do it"],
    expectedTranslationExcludes: ["arrive at", "reach", "get"],
  },
  {
    sentence: "他找得到。",
    expectedTranslationIncludes: ["can find it"],
    expectedTranslationExcludes: ["look for", "arrive at"],
  },
  {
    sentence: "他找不到。",
    expectedTranslationIncludes: ["cannot find it"],
    expectedTranslationExcludes: ["look for", "arrive at"],
  },
  {
    sentence: "我来得及。",
    expectedTranslationIncludes: ["can make it in time"],
    expectedTranslationExcludes: ["come in time", "arrive at"],
  },
  {
    sentence: "我来不及了。",
    expectedTranslationIncludes: ["too late"],
    expectedTranslationExcludes: ["come in time", "arrive at"],
  },
  {
    sentence: "现在还来得及。",
    expectedTranslationIncludes: ["still time"],
    expectedTranslationExcludes: ["come in time", "arrive at"],
  },
  {
    sentence: "现在来不及了。",
    expectedTranslationIncludes: ["too late"],
    expectedTranslationExcludes: ["come in time", "arrive at"],
  },
  {
    sentence: "他给我写信。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["he", "write", "me", "letter"],
    expectedTranslationExcludes: ["for me write", "give me write", "to me"],
  },
  { sentence: "她很高兴。", expectedTranslationIncludes: ["happy"] },
  { sentence: "我没有时间。", expectedTranslationIncludes: ["have", "time"] },
  {
    sentence: "你会不会说中文",
    expectedSource: "rule",
    expectedTranslationIncludes: ["can", "you", "speak", "chinese"],
    expectedTranslationExcludes: ["can or cannot", "persuade", "classifier"],
  },
  {
    sentence: "你是不是学生",
    expectedSource: "rule",
    expectedTranslationIncludes: ["are", "you", "student"],
    expectedTranslationExcludes: ["is or isn't", "classifier"],
  },
  {
    sentence: "你有没有时间",
    expectedSource: "rule",
    expectedTranslationIncludes: ["do", "you", "have", "time"],
    expectedTranslationExcludes: ["haven't", "classifier"],
  },
  {
    sentence: "你去不去",
    expectedSource: "rule",
    expectedTranslationIncludes: ["you", "go"],
    expectedTranslationExcludes: ["negative prefix", "classifier"],
  },
  {
    sentence: "这是我的",
    expectedSource: "rule",
    expectedTranslationIncludes: ["this", "mine"],
    expectedTranslationExcludes: ["of", "classifier"],
  },
  {
    sentence: "这是谁的书",
    expectedSource: "rule",
    expectedTranslationIncludes: ["whose", "book", "this"],
    expectedTranslationExcludes: ["who book", "classifier"],
  },
  {
    sentence: "这本书是谁的",
    expectedSource: "rule",
    expectedTranslationIncludes: ["whose", "book", "this"],
    expectedTranslationExcludes: ["classifier"],
  },
  {
    sentence: "这是不是你的书",
    expectedSource: "rule",
    expectedTranslationIncludes: ["is", "this", "your", "book"],
    expectedTranslationExcludes: ["is or isn't", "classifier"],
  },
  {
    sentence: "一个人",
    expectedSource: "rule",
    expectedTranslationIncludes: ["person"],
    expectedTranslationExcludes: ["by oneself", "classifier", "measure word"],
  },
  {
    sentence: "三本书",
    expectedSource: "rule",
    expectedTranslationIncludes: ["three", "books"],
    expectedTranslationExcludes: [
      "classifier",
      "measure word",
      "three is book",
    ],
  },
  {
    sentence: "我给你一本书",
    expectedSource: "rule",
    expectedTranslationIncludes: ["give", "you", "book"],
    expectedTranslationExcludes: ["give you book", "give to you", "classifier"],
  },
  {
    sentence: "他给我做饭",
    expectedSource: "rule",
    expectedTranslationIncludes: ["cook", "for me"],
    expectedTranslationExcludes: ["give", "prepare a meal to", "for me cook"],
  },
  {
    sentence: "他被老师批评了",
    expectedSource: "rule",
    expectedTranslationIncludes: ["was", "criticized", "teacher"],
    expectedTranslationExcludes: [
      "quilt",
      "to criticize",
      "by teacher criticize",
    ],
  },
  {
    sentence: "我被他骗了",
    expectedSource: "rule",
    expectedTranslationIncludes: ["was", "deceived", "him"],
    expectedTranslationExcludes: ["quilt", "cheat", "by him cheat"],
  },
  {
    sentence: "门被打开了",
    expectedSource: "rule",
    expectedTranslationIncludes: ["door", "was", "opened"],
    expectedTranslationExcludes: ["quilt", "gate is", "to open"],
  },
  {
    sentence: "他被公司开除了",
    expectedSource: "rule",
    expectedTranslationIncludes: ["was", "fired", "company"],
    expectedTranslationExcludes: ["quilt", "expel", "by company fire"],
  },
  {
    sentence: "他说得很好。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["speaks", "very well"],
    expectedTranslationExcludes: ["(much, good etc)", "very good"],
  },
  {
    sentence: "我做得很好。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["do", "very well"],
    expectedTranslationExcludes: ["(much, good etc)", "very good"],
  },
  {
    sentence: "她写得很好。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["writes", "very well"],
    expectedTranslationExcludes: ["(much, good etc)", "very good"],
  },
  {
    sentence: "如果你有时间，我们一起去",
    expectedSource: "rule",
    expectedTranslationIncludes: ["if you have time", "we", "go together"],
    expectedTranslationExcludes: ["if you have time we have", "literal"],
  },
  {
    sentence: "这是我昨天买的书",
    expectedSource: "rule",
    expectedTranslationIncludes: ["this is", "book", "i bought yesterday"],
    expectedTranslationExcludes: ["i yesterday bought book", "literal"],
  },
  {
    sentence: "我先去洗澡，再睡觉",
    expectedSource: "rule",
    expectedTranslationIncludes: ["first", "then", "sleep"],
    expectedTranslationExcludes: ["one side", "literal"],
  },
  {
    sentence: "他一边听音乐一边学习",
    expectedSource: "rule",
    expectedTranslationIncludes: ["while", "music", "studi"],
    expectedTranslationExcludes: ["one side", "literal"],
  },
  {
    sentence: "这个问题我还没想好",
    expectedSource: "rule",
    expectedTranslationIncludes: ["i", "still", "figured out", "question"],
    expectedTranslationExcludes: ["question i", "literal"],
  },
  {
    sentence: "今天太晚了，来不及了",
    expectedSource: "rule",
    expectedTranslationIncludes: ["too late today", "enough time"],
    expectedTranslationExcludes: ["come in time", "literal"],
  },
  {
    sentence: "如果下雨，我就不去了",
    expectedSource: "rule",
    expectedTranslationIncludes: ["if it rains", "i will not go"],
    expectedTranslationExcludes: ["if rain", "literal"],
  },
  {
    sentence: "这是他给我的照片",
    expectedSource: "rule",
    expectedTranslationIncludes: ["this is", "photo", "he gave me"],
    expectedTranslationExcludes: ["he give me photo", "literal"],
  },
  {
    sentence: "你为什么不去？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["why don't you go"],
    expectedTranslationExcludes: ["are you why", "to go"],
  },
  {
    sentence: "我去过北京。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["have been to beijing"],
    expectedTranslationExcludes: ["dang", "people's republic"],
  },
  {
    sentence: "门开着。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["door", "is open"],
    expectedTranslationExcludes: ["opening"],
  },
  {
    sentence: "你能不能帮我一下？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["can you", "help me"],
    expectedTranslationExcludes: ["cannot", "give it a go"],
  },
  {
    sentence: "我没有看过这本书。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["have not read", "this book"],
    expectedTranslationExcludes: ["look after", "readed"],
  },
  {
    sentence: "书被他放在桌子上了。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["book", "put on the table", "by him"],
    expectedTranslationExcludes: ["puted", "at table on top"],
  },
  {
    sentence: "如果明天下雨，我们就不去了。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["if it rains tomorrow", "will not go"],
    expectedTranslationExcludes: ["if rain tomorrow"],
  },
  {
    sentence: "你要不要跟我们一起去？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["want to go with us"],
    expectedTranslationExcludes: ["heel", "don't!"],
  },
  {
    sentence: "我没有去过北京。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["have not been to beijing"],
    expectedTranslationExcludes: ["people's republic", "do not have to go"],
  },
  {
    sentence: "我没听过这个说法。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["have not heard", "expression"],
    expectedTranslationExcludes: ["buddhist", "heared"],
  },
  {
    sentence: "你帮我看一下这个。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["help me", "take a look", "this"],
    expectedTranslationExcludes: ["give it a go", "look after"],
  },
  {
    sentence: "你等我一下。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["wait for me", "moment"],
    expectedTranslationExcludes: ["give it a go", "wait for i"],
  },
  {
    sentence: "我想一下再回答你。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["think for a moment", "answer you"],
    expectedTranslationExcludes: ["want give it a go"],
  },
  {
    sentence: "你跟我们一起去吗？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["go with us"],
    expectedTranslationExcludes: ["heel"],
  },
  {
    sentence: "他跟我一起回家了。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["went home with me"],
    expectedTranslationExcludes: ["heel", "return home"],
  },
  {
    sentence: "我想跟你聊一聊。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["want to chat with you"],
    expectedTranslationExcludes: ["heel", "one to chat"],
  },
  {
    sentence: "你要不要先休息一下？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["want to rest"],
    expectedTranslationExcludes: ["don't!", "give it a go"],
  },
  {
    sentence: "他能不能明天来？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["can he come tomorrow"],
    expectedTranslationExcludes: ["cannot tomorrow to come"],
  },
  {
    sentence: "这是我朋友昨天送给我的礼物。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["gift", "my friend gave me yesterday"],
    expectedTranslationExcludes: ["i friend", "to send my gift"],
  },
  {
    sentence: "如果你不想去，就告诉我。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["if you do not want to go", "tell me"],
    expectedTranslationExcludes: ["press charges i", "unexpectedly"],
  },
  {
    sentence: "这个字我不会写。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["cannot write", "character"],
    expectedTranslationExcludes: ["improbable", "letter"],
  },
  {
    sentence: "这句话我听不懂。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["cannot understand", "sentence", "when i hear it"],
    expectedTranslationExcludes: ["dialect", "hearing this sentence"],
  },
  {
    sentence: "这个问题我还没弄明白。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["still", "have not figured out", "question"],
    expectedTranslationExcludes: ["drowned", "how to do something"],
  },
  {
    sentence: "你吃了吗？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["have you eaten"],
    expectedTranslationExcludes: ["do you eat"],
  },
  {
    sentence: "他把门关上了。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["closed the door"],
    expectedTranslationExcludes: ["goalkeeper", "closed door"],
  },
  {
    sentence: "这本书是他昨天买的。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["this is the book he bought yesterday"],
    expectedTranslationExcludes: ["he yesterday to buy"],
  },
  {
    sentence: "那是我小时候住过的地方。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["that is the place where i lived when i was a child"],
    expectedTranslationExcludes: ["of course", "region before"],
  },
  {
    sentence: "他说得很快，但是我听得懂。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["speaks very quickly", "i can understand it"],
    expectedTranslationExcludes: ["me to understand", "when he hears it"],
  },
  {
    sentence: "如果你有空的话，我们明天一起去吧。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["if you are free", "let's go together tomorrow"],
    expectedTranslationExcludes: ["bar", "in the same place"],
  },
  {
    sentence: "我洗完澡就睡觉。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["go to sleep after taking a shower"],
    expectedTranslationExcludes: ["wash to finish bath"],
  },
  {
    sentence: "他一到家就开始做饭。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["as soon as he gets home", "starts cooking"],
    expectedTranslationExcludes: ["perfect", "prepare a meal"],
  },
  {
    sentence: "这件衣服我穿不上。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["cannot put", "clothing", "on"],
    expectedTranslationExcludes: ["wear on top"],
  },
  {
    sentence: "这个箱子太重了，我搬不动。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["too heavy", "cannot move it"],
    expectedTranslationExcludes: ["motionless", "repeat"],
  },
  {
    sentence: "你要不要我帮你一下？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["want me to help you"],
    expectedTranslationExcludes: ["don't! me", "give it a go"],
  },
  {
    sentence: "我还没决定要不要去。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["still have not decided whether to go"],
    expectedTranslationExcludes: ["want or not", "drowned"],
  },
  {
    sentence: "你知不知道他住在哪里？",
    expectedSource: "rule",
    expectedTranslationIncludes: ["do you know where he lives"],
    expectedTranslationExcludes: ["know not know", "him live"],
  },
  {
    sentence: "这是我第一次来中国。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["my first time coming to china"],
    expectedTranslationExcludes: ["this is i the first time"],
  },
  {
    sentence: "我本来想去，但是后来没去了。",
    expectedSource: "rule",
    expectedTranslationIncludes: ["originally wanted to go", "later i did not go"],
    expectedTranslationExcludes: ["afterwards drowned", "original to think"],
  },
];

export const ENGLISH_POLISH_VALIDATION_CASES: EnglishPolishValidationCase[] = [
  {
    sentence: "[fallback] me is student",
    input: "me is student",
    expectedTranslationIncludes: ["i am a student"],
    expectedTranslationExcludes: ["me is", "i is"],
  },
  {
    sentence: "[fallback] this is my one",
    input: "this is my one",
    expectedTranslationIncludes: ["this is mine"],
    expectedTranslationExcludes: ["my one"],
  },
];

export const CEDICT_EXPLORATORY_VALIDATION_CASES: CedictExploratoryValidationCase[] =
  [
    { sentence: "我昨天去了学校。", cluster: "aspect" },
    { sentence: "我去过北京。", cluster: "aspect" },
    { sentence: "门开着。", cluster: "aspect" },
    { sentence: "他把门打开了。", cluster: "ba" },
    { sentence: "我想去买东西。", cluster: "serial-verb" },
    { sentence: "你能不能帮我一下？", cluster: "negation-modal" },
    { sentence: "他昨天在家看书。", cluster: "time-place-action" },
    { sentence: "我没有看过这本书。", cluster: "aspect" },
    { sentence: "你为什么不去？", cluster: "negation-modal" },
    { sentence: "如果你有时间，我们一起去。", cluster: "multi-clause" },
    { sentence: "这个老师说得很快。", cluster: "aspect" },
    { sentence: "我给他看了那张照片。", cluster: "serial-verb" },
    { sentence: "书被他放在桌子上了。", cluster: "bei" },
    { sentence: "这是我昨天买的书。", cluster: "possession" },
    { sentence: "你吃了吗？", cluster: "conversation" },
    { sentence: "我先去洗澡，再睡觉。", cluster: "multi-clause" },
    { sentence: "他一边听音乐一边学习。", cluster: "multi-clause" },
    { sentence: "你要不要跟我们一起去？", cluster: "conversation" },
    { sentence: "这个问题我还没想好。", cluster: "serial-verb" },
    { sentence: "今天太晚了，来不及了。", cluster: "multi-clause" },
  ];

function classifyExploratoryTranslation(
  sentence: string,
  translation: string,
  translationSource: string,
): {
  quality: ExploratoryTranslationQuality;
  note: string;
} {
  switch (sentence) {
    case "我昨天去了学校。":
      return {
        quality: "good",
        note: "Past time + motion sentence reads naturally enough to promote once it stays stable.",
      };
    case "我去过北京。":
      return {
        quality: "wrong / broken",
        note: "Experiential aspect with 过 falls through to a broken fallback gloss here.",
      };
    case "门开着。":
      return {
        quality: "wrong / broken",
        note: "Durative-state sentence with 着 is not handled as a natural stative clause.",
      };
    case "他把门打开了。":
      return {
        quality: "wrong / broken",
        note: "This 把 + resultative sentence currently misparses badly despite looking like a high-value target.",
      };
    case "我想去买东西。":
      return {
        quality: "understandable but awkward",
        note: "Serial-verb chaining is usually readable but still stiff in English infinitive sequencing.",
      };
    case "你能不能帮我一下？":
      return {
        quality: "wrong / broken",
        note: "Negation + modal + benefactive helper question currently produces a malformed English question.",
      };
    case "他昨天在家看书。":
      return {
        quality: "understandable but awkward",
        note: "Time + place + action stacking often lands in readable but clunky English word order.",
      };
    case "我没有看过这本书。":
      return {
        quality: "wrong / broken",
        note: "Negation plus experiential aspect currently collapses into the wrong verb sense.",
      };
    case "你为什么不去？":
      return {
        quality: "wrong / broken",
        note: "Why-question with negation is currently malformed rather than merely stiff.",
      };
    case "如果你有时间，我们一起去。":
      return {
        quality: "wrong / broken",
        note: "Conditional two-clause sentence falls outside the current single-clause rule system.",
      };
    case "这个老师说得很快。":
      return {
        quality: "understandable but awkward",
        note: "Degree complement with speed adverb is readable but still a little stiff.",
      };
    case "我给他看了那张照片。":
      return {
        quality: "good",
        note: "Show/give pattern with a longer object comes out naturally and is worth promoting.",
      };
    case "书被他放在桌子上了。":
      return {
        quality: "wrong / broken",
        note: "Passive plus placement complement exceeds current passive handling.",
      };
    case "这是我昨天买的书。":
      return {
        quality: "wrong / broken",
        note: "Relative-clause possession is not modeled by the current rule layer.",
      };
    case "你吃了吗？":
      return {
        quality: "understandable but awkward",
        note: "The sentence is understandable, but the perfective conversational reading is flatter than natural English.",
      };
    case "我先去洗澡，再睡觉。":
      return {
        quality: "wrong / broken",
        note: "Sequenced two-clause actions are outside the current single-clause routing.",
      };
    case "他一边听音乐一边学习。":
      return {
        quality: "wrong / broken",
        note: "Concurrent-clause pattern with 一边...一边... is not covered.",
      };
    case "你要不要跟我们一起去？":
      return {
        quality: "wrong / broken",
        note: "Longer A-not-A invitation question currently breaks on the companion phrase.",
      };
    case "这个问题我还没想好。":
      return {
        quality: "wrong / broken",
        note: "Fronted object plus resultative complement reveals a missing narrow pattern.",
      };
    case "今天太晚了，来不及了。":
      return {
        quality: "wrong / broken",
        note: "Multi-clause time-pressure sentence exposes the current clause-combination limit.",
      };
    default:
      return {
        quality:
          translationSource === "rule"
            ? "understandable but awkward"
            : "wrong / broken",
        note: "Exploratory case requires manual review.",
      };
  }
}

export async function runCedictValidation(): Promise<
  Array<{
    sentence: string;
    translation: string;
    translationSource: string;
    passed: boolean;
  }>
> {
  const index = await loadCedict();

  const cedictResults = CEDICT_VALIDATION_CASES.map((testCase) => {
    const result = buildExampleBreakdown(testCase.sentence, index);
    const lowerTranslation = result.translation.toLowerCase();
    const passedIncludes = testCase.expectedTranslationIncludes.every(
      (fragment) => lowerTranslation.includes(fragment),
    );
    const passedExcludes = (testCase.expectedTranslationExcludes || []).every(
      (fragment) => !lowerTranslation.includes(fragment),
    );
    const passedSource =
      !testCase.expectedSource ||
      result.translationSource === testCase.expectedSource;

    return {
      sentence: testCase.sentence,
      translation: result.translation,
      translationSource: result.translationSource,
      passed: passedIncludes && passedExcludes && passedSource,
    };
  });

  const englishPolishResults = ENGLISH_POLISH_VALIDATION_CASES.map(
    (testCase) => {
      const translation = smoothFallbackTranslation(testCase.input);
      const lowerTranslation = translation.toLowerCase();
      const passedIncludes = testCase.expectedTranslationIncludes.every(
        (fragment) => lowerTranslation.includes(fragment),
      );
      const passedExcludes = (testCase.expectedTranslationExcludes || []).every(
        (fragment) => !lowerTranslation.includes(fragment),
      );

      return {
        sentence: testCase.sentence,
        translation,
        translationSource: "fallback",
        passed: passedIncludes && passedExcludes,
      };
    },
  );

  return [...cedictResults, ...englishPolishResults];
}

export async function runCedictExploratoryValidation(): Promise<
  CedictExploratoryValidationResult[]
> {
  const index = await loadCedict();

  return CEDICT_EXPLORATORY_VALIDATION_CASES.map((testCase) => {
    const result = buildExampleBreakdown(testCase.sentence, index);
    const classification = classifyExploratoryTranslation(
      testCase.sentence,
      result.translation,
      result.translationSource,
    );

    return {
      sentence: testCase.sentence,
      cluster: testCase.cluster,
      translation: result.translation,
      translationSource: result.translationSource,
      quality: classification.quality,
      note: classification.note,
    };
  });
}
