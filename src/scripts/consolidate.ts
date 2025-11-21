import OpenAI from "openai"
import * as db from "./db"
import lf from "lovefield"
import intl from "react-intl-universal"
import type { RSSItem } from "./models/item"
import type { QueryProgressStep, QueryProgress, ArticleCluster, TokenStatistics, TokenUsage } from "./models/ai-mode"
import {
    TOPIC_INTENT_RECOGNITION_SYSTEM_MESSAGE,
    getTopicIntentRecognitionPrompt,
    CLASSIFICATION_INTENT_RECOGNITION_SYSTEM_MESSAGE,
    getClassificationIntentRecognitionPrompt,
    LLM_REFINE_SYSTEM_MESSAGE,
    getLLMRefinePrompt,
    CLASSIFY_ARTICLES_SYSTEM_MESSAGE,
    getClassifyArticlesPrompt,
    CLASSIFICATION_DEDUPLICATION_SYSTEM_MESSAGE,
    getClassificationDeduplicationPrompt,
    HYDE_SYSTEM_MESSAGE,
    getHyDEPrompt
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
                    const snippet = article.snippet || ''
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

// 子步骤: 计算话题向量
async function stepComputeTopicEmbedding(
    textToVectorize: string,
    originalTopic: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    isHyDE: boolean = false,
    tokenStatistics?: TokenStatistics
): Promise<number[]> {
    const trimmedText = textToVectorize.trim()
    // 如果使用HyDE，显示原始主题；否则显示实际文本
    const displayTopic = isHyDE ? originalTopic.substring(0, 50) : trimmedText.substring(0, 50)
    callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.computingTopicEmbedding", { topic: displayTopic }))
    
    try {
        // 直接调用API计算embedding（不缓存）
        const topicEmbedding = await computeTopicEmbedding(trimmedText, config, callbacks, tokenStatistics)
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.topicEmbeddingCompleted"))
        return topicEmbedding
    } catch (error) {
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.topicEmbeddingFailed"))
        throw error
    }
}

// 子步骤: 加载已有文章向量
async function stepLoadEmbeddings(
    items: RSSItem[],
    callbacks: ConsolidateCallbacks
): Promise<number> {
    callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.loadingEmbeddings"))
    
    const itemIds = items.map(item => item._id)
    if (itemIds.length === 0) {
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.noArticlesToLoad"))
        return 0
    }

    try {
        // 批量查询所有文章的embedding
        const dbItems = await db.itemsDB
            .select(db.items._id, db.items.embedding)
            .from(db.items)
            .where(db.items._id.in(itemIds))
            .exec() as Array<{ _id: number, embedding?: number[] }>
        
        // 创建embedding映射
        const embeddingMap = new Map<number, number[]>()
        for (const dbItem of dbItems) {
            if (dbItem.embedding && Array.isArray(dbItem.embedding) && dbItem.embedding.length > 0) {
                embeddingMap.set(dbItem._id, dbItem.embedding)
            }
        }
        
        // 更新内存中的embedding
        let loadedCount = 0
        for (const item of items) {
            const embedding = embeddingMap.get(item._id)
            if (embedding) {
                item.embedding = embedding
                loadedCount++
            }
        }
        
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.embeddingsLoaded", { count: loadedCount }))
        return loadedCount
    } catch (error) {
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.loadEmbeddingsFailed"))
        return 0
    }
}

// 子步骤: 计算新文章向量
async function stepComputeEmbeddings(
    items: RSSItem[],
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<number> {
    // 过滤出还没有embedding的文章
    const articlesNeedingEmbedding = items.filter(item => {
        const embedding = item.embedding
        const hasEmbedding = embedding && Array.isArray(embedding) && embedding.length > 0
        return !hasEmbedding
    })

    if (articlesNeedingEmbedding.length === 0) {
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.allArticlesHaveEmbeddings"), 100)
        return 0
    }

    callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.needComputeEmbeddings", { count: articlesNeedingEmbedding.length }), 0)
    
    try {
        await computeAndStoreEmbeddings(articlesNeedingEmbedding, config, callbacks, tokenStatistics)
        
        // 计算完成后，批量重新加载这些文章的embedding
        const computedIds = articlesNeedingEmbedding.map(a => a._id)
        let computedCount = 0
        if (computedIds.length > 0) {
            try {
                const dbItems = await db.itemsDB
                    .select(db.items._id, db.items.embedding)
                    .from(db.items)
                    .where(db.items._id.in(computedIds))
                    .exec() as Array<{ _id: number, embedding?: number[] }>
                
                const embeddingMap = new Map<number, number[]>()
                for (const dbItem of dbItems) {
                    if (dbItem.embedding && Array.isArray(dbItem.embedding) && dbItem.embedding.length > 0) {
                        embeddingMap.set(dbItem._id, dbItem.embedding)
                    }
                }
                
                for (const article of articlesNeedingEmbedding) {
                    const embedding = embeddingMap.get(article._id)
                    if (embedding) {
                        article.embedding = embedding
                        computedCount++
                    }
                }
            } catch (error) {
                // 重新加载失败，抛出错误（严格模式）
                callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.computeEmbeddingsFailed"))
                if (error instanceof Error) {
                    throw new Error(`重新加载文章embedding失败: ${error.message}`)
                } else {
                    throw new Error(`重新加载文章embedding失败: ${String(error)}`)
                }
            }
        }
        
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.embeddingsComputed", { count: articlesNeedingEmbedding.length }), 100)
        return computedCount
    } catch (error) {
        // 计算embedding失败，更新状态并抛出错误（严格模式）
        callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.computeEmbeddingsFailed"))
        if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`计算文章embedding失败: ${String(error)}`)
        }
    }
}

// 步骤2: 向量检索（包含向量计算和相似度筛选）
export async function stepVectorRetrieval(
    topic: string,
    items: RSSItem[],
    topk: number,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<RSSItem[]> {
    callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.startVectorRetrieval"))
    
    const trimmedTopic = topic.trim()
    
    try {
        // 子步骤0: 生成HyDE假设文章（失败时直接抛出错误）
        const hypotheticalArticle = await stepGenerateHyDE(trimmedTopic, config, callbacks, tokenStatistics)
        
        // 子步骤1: 计算话题向量（使用假设文章）
        // 传入原始topic作为缓存key，但实际计算使用假设文章
        const topicEmbedding = await stepComputeTopicEmbedding(hypotheticalArticle, trimmedTopic, config, callbacks, true, tokenStatistics)
        
        // 子步骤2: 加载已有文章向量
        const loadedCount = await stepLoadEmbeddings(items, callbacks)
        
        // 子步骤3: 计算新文章向量
        const computedCount = await stepComputeEmbeddings(items, config, callbacks, tokenStatistics)
        
        
        // 子步骤4: 计算相似度并筛选
        callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.calculatingSimilarity"), 0)
        
        // 过滤出有embedding的文章
        const articlesWithEmbedding = items.filter(item => 
            item.embedding && Array.isArray(item.embedding) && item.embedding.length > 0
        )
        
        if (articlesWithEmbedding.length === 0) {
            callbacks.updateStepStatus('vector-retrieval', 'completed', intl.get("settings.aiMode.progress.messages.noArticlesForSimilarity"))
            return []
        }
        
        const totalItems = articlesWithEmbedding.length
        const batchSize = 50 // 每批处理50篇文章
        const articlesWithSimilarity: Array<{ article: RSSItem, similarity: number }> = []
        
        // 分批并行计算相似度
        for (let i = 0; i < articlesWithEmbedding.length; i += batchSize) {
            const batch = articlesWithEmbedding.slice(i, i + batchSize)
            
            // 并行计算当前批次的相似度
            const batchResults = await Promise.all(
                batch.map(item => {
                    return new Promise<{ article: RSSItem, similarity: number } | null>((resolve) => {
                        try {
                            const similarity = cosineSimilarity(topicEmbedding, item.embedding!)
                            resolve({ article: item, similarity })
                        } catch (error) {
                            // 忽略单个文章的计算错误
                            resolve(null)
                        }
                    })
                })
            )
            
            // 过滤掉null结果并添加到总结果中
            for (const result of batchResults) {
                if (result !== null) {
                    articlesWithSimilarity.push(result)
                }
            }
            
            // 更新进度
            const processedCount = Math.min(i + batchSize, totalItems)
            const progress = Math.floor((processedCount / totalItems) * 100)
            callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.calculatingSimilarityProgress", { processed: processedCount, total: totalItems }), progress)
        }

        // 按相似度降序排序
        articlesWithSimilarity.sort((a, b) => b.similarity - a.similarity)

        // 选择相似度最高的topk篇
        const selectedArticles = articlesWithSimilarity
            .slice(0, topk)
            .map(item => item.article)

        callbacks.updateStepStatus('vector-retrieval', 'completed', intl.get("settings.aiMode.progress.messages.similarityCalculated", { total: articlesWithSimilarity.length, selected: selectedArticles.length }))
        
        return selectedArticles
    } catch (error) {
        callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.vectorRetrievalFailed"))
        throw error
    }
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

// 子步骤: 分类标准意图识别（使用LLM理解如何分类）
async function stepRecognizeClassificationIntent(
    topic: string,
    classificationStandard: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<string> {
    const { chatApiKey, model, chatApiBaseURL } = config

    if (!chatApiBaseURL) {
        throw new Error('chatApiBaseURL未设置')
    }

    const trimmedTopic = topic.trim()
    const trimmedStandard = classificationStandard.trim()

    callbacks.updateStepStatus('intent-recognition-classification', 'in_progress', intl.get("settings.aiMode.progress.messages.recognizingClassificationIntent", { standard: trimmedStandard }))

    try {
        const openai = new OpenAI({
            apiKey: chatApiKey,
            baseURL: chatApiBaseURL,
            dangerouslyAllowBrowser: true
        })

        const prompt = getClassificationIntentRecognitionPrompt(trimmedTopic, trimmedStandard)

        const completionParams: any = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: CLASSIFICATION_INTENT_RECOGNITION_SYSTEM_MESSAGE
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
                callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionFailed"))
                throw new Error('分类标准意图识别失败：无法解析LLM返回的JSON响应')
            }

            // 提取分类指导信息
            if (responseData.classificationGuidance && typeof responseData.classificationGuidance === 'string') {
                const classificationGuidance = responseData.classificationGuidance.trim()
                if (classificationGuidance.length > 0) {
                    callbacks.updateStepStatus('intent-recognition-classification', 'completed', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionCompleted"))
                    return classificationGuidance
                }
            }
        }

        // 如果无法获取分类指导信息，抛出错误（严格模式）
        callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionFailed"))
        throw new Error('分类标准意图识别失败：LLM返回的响应中缺少classificationGuidance字段')
    } catch (error) {
        // API调用失败，抛出错误（严格模式）
        if (error instanceof Error && error.message.includes('分类标准意图识别失败')) {
            // 已经是我们抛出的错误，直接重新抛出
            callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionFailed"))
            throw error
        } else {
            // API调用失败
            callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionFailed"))
            if (error instanceof OpenAI.APIError) {
                throw new Error(`分类标准意图识别失败: ${error.message}`)
            } else if (error instanceof Error) {
                throw new Error(`分类标准意图识别失败: ${error.message}`)
            } else {
                throw new Error(`分类标准意图识别失败: ${String(error)}`)
            }
        }
    }
}


// 子步骤: HyDE生成（根据主题生成假设文章）
async function stepGenerateHyDE(
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

    callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.generatingHyDE", { topic: trimmedTopic }))

    try {
        const openai = new OpenAI({
            apiKey: chatApiKey,
            baseURL: chatApiBaseURL,
            dangerouslyAllowBrowser: true
        })

        const prompt = getHyDEPrompt(trimmedTopic)

        const completionParams: any = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: HYDE_SYSTEM_MESSAGE
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
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
                // 解析失败，抛出错误
                callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.hydeGenerationFailed"))
                throw new Error('HyDE生成失败：无法解析LLM返回的JSON响应')
            }

            // 提取生成的假设文章（RSS格式：title和snippet）
            if (responseData.title && responseData.snippet && typeof responseData.title === 'string' && typeof responseData.snippet === 'string') {
                // 使用与RSS文章向量化相同的格式：title\nsnippet
                const hypotheticalArticle = `${responseData.title.trim()}\n${responseData.snippet.trim()}`.trim()
                if (hypotheticalArticle.length > 0) {
                    // HyDE 生成完成，更新向量检索步骤的消息，然后继续执行向量检索的其他子步骤
                    callbacks.updateStepStatus('vector-retrieval', 'in_progress', intl.get("settings.aiMode.progress.messages.hydeGenerationCompleted"))
                    return hypotheticalArticle
                }
            }
            
            // 如果响应格式不正确，抛出错误
            callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.hydeGenerationFailed"))
            throw new Error('HyDE生成失败：LLM返回的响应格式不正确（缺少title或snippet字段）')
        } else {
            // 如果API没有返回有效响应，抛出错误
            callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.hydeGenerationFailed"))
            throw new Error('HyDE生成失败：LLM API没有返回有效响应')
        }
    } catch (error) {
        // API调用失败，抛出错误
        if (error instanceof Error) {
            callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.hydeGenerationFailed"))
            throw error
        } else {
            callbacks.updateStepStatus('vector-retrieval', 'error', intl.get("settings.aiMode.progress.messages.hydeGenerationFailed"))
            throw new Error(`HyDE生成失败: ${String(error)}`)
        }
    }
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
                const snippet = article.snippet || (article.content ? article.content.substring(0, 300) : '')
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
): Promise<{ articles: RSSItem[], timeRangeHasArticles: boolean, topicGuidance: string | null, classificationGuidance: string | null }> {
    // 初始化token统计
    const tokenStatistics = createInitialTokenStatistics()
    
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
        return { articles: [], timeRangeHasArticles: false, topicGuidance: null, classificationGuidance: null }
    }

    // 如果没有话题，直接返回所有文章
    if (!topic || !topic.trim()) {
        // 更新token统计
        if (callbacks.updateTokenStatistics) {
            callbacks.updateTokenStatistics(tokenStatistics)
        }
        return { articles: items, timeRangeHasArticles: true, topicGuidance: null, classificationGuidance: null }
    }

    const trimmedTopic = topic.trim()
    const { topk } = config

    // 步骤1.5: 主题意图识别和分类标准意图识别（并行执行）
    // 使用原始topic而不是话题意图识别后的指导（topicGuidance）
    let topicGuidance: string
    let classificationGuidance: string | null = null
    if (classificationStandard && classificationStandard.trim()) {
        // 并行执行两个意图识别步骤
        const [topicGuidanceResult, classificationGuidanceResult] = await Promise.all([
            stepRecognizeTopicIntent(trimmedTopic, normalizedConfig, callbacks, tokenStatistics),
            stepRecognizeClassificationIntent(trimmedTopic, classificationStandard, normalizedConfig, callbacks, tokenStatistics)
        ])
        topicGuidance = topicGuidanceResult
        classificationGuidance = classificationGuidanceResult
    } else {
        // 只有主题意图识别
        topicGuidance = await stepRecognizeTopicIntent(trimmedTopic, normalizedConfig, callbacks, tokenStatistics)
    }

    // 如果文章数量小于等于topk，不需要计算embedding和相似度，直接进行LLM精选
    if (items.length <= topk) {
        // 更新queryProgress，移除embedding相关步骤，只保留步骤1、意图识别和LLM精选
        // 注意：分类步骤由调用方根据是否有分类依据决定是否添加
        if (callbacks.updateQueryProgress) {
            const intentSteps: QueryProgressStep[] = [
                { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true }
            ]
            if (classificationStandard && classificationStandard.trim()) {
                intentSteps.push({ id: 'intent-recognition-classification', title: intl.get("settings.aiMode.progress.steps.intentRecognitionClassification"), status: 'completed', visible: true })
            }
            const steps: QueryProgressStep[] = [
                { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                ...intentSteps,
                { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: 'pending', visible: true }
            ]
            
            callbacks.updateQueryProgress({
                steps,
                currentStepIndex: intentSteps.length + 1, // 指向LLM精选步骤
                currentMessage: intl.get("settings.aiMode.progress.messages.skipSimilarityCalculation", { count: items.length, topk: topk })
            })
        }
        
        // 步骤2: LLM精选（使用改写后的查询）
        const refinedArticles = await stepLLMRefine(items, topicGuidance, normalizedConfig, callbacks, tokenStatistics)
        
        // 如果LLM精选后没有文章，更新 queryProgress，只保留已执行的步骤，移除所有未执行的步骤
        if (refinedArticles.length === 0) {
            if (callbacks.updateQueryProgress) {
                const intentSteps: QueryProgressStep[] = [
                    { id: 'intent-recognition-topic', title: intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"), status: 'completed', visible: true }
                ]
                if (classificationStandard && classificationStandard.trim()) {
                    intentSteps.push({ id: 'intent-recognition-classification', title: intl.get("settings.aiMode.progress.steps.intentRecognitionClassification"), status: 'completed', visible: true })
                }
                const steps: QueryProgressStep[] = [
                    { id: 'query-db', title: intl.get("settings.aiMode.progress.messages.filterByTimeRange"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.queryCompleted", { count: items.length }), visible: true },
                    ...intentSteps,
                    { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: 'completed', message: intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterLLM"), visible: true }
                ]
                
                callbacks.updateQueryProgress({
                    steps,
                    currentStepIndex: intentSteps.length + 1,
                    overallProgress: 100,
                    currentMessage: intl.get("settings.aiMode.progress.messages.completed")
                })
            }
            return { articles: [], timeRangeHasArticles: true, topicGuidance, classificationGuidance }
        }
        
        return { articles: refinedArticles, timeRangeHasArticles: true, topicGuidance, classificationGuidance }
    }

    try {
        // 步骤2: 向量检索（包含向量计算和相似度筛选）
        const selectedArticles = await stepVectorRetrieval(trimmedTopic, items, topk, normalizedConfig, callbacks, tokenStatistics)
        
        // 步骤3: LLM精选（使用改写后的查询）
        const refinedArticles = await stepLLMRefine(selectedArticles, topicGuidance, normalizedConfig, callbacks, tokenStatistics)
        
        // 如果LLM精选后没有文章，立即更新 queryProgress，只保留已执行的步骤，移除所有未执行的步骤（包括 classify-articles）
        if (refinedArticles.length === 0) {
            if (callbacks.updateQueryProgress && callbacks.getCurrentQueryProgress) {
                const currentProgress = callbacks.getCurrentQueryProgress()
                if (currentProgress) {
                    // 只保留已执行的步骤（query-db, intent-recognition-topic, intent-recognition-classification, vector-retrieval, llm-refine）
                    // 注意：hyde-generation 和 calculate-similarity 不再作为独立步骤，它们现在是 vector-retrieval 的子步骤
                    // 明确排除 classify-articles 和其他未执行的步骤
                    const executedStepIds = ['query-db', 'intent-recognition-topic', 'vector-retrieval', 'llm-refine']
                    if (classificationStandard && classificationStandard.trim()) {
                        executedStepIds.splice(2, 0, 'intent-recognition-classification')
                    }
                    const executedSteps = currentProgress.steps
                        .filter(step => executedStepIds.includes(step.id))
                        .map(step => ({
                            ...step,
                            status: 'completed' as const,
                            visible: true
                        }))
                    
                    // 完全替换 steps，确保移除所有未执行的步骤（包括 classify-articles）
                    // 使用完整的 QueryProgress 对象，确保 reducer 不会重新计算可见性
                    const finalProgress: QueryProgress = {
                        steps: executedSteps,
                        currentStepIndex: executedSteps.length - 1,
                        overallProgress: 100,
                        currentMessage: intl.get("settings.aiMode.progress.messages.completed")
                    }
                    callbacks.updateQueryProgress(finalProgress)
                }
            }
            return { articles: [], timeRangeHasArticles: true, topicGuidance, classificationGuidance }
        }
        
        return { articles: refinedArticles, timeRangeHasArticles: true, topicGuidance, classificationGuidance }
    } catch (error) {
        throw error
    }
}

// ==================== 分类函数 ====================

// 对文章进行分类分析
export async function classifyArticles(
    articles: RSSItem[],
    topicGuidance: string | null,
    classificationGuidance: string | null,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks,
    tokenStatistics?: TokenStatistics
): Promise<ArticleCluster[]> {
    const { chatApiKey, model, chatApiBaseURL } = config

    // 如果没有传入 tokenStatistics，创建一个新的（用于单独调用 classifyArticles 的情况）
    const stats = tokenStatistics || createInitialTokenStatistics()

    if (articles.length === 0) {
        return []
    }

    if (!chatApiBaseURL) {
        throw new Error('chatApiBaseURL未设置')
    }

    // 更新进度：开始分类
    callbacks.updateStepStatus('classify-articles', 'in_progress', intl.get("settings.aiMode.progress.messages.analyzingAndClassifying", { count: articles.length }))

    // 准备文章内容
    const articlesToAnalyze = articles  // 分析所有文章
    const batchSize = 5  // 每批5篇文章
    const totalArticles = articlesToAnalyze.length
    const totalBatches = Math.ceil(totalArticles / batchSize)

    // 创建所有批次
    const batches: Array<{ batch: RSSItem[], batchNumber: number, batchStart: number }> = []
    for (let batchStart = 0; batchStart < articlesToAnalyze.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, articlesToAnalyze.length)
        const batch = articlesToAnalyze.slice(batchStart, batchEnd)
        const batchNumber = Math.floor(batchStart / batchSize) + 1
        batches.push({ batch, batchNumber, batchStart })
    }

    // 用于跟踪已完成的批次数量
    let completedCount = 0
    const allClassifications: Array<{ articleIndex: number, category: string }> = []

    // 更新进度的辅助函数
    const updateProgress = () => {
        completedCount++
        const progress = Math.floor((completedCount / totalBatches) * 100)
            callbacks.updateStepStatus('classify-articles', 'in_progress', 
            intl.get("settings.aiMode.progress.messages.classifyingInParallel", { 
                completed: completedCount, 
                total: totalBatches, 
                processed: Math.min(completedCount * batchSize, totalArticles), 
                totalArticles: totalArticles 
            }), 
            progress)
    }

    // 提示词将在 processBatch 中动态生成

    // 处理单个批次的函数
    const processBatch = async (batchInfo: { batch: RSSItem[], batchNumber: number, batchStart: number }) => {
        const { batch, batchNumber, batchStart } = batchInfo

        try {
            // 准备当前批次的文章文本
            const articlesText = batch.map((article, index) => {
                const dateStr = article.date.toLocaleDateString('en-US')
                const snippet = article.snippet || (article.content ? article.content.substring(0, 300) : '')
                return `Article ${index}:
Title: ${article.title}
Published Date: ${dateStr}
Summary: ${snippet}`
            }).join('\n\n')

            const prompt = getClassifyArticlesPrompt(topicGuidance, classificationGuidance, articlesText)

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
                        content: CLASSIFY_ARTICLES_SYSTEM_MESSAGE
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
            if (completion.usage && callbacks.updateTokenStatistics) {
                addTokenUsage(stats, completion.usage, true)
                callbacks.updateTokenStatistics(stats)
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
                    throw new Error(`文章分类失败：批次 ${batchNumber} 无法解析LLM返回的JSON响应`)
                }

                // 提取分类结果
                if (responseData.classifications && Array.isArray(responseData.classifications)) {
                    responseData.classifications.forEach((item: any) => {
                        if (typeof item.articleIndex === 'number' && item.category && typeof item.category === 'string') {
                            if (item.articleIndex >= 0 && item.articleIndex < batch.length) {
                                // 将批次内索引转换为全局索引
                                const globalIndex = batchStart + item.articleIndex
                                if (globalIndex >= 0 && globalIndex < articlesToAnalyze.length) {
                                    allClassifications.push({
                                        articleIndex: globalIndex,
                                        category: item.category.trim()
                                    })
                                }
                            }
                        }
                    })
                } else {
                    // 如果响应格式不正确，抛出错误（严格模式）
                    updateProgress()
                    throw new Error(`文章分类失败：批次 ${batchNumber} LLM返回的响应中缺少classifications字段`)
                }
            } else {
                // 如果API调用失败或没有响应，抛出错误（严格模式）
                updateProgress()
                throw new Error(`文章分类失败：批次 ${batchNumber} LLM API没有返回有效响应`)
            }

            // 更新进度
            updateProgress()
        } catch (error) {
            // 批次处理失败，抛出错误（严格模式）
            updateProgress()
            if (error instanceof Error && error.message.includes('文章分类失败')) {
                // 已经是我们抛出的错误，直接重新抛出
                throw error
            } else {
                // API调用失败或其他错误
                if (error instanceof OpenAI.APIError) {
                    throw new Error(`文章分类失败：批次 ${batchInfo.batchNumber} API调用失败: ${error.message}`)
                } else if (error instanceof Error) {
                    throw new Error(`文章分类失败：批次 ${batchInfo.batchNumber} ${error.message}`)
                } else {
                    throw new Error(`文章分类失败：批次 ${batchInfo.batchNumber} ${String(error)}`)
                }
            }
        }
    }
    
    try {
        // 并行处理所有批次（严格模式：任何批次失败都会立即失败）
        await Promise.all(batches.map(batchInfo => processBatch(batchInfo)))
    } catch (error) {
        // 并行处理失败，更新状态并抛出错误（严格模式）
        callbacks.updateStepStatus('classify-articles', 'error', intl.get("settings.aiMode.progress.messages.classificationFailed"))
        if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`文章分类失败: ${String(error)}`)
        }
    }

    // 如果没有任何分类结果，返回空数组
    if (allClassifications.length === 0) {
        callbacks.updateStepStatus('classify-articles', 'completed', intl.get("settings.aiMode.progress.messages.classificationCompletedNoResults"))
        return []
    }

    // 分类去重和合并（仅当有多批时执行）
    let categoryMap = new Map<string, string>() // 原始分类名称 -> 标准分类名称

    if (totalBatches > 1) {
        // 收集所有唯一的分类名称
        const uniqueCategories = Array.from(new Set(allClassifications.map(c => c.category)))
        
        if (uniqueCategories.length > 0) {
            try {
                callbacks.updateStepStatus('classify-articles', 'in_progress', intl.get("settings.aiMode.progress.messages.mergingDuplicateCategories"))

                const openai = new OpenAI({
                    apiKey: chatApiKey,
                    baseURL: chatApiBaseURL,
                    dangerouslyAllowBrowser: true
                })

                const deduplicationPrompt = getClassificationDeduplicationPrompt(uniqueCategories)

                const completionParams: any = {
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: CLASSIFICATION_DEDUPLICATION_SYSTEM_MESSAGE
                        },
                        {
                            role: 'user',
                            content: deduplicationPrompt
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 2000
                }

                try {
                    completionParams.response_format = { type: "json_object" }
                } catch (e) {
                    // 忽略错误
                }

                const completion = await openai.chat.completions.create(completionParams)

                // 收集token使用量
                if (completion.usage && callbacks.updateTokenStatistics) {
                    addTokenUsage(stats, completion.usage, true)
                    callbacks.updateTokenStatistics(stats)
                }

                if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                    const responseText = completion.choices[0].message.content || ''

                    try {
                        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)
                        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText
                        const responseData = JSON.parse(jsonText)

                        if (responseData.synonymGroups && Array.isArray(responseData.synonymGroups)) {
                            responseData.synonymGroups.forEach((group: any) => {
                                if (group.standardName && group.synonyms && Array.isArray(group.synonyms)) {
                                    group.synonyms.forEach((synonym: string) => {
                                        if (typeof synonym === 'string') {
                                            categoryMap.set(synonym.trim(), group.standardName.trim())
                                        }
                                    })
                                }
                            })
                        } else {
                            // 如果响应格式不正确，抛出错误（严格模式）
                            throw new Error('分类去重失败：LLM返回的响应中缺少synonymGroups字段')
                        }
                    } catch (parseError) {
                        // 解析失败，抛出错误（严格模式）
                        if (parseError instanceof Error && parseError.message.includes('分类去重失败')) {
                            throw parseError
                        } else {
                            throw new Error('分类去重失败：无法解析LLM返回的JSON响应')
                        }
                    }
                } else {
                    // 如果API调用失败或没有响应，抛出错误（严格模式）
                    throw new Error('分类去重失败：LLM API没有返回有效响应')
                }
            } catch (error) {
                // 去重失败，抛出错误（严格模式）
                callbacks.updateStepStatus('classify-articles', 'error', intl.get("settings.aiMode.progress.messages.classificationFailed"))
                if (error instanceof Error && error.message.includes('分类去重失败')) {
                    throw error
                } else if (error instanceof OpenAI.APIError) {
                    throw new Error(`分类去重失败: ${error.message}`)
                } else if (error instanceof Error) {
                    throw new Error(`分类去重失败: ${error.message}`)
                } else {
                    throw new Error(`分类去重失败: ${String(error)}`)
                }
            }
        }
    }

    // 应用分类映射（如果有）
    const mappedClassifications = allClassifications.map(c => ({
        articleIndex: c.articleIndex,
        category: categoryMap.get(c.category) || c.category
    }))

    // 按分类名称分组
    const categoryGroups = new Map<string, number[]>()
    mappedClassifications.forEach(c => {
        if (!categoryGroups.has(c.category)) {
            categoryGroups.set(c.category, [])
        }
        categoryGroups.get(c.category)!.push(c.articleIndex)
    })

    // 生成 ArticleCluster 数组
    // 注意：允许一篇文章属于多个分类，但同一分类内去重
    const clusters: ArticleCluster[] = Array.from(categoryGroups.entries()).map(([category, indices], index) => {
        // 对同一分类内的索引去重（避免LLM错误返回重复条目）
        const uniqueIndices = Array.from(new Set(indices))
        return {
            id: `cluster-${index}`,
            title: category,
            description: intl.get("settings.aiMode.results.clusterDescription", { count: uniqueIndices.length }),
            articles: uniqueIndices.map(idx => articlesToAnalyze[idx])
        }
    })

    // 处理未被分配的文章（如果有）
    const assignedIndices = new Set(mappedClassifications.map(c => c.articleIndex))
    const unassignedArticles: RSSItem[] = []
    articlesToAnalyze.forEach((article, idx) => {
        if (!assignedIndices.has(idx)) {
            unassignedArticles.push(article)
        }
    })

    // 如果有未分配的文章，创建一个"其他"分类
    if (unassignedArticles.length > 0) {
        clusters.push({
            id: 'cluster-other',
            title: intl.get("settings.aiMode.results.otherCategory"),
            description: intl.get("settings.aiMode.results.unclassifiedDescription"),
            articles: unassignedArticles
        })
    }

    callbacks.updateStepStatus('classify-articles', 'completed', intl.get("settings.aiMode.progress.messages.classificationCompleted", { count: clusters.length }))
    return clusters
}

