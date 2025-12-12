/**
 * Chat API 工具函数
 * 提供统一的Chat API请求接口，支持OpenAI SDK和fetch两种方式
 */

import OpenAI from "openai"
import { createOpenAIClient, TranslationConfig } from "./translation-utils"

/**
 * Chat API配置
 */
export interface ChatApiConfig {
    apiEndpoint: string
    apiKey: string
    model: string
}

/**
 * Chat消息
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

/**
 * Chat完成请求参数
 */
export interface ChatCompletionParams {
    messages: ChatMessage[]
    temperature?: number
    max_tokens?: number
    response_format?: { type: "json_object" }
}

/**
 * Chat完成响应
 */
export interface ChatCompletionResponse {
    choices: Array<{
        message: {
            content: string
        }
    }>
    usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
    }
}

/**
 * 规范化 API Endpoint URL，提取 baseURL（用于OpenAI SDK）
 * 如果URL包含/v1/chat/completions，提取baseURL（OpenAI SDK会自动添加路径）
 * 如果不包含，保留路径作为baseURL
 */
export function normalizeApiEndpointForSDK(endpoint: string): string {
    const normalizedEndpoint = endpoint.trim()
    
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        throw new Error('API Endpoint必须以http://或https://开头')
    }
    
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            // 如果包含/v1/chat/completions，提取baseURL（OpenAI SDK会自动添加）
            return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            // 如果不包含，保留路径作为baseURL
            return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
        throw new Error(`无效的API Endpoint URL: ${normalizedEndpoint}`)
    }
}

/**
 * 规范化 API Endpoint URL，用于fetch请求
 * 直接使用用户提供的完整endpoint，不做任何修改
 */
export function normalizeApiEndpointForFetch(endpoint: string): string {
    const normalizedEndpoint = endpoint.trim()
    
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        throw new Error('API Endpoint必须以http://或https://开头')
    }
    
    // 验证URL格式
    try {
        new URL(normalizedEndpoint)
    } catch (error) {
        throw new Error(`无效的API Endpoint URL: ${normalizedEndpoint}`)
    }
    
    // 直接返回用户提供的完整endpoint，不做任何修改
    return normalizedEndpoint
}

/**
 * 使用OpenAI SDK创建Chat完成请求
 */
export async function createChatCompletionWithSDK(
    config: ChatApiConfig,
    params: ChatCompletionParams
): Promise<ChatCompletionResponse> {
    const baseURL = normalizeApiEndpointForSDK(config.apiEndpoint)
    
    const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true
    })
    
    const completionParams: any = {
        model: config.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 2000
    }
    
    // 某些模型可能不支持response_format，尝试添加但不强制
    if (params.response_format) {
        try {
            completionParams.response_format = params.response_format
        } catch (e) {
            // 忽略错误，继续使用普通格式
        }
    }
    
    const completion = await openai.chat.completions.create(completionParams)
    
    return {
        choices: completion.choices.map(choice => ({
            message: {
                content: choice.message.content || ''
            }
        })),
        usage: completion.usage ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens
        } : undefined
    }
}

/**
 * 使用fetch创建Chat完成请求（用于webview等环境）
 */
export async function createChatCompletionWithFetch(
    config: ChatApiConfig,
    params: ChatCompletionParams
): Promise<ChatCompletionResponse> {
    const endpoint = normalizeApiEndpointForFetch(config.apiEndpoint)
    
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: params.messages,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.max_tokens ?? 2000,
            ...(params.response_format ? { response_format: params.response_format } : {})
        })
    })
    
    if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`
        if (response.status === 404) {
            errorMessage = `404错误: 请求的URL不存在\n\n请检查:\n1. Chat API Endpoint是否正确（完整的URL路径）\n2. API服务是否正常运行\n\n当前请求URL: ${endpoint}\n\n错误详情: ${errorText}`
        } else {
            errorMessage += `. ${errorText}`
        }
        throw new Error(errorMessage)
    }
    
    const data = await response.json()
    
    if (!data.choices || !data.choices.length || !data.choices[0].message) {
        throw new Error('Invalid API response format')
    }
    
    return {
        choices: data.choices.map((choice: any) => ({
            message: {
                content: choice.message?.content || ''
            }
        })),
        usage: data.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens
        } : undefined
    }
}

/**
 * 转录片段接口
 */
export interface TranscriptSegment {
    text: string
    start: number
    duration: number
}

/**
 * 摘要要点接口（包含时间戳引用）
 */
export interface SummaryTakeaway {
    label: string
    insight: string
    timestamps: string[]  // 时间戳引用数组，1-2个 (MM:SS 或 HH:MM:SS)
}

/**
 * 视频摘要完整结构
 */
export interface TranscriptSummary {
    overview: string  // 摘要速览：简短介绍视频内容，包含人物信息
    takeaways: SummaryTakeaway[]  // 重点提要
}

/**
 * 最精彩引用接口
 */
export interface JuiciestQuote {
    quote: string        // 原文引用
    timestamp: string     // 时间戳 (MM:SS 或 HH:MM:SS)
    speaker?: string      // 说话者名称（可选）
    interpretation?: string  // 简要说明这个引用表达的意思（可选，与应用设置的语言一致）
}

/**
 * 格式化时间戳（秒数转为 MM:SS 或 HH:MM:SS）
 */
function formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)
    
    const pad = (value: number): string => value.toString().padStart(2, '0')
    
    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    }
    return `${pad(minutes)}:${pad(seconds)}`
}

/**
 * 格式化时间戳部分为零填充字符串
 */
function formatTimestampFromParts(hours: number, minutes: number, seconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(hours * 3600 + minutes * 60 + seconds))
    const normalizedHours = Math.floor(totalSeconds / 3600)
    const normalizedMinutes = Math.floor((totalSeconds % 3600) / 60)
    const normalizedSeconds = totalSeconds % 60

    if (normalizedHours > 0) {
        return [
            normalizedHours.toString().padStart(2, '0'),
            normalizedMinutes.toString().padStart(2, '0'),
            normalizedSeconds.toString().padStart(2, '0')
        ].join(':')
    }

    return [
        normalizedMinutes.toString().padStart(2, '0'),
        normalizedSeconds.toString().padStart(2, '0')
    ].join(':')
}

/**
 * 清理时间戳字符串，转换为规范化的零填充格式
 */
function sanitizeTimestamp(value: string): string | null {
    if (!value) return null

    const cleaned = value
        .replace(/[\[\](){}【】]/g, ' ')
        .replace(/[-–]|to/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const directMatch = cleaned.match(/(\d{1,2}:\d{1,2}:\d{1,2}|\d{1,2}:\d{1,2})/)
    if (directMatch) {
        const parts = directMatch[1].split(':').map(part => parseInt(part, 10))
        if (parts.some(Number.isNaN)) {
            return null
        }

        if (parts.length === 3) {
            return formatTimestampFromParts(parts[0], parts[1], parts[2])
        }

        if (parts.length === 2) {
            return formatTimestampFromParts(0, parts[0], parts[1])
        }
    }

    return null
}

/**
 * 从字符串中提取时间戳候选
 */
function timestampCandidatesFromString(source: string): string[] {
    return source
        .split(/[,/;]|and|\s+(?=\d)/i)
        .map(part => part.trim())
        .filter(Boolean)
}

/**
 * 从对象中提取时间戳候选
 */
function timestampCandidatesFromObject(source: Record<string, unknown>): string[] {
    const candidates: string[] = []

    if (typeof source.time === 'string') {
        candidates.push(source.time)
    }

    if (typeof source.timestamp === 'string') {
        candidates.push(source.timestamp)
    }

    return candidates
}

/**
 * 收集时间戳候选
 */
function collectTimestampCandidates(source: unknown, depth = 0): string[] {
    if (depth > 3 || source == null) {
        return []
    }

    if (typeof source === 'string') {
        return timestampCandidatesFromString(source)
    }

    if (Array.isArray(source)) {
        return source.flatMap(item => collectTimestampCandidates(item, depth + 1))
    }

    if (typeof source === 'object') {
        return timestampCandidatesFromObject(source as Record<string, unknown>)
    }

    return []
}

/**
 * 规范化时间戳源数组，返回规范化的时间戳数组（最多 limit 个）
 */
function normalizeTimestampSources(sources: unknown[], limit: number = 2): string[] {
    const sanitized: string[] = []

    for (const source of sources) {
        const candidates = collectTimestampCandidates(source)
        for (const candidate of candidates) {
            const normalized = sanitizeTimestamp(candidate)
            if (normalized) {
                sanitized.push(normalized)
            }
        }
    }

    const unique = Array.from(new Set(sanitized))
    return unique.slice(0, limit)
}

/**
 * 格式化转录文本为带时间戳的格式（使用时间范围格式，与 TLDW 一致）
 */
function formatTranscriptWithTimestamps(segments: TranscriptSegment[]): string {
    return segments.map(segment => {
        const start = formatTime(segment.start)
        const end = formatTime(segment.start + segment.duration)
        return `[${start}-${end}] ${segment.text}`
    }).join('\n')
}

/**
 * 生成视频字幕摘要（返回结构化数据，包含摘要速览和重点提要）
 * @param segments 转录片段数组
 * @param config Chat API配置
 * @param targetLanguage 目标语言名称（如 "English", "简体中文" 等）
 * @param snippet 文章摘要/片段（可选）
 * @returns 生成的摘要结构，包含 overview 和 takeaways
 */
export async function generateTranscriptSummary(
    segments: TranscriptSegment[],
    config: ChatApiConfig,
    targetLanguage: string = "English",
    snippet?: string
): Promise<TranscriptSummary> {
    if (!segments || segments.length === 0) {
        throw new Error('转录片段为空，无法生成摘要')
    }

    const transcriptWithTimestamps = formatTranscriptWithTimestamps(segments)

    // 构建摘要提示词（生成两部分：摘要速览和重点提要）
    const snippetSection = snippet ? `<articleInfo>
<summary>${snippet}</summary>
</articleInfo>

` : ''

    const prompt = `<task>
${snippetSection}<role>You are an expert editorial analyst summarizing video content for viewers.</role>
<goal>Produce a concise overview and 4-6 key takeaways that help viewers understand the video's core content.</goal>
<instructions>
  <item>Only use information stated explicitly in the transcript. Never speculate.</item>
  <item>Generate two parts:
    1. Overview: A brief summary (2-4 sentences) introducing the video's content. If there are people mentioned in the transcript (speakers, interviewees, guests, etc.), include their names and roles/identities in the overview. Use the article summary above to help identify speakers and context when available.
    2. Takeaways: 4-6 key points, each with a label, insight, and 1-2 timestamps pointing to supporting moments.</item>
  <item>For the overview: Write 2-4 sentences that give a quick introduction to what the video is about. If people are mentioned, introduce them (e.g., "This video features an interview with [Name], who discusses..."). Use the article summary above to help identify speakers when available.</item>
  <item>For each takeaway: Make the label specific, punchy, and no longer than 10 words. Write the insight as 1-2 sentences that preserve the speaker's framing. Attach 1-2 zero-padded timestamps (MM:SS or HH:MM:SS) that point to the supporting moments in the transcript.</item>
  <item>Favor contrarian viewpoints, concrete examples, data, or memorable stories over generic advice.</item>
  <item>Avoid overlapping takeaways. Each one should stand alone.</item>
  <item>CRITICAL LANGUAGE REQUIREMENT: You MUST write ALL text (including the "overview" field and all "label" and "insight" fields in "takeaways") STRICTLY in ${targetLanguage}. This is mandatory and non-negotiable. Do NOT use any other language. Every single word in your response must be in ${targetLanguage}. If the transcript is in a different language, you must translate and summarize it in ${targetLanguage}.</item>
</instructions>
<qualityControl>
  <item>Verify every claim is grounded in transcript lines you can cite verbatim.</item>
  <item>Ensure timestamps map to the lines that justify the insight.</item>
  <item>If the transcript lacks enough high-quality insights, still return at least four takeaways by choosing the strongest available.</item>
  <item>Double-check that ALL text is in ${targetLanguage} before returning the response.</item>
</qualityControl>
<outputFormat>Return strict JSON with this structure: {"overview":"string","takeaways":[{"label":"string","insight":"string","timestamps":["MM:SS"]}]}. The "overview" field and all "label" and "insight" fields MUST be written in ${targetLanguage}. Each takeaway must include 1-2 timestamps in the "timestamps" array. Do not include markdown or commentary.</outputFormat>
<transcript><![CDATA[
${transcriptWithTimestamps}
]]></transcript>
</task>`

    // 使用和翻译功能相同的客户端创建方式
    const translationConfig: TranslationConfig = {
        apiEndpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model
    }
    const openai = createOpenAIClient(translationConfig)

    const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
            {
                role: 'system',
                content: `You are a helpful assistant that summarizes video transcripts. You MUST write ALL output text (including overview and all takeaways) STRICTLY in ${targetLanguage} language. This is mandatory. Never use any other language. If the transcript is in a different language, you must translate and summarize it in ${targetLanguage}.`
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.6,
        max_tokens: 2000,
        response_format: { type: "json_object" }
    })

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        const responseText = completion.choices[0].message.content || ''
        if (!responseText) {
            throw new Error('摘要结果为空')
        }

        // 解析 JSON 响应
        let parsed: any
        try {
            // 尝试提取 JSON（可能被代码块包裹）
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i)
            const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim()
            parsed = JSON.parse(jsonText)
        } catch (parseError) {
            throw new Error('API返回的JSON格式不正确')
        }

        // 提取 overview
        const overview = (parsed?.overview || parsed?.summary || '').trim()
        
        // 规范化响应数据 - 提取 takeaways
        const candidateArray = Array.isArray(parsed?.takeaways)
            ? parsed.takeaways
            : Array.isArray(parsed?.items)
                ? parsed.items
                : Array.isArray(parsed)
                    ? parsed
                    : []

        const takeaways: SummaryTakeaway[] = []

        for (const item of candidateArray) {
            if (!item || typeof item !== 'object') {
                continue
            }

            const label = (item.label || item.title || '').trim()
            const insight = (item.insight || item.summary || item.description || '').trim()

            // 提取时间戳
            const timestampSources: unknown[] = []

            if (Array.isArray(item.timestamps)) {
                timestampSources.push(...item.timestamps)
            }

            if (typeof item.timestamp === 'string') {
                timestampSources.push(item.timestamp)
            }

            if (typeof item.time === 'string') {
                timestampSources.push(item.time)
            }

            const uniqueTimestamps = normalizeTimestampSources(timestampSources, 2)

            // 必须有 label、insight 和至少一个时间戳
            if (label && insight && uniqueTimestamps.length > 0) {
                takeaways.push({
                    label,
                    insight,
                    timestamps: uniqueTimestamps
                })
            }

            if (takeaways.length >= 6) {
                break
            }
        }

        if (!overview) {
            throw new Error('AI模型未返回有效的摘要速览')
        }

        if (takeaways.length === 0) {
            throw new Error('AI模型未返回有效的摘要要点')
        }

        return {
            overview,
            takeaways
        }
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
}

/**
 * 生成最精彩引用（返回结构化数据，类似 TLDW quotes）
 * @param segments 转录片段数组
 * @param config Chat API配置
 * @param targetLanguage 目标语言名称（如 "English", "简体中文" 等）
 * @param snippet 文章摘要/片段（可选）
 * @returns 生成的最精彩引用数组
 */
export async function generateJuiciestQuotes(
    segments: TranscriptSegment[],
    config: ChatApiConfig,
    targetLanguage: string = "English",
    snippet?: string
): Promise<JuiciestQuote[]> {
    if (!segments || segments.length === 0) {
        throw new Error('转录片段为空，无法生成引用')
    }

    const transcriptWithTimestamps = formatTranscriptWithTimestamps(segments)

    // 构建引用提取提示词（参考 TLDW quotes 设计）
    const snippetSection = snippet ? `<articleInfo>
<summary>${snippet}</summary>
</articleInfo>

` : ''

    const prompt = `<task>
${snippetSection}
<role>You are extracting the most quotable, high-impact lines from a video transcript.</role>
<goal>Return up to five of the most compelling quotes that convey the video's main message.</goal>
<instructions>
  <item>Only use direct quotes that appear verbatim in the transcript.</item>
  <item>Each quote must highlight memorable language, strong emotion, or critical insights.</item>
  <item>Each quote must include the exact timestamp (MM:SS or HH:MM:SS) where it appears in the transcript, pointing to where the quote begins.</item>
  <item>Identify the speaker: Extract the speaker name if it's explicitly mentioned in the transcript (e.g., "John:", "Speaker 1:", "Interviewer:", labels, or speaker tags). If not explicitly mentioned, you may reasonably infer the speaker from context clues in the transcript or article summary (e.g., dialogue patterns, role indicators like "Host" or "Guest", or consistent speaking patterns). Use the article summary above to help identify speakers when available. However, NEVER invent or fabricate speaker names that don't exist in the transcript or cannot be reasonably inferred from it. If you cannot determine or reasonably infer the speaker, leave the "speaker" field empty.</item>
  <item>For each quote, provide a brief interpretation (1-2 sentences) that explains what the quote means in context. The interpretation should help readers understand the significance or meaning of the quote within the video's narrative. CRITICAL: The "interpretation" field MUST be written STRICTLY in ${targetLanguage}. This is mandatory and non-negotiable.</item>
  <item>Order the quotes from most to least impactful.</item>
  <item>CRITICAL LANGUAGE REQUIREMENT: The "quote" field must be in the original language of the transcript (as it appears verbatim). The "interpretation" field MUST be written STRICTLY in ${targetLanguage}. Do NOT use any other language for the interpretation field. Every word in the interpretation must be in ${targetLanguage}.</item>
</instructions>
<qualityControl>
  <item>Do not fabricate quotes or timestamps.</item>
  <item>If fewer than five strong quotes exist, return the best available and respect schema limits.</item>
</qualityControl>
<outputFormat>Return strict JSON with up to 5 objects: [{"quote":"string","timestamp":"MM:SS","speaker":"string (optional)","interpretation":"string (optional)"}]. The "quote" field must be the exact verbatim text from the transcript (in its original language). The "speaker" field should contain the name or identifier of who said the quote if available in the transcript. CRITICAL: The "interpretation" field MUST be a brief explanation (1-2 sentences) of what the quote means in context, and it MUST be written STRICTLY in ${targetLanguage}. Do NOT use English or any other language for the interpretation field. Order quotes from most to least impactful. Do not include markdown or commentary.</outputFormat>
<transcript><![CDATA[
${transcriptWithTimestamps}
]]></transcript>
</task>`

    // 使用和翻译功能相同的客户端创建方式
    const translationConfig: TranslationConfig = {
        apiEndpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model
    }
    const openai = createOpenAIClient(translationConfig)

    const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
            {
                role: 'system',
                content: `You are a helpful assistant that extracts memorable quotes from video transcripts. CRITICAL: The "interpretation" field in your JSON response MUST be written STRICTLY in ${targetLanguage}. The "quote" field should remain in the original language of the transcript. Never use English or any other language for the interpretation field when the target language is ${targetLanguage}.`
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
    })

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        const responseText = completion.choices[0].message.content || ''
        if (!responseText) {
            throw new Error('引用结果为空')
        }

        // 解析 JSON 响应
        let parsed: any
        try {
            // 尝试提取 JSON（可能被代码块包裹）
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/i)
            const jsonText = jsonMatch ? jsonMatch[1].trim() : responseText.trim()
            parsed = JSON.parse(jsonText)
        } catch (parseError) {
            throw new Error('API返回的JSON格式不正确')
        }

        // 规范化响应数据
        const candidateArray = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.quotes)
                ? parsed.quotes
                : Array.isArray(parsed?.items)
                    ? parsed.items
                    : []

        const quotes: JuiciestQuote[] = []

        for (const item of candidateArray) {
            if (!item || typeof item !== 'object') {
                continue
            }

            const quote = (item.quote || '').trim()
            const timestamp = (item.timestamp || item.time || '').trim()
            const speaker = (item.speaker || '').trim()
            const interpretation = (item.interpretation || '').trim()

            // 规范化时间戳（移除方括号，确保格式正确）
            const normalizedTimestamp = timestamp
                .replace(/[\[\]]/g, '')
                .trim()

            // 验证时间戳格式
            if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(normalizedTimestamp)) {
                continue
            }

            if (quote && normalizedTimestamp) {
                quotes.push({
                    quote,
                    timestamp: normalizedTimestamp,
                    speaker: speaker || undefined,
                    interpretation: interpretation || undefined
                })
            }

            if (quotes.length >= 5) {
                break
            }
        }

        if (quotes.length === 0) {
            throw new Error('AI模型未返回有效的引用')
        }

        return quotes
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
}

