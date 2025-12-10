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
 * 摘要要点接口
 */
export interface SummaryTakeaway {
    label: string
    insight: string
    timestamps: string[]
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
 * 格式化转录文本为带时间戳的格式
 */
function formatTranscriptWithTimestamps(segments: TranscriptSegment[]): string {
    return segments.map(segment => {
        const start = formatTime(segment.start)
        return `[${start}] ${segment.text}`
    }).join('\n')
}

/**
 * 生成视频字幕摘要（返回结构化数据，类似 TLDW takeaways）
 * @param segments 转录片段数组
 * @param config Chat API配置
 * @param targetLanguage 目标语言名称（如 "English", "简体中文" 等）
 * @returns 生成的摘要要点数组
 */
export async function generateTranscriptSummary(
    segments: TranscriptSegment[],
    config: ChatApiConfig,
    targetLanguage: string = "English"
): Promise<SummaryTakeaway[]> {
    if (!segments || segments.length === 0) {
        throw new Error('转录片段为空，无法生成摘要')
    }

    const transcriptWithTimestamps = formatTranscriptWithTimestamps(segments)

    // 构建摘要提示词（参考 TLDW takeaways 设计）
    const prompt = `<task>
<role>You are an expert editorial analyst distilling a video's most potent insights for time-pressed viewers.</role>
<goal>Produce 4-6 high-signal takeaways that help a viewer retain the video's core ideas.</goal>
<instructions>
  <item>Only use information stated explicitly in the transcript. Never speculate.</item>
  <item>Make each label specific, punchy, and no longer than 10 words.</item>
  <item>Write each insight as 1-2 sentences that preserve the speaker's framing.</item>
  <item>Attach 1-2 zero-padded timestamps (MM:SS or HH:MM:SS) that point to the supporting moments.</item>
  <item>Favor contrarian viewpoints, concrete examples, data, or memorable stories over generic advice.</item>
  <item>Avoid overlapping takeaways. Each one should stand alone.</item>
  <item>IMPORTANT: You MUST respond in ${targetLanguage}. All text in the "label" and "insight" fields must be in ${targetLanguage}.</item>
</instructions>
<qualityControl>
  <item>Verify every claim is grounded in transcript lines you can cite verbatim.</item>
  <item>Ensure timestamps map to the lines that justify the insight.</item>
  <item>If the transcript lacks enough high-quality insights, still return at least four by choosing the strongest available.</item>
</qualityControl>
<outputFormat>Return strict JSON with 4-6 objects: [{"label":"string","insight":"string","timestamps":["MM:SS"]}]. Do not include markdown or commentary.</outputFormat>
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
                content: `You are a helpful assistant that summarizes video transcripts. You must always respond in ${targetLanguage} language. Never use any other language.`
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

        // 规范化响应数据
        const candidateArray = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.takeaways)
                ? parsed.takeaways
                : Array.isArray(parsed?.items)
                    ? parsed.items
                    : []

        const takeaways: SummaryTakeaway[] = []

        for (const item of candidateArray) {
            if (!item || typeof item !== 'object') {
                continue
            }

            const label = (item.label || item.title || '').trim()
            const insight = (item.insight || item.summary || item.description || '').trim()
            
            // 提取时间戳
            const timestampSources: string[] = []
            if (Array.isArray(item.timestamps)) {
                timestampSources.push(...item.timestamps)
            }
            if (typeof item.timestamp === 'string') {
                timestampSources.push(item.timestamp)
            }
            if (typeof item.time === 'string') {
                timestampSources.push(item.time)
            }

            // 规范化时间戳（移除方括号，确保格式正确）
            const normalizedTimestamps = timestampSources
                .map(ts => ts.trim().replace(/[\[\]]/g, ''))
                .filter(ts => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(ts))
                .slice(0, 2) // 最多2个时间戳

            if (label && insight && normalizedTimestamps.length > 0) {
                takeaways.push({
                    label,
                    insight,
                    timestamps: normalizedTimestamps
                })
            }

            if (takeaways.length >= 6) {
                break
            }
        }

        if (takeaways.length === 0) {
            throw new Error('AI模型未返回有效的摘要要点')
        }

        return takeaways
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
}

