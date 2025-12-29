/**
 * 统一的LLM客户端封装
 * 提供统一的OpenAI SDK接口，支持所有LLM API调用
 */

import OpenAI from "openai"
import type { ChatCompletionCreateParams, ChatCompletion } from "openai/resources/chat/completions"

/**
 * 统一的LLM配置接口
 */
export interface LLMConfig {
    apiEndpoint: string  // 完整的API端点URL
    apiKey: string
    model: string
}

/**
 * LLM调用参数
 */
export interface LLMCallParams {
    messages: Array<{
        role: 'system' | 'user' | 'assistant'
        content: string
    }>
    temperature?: number
    max_tokens?: number
    response_format?: { type: "json_object" }
}

/**
 * API调用记录回调函数类型
 */
export type OnApiCallCallback = (
    model: string,
    apiType: string,
    callContext: string,
    usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }
) => void

/**
 * 规范化API端点URL，提取baseURL（用于OpenAI SDK）
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
 * 创建OpenAI客户端
 */
export function createLLMClient(config: LLMConfig): OpenAI {
    const baseURL = normalizeApiEndpointForSDK(config.apiEndpoint)
    
    return new OpenAI({
        apiKey: config.apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true
    })
}

/**
 * 记录API调用
 * 自动检测运行环境并选择适当的记录方式
 */
async function recordLLMCall(
    model: string,
    callContext: string,
    usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number },
    onApiCall?: OnApiCallCallback
): Promise<void> {
    if (!usage) {
        return
    }

    if (onApiCall) {
        // 主进程：使用提供的回调函数
        onApiCall(model, 'chat', callContext, usage)
    } else if (typeof window !== 'undefined' && window.utils && window.utils.recordApiCall) {
        // 渲染进程：通过 IPC 调用
        window.utils.recordApiCall(model, 'chat', callContext, usage).catch(err => {
            console.error('记录API调用失败:', err)
        })
    } else if (typeof window !== 'undefined') {
        // 渲染进程：直接调用数据库（fallback）
        import("./api-call-recorder").then(({ recordApiCall }) => {
            recordApiCall(model, 'chat', callContext, usage).catch(err => {
                console.error('记录API调用失败:', err)
            })
        }).catch(() => {
            // 忽略导入失败
        })
    }
    // 在主进程中且没有提供记录函数时，不记录（由调用者负责）
}

/**
 * 统一的LLM API调用函数
 * @param config LLM配置
 * @param params 调用参数
 * @param callContext 调用上下文（用于记录API调用）
 * @param onApiCall 可选的API调用记录回调（用于主进程）
 * @returns ChatCompletion响应
 */
export async function callLLM(
    config: LLMConfig,
    params: LLMCallParams,
    callContext: string,
    onApiCall?: OnApiCallCallback
): Promise<ChatCompletion> {
    const openai = createLLMClient(config)
    
    const completionParams: ChatCompletionCreateParams = {
        model: config.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 2000,
    }
    
    // 某些模型可能不支持response_format，尝试添加但不强制
    if (params.response_format) {
        try {
            completionParams.response_format = params.response_format
        } catch (e) {
            // 忽略错误，继续使用普通格式
        }
    }
    
    try {
        const completion = await openai.chat.completions.create(completionParams)
        
        // 自动记录API调用
        if (completion.usage) {
            await recordLLMCall(config.model, callContext, completion.usage, onApiCall)
        }
        
        return completion
    } catch (error) {
        // 统一错误处理，直接使用原始错误消息（已包含状态码、错误代码等信息）
        if (error instanceof OpenAI.APIError) {
            // OpenAI API 错误消息已经包含了详细的信息（状态码、错误代码等）
            throw new Error(`LLM API调用失败: ${error.message}`)
        } else if (error instanceof Error) {
            throw new Error(`LLM API调用失败: ${error.message}`)
        } else {
            throw new Error(`LLM API调用失败: ${String(error)}`)
        }
    }
}

/**
 * 配置转换函数：从ChatApiConfig转换为LLMConfig
 */
export function chatApiConfigToLLMConfig(config: { apiEndpoint: string, apiKey: string, model: string }): LLMConfig {
    return {
        apiEndpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model
    }
}

/**
 * 配置转换函数：从TranslationConfig转换为LLMConfig
 */
export function translationConfigToLLMConfig(config: { apiEndpoint: string, apiKey: string, model: string }): LLMConfig {
    return {
        apiEndpoint: config.apiEndpoint,
        apiKey: config.apiKey,
        model: config.model
    }
}

/**
 * 配置转换函数：从ConsolidateConfig转换为LLMConfig
 */
export function consolidateConfigToLLMConfig(config: { chatApiEndpoint: string, chatApiKey: string, model: string }): LLMConfig {
    return {
        apiEndpoint: config.chatApiEndpoint,
        apiKey: config.chatApiKey,
        model: config.model
    }
}

