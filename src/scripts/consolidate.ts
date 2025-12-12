import OpenAI from "openai"
import * as db from "./db"
import lf from "lovefield"
import intl from "react-intl-universal"
import type { RSSItem } from "./models/item"
import type { QueryProgressStep, QueryProgress, ArticleCluster, TokenStatistics, TokenUsage } from "./models/ai-mode"
import {
    TOPIC_INTENT_RECOGNITION_SYSTEM_MESSAGE,
    getTopicIntentRecognitionPrompt,
    LLM_PRELIMINARY_FILTER_SYSTEM_MESSAGE,
    getLLMPreliminaryFilterPrompt,
    LLM_REFINE_SYSTEM_MESSAGE,
    getLLMRefinePrompt
} from "./prompts"

// ==================== 配置和回调接口 ====================

export interface ConsolidateConfig {
    chatApiEndpoint: string
    chatApiKey: string
    embeddingApiEndpoint: string
    embeddingApiKey: string
    embeddingModel: string
    embeddingQPS?: number
    model: string
    topk: number
    chatApiBaseURL?: string
    embeddingApiBaseURL?: string
}

export interface ConsolidateCallbacks {
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => void
    updateQueryProgress?: (progress: Partial<QueryProgress>) => void
    getCurrentQueryProgress?: () => QueryProgress | null
    updateTokenStatistics?: (tokenStatistics: TokenStatistics) => void
}

// ==================== 辅助函数 ====================

// 初始化Token统计
function createInitialTokenStatistics(): TokenStatistics {
    return {
        chatModel: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        },
        embeddingModel: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }
    }
}

// 累加Token使用量
function addTokenUsage(statistics: TokenStatistics, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }, isChatModel: boolean): void {
    if (isChatModel) {
        // Chat Model: 通常有 prompt_tokens, completion_tokens, total_tokens
        statistics.chatModel.prompt_tokens += usage.prompt_tokens || 0
        statistics.chatModel.completion_tokens += usage.completion_tokens || 0
        statistics.chatModel.total_tokens += usage.total_tokens || 0
    } else {
        // Embedding Model: 通常只有 prompt_tokens 和 total_tokens，没有 completion_tokens
        // 格式: { "prompt_tokens": 184, "total_tokens": 184 }
        // 只使用API返回的total_tokens
        const totalTokens = usage.total_tokens ?? 0
        
        statistics.embeddingModel.prompt_tokens += usage.prompt_tokens ?? 0
        statistics.embeddingModel.completion_tokens += 0  // Embeddings API 没有 completion_tokens
        statistics.embeddingModel.total_tokens += totalTokens
    }
}

// 清除所有文章的embedding
export async function clearArticleEmbeddings(): Promise<void> {
    // 等待数据库初始化
    let retries = 0
    while ((!db.itemsDB || !db.items) && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
    }
    
    if (!db.itemsDB || !db.items) {
        throw new Error('数据库未初始化，请稍后再试')
    }

    try {
        // 将所有文章的embedding字段设置为null
        await db.itemsDB
            .update(db.items)
            .set(db.items.embedding, null)
            .exec()
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`清除文章embedding失败: ${error.message}`)
        } else {
            throw new Error(`清除文章embedding失败: ${String(error)}`)
        }
    }
}

// 规范化 API Endpoint URL，提取 baseURL
export function normalizeApiEndpoint(endpoint: string): string {
    const normalizedEndpoint = endpoint.trim()
    
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        throw new Error('API Endpoint必须以http://或https://开头')
    }
    
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
        throw new Error(`无效的API Endpoint URL: ${normalizedEndpoint}`)
    }
}

// 计算余弦相似度
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('向量维度不匹配')
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i]
        normA += vecA[i] * vecA[i]
        normB += vecB[i] * vecB[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0) {
        return 0
    }

    return dotProduct / denominator
}

// 计算话题的embedding
// textToVectorize: 实际用于计算embedding的文本（可能是HyDE生成的文章或原始主题）
export async function computeTopicEmbedding(
    textToVectorize: string,
    config: ConsolidateConfig,
    callbacks?: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<number[]> {
    const { embeddingApiKey, embeddingModel, embeddingApiBaseURL } = config

    if (!embeddingApiBaseURL) {
        throw new Error('embeddingApiBaseURL未设置')
    }

    const modelToUse = embeddingModel.trim()
    const trimmedText = textToVectorize.trim()

    try {
        const openai = new OpenAI({
            apiKey: embeddingApiKey,
            baseURL: embeddingApiBaseURL,
            dangerouslyAllowBrowser: true
        })

        // 调用embedding API（使用实际文本计算embedding，不缓存）
        const response = await openai.embeddings.create({
            model: modelToUse,
            input: trimmedText,
        })

        // 收集token使用量
        if (response.usage && callbacks && callbacks.updateTokenStatistics && tokenStatistics) {
            addTokenUsage(tokenStatistics, response.usage, false)
            callbacks.updateTokenStatistics(tokenStatistics)
        }

        if (response.data && response.data.length > 0 && response.data[0].embedding) {
            const embedding = response.data[0].embedding
            return embedding
        } else {
            throw new Error('API返回的embedding格式不正确')
        }
    } catch (error: any) {
        if (error instanceof OpenAI.APIError) {
            throw new Error(`计算话题embedding失败: ${error.message}`)
        } else if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`计算话题embedding失败: ${String(error)}`)
        }
    }
}

// 计算文章的embedding并存储
export async function computeAndStoreEmbeddings(
    articles: RSSItem[],
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<void> {
    const { embeddingApiKey, embeddingModel, embeddingApiBaseURL } = config

    if (articles.length === 0) {
        return
    }

    if (!embeddingApiBaseURL) {
        return
    }

    // 过滤出还没有embedding的文章
    const articlesNeedingEmbedding = articles.filter(article => {
        const embedding = article.embedding
        return !embedding || !Array.isArray(embedding) || embedding.length === 0
    })
    
    if (articlesNeedingEmbedding.length === 0) {
        return
    }

    try {
        const openai = new OpenAI({
            apiKey: embeddingApiKey,
            baseURL: embeddingApiBaseURL,
            dangerouslyAllowBrowser: true
        })

        const modelToUse = embeddingModel.trim()
        const batchSize = 10  // API限制：每批最多10篇
        const totalArticles = articlesNeedingEmbedding.length
        const totalBatches = Math.ceil(totalArticles / batchSize)
        
        // 创建所有批次
        const batches: Array<{ batch: RSSItem[], batchNumber: number, batchStart: number }> = []
        for (let batchStart = 0; batchStart < articlesNeedingEmbedding.length; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, articlesNeedingEmbedding.length)
            const batch = articlesNeedingEmbedding.slice(batchStart, batchEnd)
            const batchNumber = Math.floor(batchStart / batchSize) + 1
            batches.push({ batch, batchNumber, batchStart })
        }
        
        // 用于跟踪已完成的批次数量
        let completedCount = 0
        
        // 更新进度的辅助函数（带节流）
        const updateProgress = () => {
            completedCount++
            const progress = Math.floor((completedCount / totalBatches) * 100)
            callbacks.updateStepStatus('vector-retrieval', 'in_progress', 
                intl.get("settings.aiMode.progress.messages.computingVectorsInParallel", { 
                    completed: completedCount, 
                    total: totalBatches, 
                    processed: Math.min(completedCount * batchSize, totalArticles), 
                    totalArticles: totalArticles 
                }), 
                progress)
        }
        
        // QPS限制器：使用滑动窗口跟踪最近1秒内的请求时间戳
        const maxQPS = config.embeddingQPS || 30
        const requestTimestamps: number[] = []
        
        // 速率限制函数：等待直到有可用的QPS配额
        const waitForRateLimit = async () => {
            const now = Date.now()
            const oneSecondAgo = now - 1000
            
            // 清理1秒前的旧时间戳
            while (requestTimestamps.length > 0 && requestTimestamps[0] <= oneSecondAgo) {
                requestTimestamps.shift()
            }
            
            // 如果当前QPS已达到限制，等待直到有可用配额
            if (requestTimestamps.length >= maxQPS) {
                const oldestTimestamp = requestTimestamps[0]
                const waitTime = oldestTimestamp + 1000 - now
                if (waitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTime))
                    // 等待后再次清理旧时间戳
                    const newNow = Date.now()
                    const newOneSecondAgo = newNow - 1000
                    while (requestTimestamps.length > 0 && requestTimestamps[0] <= newOneSecondAgo) {
                        requestTimestamps.shift()
                    }
                }
            }
            
            // 记录当前请求时间戳
            requestTimestamps.push(Date.now())
        }
        
        // 处理单个批次的函数
        const processBatch = async (batchInfo: { batch: RSSItem[], batchNumber: number, batchStart: number }) => {
            const { batch, batchNumber } = batchInfo
            
            try {
                // 等待QPS限制
                await waitForRateLimit()
                
                // 准备当前批次的文本
                const texts = batch.map(article => {
                    // 拼接标题和摘要
                    const title = article.title || ''
                    const snippet = article.snippet || (article.content ? article.content.substring(0, 300) : '')
                    return `${title}\n${snippet}`.trim()
                })

                // 调用embedding API
                const response = await openai.embeddings.create({
                    model: modelToUse,
                    input: texts,
                })

                // 收集token使用量
                if (response.usage && callbacks.updateTokenStatistics && tokenStatistics) {
                    addTokenUsage(tokenStatistics, response.usage, false)
                    callbacks.updateTokenStatistics(tokenStatistics)
                }

                // 验证响应格式
                if (!response.data || !Array.isArray(response.data) || response.data.length !== batch.length) {
                    throw new Error(`API返回的embedding数量不正确：期望 ${batch.length} 个，实际 ${response.data?.length || 0} 个`)
                }

                // 存储embedding到数据库
                const embeddings = response.data.map(item => {
                    if (!item.embedding || !Array.isArray(item.embedding) || item.embedding.length === 0) {
                        throw new Error('API返回的embedding格式不正确：缺少embedding字段或embedding为空')
                    }
                    return item.embedding
                })
                
                // 并行更新数据库
                await Promise.all(batch.map(async (article, i) => {
                    const embedding = embeddings[i]
                    
                    // 更新数据库
                    await db.itemsDB
                        .update(db.items)
                        .where(db.items._id.eq(article._id))
                        .set(db.items.embedding, embedding)
                        .exec()
                    
                    // 更新内存中的对象
                    article.embedding = embedding
                }))
                
                // 更新进度
                updateProgress()
            } catch (error) {
                // 批次处理失败，抛出错误（严格模式）
                updateProgress()
                if (error instanceof OpenAI.APIError) {
                    throw new Error(`计算文章embedding失败：批次 ${batchNumber} API调用失败: ${error.message}`)
                } else if (error instanceof Error) {
                    throw new Error(`计算文章embedding失败：批次 ${batchNumber} ${error.message}`)
                } else {
                    throw new Error(`计算文章embedding失败：批次 ${batchNumber} ${String(error)}`)
                }
            }
        }
        
        // 顺序处理所有批次，确保QPS限制（严格模式：任何批次失败都会立即失败）
        for (const batchInfo of batches) {
            await processBatch(batchInfo)
        }

    } catch (error: any) {
        // 抛出错误（严格模式）
        if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`计算文章embedding失败: ${String(error)}`)
        }
    }
}

// ==================== 步骤函数 ====================

// 步骤1: 查询数据库文章
export async function stepQueryDatabase(
    timeRangeDays: number | null,
    callbacks: ConsolidateCallbacks
): Promise<RSSItem[]> {
    callbacks.updateStepStatus('query-db', 'in_progress', intl.get("settings.aiMode.progress.messages.queryingArticles"))
    
    // 等待数据库初始化
    let retries = 0
    while ((!db.itemsDB || !db.items) && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
    }
    
    if (!db.itemsDB || !db.items) {
        callbacks.updateStepStatus('query-db', 'error', intl.get("settings.aiMode.progress.messages.databaseNotInitialized"))
        throw new Error('数据库未初始化，请稍后再试')
    }

    const predicates: lf.Predicate[] = []
    
    // 时间范围筛选
    if (timeRangeDays !== null) {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - timeRangeDays)
        predicates.push(db.items.date.gte(cutoffDate))
    }

    const query = predicates.length > 0 
        ? lf.op.and.apply(null, predicates)
        : null

    const queryBuilder = db.itemsDB
        .select()
        .from(db.items)
        .orderBy(db.items.date, lf.Order.DESC)

    const items = query 
        ? await queryBuilder.where(query).exec() as RSSItem[]
        : await queryBuilder.exec() as RSSItem[]
    
    callbacks.updateStepStatus('query-db', 'completed', intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }))
    return items
}


// 子步骤: 主题意图识别（识别用户意图并确定查询的精细程度）
async function stepRecognizeTopicIntent(
    topic: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<string> {
    const { chatApiKey, model, chatApiBaseURL } = config

    if (!chatApiBaseURL) {
        throw new Error('chatApiBaseURL未设置')
    }

    const trimmedTopic = topic.trim()

    callbacks.updateStepStatus('intent-recognition-topic', 'in_progress', intl.get("settings.aiMode.progress.messages.recognizingTopicIntent", { topic: trimmedTopic }))

    try {
        const openai = new OpenAI({
            apiKey: chatApiKey,
            baseURL: chatApiBaseURL,
            dangerouslyAllowBrowser: true
        })

        const prompt = getTopicIntentRecognitionPrompt(trimmedTopic)

        const completionParams: any = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: TOPIC_INTENT_RECOGNITION_SYSTEM_MESSAGE
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 500
        }

        // 某些模型可能不支持response_format，尝试添加但不强制
        try {
            completionParams.response_format = { type: "json_object" }
        } catch (e) {
            // 忽略错误，继续使用普通格式
        }

        const completion = await openai.chat.completions.create(completionParams)

        // 收集token使用量
        if (completion.usage && callbacks.updateTokenStatistics && tokenStatistics) {
            addTokenUsage(tokenStatistics, completion.usage, true)
            callbacks.updateTokenStatistics(tokenStatistics)
        }

        if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
            const responseText = completion.choices[0].message.content || ''
            
            // 解析JSON响应
            let responseData
            try {
                // 尝试提取JSON（可能包含markdown代码块）
                const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)
                const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText
                responseData = JSON.parse(jsonText)
            } catch (parseError) {
                // 解析失败，抛出错误（严格模式）
                callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionFailed"))
                throw new Error('主题意图识别失败：无法解析LLM返回的JSON响应')
            }

            // 提取改写后的查询
            if (responseData.rewrittenQuery && typeof responseData.rewrittenQuery === 'string') {
                const rewrittenQuery = responseData.rewrittenQuery.trim()
                if (rewrittenQuery.length > 0) {
                    callbacks.updateStepStatus('intent-recognition-topic', 'completed', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionCompleted"))
                    return rewrittenQuery
                }
            }
        }

        // 如果无法获取改写后的查询，抛出错误（严格模式）
        callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionFailed"))
        throw new Error('主题意图识别失败：LLM返回的响应中缺少rewrittenQuery字段')
    } catch (error) {
        // API调用失败，抛出错误（严格模式）
        if (error instanceof Error && error.message.includes('主题意图识别失败')) {
            // 已经是我们抛出的错误，直接重新抛出
            callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionFailed"))
            throw error
        } else {
            // API调用失败
            callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionFailed"))
            if (error instanceof OpenAI.APIError) {
                throw new Error(`主题意图识别失败: ${error.message}`)
            } else if (error instanceof Error) {
                throw new Error(`主题意图识别失败: ${error.message}`)
            } else {
                throw new Error(`主题意图识别失败: ${String(error)}`)
            }
        }
    }
}



// 步骤3: LLM初筛（基于标题快速过滤明显不符合主题的文章）
// 注意：此函数仅在文章数量 > 100 时被调用
export async function stepLLMPreliminaryFilter(
    articles: RSSItem[],
    intentGuidance: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<RSSItem[]> {
    const { chatApiKey, model, chatApiBaseURL } = config

    if (!chatApiBaseURL) {
        throw new Error('chatApiBaseURL未设置')
    }

    // 如果文章数量 <= 100，直接返回所有文章
    if (articles.length <= 100) {
        callbacks.updateStepStatus('llm-preliminary-filter', 'completed', intl.get("settings.aiMode.progress.messages.skippingPreliminaryFilter", { count: articles.length }))
        return articles
    }

    callbacks.updateStepStatus('llm-preliminary-filter', 'in_progress', intl.get("settings.aiMode.progress.messages.llmPreliminaryFiltering", { count: articles.length }), 0)

    const batchSize = 50 // 每批最多50篇文章（只分析标题，可以处理更多）
    const totalArticles = articles.length
    const totalBatches = Math.ceil(totalArticles / batchSize)
    
    // 创建所有批次
    const batches: Array<{ batch: RSSItem[], batchNumber: number, batchStart: number }> = []
    for (let batchStart = 0; batchStart < articles.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, articles.length)
        const batch = articles.slice(batchStart, batchEnd)
        const batchNumber = Math.floor(batchStart / batchSize) + 1
        batches.push({ batch, batchNumber, batchStart })
    }
    
    // 用于跟踪已完成的批次数量
    let completedCount = 0
    const allRelatedIndices = new Set<number>()
    
    // 更新进度的辅助函数（带节流）
    const updateProgress = () => {
        completedCount++
        const progress = Math.floor((completedCount / totalBatches) * 100)
        callbacks.updateStepStatus('llm-preliminary-filter', 'in_progress', 
            intl.get("settings.aiMode.progress.messages.llmPreliminaryFilteringInParallel", { 
                completed: completedCount, 
                total: totalBatches, 
                processed: Math.min(completedCount * batchSize, totalArticles), 
                totalArticles: totalArticles 
            }), 
            progress)
    }
    
    // 处理单个批次的函数
    const processBatch = async (batchInfo: { batch: RSSItem[], batchNumber: number, batchStart: number }) => {
        const { batch, batchNumber, batchStart } = batchInfo
        
        try {
            // 准备当前批次的文章标题（只提取标题）
            const titlesText = batch.map((article, index) => {
                return `Title ${index}: ${article.title || ''}`
            }).join('\n')

            const prompt = getLLMPreliminaryFilterPrompt(intentGuidance, titlesText)

            const openai = new OpenAI({
                apiKey: chatApiKey,
                baseURL: chatApiBaseURL,
                dangerouslyAllowBrowser: true
            })

            // 尝试使用JSON格式，如果不支持则回退到普通格式
            const completionParams: any = {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: LLM_PRELIMINARY_FILTER_SYSTEM_MESSAGE
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            }
            
            // 某些模型可能不支持response_format，尝试添加但不强制
            try {
                completionParams.response_format = { type: "json_object" }
            } catch (e) {
                // 忽略错误，继续使用普通格式
            }
            
            const completion = await openai.chat.completions.create(completionParams)
            
            // 收集token使用量
            if (completion.usage && callbacks.updateTokenStatistics && tokenStatistics) {
                addTokenUsage(tokenStatistics, completion.usage, true)
                callbacks.updateTokenStatistics(tokenStatistics)
            }
            
            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                const responseText = completion.choices[0].message.content || ''
                
                // 解析JSON响应
                let responseData
                try {
                    // 尝试提取JSON（可能包含markdown代码块）
                    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)
                    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText
                    responseData = JSON.parse(jsonText)
                } catch (parseError) {
                    // 解析失败，抛出错误（严格模式）
                    updateProgress()
                    throw new Error(`LLM初筛失败：批次 ${batchNumber} 无法解析LLM返回的JSON响应`)
                }

                // 提取相关文章索引
                if (responseData.relatedArticleIndices && Array.isArray(responseData.relatedArticleIndices)) {
                    responseData.relatedArticleIndices.forEach((idx: number) => {
                        if (typeof idx === 'number' && idx >= 0 && idx < batch.length) {
                            // 将批次内的索引转换为全局索引
                            const globalIndex = batchStart + idx
                            if (globalIndex >= 0 && globalIndex < articles.length) {
                                allRelatedIndices.add(globalIndex)
                            }
                        }
                    })
                } else {
                    // 如果响应格式不正确，抛出错误（严格模式）
                    updateProgress()
                    throw new Error(`LLM初筛失败：批次 ${batchNumber} LLM返回的响应中缺少relatedArticleIndices字段`)
                }
            } else {
                // 如果API调用失败或没有响应，抛出错误（严格模式）
                updateProgress()
                throw new Error(`LLM初筛失败：批次 ${batchNumber} LLM API没有返回有效响应`)
            }
            
            // 更新进度
            updateProgress()
        } catch (error) {
            // 批次处理失败，抛出错误（严格模式）
            updateProgress()
            if (error instanceof Error && error.message.includes('LLM初筛失败')) {
                // 已经是我们抛出的错误，直接重新抛出
                throw error
            } else {
                // API调用失败或其他错误
                if (error instanceof OpenAI.APIError) {
                    throw new Error(`LLM初筛失败：批次 ${batchInfo.batchNumber} API调用失败: ${error.message}`)
                } else if (error instanceof Error) {
                    throw new Error(`LLM初筛失败：批次 ${batchInfo.batchNumber} ${error.message}`)
                } else {
                    throw new Error(`LLM初筛失败：批次 ${batchInfo.batchNumber} ${String(error)}`)
                }
            }
        }
    }
    
    try {
        // 并行处理所有批次（严格模式：任何批次失败都会立即失败）
        await Promise.all(batches.map(batchInfo => processBatch(batchInfo)))
    } catch (error) {
        // 并行处理失败，更新状态并抛出错误（严格模式）
        callbacks.updateStepStatus('llm-preliminary-filter', 'error', intl.get("settings.aiMode.progress.messages.llmPreliminaryFilteringFailed"))
        if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`LLM初筛失败: ${String(error)}`)
        }
    }

    // 根据筛选结果返回相关文章
    const filteredArticles = articles.filter((_, index) => allRelatedIndices.has(index))
    
    // 如果筛选后没有文章，返回空数组
    if (filteredArticles.length === 0) {
        callbacks.updateStepStatus('llm-preliminary-filter', 'completed', intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterPreliminaryFilter"))
        return []
    }
    
    callbacks.updateStepStatus('llm-preliminary-filter', 'completed', intl.get("settings.aiMode.progress.messages.llmPreliminaryFilteringCompleted", { total: articles.length, filtered: filteredArticles.length }))
    return filteredArticles
}


// 步骤4: LLM精选（使用LLM严格判断文章是否真正讨论用户关注的主题）
// 注意：此函数使用意图识别后的指导（intentGuidance）而不是原始topic
export async function stepLLMRefine(
    articles: RSSItem[],
    intentGuidance: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<RSSItem[]> {
    const { chatApiKey, model, chatApiBaseURL } = config

    if (!chatApiBaseURL) {
        throw new Error('chatApiBaseURL未设置')
    }

    if (articles.length === 0) {
        // 即使没有文章，也要更新步骤状态，确保步骤可见
        callbacks.updateStepStatus('llm-refine', 'completed', intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterLLM"))
        return []
    }

    callbacks.updateStepStatus('llm-refine', 'in_progress', intl.get("settings.aiMode.progress.messages.llmFiltering", { count: articles.length }), 0)

    const batchSize = 5 // 每批最多5篇文章
    const totalArticles = articles.length
    const totalBatches = Math.ceil(totalArticles / batchSize)
    
    // 创建所有批次
    const batches: Array<{ batch: RSSItem[], batchNumber: number, batchStart: number }> = []
    for (let batchStart = 0; batchStart < articles.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, articles.length)
        const batch = articles.slice(batchStart, batchEnd)
        const batchNumber = Math.floor(batchStart / batchSize) + 1
        batches.push({ batch, batchNumber, batchStart })
    }
    
    // 用于跟踪已完成的批次数量
    let completedCount = 0
    const allRelatedIndices = new Set<number>()
    
    // 更新进度的辅助函数（带节流）
    const updateProgress = () => {
        completedCount++
        const progress = Math.floor((completedCount / totalBatches) * 100)
            callbacks.updateStepStatus('llm-refine', 'in_progress', 
            intl.get("settings.aiMode.progress.messages.llmFilteringInParallel", { 
                completed: completedCount, 
                total: totalBatches, 
                processed: Math.min(completedCount * batchSize, totalArticles), 
                totalArticles: totalArticles 
            }), 
            progress)
    }
    
    // 处理单个批次的函数
    const processBatch = async (batchInfo: { batch: RSSItem[], batchNumber: number, batchStart: number }) => {
        const { batch, batchNumber, batchStart } = batchInfo
        
        try {
            // 准备当前批次的文章文本
            const articlesText = batch.map((article, index) => {
                const dateStr = article.date.toLocaleDateString('en-US')
                const snippet = ((article.snippet || '') + ' ' + (article.content ? article.content.substring(0, 500) : '')).trim()
                return `Article ${index}:
Title: ${article.title}
Published Date: ${dateStr}
Summary: ${snippet}`
            }).join('\n\n')

            const prompt = getLLMRefinePrompt(intentGuidance, articlesText)

            const openai = new OpenAI({
                apiKey: chatApiKey,
                baseURL: chatApiBaseURL,
                dangerouslyAllowBrowser: true
            })

            // 尝试使用JSON格式，如果不支持则回退到普通格式
            const completionParams: any = {
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: LLM_REFINE_SYSTEM_MESSAGE
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            }
            
            // 某些模型可能不支持response_format，尝试添加但不强制
            try {
                completionParams.response_format = { type: "json_object" }
            } catch (e) {
                // 忽略错误，继续使用普通格式
            }
            
            const completion = await openai.chat.completions.create(completionParams)
            
            // 收集token使用量
            if (completion.usage && callbacks.updateTokenStatistics && tokenStatistics) {
                addTokenUsage(tokenStatistics, completion.usage, true)
                callbacks.updateTokenStatistics(tokenStatistics)
            }
            
            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                const responseText = completion.choices[0].message.content || ''
                
                // 解析JSON响应
                let responseData
                try {
                    // 尝试提取JSON（可能包含markdown代码块）
                    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)
                    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText
                    responseData = JSON.parse(jsonText)
                } catch (parseError) {
                    // 解析失败，抛出错误（严格模式）
                    updateProgress()
                    throw new Error(`LLM精选失败：批次 ${batchNumber} 无法解析LLM返回的JSON响应`)
                }

                // 提取相关文章索引
                if (responseData.relatedArticleIndices && Array.isArray(responseData.relatedArticleIndices)) {
                    responseData.relatedArticleIndices.forEach((idx: number) => {
                        if (typeof idx === 'number' && idx >= 0 && idx < batch.length) {
                            // 将批次内的索引转换为全局索引
                            const globalIndex = batchStart + idx
                            if (globalIndex >= 0 && globalIndex < articles.length) {
                                allRelatedIndices.add(globalIndex)
                            }
                        }
                    })
                } else {
                    // 如果响应格式不正确，抛出错误（严格模式）
                    updateProgress()
                    throw new Error(`LLM精选失败：批次 ${batchNumber} LLM返回的响应中缺少relatedArticleIndices字段`)
                }
            } else {
                // 如果API调用失败或没有响应，抛出错误（严格模式）
                updateProgress()
                throw new Error(`LLM精选失败：批次 ${batchNumber} LLM API没有返回有效响应`)
            }
            
            // 更新进度
            updateProgress()
        } catch (error) {
            // 批次处理失败，抛出错误（严格模式）
            updateProgress()
            if (error instanceof Error && error.message.includes('LLM精选失败')) {
                // 已经是我们抛出的错误，直接重新抛出
                throw error
            } else {
                // API调用失败或其他错误
                if (error instanceof OpenAI.APIError) {
                    throw new Error(`LLM精选失败：批次 ${batchInfo.batchNumber} API调用失败: ${error.message}`)
                } else if (error instanceof Error) {
                    throw new Error(`LLM精选失败：批次 ${batchInfo.batchNumber} ${error.message}`)
                } else {
                    throw new Error(`LLM精选失败：批次 ${batchInfo.batchNumber} ${String(error)}`)
                }
            }
        }
    }
    
    try {
        // 并行处理所有批次（严格模式：任何批次失败都会立即失败）
        await Promise.all(batches.map(batchInfo => processBatch(batchInfo)))
    } catch (error) {
        // 并行处理失败，更新状态并抛出错误（严格模式）
        callbacks.updateStepStatus('llm-refine', 'error', intl.get("settings.aiMode.progress.messages.llmFilteringFailed"))
        if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`LLM精选失败: ${String(error)}`)
        }
    }

    // 根据筛选结果返回相关文章
    const refinedArticles = articles.filter((_, index) => allRelatedIndices.has(index))
    
    // 如果筛选后没有文章，返回空数组
    if (refinedArticles.length === 0) {
        callbacks.updateStepStatus('llm-refine', 'completed', intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterLLM"))
        return []
    }
    
    callbacks.updateStepStatus('llm-refine', 'completed', intl.get("settings.aiMode.progress.messages.llmFilteringCompleted", { total: articles.length, refined: refinedArticles.length }))
    return refinedArticles
}

// ==================== 主函数 ====================

// 整理汇总文章（主函数）
export async function consolidate(
    timeRangeDays: number | null,
    topic: string | null,
    classificationStandard: string | null,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<{ articles: RSSItem[], timeRangeHasArticles: boolean, topicGuidance: string | null, tokenStatistics: TokenStatistics }> {
    // 初始化token统计
    const tokenStatistics = createInitialTokenStatistics()
    
    // 立即初始化token统计，让前端从一开始就显示token统计组件
    if (callbacks.updateTokenStatistics) {
        callbacks.updateTokenStatistics(tokenStatistics)
    }
    
    // 在开始之前统一验证所有配置并规范化 URL
    // 验证 Chat API 配置
    if (!config.chatApiEndpoint || !config.chatApiEndpoint.trim()) {
        throw new Error('请先配置Chat API Endpoint（在设置中配置）')
    }
    if (!config.chatApiKey || !config.chatApiKey.trim()) {
        throw new Error('请先配置Chat API Key（在设置中配置）')
    }
    if (!config.model || !config.model.trim()) {
        throw new Error('请先配置模型名称（在设置中配置）')
    }
    
    // 验证 Embedding API 配置
    if (!config.embeddingApiEndpoint || !config.embeddingApiEndpoint.trim()) {
        throw new Error('请先配置Embedding API Endpoint（在设置中配置）')
    }
    if (!config.embeddingApiKey || !config.embeddingApiKey.trim()) {
        throw new Error('请先配置Embedding API Key（在设置中配置）')
    }
    if (!config.embeddingModel || !config.embeddingModel.trim()) {
        throw new Error('请先配置Embedding模型名称（在设置中配置）')
    }
    
    // 规范化 URL
    let chatApiBaseURL: string
    let embeddingApiBaseURL: string
    try {
        chatApiBaseURL = normalizeApiEndpoint(config.chatApiEndpoint)
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Chat API Endpoint配置错误: ${error.message}`)
        }
        throw error
    }
    
    try {
        embeddingApiBaseURL = normalizeApiEndpoint(config.embeddingApiEndpoint)
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Embedding API Endpoint配置错误: ${error.message}`)
        }
        throw error
    }
    
    // 创建包含规范化 baseURL 的配置对象
    const normalizedConfig: ConsolidateConfig = {
        ...config,
        chatApiBaseURL,
        embeddingApiBaseURL
    }
    
    // 步骤1: 根据时间范围筛选
    const items = await stepQueryDatabase(timeRangeDays, callbacks)
    
    // 记录时间范围内是否有文章
    const timeRangeHasArticles = items.length > 0

    // 如果时间范围筛选后没有文章，更新 queryProgress，只保留 query-db 步骤，移除所有后续步骤
    if (items.length === 0) {
        if (callbacks.updateQueryProgress) {
            // 如果存在当前的 queryProgress，从中读取 query-db 步骤的消息，否则使用默认消息
            let queryDbMessage = intl.get("settings.aiMode.progress.messages.queryCompleted", { count: 0 })
            if (callbacks.getCurrentQueryProgress) {
                const currentProgress = callbacks.getCurrentQueryProgress()
                if (currentProgress) {
                    const queryDbStep = currentProgress.steps.find(step => step.id === 'query-db')
                    if (queryDbStep && queryDbStep.message) {
                        queryDbMessage = queryDbStep.message
                    }
                }
            }
            
            const steps: QueryProgressStep[] = [
                { id: 'query-db', title: intl.get("settings.aiMode.progress.steps.queryDb"), status: 'completed', message: queryDbMessage, visible: true }
            ]
            
            // 完全替换 steps，确保移除所有未执行的步骤（包括 classify-articles）
            callbacks.updateQueryProgress({
                steps,
                currentStepIndex: 0,
                currentMessage: intl.get("settings.aiMode.progress.messages.completed"),
                overallProgress: 100
            })
        }
        // 更新token统计
        if (callbacks.updateTokenStatistics) {
            callbacks.updateTokenStatistics(tokenStatistics)
        }
        return { articles: [], timeRangeHasArticles: false, topicGuidance: null, tokenStatistics }
    }

    // 如果没有话题，直接返回所有文章
    if (!topic || !topic.trim()) {
        // 更新token统计
        if (callbacks.updateTokenStatistics) {
            callbacks.updateTokenStatistics(tokenStatistics)
        }
        return { articles: items, timeRangeHasArticles: true, topicGuidance: null, tokenStatistics }
    }

    const trimmedTopic = topic.trim()

    // 步骤1.5: 主题意图识别
    const topicGuidance = await stepRecognizeTopicIntent(trimmedTopic, normalizedConfig, callbacks, tokenStatistics)

    // 步骤1.6: LLM初筛（仅在文章数量 > 100 时执行）
    let articlesToRefine = items
    const shouldPerformPreliminaryFilter = items.length > 100
    
    if (shouldPerformPreliminaryFilter) {
        // 更新queryProgress，添加LLM初筛步骤
        if (callbacks.updateQueryProgress) {
            const steps: QueryProgressStep[] = [
                { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true },
                { id: 'llm-preliminary-filter', title: intl.get("settings.aiMode.progress.steps.llmPreliminaryFilter"), status: 'pending', visible: true },
                { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: 'pending', visible: true }
            ]
            
            callbacks.updateQueryProgress({
                steps,
                currentStepIndex: 2, // 指向LLM初筛步骤
                currentMessage: intl.get("settings.aiMode.progress.messages.startLLMPreliminaryFilter")
            })
        }
        
        articlesToRefine = await stepLLMPreliminaryFilter(items, topicGuidance, normalizedConfig, callbacks, tokenStatistics)
        
        // 如果初筛后没有文章，提前返回
        if (articlesToRefine.length === 0) {
            if (callbacks.updateQueryProgress) {
                const steps: QueryProgressStep[] = [
                    { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                    { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true },
                    { id: 'llm-preliminary-filter', title: intl.get("settings.aiMode.progress.steps.llmPreliminaryFilter"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterPreliminaryFilter"), visible: true }
                ]
                
                callbacks.updateQueryProgress({
                    steps,
                    currentStepIndex: 2,
                    overallProgress: 100,
                    currentMessage: intl.get("settings.aiMode.progress.messages.completed")
                })
            }
            return { articles: [], timeRangeHasArticles: true, topicGuidance, tokenStatistics }
        }
        
        // 更新queryProgress，标记初筛完成，准备LLM精选
        if (callbacks.updateQueryProgress) {
            const steps: QueryProgressStep[] = [
                { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true },
                { id: 'llm-preliminary-filter', title: intl.get("settings.aiMode.progress.steps.llmPreliminaryFilter"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.llmPreliminaryFilteringCompleted", { total: items.length, filtered: articlesToRefine.length }), visible: true },
                { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: 'pending', visible: true }
            ]
            
            callbacks.updateQueryProgress({
                steps,
                currentStepIndex: 3, // 指向LLM精选步骤
                currentMessage: intl.get("settings.aiMode.progress.messages.startLLMRefine")
            })
        }
    } else {
        // 文章数量 <= 100，跳过初筛，直接进行LLM精选
        // 更新queryProgress，只保留步骤1、意图识别和LLM精选
        if (callbacks.updateQueryProgress) {
            const steps: QueryProgressStep[] = [
                { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true },
                { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: 'pending', visible: true }
            ]
            
            callbacks.updateQueryProgress({
                steps,
                currentStepIndex: 2, // 指向LLM精选步骤
                currentMessage: intl.get("settings.aiMode.progress.messages.startLLMRefine")
            })
        }
    }
    
    // 步骤2: LLM精选（使用改写后的查询，对文章进行筛选）
    const refinedArticles = await stepLLMRefine(articlesToRefine, topicGuidance, normalizedConfig, callbacks, tokenStatistics)
    
    // 如果LLM精选后没有文章，更新 queryProgress，只保留已执行的步骤
    if (refinedArticles.length === 0) {
        if (callbacks.updateQueryProgress) {
            const steps: QueryProgressStep[] = shouldPerformPreliminaryFilter
                ? [
                    { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                    { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true },
                    { id: 'llm-preliminary-filter', title: intl.get("settings.aiMode.progress.steps.llmPreliminaryFilter"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.llmPreliminaryFilteringCompleted", { total: items.length, filtered: articlesToRefine.length }), visible: true },
                    { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterLLM"), visible: true }
                ]
                : [
                    { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                    { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true },
                    { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterLLM"), visible: true }
                ]
            
            callbacks.updateQueryProgress({
                steps,
                currentStepIndex: shouldPerformPreliminaryFilter ? 3 : 2,
                overallProgress: 100,
                currentMessage: intl.get("settings.aiMode.progress.messages.completed")
            })
        }
        return { articles: [], timeRangeHasArticles: true, topicGuidance, tokenStatistics }
    }
    
    return { articles: refinedArticles, timeRangeHasArticles: true, topicGuidance, tokenStatistics }
}

// ==================== 分类函数 ====================
// 注意：分类功能已移除，此函数保留仅为向后兼容，实际不会被调用
export async function classifyArticles(
    articles: RSSItem[],
    topicGuidance: string | null,
    classificationGuidance: string | null,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<ArticleCluster[]> {
    // 分类功能已移除，返回空数组
    return []
}

