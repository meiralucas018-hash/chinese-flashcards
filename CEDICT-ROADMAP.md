# CEDICT Roadmap

Current status: iteration 60 is the last fixed roadmap iteration. After that, work continues as a failure-driven backlog.

- Done: Iterations 0-60
- Done: Failure-driven batches 61-70
- In progress: Failure-driven batches 71-73

Notes:

- This file is the canonical roadmap for CEDICT rule-engine work.
- Iterations 0-60 were the planned grammar and infrastructure passes.
- Everything after 60 is a rolling backlog ordered by expected yield for real-sentence translation quality.
- "Near perfect" here means "very high quality on common non-idiomatic Chinese sentences", not a literal guarantee of zero bad translations in unrestricted Chinese.

## Iterations

0. Done: baseline audit of segmentation, clause modeling, missing grammar families, aspect, particles, noun phrases, sense disambiguation, reranking, and test gaps.
1. Done: add correlative rules for 不但/不仅…而且…, 既然…就…, 即使…也…, 除非….
2. Done: add 让 causatives and fronted 为了… purpose clauses.
3. Done: add first coverb pass for 从, 向/往/朝, 离.
4. Done: add 关于/对于, chained 为了让…, and segmentation fixes for 不知道 and 这件事.
5. Done: add 一旦…(就)… with subject inheritance.
6. Done: add fronted comparison 比起….
7. Done: add 越来越… and compact same-subject 越…越….
8. Done: add perspective topic 对/对于…来说.
9. Done: extend 越…越… to split-clause cases.
10. Done: stabilize split-clause adjective rendering and add missing adjective mapping 简单 -> simple.
11. Done: implement 越…越不… and map natural cases to the more..., the less....
12. Done: implement 越…越没… and support 没有, 没办法, 没意思, 没信心, and similar loss patterns.
13. Done: implement 越来越不….
14. Done: implement 越来越没….
15. Done: extend additive correlatives to 不但/不仅…还….
16. Done: extend additive correlatives to 不但/不仅…也….
17. Done: make 哪怕…也… a dedicated rule.
18. Done: add concessive variants 即便…也…, 就算…也…, 就算是…也….
19. Done: add 再…也… for emphatic impossibility and limit statements.
20. Done: add universal-condition correlatives 无论…都… and 不管…都….
21. Done: add paired coordination 既…又… for adjectives and verbs.
22. Done: improve 一边…一边… with same-subject and explicit-second-subject handling.
23. Done: improve 先…再… with cleaner subject inheritance and tense smoothing.
24. Done: add 一…就… immediate-trigger constructions.
25. Done: add 一…也不… emphatic negation.
26. Done: add 连…都/也… focus-sensitive emphasis.
27. Done: add 只要…就… sufficient-condition handling.
28. Done: improve 如果/要是…就… with explicit vs inherited result subjects.
29. Done: add 要不是… counterfactual and cause-denial patterns.
30. Done: add explicit 否则/不然/要不然 consequence chaining.
31. Done: extend 为了 + coverb chains such as 为了给他买书… and 为了跟他见面….
32. Done: add 为了不… negative purpose clauses.
33. Done: deepen 关于/对于…来说 with noun, pronoun, and abstract-topic viewpoint phrasing.
34. Done: add 从…到… ranges for time, place, quantity, and state change.
35. Done: add 离…还有… remaining-time and remaining-distance constructions.
36. Done: extend 向/往/朝 to caused motion and transfer verbs.
37. Done: disambiguate 跟/和/同 across comitative, coordination, and comparison.
38. Done: disambiguate 给 across recipient, benefactive, and colloquial verbal marking.
39. Done: add 对 as target and attitude marker, not just 对于.
40. Done: deepen 把 with result-state, direction-chain, and disposal semantics.
41. Done: deepen 被 with omitted agents and result-state emphasis.
42. Done: unify 让/叫/使 causative families.
43. Done: improve active/passive reranking so 把/被 alternatives surface more naturally.
44. Done: add 是…的 past-focus constructions.
45. Done: add 是为了… explanatory-focus constructions.
46. Done: distinguish sentence-final 了 as change-of-state vs completion.
47. Done: add 快…了 imminence constructions.
48. Done: model 就 vs 才 nuance and scope.
49. Done: improve multi-marker aspect handling for 了/过/着.
50. Done: stop discarding sentence particles 吧/呢/啊/呀/啦; preserve tone and discourse meaning.
51. Done: improve person-name and named-entity segmentation.
52. Done: expand longer multiword-expression detection beyond current phrase biasing.
53. Done: add more lexicalized idioms and fixed-expression translations.
54. Done: improve dates, times, percentages, numbers, ranges, and counters.
55. Done: improve classifier phrase handling inside larger noun phrases.
56. Done: improve 的 attachment and relative-clause scope.
57. Done: improve omitted-subject recovery across neighboring clauses.
58. Done: add lexical sense disambiguation for frequent polysemous verbs and adjectives.
59. Done: improve reranking across competing rule outputs, especially when multiple rules partially fit.
60. Done: expand the benchmark suite for long clauses, dialogue, ellipsis, topic chains, pro-drop, and ambiguity stress cases.

## After Iteration 60

Use a failure-driven loop:

1. Mine bad outputs from real sentences.
2. Cluster by grammar family, segmentation failure, lexical ambiguity, or reranking failure.
3. Patch the smallest high-yield class first.
4. Add regression probes before moving on.

## Failure-Driven Batches

Completed batches:

61. Done: contrastive correction and identity framing.
    Scope: `不是…而是…`, `不是A，是B`, possessive identity corrections, and not-all / partial-negation patterns such as `不是所有…都…`.
62. Done: exception / exclusion framing.
    Scope: `除了…都…`, `除了…以外…`, `别的都…`, and exception phrases fronted as concessions like `除了贵一点…`.
63. Done: alternative-choice and diagnostic dialogue questions.
    Scope: `还是` alternative questions, `怎么了`, `怎么回事`, and other compact conversational prompts that should not fall back to literal glosses.
64. Done: minimizer and scalar negation.
    Scope: `一点儿也不…`, `一点儿都不…`, `连…也/都没…`, and similar scope-sensitive negative emphasis.
65. Done: resultative lexical gaps inside `把/被` pipelines.
    Scope: common result compounds such as `打碎`, `难住`, `听清`, `看清`, `说清楚`, and chained result-direction combinations that were leaking literal glosses.
66. Done: concessive-discourse and stance correction frames.
    Scope: `不是我不…，是我真的…`, `说是这么说…`, `说起来/说来话长`-adjacent discourse lead-ins, and related "not that X, it's that Y" variants.
67. Done: generalized focus-emphasis with lexicalized tails.
    Scope: `连…都不知道`, `连…也没听懂`, `连…都没看一眼`, and related focus-emphasis clauses where the tail predicate needed natural English lexicalization.
68. Done: colloquial time-state sentences.
    Scope: sentences like `他刚才还在这里`, `刚到`, `还在`, and similar current-state or just-now frames.
69. Done: stronger fronted-topic object realization.
    Scope: topic-fronted objects like `书我看完了` that were structurally right but still needed better article and object realization.
70. Done: dialogue-reply and refusal shaping.
    Scope: compact refusals, explanations, and reply-style clauses where the rule path existed but still produced stiff or low-English-likelihood output.

Remaining iterations:

71. In progress: broader discourse-correction families.
    Scope: `不是说…`, `倒不是…`, `也不是…就是…`, `不是A不B，而是…`, and adjacent contrastive explanation frames that still sit between lexicalized reply logic and generic clause translation.
72. In progress: current-state and temporal nuance cleanup.
    Scope: `刚才/刚刚/一直/还在/已经` combinations, especially when English tense choice should be past-state, current relevance, or continuing state instead of literal adverb stacking.
73. In progress: focus-emphasis expansion beyond the current lexical tails.
    Scope: more `连…都/也…` predicates such as perception, cognition, and resultative complements where the engine still produces structurally correct but low-naturalness English.
74. Next: pro-drop dialogue repair and short replies.
    Scope: compact answers, refusals, confirmations, conversational repairs, and reply-only clauses where omitted subjects still push the engine toward stiff literal output.
75. Next: topic chains, omitted arguments, and discourse continuity.
    Scope: multi-clause topic chains, omitted objects, and context-carried participants that are grammatical in Chinese but still underdetermined for a rule engine without stronger discourse modeling.
76. Next: serial-verb and control-verb sequencing.
    Scope: `想去买`, `拿来给我看`, `回去再说`, `帮我去问`, and longer action chains where English infinitive vs finite sequencing is still unstable.
77. Next: coverb and preposition refinement.
    Scope: `给/跟/对/朝/往/从/离/向/为` combinations, especially when recipient, direction, source, comparison, or benefactive roles compete.
78. Next: aspect-stack cleanup.
    Scope: `了/过/着/正在/一直/已经/就/才` interactions, including current relevance, recent completion, continuing state, and event-sequence readings.
79. Next: sentence-final particle tone shaping.
    Scope: broader `吧/呢/啊/呀/啦/嘛` handling where the propositional content is already right but the English tone still sounds wrong or too flat.
80. Next: broader `把/被/让` event templates.
    Scope: more disposal, passive, causative, and caused-result chains beyond the current high-frequency lexicalized set.
81. Next: comparison and preference family expansion.
    Scope: `比起…`, `与其…不如…`, `宁可…也不…`, `越…越…`, `更/最/还要`, and mixed comparison-preference sentences that still need tighter English structure.
82. Next: quantified scope and partial-negation expansion.
    Scope: `未必`, `不见得`, `不一定`, `不是每个…都…`, `没有人不…`, and other scope-sensitive negation patterns outside the already-fixed not-all cases.
83. Next: wh-ellipsis and fragment-question handling.
    Scope: compact fragments such as `然后呢`, `那怎么办`, `为什么不呢`, `怎么说呢`, and context-dependent short questions that currently fall back too literally.
84. Next: answer-shaping for yes-no and A-not-A dialogues.
    Scope: short replies like `行`, `不行`, `可以吧`, `算了吧`, `我看也是`, and partial-echo answers that need natural conversational English.
85. Next: deeper `的`-modifier and relative-clause attachment.
    Scope: longer nested modifiers, eventive relatives, and possessive-relative ambiguity that still produces wrong noun attachment or article choice.
86. Next: topic-comment and left-dislocation expansion.
    Scope: fronted topics with resumptive subjects or omitted links, including `这个问题，我觉得…`, `书呢，我看完了`, and split contrastive topics.
87. Next: complement system expansion.
    Scope: potential complements, directional complements, degree complements, and result complements outside the currently lexicalized families.
88. Next: event sequencing and temporal linker cleanup.
    Scope: `以后/之前/的时候/后来/然后/先…再…/一…就…` combinations where clause order is recognized but English sequencing is still stiff.
89. Next: copular, stative, and evaluative predicate polish.
    Scope: adjective-like predicates, evaluative statements, and `是…的` edge cases where the engine still sounds lexical rather than native.
90. Next: noun-phrase naturalness and article policy.
    Scope: definiteness, countability, bare singulars, generic plurals, and measured noun phrases that are structurally correct but still unnatural in English.
91. Next: high-frequency lexical sense disambiguation.
    Scope: frequent polysemous verbs and light verbs such as `想`, `看`, `打`, `开`, `上`, `下`, `过`, `出`, `起来`, `下来`, and `意思`.
92. Next: omitted recipient, agent, and experiencer recovery.
    Scope: clauses where Chinese omits a participant that English strongly prefers to realize, especially in speech, benefactive, and experiencer constructions.
93. Next: discourse connector normalization.
    Scope: `不过`, `而已`, `反正`, `结果`, `其实`, `毕竟`, `顺便`, `再说`, `不过话说回来`, and adjacent discourse markers that need idiomatic English bridging.
94. Next: modality and speaker-stance expansion.
    Scope: `应该`, `大概`, `恐怕`, `未免`, `何必`, `至于`, `难怪`, `怪不得`, and other epistemic or rhetorical stance markers outside the current fixed replies.
95. Next: continuation-state and interrupted-plan templates.
    Scope: `本来…后来…`, `正要…就…`, `差一点就…`, `还没来得及…`, and near-event / interrupted-event patterns beyond the current handled set.
96. Next: reranking and naturalness scoring upgrades.
    Scope: improve selection when multiple rules partially match, so the engine prefers natural English clause shapes over literal but structurally valid outputs.
97. Next: larger stress harness and adversarial probes.
    Scope: extend the probe corpus with denser multi-clause sentences, dialogue fragments, omitted-argument cases, and deliberate ambiguity clusters to mine the next failures faster.
98. Next: fallback output shaping.
    Scope: make non-rule outputs less damaging by smoothing literal gloss order, article choice, verb support, and punctuation when no strong structured rule exists.
99. Next: discourse-memory-lite heuristics.
    Scope: limited carry-over of subject, topic, and omitted object within short neighboring clauses without introducing full document-level state.
100. Next: hard-tail documentation and unresolved class tracking.
    Scope: maintain an explicit list of remaining non-idiom failure classes that are unlikely to disappear with local rule patches alone, so "near perfect" is measured against a visible backlog instead of intuition.

## Working Rule

1. Prefer one regression cluster that kills many bad outputs over one-off sentence patches.
2. Promote exact-match lexicalization only for genuinely fixed expressions or dialogue replies.
3. Treat "perfect translation for any Chinese sentence" as out of reach for a pure rule engine; use this loop to raise floor quality and keep failure classes explicit.
