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
            output: "Articles should discuss any aspect of artificial intelligence (AI), including but not limited to: machine learning, deep learning, neural networks, natural language processing, computer vision, AI applications, AI research, AI ethics, AI tools, AI frameworks, AI companies, AI industry news, and any other AI-related topics. Include articles that discuss AI in any meaningful way."
        },
        example2: {
            title: "Example 2 - Specific Query:",
            input: "AI programming tools",
            output: "Articles should specifically discuss AI programming tools, such as AI code assistants (e.g., GitHub Copilot, Cursor, Codeium), AI-powered development environments, AI coding frameworks, AI tools for software development, and similar tools that help programmers write code using AI. EXCLUDE: General AI articles that don't discuss programming tools, AI research papers that don't focus on programming tools, or articles about AI in other domains that don't relate to programming tools."
        },
        example3: {
            title: "Example 3 - Specific Query:",
            input: "chinese ai industry",
            output: "Articles should specifically discuss the Chinese AI industry, including Chinese AI companies (e.g., Baidu, Alibaba, Tencent, SenseTime), AI development in China, Chinese AI policies and regulations, Chinese AI market trends, Chinese AI research and innovation, and the Chinese AI ecosystem. EXCLUDE: General AI articles that don't focus on China or the Chinese market, AI articles about other countries or regions, or AI articles that only mention China in passing without substantial focus on the Chinese AI industry."
        },
        example4: {
            title: "Example 4 - Specific Query:",
            input: "large language models",
            output: "Articles should specifically discuss large language models (LLMs), including LLM architectures, LLM training methods, LLM applications, LLM companies and products (e.g., GPT, Claude, Llama), LLM research, LLM capabilities and limitations, and LLM-related technologies. EXCLUDE: General AI articles that don't specifically discuss large language models, articles about other types of AI models (e.g., computer vision models, reinforcement learning) that don't relate to language models, or articles that only briefly mention LLMs without substantial discussion."
        },
        example5: {
            title: "Example 5 - Specific Query:",
            input: "AI safety and alignment",
            output: "Articles should specifically discuss AI safety and alignment, including AI alignment research, AI safety concerns, AI risk mitigation, AI governance and regulation related to safety, AI ethics focused on safety, and technical approaches to making AI systems safe and aligned with human values. EXCLUDE: General AI articles that don't focus on safety or alignment, articles about AI applications that don't discuss safety concerns, or articles about AI ethics that don't specifically address safety or alignment issues."
        }
    },

    // LLM精选例子
    llmRefine: {
        broadQuery: {
            title: "If the guidance says to include \"all AI-related topics\" (broad query):",
            include: [
                "Articles primarily about AI, machine learning, neural networks, etc. with substantial content",
                "Articles that provide important insights about AI applications, AI research findings, or significant AI developments"
            ],
            exclude: [
                "Articles that only mention the topic in passing without providing meaningful content or insights",
                "Articles where the topic is only tangentially related without substantial relevance"
            ]
        },
        specificQuery: {
            title: "If the guidance says to include \"AI programming tools\" and exclude \"general AI articles\" (specific query):",
            include: [
                "Articles specifically about AI code assistants (e.g., GitHub Copilot, Cursor, Codeium), AI development tools, etc. with substantial content",
                "Articles that provide important information about AI programming tools (reviews, comparisons, tutorials, etc.)"
            ],
            exclude: [
                "General AI research papers that don't discuss programming tools",
                "Articles about other AI topics (e.g., computer vision, NLP) that don't relate to programming tools",
                "Articles that only briefly mention AI programming tools without substantial discussion"
            ]
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


// ==================== 公共常量 ====================
// 注意：不再使用公共常量来避免冗余
// 如果某个提示词的结果已经包含了要求，后续提示词就不需要重复

// ==================== 主题意图识别 ====================

export const TOPIC_INTENT_RECOGNITION_SYSTEM_MESSAGE = `You are a professional intent recognition assistant for an AI-focused article database. All articles in this database are AI-related, so your task is to analyze user queries and determine their specificity level (broad vs specific) to rewrite them into detailed guidance for article filtering. You excel at distinguishing between broad queries (that should match all related AI topics) and specific queries (that should only match the exact combination of AI concepts). IMPORTANT: Always output the rewritten guidance in English, regardless of the input language. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getTopicIntentRecognitionPrompt(topic: string): string {
    return `You are tasked with recognizing the user's intent from their topic query and rewriting it into a more detailed and comprehensive guidance for article filtering. **IMPORTANT: All articles in this database are AI-related**, so you don't need to filter for "AI relevance" - instead, focus on determining the specificity level of the query within the AI domain.

## User's Original Topic
"${topic}"

## Task
Analyze the user's query to determine its granularity level within the AI domain, then rewrite it into detailed guidance for article filtering.

**IMPORTANT: The rewritten guidance MUST be written in English, regardless of the language of the user's original query.**

### Step 1: Determine Query Granularity
First, assess how specific or broad the user's query is within the AI domain:

**Broad/General Query Examples:**
- "ai" → Should match ALL AI-related articles (any aspect of artificial intelligence: machine learning, deep learning, NLP, computer vision, AI applications, AI research, AI ethics, AI tools, AI companies, etc.)
- "machine learning" → Should match ALL articles related to machine learning (any aspect: algorithms, models, applications, research, tools, etc.)

**Specific/Narrow Query Examples:**
- "AI programming tools" → Should ONLY match articles about AI programming tools (e.g., GitHub Copilot, Cursor, Codeium), NOT general AI articles that don't discuss programming tools
- "large language models" → Should ONLY match articles specifically about LLMs (GPT, Claude, Llama, etc.), NOT general AI articles that don't focus on language models
- "chinese ai industry" → Should ONLY match articles specifically about the Chinese AI industry, NOT general AI articles that don't focus on China
- "AI safety and alignment" → Should ONLY match articles specifically about AI safety and alignment, NOT general AI articles that don't discuss safety concerns

### Step 2: Rewrite Based on Granularity

**For Broad Queries:**
- Expand to include all related AI aspects, synonyms, and variations
- Include all sub-topics and related AI concepts
- The guidance should be inclusive and comprehensive within the AI domain

**For Specific Queries:**
- Focus ONLY on the specific combination of AI concepts mentioned
- Clearly define what should be INCLUDED
- Clearly define what should be EXCLUDED (other AI topics that don't match the specific combination)
- Be precise about the boundaries within the AI domain

### Step 3: Create Detailed Guidance

The rewritten guidance should:
1. Identify the granularity level (broad or specific) within the AI domain
2. List key AI concepts and terms that should be included
3. For specific queries, explicitly state what AI topics should be EXCLUDED
4. Provide clear criteria for matching articles (all articles are AI-related, so focus on topic relevance)

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

// ==================== LLM初筛 ====================

export const LLM_PRELIMINARY_FILTER_SYSTEM_MESSAGE = `You are a professional article title filtering assistant for an AI-focused article database. All articles are AI-related, so you should quickly judge whether article titles match the intent recognition guidance based on topic relevance within the AI domain. You only filter out articles whose titles are clearly unrelated to the specific topic. For articles whose titles match the topic or are uncertain, you should keep them for further detailed analysis. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getLLMPreliminaryFilterPrompt(intentGuidance: string, titlesText: string): string {
    return `You are tasked with preliminarily filtering articles based on their titles only. **IMPORTANT: All articles in this database are AI-related**, so you don't need to check for "AI relevance" - instead, focus on whether titles match the specific topic within the AI domain. This is a quick filtering step to remove articles whose titles are clearly unrelated to the topic.

## Intent Recognition Guidance
${intentGuidance}

## Task
Analyze each article title and determine if it should be kept for further detailed analysis. You should:
- **KEEP** articles whose titles match the topic or are related to the topic within the AI domain
- **KEEP** articles whose titles are uncertain or ambiguous (when in doubt, keep it)
- **FILTER OUT** only articles whose titles are clearly and obviously unrelated to the specific topic (even though they are AI-related)

## Decision Criteria

**CRITICAL: Conservative Filtering**
- This is a preliminary filter based on titles only - be conservative
- Only filter out titles that are **clearly and obviously** unrelated to the specific topic
- When in doubt, keep the article for further analysis
- Remember: titles may not fully represent article content, so err on the side of keeping articles
- **Note**: All articles are AI-related, so focus on topic relevance, not AI relevance

**For Broad Queries (general AI topics):**
- Keep articles whose titles mention any aspect related to the topic within the AI domain
- Only filter out titles that are completely unrelated to the topic (even if they are AI-related)

**For Specific Queries (narrow AI topics):**
- Keep articles whose titles mention the specific combination of AI concepts
- Keep articles whose titles are ambiguous or could potentially relate to the topic
- Only filter out titles that are clearly about different AI topics

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

export const LLM_REFINE_SYSTEM_MESSAGE = `You are a professional article filtering assistant for an AI-focused article database. All articles are AI-related, so you should judge whether articles match the intent recognition guidance with high relevance based on topic specificity within the AI domain. You carefully follow the inclusion and exclusion criteria specified in the guidance, paying special attention to query granularity (broad vs specific). You only select articles that have high relevance to the topic or provide important information related to the topic. Return results strictly in JSON format, only return JSON objects, do not include any other text.`

export function getLLMRefinePrompt(intentGuidance: string, articlesText: string): string {
    return `You are tasked with filtering articles based on the following intent recognition guidance. **IMPORTANT: All articles in this database are AI-related**, so you don't need to check for "AI relevance" - instead, focus on whether articles match the specific topic within the AI domain. This guidance has been carefully crafted to identify the user's intent and determine the query granularity (specificity level).

## Intent Recognition Guidance
${intentGuidance}

## Task
Analyze each article and determine if it matches the criteria specified in the intent recognition guidance above. The guidance has already identified:
1. The granularity level (broad or specific query) within the AI domain
2. What should be INCLUDED
3. What should be EXCLUDED (for specific queries - other AI topics that don't match)

## Decision Criteria

**CRITICAL: High Relevance Requirement**
- Only include articles that have **high relevance** to the topic or provide **important information** related to the topic within the AI domain
- Exclude articles that only have passing mentions or superficial references without substantial content
- An article should either: (1) be primarily about the topic, or (2) provide significant insights, analysis, or important information related to the topic
- **Note**: All articles are AI-related, so focus on topic relevance, not AI relevance

**For Broad Queries (general AI topics):**
- Include articles that **substantially discuss** aspects related to the topic within the AI domain (not just passing mentions)
- Include articles that provide **important information** about the topic, even if the topic is not the primary focus
- **EXCLUDE** articles that only mention the topic in passing without providing meaningful content or insights
- **EXCLUDE** articles where the topic is only tangentially related without substantial relevance

**For Specific Queries (narrow AI topics):**
- Include articles ONLY if they match the specific combination of AI concepts mentioned **with high relevance**
- Strictly EXCLUDE articles that discuss other AI topics but don't match the specific combination
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
Return a JSON object. **IMPORTANT: Always provide the "reason" field first, then the "related" field. This order helps you think through the reasoning before making the final judgment:**
{
  "reason": "Brief explanation (1-2 sentences) of why the article is or is not related to the topic",
  "related": true
}

**Important:**
- **First, analyze and write the "reason" field** - explain your judgment basis for whether the article is related or not
- **Then, set the "related" field** based on your reasoning: true if the article matches the criteria, false if it doesn't
- The "reason" field should explain the judgment basis for whether the article is related or not
- Always provide both fields, with "reason" appearing before "related" in the JSON object

## Articles to Analyze
${articlesText}

Return the JSON result:`
}

