// ==================== 提示词管理 ====================
// 所有LLM提示词集中管理，便于维护和修改

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

**Example 1 - Broad Query:**
- Input: "ai"
- Output: "Articles should discuss any aspect of artificial intelligence (AI), including but not limited to: machine learning, deep learning, neural networks, natural language processing, computer vision, AI applications, AI research, AI ethics, AI tools, AI frameworks, and any other AI-related topics. Include articles that mention AI in any meaningful way."

**Example 2 - Specific Query:**
- Input: "AI programming tools"
- Output: "Articles should specifically discuss AI programming tools, such as AI code assistants, AI-powered development environments, AI coding frameworks, AI tools for software development, and similar tools that help programmers write code using AI. EXCLUDE: General AI articles that don't discuss programming tools, general programming articles that don't involve AI, or AI research papers that don't focus on programming tools."

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

export const CLASSIFICATION_INTENT_RECOGNITION_SYSTEM_MESSAGE = `You are a professional classification guidance assistant, skilled at understanding classification standards and generating detailed guidance for article classification. You excel at interpreting classification standards in the context of specific topics and providing clear, actionable guidance. CRITICAL: You must ensure that classifications are ONLY extracted if they are relevant to the topic - unrelated classifications should be ignored even if they appear in articles. IMPORTANT: Always output the classification guidance in English, regardless of the input language. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getClassificationIntentRecognitionPrompt(topicGuidance: string, classificationStandard: string): string {
    return `You are tasked with understanding how to classify articles based on topic guidance (from intent recognition) and a classification standard. Your goal is to generate detailed classification guidance that will help accurately categorize articles.

## Topic Guidance (from Intent Recognition)
${topicGuidance}

## Classification Standard
"${classificationStandard}"

## Task
Analyze the topic guidance and classification standard to understand:
1. What the classification standard means in the context of the topic guidance
2. How to apply the classification standard to articles that match the topic guidance
3. What categories or labels should be used - **ONLY categories that are RELEVANT to the topic**
4. Any specific rules or criteria for classification

**CRITICAL REQUIREMENT: Categories must be RELEVANT to the topic. Only extract classifications that are directly related to the topic guidance. Ignore any classifications that are unrelated to the topic, even if they appear in the article.**

**IMPORTANT: The classification guidance MUST be written in English, regardless of the language of the input.**

## Classification Guidance Requirements

The guidance should:
1. **Interpret the standard**: Explain what the classification standard means in the context of the topic guidance
2. **Define categories**: Identify what categories or labels should be used based on the standard - **ONLY categories relevant to the topic**
3. **Provide criteria**: Specify clear criteria for assigning articles to each category, emphasizing that only topic-relevant classifications should be extracted
4. **Handle edge cases**: Address how to handle articles that might fit multiple categories or none, and explicitly state that unrelated classifications should be ignored

## Topic Relevance Rule

**IMPORTANT**: When applying the classification standard, you must ONLY extract classifications that are relevant to the topic. For example:
- If the topic is about "cameras" and the standard is "classify by product name", you should ONLY extract camera product names (e.g., "Canon EOS R5", "Sony A7", "Nikon D850"). Do NOT extract other product names that appear in the article but are unrelated to cameras (e.g., "iPhone", "Tesla Model 3", "MacBook Pro").
- If the topic is about "AI technology" and the standard is "classify by company name", you should ONLY extract companies that are relevant to AI (e.g., "OpenAI", "Google", "Microsoft"). Do NOT extract companies mentioned in passing that are unrelated to AI.

## Examples

**Example 1:**
- Topic Guidance: "Articles should discuss cameras, including camera reviews, camera technology, camera features, camera comparisons, etc."
- Classification Standard: "classify by product name"
- Output: "Classify articles by camera product names mentioned. ONLY extract camera product names that are relevant to the topic (e.g., 'Canon EOS R5', 'Sony A7 III', 'Nikon D850', 'Fujifilm X-T4'). Do NOT extract other product names that appear in the article but are unrelated to cameras (e.g., smartphones, laptops, cars). Each article should be assigned to the primary camera product discussed. If multiple camera products are mentioned, assign to the most prominent one. Use consistent product names."

**Example 2:**
- Topic Guidance: "Articles should discuss any aspect of artificial intelligence (AI), including but not limited to: machine learning, deep learning, neural networks, natural language processing, computer vision, AI applications, AI research, AI ethics, AI tools, AI frameworks, and any other AI-related topics."
- Classification Standard: "classify by company name"
- Output: "Classify articles by the company or organization mentioned that is relevant to AI. ONLY extract companies that are directly involved in AI (e.g., OpenAI, Google (DeepMind), Microsoft, Anthropic, etc.). Do NOT extract companies mentioned in passing that are unrelated to AI. Each article should be assigned to the primary AI-related company discussed. If multiple AI-related companies are mentioned, assign to the most prominent one. Use consistent company names (e.g., 'Google' not 'Google Inc.' or 'Alphabet')."

**Example 3:**
- Topic Guidance: "Articles should discuss any aspect of healthcare, including medical research, treatments, public health, medical technology, etc."
- Classification Standard: "classify by medical specialty"
- Output: "Classify articles by medical specialty or field. ONLY extract medical specialties that are relevant to the healthcare topic discussed in the article. Do NOT extract unrelated specialties mentioned in passing. Each article should be assigned to the primary medical specialty discussed. If an article covers multiple specialties, assign to the most prominent one. Use standard medical specialty names."

## Output Format
Return a JSON object with the classification guidance:
{
  "classificationGuidance": "detailed guidance text here"
}

**IMPORTANT: The classificationGuidance MUST be written in English.**

The classification guidance should be a clear, detailed description (typically 4-6 sentences) that:
- Explains how to interpret the classification standard in the context of the topic
- Defines what categories to use - emphasizing that ONLY topic-relevant categories should be extracted
- Provides criteria for classification, explicitly stating that unrelated classifications should be ignored
- Handles edge cases, including what to do when unrelated classifications appear in articles
- **All text must be in English**

Return the JSON result:`
}

// ==================== LLM精选 ====================

export const LLM_REFINE_SYSTEM_MESSAGE = `You are a professional article filtering assistant, skilled at judging whether articles match the intent recognition guidance. You carefully follow the inclusion and exclusion criteria specified in the guidance, paying special attention to query granularity (broad vs specific). Return results strictly in JSON format, only return JSON objects, do not include any other text.`

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

**For Broad Queries (general topics):**
- Include articles that discuss ANY aspect related to the topic
- Include articles with passing mentions if they are meaningfully related
- Be inclusive and comprehensive

**For Specific Queries (narrow topics):**
- Include articles ONLY if they match the specific combination of concepts mentioned
- Strictly EXCLUDE articles that discuss broader topics but don't match the specific combination
- Pay close attention to the exclusion criteria stated in the guidance

## Important Rules
1. **Follow the guidance strictly**: The intent recognition guidance above has already determined the appropriate granularity and boundaries. Follow it precisely.
2. **Check inclusion criteria**: An article must meet ALL the inclusion criteria stated in the guidance.
3. **Check exclusion criteria**: For specific queries, if the guidance explicitly states what to EXCLUDE, those articles must be excluded even if they seem related.

## Examples Based on Guidance

**If the guidance says to include "all AI-related topics" (broad query):**
✅ INCLUDE: Any article about AI, machine learning, neural networks, etc.
❌ EXCLUDE: Articles completely unrelated to AI

**If the guidance says to include "AI programming tools" and exclude "general AI articles" (specific query):**
✅ INCLUDE: Articles specifically about AI code assistants, AI development tools, etc.
❌ EXCLUDE: General AI research papers that don't discuss programming tools
❌ EXCLUDE: General programming articles that don't involve AI

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

export const CLASSIFY_ARTICLES_SYSTEM_MESSAGE = `You are a professional article classification assistant, skilled at categorizing articles according to classification standards and guidance. You excel at extracting only topic-relevant classifications and ignoring unrelated classifications. CRITICAL: You must ensure that classifications are ONLY extracted if they are relevant to the topic - unrelated classifications should be ignored even if they appear in articles. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getClassifyArticlesPrompt(
    topicGuidance: string | null,
    classificationGuidance: string | null,
    articlesText: string
): string {
    const topicText = topicGuidance ? `\n## Topic Guidance (from Intent Recognition)\n${topicGuidance}` : ''
    const classificationGuidanceText = classificationGuidance ? `\n\n## Classification Guidance (from Intent Recognition)\n${classificationGuidance}\n\n**IMPORTANT:** Follow the classification guidance above carefully. It provides detailed instructions on how to interpret the classification standard and apply it to articles related to the topic.` : ''

    return `Classify the following articles according to the provided guidance.${topicText}${classificationGuidanceText}

## Task
Assign one or more classification labels to each article based on the classification guidance provided above${topicGuidance ? ' and the topic guidance' : ''}.

**CRITICAL REQUIREMENT: Categories must be RELEVANT to the topic. Only extract classifications that are directly related to the topic. Ignore any classifications that are unrelated to the topic, even if they appear in the article.**

## Classification Rules
1. **Read carefully**: Analyze the title and summary of each article
2. **Follow guidance**: ${classificationGuidance ? 'Strictly follow the classification guidance provided above. It explains how to interpret the classification standard in the context of the topic and specifies what categories to extract.' : (topicGuidance ? 'Classify based on the topic guidance provided above and the main content and subject matter.' : 'Classify based on the main content and subject matter')}
3. **Topic relevance**: ONLY extract classifications that are directly related to the topic. Do NOT extract classifications that are unrelated to the topic, even if they appear in the article
4. **Multiple categories**: An article can belong to multiple categories if it covers multiple topic-relevant aspects (all categories must be topic-relevant)
5. **Category names**: Keep category names concise (max 20 characters) and descriptive
6. **Consistency**: Use consistent category names throughout (e.g., don't mix "Apple" and "Apple Inc.")

## Topic Relevance Rule

**IMPORTANT**: When applying the classification standard, you must ONLY extract classifications that are relevant to the topic. For example:
- If the topic is about "cameras" and the standard is "classify by product name", you should ONLY extract camera product names (e.g., "Canon EOS R5", "Sony A7", "Nikon D850"). Do NOT extract other product names that appear in the article but are unrelated to cameras (e.g., "iPhone", "Tesla Model 3", "MacBook Pro").
- If the topic is about "AI technology" and the standard is "classify by company name", you should ONLY extract companies that are relevant to AI (e.g., "OpenAI", "Google", "Microsoft"). Do NOT extract companies mentioned in passing that are unrelated to AI.

## Examples

**Example 1 - Multiple topic-relevant categories:**
If an article discusses both "Canon EOS R5" and "Sony A7 III" (both camera products, topic-relevant):
  { "articleIndex": 0, "category": "Canon EOS R5" }
  { "articleIndex": 0, "category": "Sony A7 III" }

**Example 2 - Ignore unrelated classifications:**
If an article mentions "Canon EOS R5" (camera, topic-relevant) and "iPhone 15" (smartphone, unrelated to cameras):
  { "articleIndex": 1, "category": "Canon EOS R5" }
  Do NOT create a classification for "iPhone 15" as it is unrelated to the camera topic.

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
- Every article must have at least one classification (if topic-relevant classifications exist)
- Only extract classifications that are relevant to the topic - ignore unrelated classifications
- If an article belongs to multiple topic-relevant categories, create separate records for each
- Use consistent category names (e.g., don't mix "Apple" and "Apple Inc.")
- If no topic-relevant classifications can be found, do not create any classification records for that article

## Articles to Classify
${articlesText}

Return the classification results in JSON format:`
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

**Example 1 - Company Names:**
{
  "standardName": "Apple",
  "synonyms": ["Apple", "Apple Inc.", "Apple Corporation", "AAPL"]
}

**Example 2 - Technology Terms:**
{
  "standardName": "Artificial Intelligence",
  "synonyms": ["AI", "Artificial Intelligence", "Machine Intelligence"]
}

**Example 3 - Standalone Category:**
{
  "standardName": "Healthcare",
  "synonyms": ["Healthcare"]
}

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

Return the synonym grouping results in JSON format:`
}

