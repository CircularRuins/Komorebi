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
 * 生成视频字幕摘要（使用和翻译功能相同的结构）
 * @param transcriptText 字幕文本
 * @param config Chat API配置
 * @param targetLanguage 目标语言名称（如 "English", "简体中文" 等）
 * @returns 生成的摘要
 */
export async function generateTranscriptSummary(
    transcriptText: string,
    config: ChatApiConfig,
    targetLanguage: string = "English"
): Promise<string> {
    if (!transcriptText || !transcriptText.trim()) {
        throw new Error('字幕文本为空，无法生成摘要')
    }

    // 构建摘要提示词（要求返回markdown格式，使用指定语言）
    const prompt = `You must write the summary in ${targetLanguage} language. Please provide a brief summary of the key points from the following video transcript. Use Markdown format.

IMPORTANT: The entire summary must be written in ${targetLanguage}. Do not use any other language.

Requirements:
- Write entirely in ${targetLanguage} language
- Keep it concise, only summarize the main points
- Use Markdown formatting (headings, lists, bold, etc.)
- Use bullet points for key points

Transcript:
${transcriptText}

Summary (must be in ${targetLanguage}, Markdown format):`

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
        temperature: 0.7,
        max_tokens: 2000,
    })

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        const summary = completion.choices[0].message.content || ''
        if (!summary) {
            throw new Error('摘要结果为空')
        }
        return summary
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
}

