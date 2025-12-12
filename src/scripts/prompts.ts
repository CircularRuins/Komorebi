// ==================== 提示词管理 ====================
// 所有LLM提示词集中管理，便于维护和修改

// ==================== 公共常量 ====================

// ==================== 提示词例子 ====================
// 所有提示词中的例子集中管理，方便修改和维护

export const PROMPT_EXAMPLES = {
    // 主题意图识别例子
    topicIntentRecognition: {
        example1: {
            title: "Example 1 - Broad Query:",
            input: "ai",
            output: "Articles should discuss any aspect of artificial intelligence (AI), including but not limited to: machine learning, deep learning, neural networks, natural language processing, computer vision, AI applications, AI research, AI ethics, AI tools, AI frameworks, and any other AI-related topics. Include articles that mention AI in any meaningful way."
        },
        example2: {
            title: "Example 2 - Specific Query:",
            input: "AI programming tools",
            output: "Articles should specifically discuss AI programming tools, such as AI code assistants, AI-powered development environments, AI coding frameworks, AI tools for software development, and similar tools that help programmers write code using AI. EXCLUDE: General AI articles that don't discuss programming tools, general programming articles that don't involve AI, or AI research papers that don't focus on programming tools."
        },
        example3: {
            title: "Example 3 - Specific Query:",
            input: "chinese ai industry",
            output: "Articles should specifically discuss the Chinese AI industry, including Chinese AI companies, AI development in China, Chinese AI policies and regulations, Chinese AI market trends, Chinese AI research and innovation, and the Chinese AI ecosystem. EXCLUDE: General AI articles that don't focus on China or the Chinese market, AI articles about other countries or regions, or general technology articles about China that don't specifically discuss AI."
        },
        example4: {
            title: "Example 4 - Specific Query:",
            input: "autonomous vehicle safety",
            output: "Articles should specifically discuss safety aspects of autonomous vehicles, including autonomous vehicle safety testing, safety regulations for self-driving cars, safety technologies in autonomous vehicles, safety incidents and analysis, and safety standards for autonomous driving systems. EXCLUDE: General autonomous vehicle articles that don't focus on safety, general transportation safety articles that don't discuss autonomous vehicles, or articles about vehicle safety that don't specifically address autonomous vehicles."
        },
        example5: {
            title: "Example 5 - Specific Query:",
            input: "quantum computing applications in finance",
            output: "Articles should specifically discuss applications of quantum computing in the finance industry, such as quantum algorithms for financial modeling, quantum computing for risk analysis, quantum computing for portfolio optimization, and quantum computing solutions for financial services. EXCLUDE: General quantum computing articles that don't discuss finance applications, general finance technology articles that don't involve quantum computing, quantum computing research that doesn't focus on finance, or finance articles that only mention quantum computing in passing."
        }
    },

    // 分类标准意图识别例子
    classificationIntentRecognition: {
        example1: {
            title: "Example 1:",
            topicGuidance: "Articles should discuss cameras, including camera reviews, camera technology, camera features, camera comparisons, etc.",
            classificationStandard: "classify by product name",
            output: "Classify articles by camera product names mentioned. ONLY extract camera product names that are relevant to the topic (e.g., 'Canon EOS R5', 'Sony A7 III', 'Nikon D850', 'Fujifilm X-T4'). Do NOT extract other product names that appear in the article but are unrelated to cameras (e.g., smartphones, laptops, cars). Each article should be assigned to the primary camera product discussed. If multiple camera products are mentioned, assign to the most prominent one. Use consistent product names."
        },
        example2: {
            title: "Example 2:",
            topicGuidance: "Articles should discuss any aspect of artificial intelligence (AI), including but not limited to: machine learning, deep learning, neural networks, natural language processing, computer vision, AI applications, AI research, AI ethics, AI tools, AI frameworks, and any other AI-related topics.",
            classificationStandard: "classify by company name",
            output: "Classify articles by the company or organization mentioned that is relevant to AI. ONLY extract companies that are directly involved in AI (e.g., OpenAI, Google (DeepMind), Microsoft, Anthropic, etc.). Do NOT extract companies mentioned in passing that are unrelated to AI. Each article should be assigned to the primary AI-related company discussed. If multiple AI-related companies are mentioned, assign to the most prominent one. Use consistent company names (e.g., 'Google' not 'Google Inc.' or 'Alphabet')."
        },
        example3: {
            title: "Example 3:",
            topicGuidance: "Articles should discuss any aspect of healthcare, including medical research, treatments, public health, medical technology, etc.",
            classificationStandard: "classify by medical specialty",
            output: "Classify articles by medical specialty or field. ONLY extract medical specialties that are relevant to the healthcare topic discussed in the article. Do NOT extract unrelated specialties mentioned in passing. Each article should be assigned to the primary medical specialty discussed. If an article covers multiple specialties, assign to the most prominent one. Use standard medical specialty names."
        }
    },

    // LLM精选例子
    llmRefine: {
        broadQuery: {
            title: "If the guidance says to include \"all AI-related topics\" (broad query):",
            include: [
                "Articles primarily about AI, machine learning, neural networks, etc.",
                "Articles that provide important insights about AI applications, AI research findings, or significant AI developments"
            ],
            exclude: [
                "Articles completely unrelated to AI",
                "Articles that only mention AI in passing (e.g., \"the company also uses AI\" without further discussion)",
                "Articles where AI is only tangentially mentioned without providing substantial information"
            ]
        },
        specificQuery: {
            title: "If the guidance says to include \"AI programming tools\" and exclude \"general AI articles\" (specific query):",
            include: [
                "Articles specifically about AI code assistants, AI development tools, etc. with substantial content",
                "Articles that provide important information about AI programming tools (reviews, comparisons, tutorials, etc.)"
            ],
            exclude: [
                "General AI research papers that don't discuss programming tools",
                "General programming articles that don't involve AI",
                "Articles that only briefly mention AI programming tools without substantial discussion"
            ]
        }
    },

    // 文章分类例子
    classifyArticles: {
        example1: {
            title: "Example 1 - Multiple topic-relevant categories:",
            description: "If an article discusses multiple topic-relevant items (e.g., both \"Canon EOS R5\" and \"Sony A7 III\" for a camera topic):",
            output: [
                "{ \"articleIndex\": 0, \"category\": \"Canon EOS R5\" }",
                "{ \"articleIndex\": 0, \"category\": \"Sony A7 III\" }"
            ]
        },
        example2: {
            title: "Example 2 - Ignore unrelated classifications:",
            description: "If an article mentions both topic-relevant and unrelated items (e.g., \"Canon EOS R5\" and \"iPhone 15\" for a camera topic):",
            output: [
                "{ \"articleIndex\": 1, \"category\": \"Canon EOS R5\" }",
                "Do NOT create a classification for \"iPhone 15\" as it is unrelated to the topic."
            ]
        }
    },

    // 分类去重例子
    classificationDeduplication: {
        example1: {
            title: "Example 1 - Company Names:",
            output: {
                standardName: "Apple",
                synonyms: ["Apple", "Apple Inc.", "Apple Corporation", "AAPL"]
            }
        },
        example2: {
            title: "Example 2 - Technology Terms:",
            output: {
                standardName: "Artificial Intelligence",
                synonyms: ["AI", "Artificial Intelligence", "Machine Intelligence"]
            }
        },
        example3: {
            title: "Example 3 - Standalone Category:",
            output: {
                standardName: "Healthcare",
                synonyms: ["Healthcare"]
            }
        }
    }
}

// 格式化例子的辅助函数
function formatTopicIntentRecognitionExamples(): string {
    const examples = PROMPT_EXAMPLES.topicIntentRecognition
    return `**${examples.example1.title}**
- Input: "${examples.example1.input}"
- Output: "${examples.example1.output}"

**${examples.example2.title}**
- Input: "${examples.example2.input}"
- Output: "${examples.example2.output}"

**${examples.example3.title}**
- Input: "${examples.example3.input}"
- Output: "${examples.example3.output}"

**${examples.example4.title}**
- Input: "${examples.example4.input}"
- Output: "${examples.example4.output}"

**${examples.example5.title}**
- Input: "${examples.example5.input}"
- Output: "${examples.example5.output}"`
}

function formatClassificationIntentRecognitionExamples(): string {
    const ex1 = PROMPT_EXAMPLES.classificationIntentRecognition.example1
    const ex2 = PROMPT_EXAMPLES.classificationIntentRecognition.example2
    const ex3 = PROMPT_EXAMPLES.classificationIntentRecognition.example3
    return `**${ex1.title}**
- Topic: "${ex1.topicGuidance}"
- Classification Standard: "${ex1.classificationStandard}"
- Output: "${ex1.output}"

**${ex2.title}**
- Topic: "${ex2.topicGuidance}"
- Classification Standard: "${ex2.classificationStandard}"
- Output: "${ex2.output}"

**${ex3.title}**
- Topic: "${ex3.topicGuidance}"
- Classification Standard: "${ex3.classificationStandard}"
- Output: "${ex3.output}"`
}

function formatLLMRefineExamples(): string {
    const broad = PROMPT_EXAMPLES.llmRefine.broadQuery
    const specific = PROMPT_EXAMPLES.llmRefine.specificQuery
    return `**${broad.title}**
${broad.include.map(item => `✅ INCLUDE: ${item}`).join('\n')}
${broad.exclude.map(item => `❌ EXCLUDE: ${item}`).join('\n')}

**${specific.title}**
${specific.include.map(item => `✅ INCLUDE: ${item}`).join('\n')}
${specific.exclude.map(item => `❌ EXCLUDE: ${item}`).join('\n')}`
}

function formatClassifyArticlesExamples(): string {
    const ex1 = PROMPT_EXAMPLES.classifyArticles.example1
    const ex2 = PROMPT_EXAMPLES.classifyArticles.example2
    return `**${ex1.title}**
${ex1.description}
${ex1.output.map(line => `  ${line}`).join('\n')}

**${ex2.title}**
${ex2.description}
${ex2.output.map(line => `  ${line}`).join('\n')}`
}

function formatClassificationDeduplicationExamples(): string {
    const ex1 = PROMPT_EXAMPLES.classificationDeduplication.example1
    const ex2 = PROMPT_EXAMPLES.classificationDeduplication.example2
    const ex3 = PROMPT_EXAMPLES.classificationDeduplication.example3
    return `**${ex1.title}**
${JSON.stringify(ex1.output, null, 2)}

**${ex2.title}**
${JSON.stringify(ex2.output, null, 2)}

**${ex3.title}**
${JSON.stringify(ex3.output, null, 2)}`
}

// ==================== 公共常量 ====================
// 注意：不再使用公共常量来避免冗余
// 如果某个提示词的结果已经包含了要求，后续提示词就不需要重复

// ==================== 主题意图识别 ====================

export const TOPIC_INTENT_RECOGNITION_SYSTEM_MESSAGE = `You are a professional intent recognition assistant, skilled at analyzing user intent and determining query granularity (specificity level) to rewrite queries into detailed guidance for article filtering. You excel at distinguishing between broad queries (that should match all related topics) and specific queries (that should only match the exact combination of concepts). IMPORTANT: Always output the rewritten guidance in English, regardless of the input language. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getTopicIntentRecognitionPrompt(topic: string): string {
    return `You are tasked with recognizing the user's intent from their topic query and rewriting it into a more detailed and comprehensive guidance for article filtering. The key is to identify the user's intent and determine the granularity (specificity level) of the query.

## User's Original Topic
"${topic}"

## Task
Analyze the user's query to determine its granularity level, then rewrite it into detailed guidance for article filtering.

**IMPORTANT: The rewritten guidance MUST be written in English, regardless of the language of the user's original query.**

### Step 1: Determine Query Granularity
First, assess how specific or broad the user's query is:

**Broad/General Query Examples:**
- "ai" → Should match ALL articles related to AI (any aspect of artificial intelligence)
- "technology" → Should match ALL technology-related articles
- "health" → Should match ALL health-related articles

**Specific/Narrow Query Examples:**
- "AI programming tools" → Should ONLY match articles about AI programming tools, NOT general AI articles that don't discuss programming tools
- "machine learning algorithms" → Should ONLY match articles about ML algorithms, NOT general ML articles that don't discuss algorithms
- "medical AI applications" → Should ONLY match articles about medical AI applications, NOT general AI or general medical articles
- "reinforcement learning in medical AI applications" → Should ONLY match articles about reinforcement learning in medical AI applications, NOT general AI or general medical articles, NOT general reinforcement learning articles that don't discuss medical AI applications

### Step 2: Rewrite Based on Granularity

**For Broad Queries:**
- Expand to include all related aspects, synonyms, and variations
- Include all sub-topics and related concepts
- The guidance should be inclusive and comprehensive

**For Specific Queries:**
- Focus ONLY on the specific combination of concepts mentioned
- Clearly define what should be INCLUDED
- Clearly define what should be EXCLUDED (broader topics that don't match the specific combination)
- Be precise about the boundaries

### Step 3: Create Detailed Guidance

The rewritten guidance should:
1. Identify the granularity level (broad or specific)
2. List key concepts and terms that should be included
3. For specific queries, explicitly state what should be EXCLUDED
4. Provide clear criteria for matching articles

## Examples

${formatTopicIntentRecognitionExamples()}

## Output Format
Return a JSON object with the rewritten query:
{
  "rewrittenQuery": "detailed guidance text here"
}

**IMPORTANT: The rewrittenQuery MUST be written in English.**

The rewritten query should be a clear, detailed description (typically 2-4 sentences) that:
- States the granularity level
- Defines what should be INCLUDED
- For specific queries, explicitly states what should be EXCLUDED
- Provides clear matching criteria
- **All text must be in English**

Return the JSON result:`
}

// ==================== 分类标准意图识别 ====================

export const CLASSIFICATION_INTENT_RECOGNITION_SYSTEM_MESSAGE = `You are a professional classification guidance assistant, skilled at understanding classification standards and generating detailed guidance for article classification. You excel at interpreting classification standards in the context of specific topics and providing clear, actionable guidance. IMPORTANT: Always output the classification guidance in English, regardless of the input language. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getClassificationIntentRecognitionPrompt(topic: string, classificationStandard: string): string {
    return `You are tasked with understanding how to classify articles based on topic and a classification standard. Your goal is to generate detailed classification guidance that will help accurately categorize articles.

## Topic
${topic}

## Classification Standard
"${classificationStandard}"

## Task
Analyze the topic and classification standard together to understand the user's intent:
1. **What type of classification is required**: Determine the exact type of entities/items that should be used as classifications based on the standard (e.g., product names, company names, countries, medical specialties, technologies, etc.)
2. **Strict type matching**: The classification standard defines a specific type - classifications MUST be of that type and nothing else
3. **Understand the relationship between topic and classification**: The topic and classification standard work together - you need to understand how to extract classifications of the specified type that relate to the topic context
4. **Contextual relevance**: Extract classifications of the correct type when they appear in the context of the topic, even if the classification type itself doesn't directly relate to the topic

**IMPORTANT: The classification guidance MUST be written in English, regardless of the language of the input.**

## Critical Requirements

### 1. Define the Classification Type Explicitly

**CRITICAL**: The classification standard specifies a TYPE of classification. You must:
- Identify the exact type of entities/items that should be used as classifications
- Explicitly state what type of classifications are required (e.g., "product names", "company names", "countries", "medical specialties", "technologies", etc.)
- Make it clear that classifications MUST be of this type and ONLY this type

**Examples of type definitions:**
- If standard is "classify by product name" → Classifications MUST be product names (e.g., "iPhone 15", "Canon EOS R5"). NOT company names, NOT technologies, NOT features - ONLY product names.
- If standard is "classify by company name" → Classifications MUST be company names (e.g., "Apple", "Google", "Microsoft"). NOT product names, NOT technologies, NOT people - ONLY company names.
- If standard is "classify by country" → Classifications MUST be country names (e.g., "China", "United States", "Japan"). NOT cities, NOT companies, NOT technologies - ONLY countries.
- If standard is "classify by medical specialty" → Classifications MUST be medical specialties (e.g., "Cardiology", "Oncology", "Pediatrics"). NOT diseases, NOT treatments, NOT hospitals - ONLY medical specialties.

### 2. Strict Type Enforcement

The guidance MUST explicitly state:
- **What IS a valid classification**: Only entities/items of the specified type
- **What is NOT a valid classification**: Any other type of entities/items, even if they appear in the article
- **Type mismatch examples**: Provide clear examples of what should NOT be classified (e.g., if standard is "product names", then company names, technologies, or features mentioned in the article are NOT valid classifications)

### 3. Understanding Topic-Classification Relationship

**CRITICAL**: You must understand how the topic and classification standard work together:

- The classification standard defines **WHAT TYPE** of entities to extract (e.g., countries, companies, products)
- The topic defines **THE CONTEXT** in which these entities should be extracted
- You need to extract entities of the specified type when they appear in relation to the topic, even if the type itself doesn't directly relate to the topic

**Examples:**
- Topic: "人工智能产业" (AI industry), Standard: "按国家分类" (classify by country)
  - **Understanding**: User wants to classify AI industry articles by country (e.g., "China", "United States", "Japan")
  - **Extraction rule**: Extract country names when they appear in the context of AI industry discussions
  - **Valid classifications**: Countries mentioned in relation to AI industry (e.g., "China" for Chinese AI industry, "United States" for US AI industry)
  - **NOT valid**: Countries mentioned in completely unrelated contexts (e.g., a country mentioned in a weather report within the same article)

- Topic: "相机" (cameras), Standard: "按产品名称分类" (classify by product name)
  - **Understanding**: User wants to classify camera articles by camera product names
  - **Extraction rule**: Extract camera product names (e.g., "Canon EOS R5", "Sony A7 III")
  - **Valid classifications**: Camera product names mentioned in the article
  - **NOT valid**: Other product names unrelated to cameras (e.g., "iPhone", "MacBook" mentioned in passing)

- Topic: "AI技术" (AI technology), Standard: "按公司名称分类" (classify by company name)
  - **Understanding**: User wants to classify AI technology articles by company names
  - **Extraction rule**: Extract company names when they appear in the context of AI technology
  - **Valid classifications**: Companies mentioned in relation to AI technology (e.g., "OpenAI", "Google", "Microsoft")
  - **NOT valid**: Companies mentioned in completely unrelated contexts

## Classification Guidance Requirements

The guidance should:
1. **Define the classification type**: Explicitly state what type of entities/items should be used as classifications (e.g., "product names", "company names", "countries", etc.)
2. **Enforce type strictness**: Clearly state that classifications MUST be of the specified type and nothing else
3. **Explain topic-classification relationship**: Explain how to extract classifications of the specified type in the context of the topic - when entities of the correct type appear in relation to the topic, they should be extracted
4. **Provide contextual examples**: Give examples of valid classifications (correct type + contextually related to topic) and invalid classifications (wrong type or completely unrelated context)
5. **Handle edge cases**: Address how to handle articles that might fit multiple categories or none, and explicitly state that type mismatches should be ignored

**Example structure for the guidance:**
- "Classify articles by [TYPE] (e.g., product names, company names, countries, etc.). Classifications MUST be [TYPE] and nothing else. Extract [TYPE] when they appear in the context of [topic description]. For example, valid classifications are [examples of correct type in topic context]. Do NOT extract [examples of wrong types] even if they appear in the article. Do NOT extract [TYPE] that appear in completely unrelated contexts within the article."

## Examples

${formatClassificationIntentRecognitionExamples()}

## Output Format
Return a JSON object with the classification guidance:
{
  "classificationGuidance": "detailed guidance text here"
}

**IMPORTANT: The classificationGuidance MUST be written in English.**

The classification guidance should be a clear, detailed description (typically 5-8 sentences) that:
1. **Explicitly defines the classification type**: States what type of entities/items should be used as classifications (e.g., "product names", "company names", "countries", "medical specialties", etc.)
2. **Enforces type strictness**: Clearly states that classifications MUST be of the specified type and nothing else, with examples of what is valid and what is invalid
3. **Explains topic-classification relationship**: Explains how to extract classifications of the specified type in the context of the topic - when entities of the correct type appear in relation to the topic, extract them; when they appear in completely unrelated contexts, ignore them
4. **Provides contextual examples**: Includes examples of valid classifications (correct type + contextually related to topic) and invalid classifications (wrong type or completely unrelated context)
5. **Handles edge cases**: Addresses how to handle articles with multiple valid classifications or no valid classifications
6. **All text must be in English**

**Critical**: The guidance MUST:
- Make it crystal clear what type of classifications are required and what types are NOT allowed
- Explain how to determine if a classification of the correct type should be extracted based on its relationship to the topic context
- Provide clear examples showing when to extract (correct type + topic context) and when not to extract (wrong type or unrelated context)

Return the JSON result:`
}

// ==================== LLM初筛 ====================

export const LLM_PRELIMINARY_FILTER_SYSTEM_MESSAGE = `You are a professional article title filtering assistant, skilled at quickly judging whether article titles match the intent recognition guidance. You only filter out articles whose titles are clearly unrelated to the topic. For articles whose titles match the topic or are uncertain, you should keep them for further detailed analysis. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getLLMPreliminaryFilterPrompt(intentGuidance: string, titlesText: string): string {
    return `You are tasked with preliminarily filtering articles based on their titles only. This is a quick filtering step to remove articles whose titles are clearly unrelated to the topic.

## Intent Recognition Guidance
${intentGuidance}

## Task
Analyze each article title and determine if it should be kept for further detailed analysis. You should:
- **KEEP** articles whose titles match the topic or are related to the topic
- **KEEP** articles whose titles are uncertain or ambiguous (when in doubt, keep it)
- **FILTER OUT** only articles whose titles are clearly and obviously unrelated to the topic

## Decision Criteria

**CRITICAL: Conservative Filtering**
- This is a preliminary filter based on titles only - be conservative
- Only filter out titles that are **clearly and obviously** unrelated to the topic
- When in doubt, keep the article for further analysis
- Remember: titles may not fully represent article content, so err on the side of keeping articles

**For Broad Queries (general topics):**
- Keep articles whose titles mention any aspect related to the topic
- Only filter out titles that are completely unrelated to the topic

**For Specific Queries (narrow topics):**
- Keep articles whose titles mention the specific combination of concepts
- Keep articles whose titles are ambiguous or could potentially relate to the topic
- Only filter out titles that are clearly about different topics

## Important Rules
1. **Conservative approach**: When uncertain, always keep the article
2. **Title-only analysis**: You only see titles, not content - be lenient
3. **Clear filtering**: Only filter out titles that are obviously unrelated
4. **Follow the guidance**: Use the intent recognition guidance to understand what should be included

## Output Format
Return a JSON object with the indices (0-based) of articles whose titles should be kept (not filtered out):
{
  "relatedArticleIndices": [0, 2, 5, 7]
}

If all titles should be kept, return all indices. If some titles are clearly unrelated, exclude their indices.

## Article Titles to Analyze
${titlesText}

Return the JSON result:`
}

// ==================== LLM精选 ====================

export const LLM_REFINE_SYSTEM_MESSAGE = `You are a professional article filtering assistant, skilled at judging whether articles match the intent recognition guidance with high relevance. You carefully follow the inclusion and exclusion criteria specified in the guidance, paying special attention to query granularity (broad vs specific). You only select articles that have high relevance to the topic or provide important information related to the topic. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getLLMRefinePrompt(intentGuidance: string, articlesText: string): string {
    return `You are tasked with filtering articles based on the following intent recognition guidance. This guidance has been carefully crafted to identify the user's intent and determine the query granularity (specificity level).

## Intent Recognition Guidance
${intentGuidance}

## Task
Analyze each article and determine if it matches the criteria specified in the intent recognition guidance above. The guidance has already identified:
1. The granularity level (broad or specific query)
2. What should be INCLUDED
3. What should be EXCLUDED (for specific queries)

## Decision Criteria

**CRITICAL: High Relevance Requirement**
- Only include articles that have **high relevance** to the topic or provide **important information** related to the topic
- Exclude articles that only have passing mentions or superficial references without substantial content
- An article should either: (1) be primarily about the topic, or (2) provide significant insights, analysis, or important information related to the topic

**For Broad Queries (general topics):**
- Include articles that **substantially discuss** aspects related to the topic (not just passing mentions)
- Include articles that provide **important information** about the topic, even if the topic is not the primary focus
- **EXCLUDE** articles that only mention the topic in passing without providing meaningful content or insights
- **EXCLUDE** articles where the topic is only tangentially related without substantial relevance

**For Specific Queries (narrow topics):**
- Include articles ONLY if they match the specific combination of concepts mentioned **with high relevance**
- Strictly EXCLUDE articles that discuss broader topics but don't match the specific combination
- Pay close attention to the exclusion criteria stated in the guidance
- **EXCLUDE** articles that only superficially touch on the specific topic without providing substantial information

## Important Rules
1. **Follow the guidance strictly**: The intent recognition guidance above has already determined the appropriate granularity and boundaries. Follow it precisely.
2. **Check inclusion criteria**: An article must meet ALL the inclusion criteria stated in the guidance.
3. **Check exclusion criteria**: For specific queries, if the guidance explicitly states what to EXCLUDE, those articles must be excluded even if they seem related.
4. **High relevance standard**: Only select articles that have substantial relevance to the topic. Reject articles that only have superficial mentions or tangential connections.
5. **Important information test**: If an article is not primarily about the topic, it must provide important, valuable, or significant information related to the topic to be included.

## Examples Based on Guidance

${formatLLMRefineExamples()}

## Output Format
Return a JSON object with the indices (0-based) of articles that meet the criteria:
{
  "relatedArticleIndices": [0, 2, 5, 7]
}

If all articles match the guidance, return all indices. If none do, return an empty array.

## Articles to Analyze
${articlesText}

Return the JSON result:`
}

// ==================== 文章分类 ====================

export const CLASSIFY_ARTICLES_SYSTEM_MESSAGE = `You are a professional article classification assistant, skilled at categorizing articles according to classification standards and guidance. You excel at extracting only topic-relevant classifications and ignoring unrelated classifications. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getClassifyArticlesPrompt(
    classificationGuidance: string,
    articlesText: string
): string {
    return `You are tasked with classifying articles according to the classification guidance provided below. You must strictly follow the guidance and only extract classifications that match the criteria specified in the guidance.

## Classification Guidance
${classificationGuidance}

## Critical Requirements

**CRITICAL: You must understand and strictly follow the classification guidance above.**

1. **Understand the classification standard**: The guidance above defines:
   - What type of classifications to extract (e.g., product names, company names, medical specialties, etc.)
   - What criteria must be met for a classification to be valid
   - What should be INCLUDED and what should be EXCLUDED

2. **Only extract what the guidance requires**: 
   - ONLY extract classifications that match the type and criteria specified in the guidance
   - Do NOT extract classifications that don't match the guidance's requirements
   - Do NOT create your own classification categories - only use what the guidance explicitly allows

3. **Strict adherence to inclusion/exclusion rules**:
   - If the guidance says "ONLY extract X", then ONLY extract X - nothing else
   - If the guidance says "Do NOT extract Y", then do NOT extract Y under any circumstances
   - If the guidance provides examples of what to include/exclude, follow those examples strictly

4. **When to classify**:
   - Only create classifications for articles that contain items matching the guidance's criteria
   - If an article doesn't contain any items that match the guidance, do NOT create any classification for that article
   - Do NOT force classifications - if there's no match, leave the article unclassified

## Classification Process

For each article:
1. **Read the classification guidance carefully** - understand what type of classifications to extract
2. **Analyze the article** - look for items in the title and summary that match the guidance's criteria
3. **Check against guidance** - verify that any potential classification matches the guidance's requirements
4. **Extract only valid classifications** - only create classifications for items that strictly match the guidance
5. **Ignore unrelated items** - if an article mentions items that don't match the guidance, ignore them completely

## Classification Rules

1. **Strict adherence**: Follow the classification guidance exactly as written - do not interpret it loosely
2. **Type matching**: Only extract classifications of the type specified in the guidance (e.g., if guidance says "product names", only extract product names, not company names or other types)
3. **Relevance check**: Only extract classifications that are relevant according to the guidance's criteria
4. **Multiple categories**: If an article contains multiple items that match the guidance, create separate classification records for each
5. **Category names**: Use the exact names as they appear in the article or use consistent standard names (max 20 characters)
6. **Consistency**: Use consistent category names throughout (e.g., don't mix "Apple" and "Apple Inc.")

## Examples

${formatClassifyArticlesExamples()}

## Output Format

Return a JSON array with classification records. Each record contains:
- articleIndex: The article's position in the list (0-based)
- category: The classification label (string, max 20 characters)

Format:
{
  "classifications": [
    { "articleIndex": 0, "category": "Category Name 1" },
    { "articleIndex": 0, "category": "Category Name 2" },
    { "articleIndex": 1, "category": "Category Name 1" }
  ]
}

**Important:**
- Only create classifications for items that strictly match the classification guidance
- If an article doesn't contain any items matching the guidance, do NOT create any classification for that article
- Do NOT extract classifications that don't match the guidance's type or criteria
- If an article belongs to multiple categories that match the guidance, create separate records for each
- Use consistent category names (e.g., don't mix "Apple" and "Apple Inc.")

## Articles to Classify
${articlesText}

Return the JSON result:`
}

// ==================== 分类去重 ====================

export const CLASSIFICATION_DEDUPLICATION_SYSTEM_MESSAGE = `You are a professional text analysis assistant, skilled at identifying synonyms. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getClassificationDeduplicationPrompt(uniqueCategories: string[]): string {
    const categoryList = uniqueCategories.map((cat, idx) => `${idx}. ${cat}`).join('\n')

    return `Identify synonyms and duplicate category names, then merge them into standardized groups.

## Category Names to Process
${categoryList}

## Task
Group category names that refer to the same entity or concept, and select a standard name for each group.

## Identification Rules

### 1. Exact Duplicates
Categories that are identical (case-insensitive):
- "Apple" and "apple" → Same group
- "Google" and "Google" → Same group

### 2. Synonyms and Variations
Categories that refer to the same entity:
- **Company names**: "Apple", "Apple Inc.", "Apple Corporation" → Same group
- **Abbreviations**: "AI", "Artificial Intelligence" → Same group
- **Common variations**: "Machine Learning", "ML", "machine learning" → Same group
- **Cross-language**: Categories in different languages referring to the same concept should be grouped together

### 3. Standard Name Selection
Choose the standard name using these criteria (in order):
1. Most commonly used variant in the list
2. Most formal/official name (e.g., "Apple Inc." over "Apple")
3. Shortest clear name if equally common
4. English name if cross-language synonyms exist

## Examples

${formatClassificationDeduplicationExamples()}

## Output Format
Return a JSON object with synonym groups:
{
  "synonymGroups": [
    {
      "standardName": "Apple",
      "synonyms": ["Apple", "Apple Inc.", "Apple Corporation"]
    },
    {
      "standardName": "Google",
      "synonyms": ["Google", "Google Inc.", "Alphabet"]
    },
    {
      "standardName": "Healthcare",
      "synonyms": ["Healthcare"]
    }
  ]
}

## Important Notes
- Every category name must appear in exactly one group
- If a category has no synonyms, it forms a single-item group
- The synonyms array must include standardName itself
- Handle cross-language synonyms appropriately (group them together)
- Be consistent: if "Apple" and "Apple Inc." are synonyms, always group them

Return the JSON result:`
}

// ==================== HyDE (Hypothetical Document Embeddings) ====================

export const HYDE_SYSTEM_MESSAGE = `You are a professional RSS article generation assistant, skilled at creating hypothetical RSS feed articles based on topics. Your task is to generate a realistic RSS article (with title and snippet) that would be relevant to the given topic. The generated article should mimic the format and style of real RSS feed articles, with a headline-style title and a news-style snippet/summary. The generated article should be comprehensive enough to serve as a good representation for semantic search in a RAG system. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getHyDEPrompt(topic: string): string {
    return `You are tasked with generating a hypothetical RSS article based on the following topic. This hypothetical article will be used for semantic search and vectorization in a RAG (Retrieval-Augmented Generation) system, so it should mimic the format and style of real RSS feed articles.

## Topic
"${topic}"

## Task
Generate a hypothetical RSS article that would be relevant to this topic. The article should mimic the format of real RSS feed articles, which typically include:
1. A clear and descriptive title (similar to news article headlines)
2. A snippet/summary that provides a concise overview of the article content (typically 100-300 words)

## RSS Article Format Requirements
The generated article should:
- **Title**: Be written like a real RSS article headline - concise, informative, and attention-grabbing
- **Snippet**: Be written like a real RSS article summary/abstract - it should:
  * Provide a clear overview of the topic
  * Include key information and main points
  * Be written in a news/article style (not overly technical or academic)
  * Be comprehensive enough for semantic search (typically 100-300 words)
  * Mimic the style of real RSS feed summaries

## Output Format
Return a JSON object with the hypothetical RSS article:
{
  "title": "Article title here (RSS headline style)",
  "snippet": "Article snippet/summary here (RSS summary style, 100-300 words)"
}

**IMPORTANT: The title and snippet MUST be written in English, regardless of the language of the input topic.**

The snippet should be written like a real RSS article summary that:
- Introduces the topic clearly
- Explains key concepts and main points
- Provides relevant details and context
- Covers important aspects of the topic
- Is written in a natural, news/article style (similar to RSS feed summaries)

Return the JSON result:`
}

