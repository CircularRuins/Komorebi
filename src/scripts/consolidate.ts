import OpenAI from "openai"
import * as db from "./db"
import lf from "lovefield"
import intl from "react-intl-universal"
import type { RSSItem } from "./models/item"
import type { QueryProgressStep, QueryProgress, ArticleCluster } from "./models/ai-mode"
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
    getClassificationDeduplicationPrompt
} from "./prompts"

// ==================== 配置和回调接口 ====================

export interface ConsolidateConfig {
    chatApiEndpoint: string
    chatApiKey: string
    embeddingApiEndpoint: string
    embeddingApiKey: string
    embeddingModel: string
    model: string
    topk: number
}

export interface ConsolidateCallbacks {
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => void
    updateQueryProgress?: (progress: Partial<QueryProgress>) => void
    getCurrentQueryProgress?: () => QueryProgress | null
}

// ==================== 缓存相关函数 ====================

function getTopicEmbeddingCacheKey(topic: string, embeddingModel: string): string {
    const normalizedTopic = topic.trim().toLowerCase()
    const normalizedModel = embeddingModel.trim()
    return `topic-embedding-${normalizedModel}-${normalizedTopic}`
}

function loadTopicEmbeddingFromCache(topic: string, embeddingModel: string): number[] | null {
    try {
        const cacheKey = getTopicEmbeddingCacheKey(topic, embeddingModel)
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
            const embedding = JSON.parse(cached)
            if (Array.isArray(embedding) && embedding.length > 0) {
                return embedding
            }
        }
    } catch (error) {
    }
    return null
}

function saveTopicEmbeddingToCache(topic: string, embeddingModel: string, embedding: number[]): void {
    const cacheKey = getTopicEmbeddingCacheKey(topic, embeddingModel)
    try {
        localStorage.setItem(cacheKey, JSON.stringify(embedding))
        
        // 限制缓存数量，避免localStorage过大（最多保留100个话题的embedding）
        cleanupTopicEmbeddingCache(embeddingModel, 100)
    } catch (error) {
        // 如果localStorage满了，尝试清理一些旧的缓存
        if (error instanceof DOMException && error.code === 22) {
            cleanupTopicEmbeddingCache(embeddingModel, 50)
            try {
                localStorage.setItem(cacheKey, JSON.stringify(embedding))
            } catch (retryError) {
            }
        }
    }
}

function cleanupTopicEmbeddingCache(embeddingModel: string, keepCount: number): void {
    try {
        const prefix = `topic-embedding-${embeddingModel.trim()}-`
        const keys: string[] = []
        
        // 收集所有相关缓存key
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(prefix)) {
                keys.push(key)
            }
        }
        
        // 如果超过限制，删除最旧的（按key排序，删除前面的）
        if (keys.length > keepCount) {
            keys.sort() // 按字母顺序排序，删除旧的
            const toDelete = keys.slice(0, keys.length - keepCount)
            for (const key of toDelete) {
                localStorage.removeItem(key)
            }
        }
    } catch (error) {
    }
}

// ==================== 辅助函数 ====================

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
export async function computeTopicEmbedding(
    topic: string,
    config: ConsolidateConfig
): Promise<number[]> {
    const { embeddingApiEndpoint, embeddingApiKey, embeddingModel } = config

    // 验证API配置
    if (!embeddingApiEndpoint || !embeddingApiEndpoint.trim()) {
        throw new Error('请先配置Embedding API Endpoint（在设置中配置）')
    }
    if (!embeddingApiKey || !embeddingApiKey.trim()) {
        throw new Error('请先配置Embedding API Key（在设置中配置）')
    }
    if (!embeddingModel || !embeddingModel.trim()) {
        throw new Error('请先配置Embedding模型名称（在设置中配置）')
    }

    const modelToUse = embeddingModel.trim()
    const trimmedTopic = topic.trim()

    // 先尝试从缓存加载
    const cachedEmbedding = loadTopicEmbeddingFromCache(trimmedTopic, modelToUse)
    if (cachedEmbedding) {
        return cachedEmbedding
    }

    // 缓存中没有，需要计算

    // 规范化endpoint URL
    let normalizedEndpoint = embeddingApiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        throw new Error('Embedding API Endpoint必须以http://或https://开头')
    }

    // 提取base URL（用于embedding API）
    let baseURL = normalizedEndpoint
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
        throw new Error(`无效的Embedding API Endpoint URL: ${normalizedEndpoint}`)
    }

    try {
        const openai = new OpenAI({
            apiKey: embeddingApiKey,
            baseURL: baseURL,
            dangerouslyAllowBrowser: true
        })

        // 调用embedding API
        const response = await openai.embeddings.create({
            model: modelToUse,
            input: trimmedTopic,
        })

        if (response.data && response.data.length > 0 && response.data[0].embedding) {
            const embedding = response.data[0].embedding
            
            // 保存到缓存
            saveTopicEmbeddingToCache(trimmedTopic, modelToUse, embedding)
            
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
    callbacks: ConsolidateCallbacks
): Promise<void> {
    const { embeddingApiEndpoint, embeddingApiKey, embeddingModel } = config

    if (articles.length === 0) {
        return
    }

    // 验证API配置
    if (!embeddingApiEndpoint || !embeddingApiEndpoint.trim()) {
        return
    }
    if (!embeddingApiKey || !embeddingApiKey.trim()) {
        return
    }

    // 规范化endpoint URL
    let normalizedEndpoint = embeddingApiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        return
    }

    // 提取base URL（用于embedding API）
    let baseURL = normalizedEndpoint
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
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
            baseURL: baseURL,
            dangerouslyAllowBrowser: true
        })

        // 验证embedding模型配置
        if (!embeddingModel || !embeddingModel.trim()) {
            return
        }

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
            callbacks.updateStepStatus('vectorize-text', 'in_progress', 
                intl.get("settings.aiMode.progress.messages.computingVectorsInParallel", { 
                    completed: completedCount, 
                    total: totalBatches, 
                    processed: Math.min(completedCount * batchSize, totalArticles), 
                    totalArticles: totalArticles 
                }), 
                progress)
        }
        
        // 处理单个批次的函数
        const processBatch = async (batchInfo: { batch: RSSItem[], batchNumber: number, batchStart: number }) => {
            const { batch, batchNumber } = batchInfo
            
            try {
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

                // 存储embedding到数据库
                const embeddings = response.data.map(item => item.embedding)
                
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
                // 即使某个批次失败，也更新进度计数
                updateProgress()
                // 不抛出错误，避免影响其他批次
            }
        }
        
        // 并行处理所有批次
        await Promise.allSettled(batches.map(batchInfo => processBatch(batchInfo)))

    } catch (error: any) {
        // 不抛出错误，避免影响主流程
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
    topic: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<number[]> {
    const trimmedTopic = topic.trim()
    callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.computingTopicEmbedding", { topic: trimmedTopic }))
    
    try {
        const topicEmbedding = await computeTopicEmbedding(trimmedTopic, config)
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.topicEmbeddingCompleted"))
        return topicEmbedding
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.topicEmbeddingFailed"))
        throw error
    }
}

// 子步骤: 加载已有文章向量
async function stepLoadEmbeddings(
    items: RSSItem[],
    callbacks: ConsolidateCallbacks
): Promise<void> {
    callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.loadingEmbeddings"))
    
    const itemIds = items.map(item => item._id)
    if (itemIds.length === 0) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.noArticlesToLoad"))
        return
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
        
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.embeddingsLoaded", { count: loadedCount }))
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.loadEmbeddingsFailed"))
    }
}

// 子步骤: 计算新文章向量
async function stepComputeEmbeddings(
    items: RSSItem[],
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<void> {
    // 过滤出还没有embedding的文章
    const articlesNeedingEmbedding = items.filter(item => {
        const embedding = item.embedding
        const hasEmbedding = embedding && Array.isArray(embedding) && embedding.length > 0
        return !hasEmbedding
    })

    if (articlesNeedingEmbedding.length === 0) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.allArticlesHaveEmbeddings"), 100)
        return
    }

    callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.needComputeEmbeddings", { count: articlesNeedingEmbedding.length }), 0)
    
    try {
        await computeAndStoreEmbeddings(articlesNeedingEmbedding, config, callbacks)
        
        // 计算完成后，批量重新加载这些文章的embedding
        const computedIds = articlesNeedingEmbedding.map(a => a._id)
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
                    }
                }
            } catch (error) {
                // 忽略重新加载错误，继续执行
            }
        }
        
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.embeddingsComputed", { count: articlesNeedingEmbedding.length }), 100)
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.computeEmbeddingsFailed"))
        // 继续执行，只使用已有embedding的文章
    }
}

// 步骤2: 文本向量化（合并原步骤2、3、4）
export async function stepVectorizeText(
    topic: string,
    items: RSSItem[],
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<number[]> {
    callbacks.updateStepStatus('vectorize-text', 'in_progress', intl.get("settings.aiMode.progress.messages.startVectorization"))
    
    const trimmedTopic = topic.trim()
    
    try {
        // 子步骤1: 计算话题向量
        const topicEmbedding = await stepComputeTopicEmbedding(trimmedTopic, config, callbacks)
        
        // 子步骤2: 加载已有文章向量
        await stepLoadEmbeddings(items, callbacks)
        
        // 子步骤3: 计算新文章向量
        await stepComputeEmbeddings(items, config, callbacks)
        
        callbacks.updateStepStatus('vectorize-text', 'completed', intl.get("settings.aiMode.progress.messages.vectorizationCompleted"))
        return topicEmbedding
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'error', intl.get("settings.aiMode.progress.messages.vectorizationFailed"))
        throw error
    }
}

// 步骤3: 计算相似度并筛选
export async function stepCalculateSimilarity(
    items: RSSItem[],
    topicEmbedding: number[],
    topk: number,
    callbacks: ConsolidateCallbacks
): Promise<RSSItem[]> {
    callbacks.updateStepStatus('calculate-similarity', 'in_progress', intl.get("settings.aiMode.progress.messages.calculatingSimilarity"), 0)
    
    // 过滤出有embedding的文章
    const articlesWithEmbedding = items.filter(item => 
        item.embedding && Array.isArray(item.embedding) && item.embedding.length > 0
    )
    
    if (articlesWithEmbedding.length === 0) {
        callbacks.updateStepStatus('calculate-similarity', 'completed', intl.get("settings.aiMode.progress.messages.noArticlesForSimilarity"))
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
        callbacks.updateStepStatus('calculate-similarity', 'in_progress', intl.get("settings.aiMode.progress.messages.calculatingSimilarityProgress", { processed: processedCount, total: totalItems }), progress)
    }

    // 按相似度降序排序
    articlesWithSimilarity.sort((a, b) => b.similarity - a.similarity)

    // 选择相似度最高的topk篇
    const selectedArticles = articlesWithSimilarity
        .slice(0, topk)
        .map(item => item.article)

    callbacks.updateStepStatus('calculate-similarity', 'completed', intl.get("settings.aiMode.progress.messages.similarityCalculated", { total: articlesWithSimilarity.length, selected: selectedArticles.length }))

    return selectedArticles
}

// 子步骤: 主题意图识别（识别用户意图并确定查询的精细程度）
async function stepRecognizeTopicIntent(
    topic: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<string> {
    const { chatApiEndpoint, chatApiKey, model } = config

    const trimmedTopic = topic.trim()

    // 验证API配置
    if (!chatApiEndpoint || !chatApiEndpoint.trim()) {
        callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.configChatApiEndpoint"))
        return trimmedTopic // 容错：返回原始topic
    }
    if (!chatApiKey || !chatApiKey.trim()) {
        callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.configChatApiKey"))
        return trimmedTopic // 容错：返回原始topic
    }
    if (!model || !model.trim()) {
        callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.configModelName"))
        return trimmedTopic // 容错：返回原始topic
    }

    callbacks.updateStepStatus('intent-recognition-topic', 'in_progress', intl.get("settings.aiMode.progress.messages.recognizingTopicIntent", { topic: trimmedTopic }))

    // 规范化endpoint URL
    let normalizedEndpoint = chatApiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.chatApiEndpointInvalid"))
        return trimmedTopic // 容错：返回原始topic
    }

    // 提取base URL
    let baseURL = normalizedEndpoint
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
        callbacks.updateStepStatus('intent-recognition-topic', 'error', intl.get("settings.aiMode.progress.messages.chatApiEndpointUrlInvalid", { url: normalizedEndpoint }))
        return trimmedTopic // 容错：返回原始topic
    }

    try {
        const openai = new OpenAI({
            apiKey: chatApiKey,
            baseURL: baseURL,
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
                // 解析失败，回退到原始topic
                callbacks.updateStepStatus('intent-recognition-topic', 'completed', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionFailed"))
                return trimmedTopic
            }

            // 提取改写后的查询
            if (responseData.rewrittenQuery && typeof responseData.rewrittenQuery === 'string') {
                const rewrittenQuery = responseData.rewrittenQuery.trim()
                if (rewrittenQuery.length > 0) {
                    // 输出主题意图识别的LLM返回结果
                    console.log('=== 主题意图识别 LLM 返回结果 ===')
                    console.log('原始输入:', trimmedTopic)
                    console.log('改写后的查询:', rewrittenQuery)
                    console.log('=====================================')
                    
                    callbacks.updateStepStatus('intent-recognition-topic', 'completed', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionCompleted"))
                    return rewrittenQuery
                }
            }
        }

        // 如果无法获取改写后的查询，回退到原始topic
        callbacks.updateStepStatus('intent-recognition-topic', 'completed', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionFailed"))
        return trimmedTopic
    } catch (error) {
        // API调用失败，回退到原始topic
        callbacks.updateStepStatus('intent-recognition-topic', 'completed', intl.get("settings.aiMode.progress.messages.topicIntentRecognitionFailed"))
        return trimmedTopic
    }
}

// 子步骤: 分类标准意图识别（使用LLM理解如何分类）
async function stepRecognizeClassificationIntent(
    topicGuidance: string,
    classificationStandard: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<string> {
    const { chatApiEndpoint, chatApiKey, model } = config

    const trimmedTopicGuidance = topicGuidance.trim()
    const trimmedStandard = classificationStandard.trim()

    // 验证API配置
    if (!chatApiEndpoint || !chatApiEndpoint.trim()) {
        callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.configChatApiEndpoint"))
        return trimmedStandard // 容错：返回原始分类标准
    }
    if (!chatApiKey || !chatApiKey.trim()) {
        callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.configChatApiKey"))
        return trimmedStandard // 容错：返回原始分类标准
    }
    if (!model || !model.trim()) {
        callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.configModelName"))
        return trimmedStandard // 容错：返回原始分类标准
    }

    callbacks.updateStepStatus('intent-recognition-classification', 'in_progress', intl.get("settings.aiMode.progress.messages.recognizingClassificationIntent", { standard: trimmedStandard }))

    // 规范化endpoint URL
    let normalizedEndpoint = chatApiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.chatApiEndpointInvalid"))
        return trimmedStandard // 容错：返回原始分类标准
    }

    // 提取base URL
    let baseURL = normalizedEndpoint
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
        callbacks.updateStepStatus('intent-recognition-classification', 'error', intl.get("settings.aiMode.progress.messages.chatApiEndpointUrlInvalid", { url: normalizedEndpoint }))
        return trimmedStandard // 容错：返回原始分类标准
    }

    try {
        const openai = new OpenAI({
            apiKey: chatApiKey,
            baseURL: baseURL,
            dangerouslyAllowBrowser: true
        })

        const prompt = getClassificationIntentRecognitionPrompt(trimmedTopicGuidance, trimmedStandard)

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
                // 解析失败，回退到原始分类标准
                callbacks.updateStepStatus('intent-recognition-classification', 'completed', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionFailed"))
                return trimmedStandard
            }

            // 提取分类指导信息
            if (responseData.classificationGuidance && typeof responseData.classificationGuidance === 'string') {
                const classificationGuidance = responseData.classificationGuidance.trim()
                if (classificationGuidance.length > 0) {
                    // 输出分类标准意图识别的LLM返回结果
                    console.log('=== 分类标准意图识别 LLM 返回结果 ===')
                    console.log('分类标准:', trimmedStandard)
                    console.log('分类指导:', classificationGuidance)
                    console.log('==========================================')
                    
                    callbacks.updateStepStatus('intent-recognition-classification', 'completed', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionCompleted"))
                    return classificationGuidance
                }
            }
        }

        // 如果无法获取分类指导信息，回退到原始分类标准
        callbacks.updateStepStatus('intent-recognition-classification', 'completed', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionFailed"))
        return trimmedStandard
    } catch (error) {
        // API调用失败，回退到原始分类标准
        callbacks.updateStepStatus('intent-recognition-classification', 'completed', intl.get("settings.aiMode.progress.messages.classificationIntentRecognitionFailed"))
        return trimmedStandard
    }
}

// 步骤3.5: 意图识别（包含主题意图识别和分类标准意图识别两个子步骤）
export async function stepRecognizeIntent(
    topic: string,
    classificationStandard: string | null,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<{ topicGuidance: string, classificationGuidance: string | null }> {
    // 子步骤1: 主题意图识别（总是执行）
    const topicGuidance = await stepRecognizeTopicIntent(topic, config, callbacks)
    
    // 子步骤2: 分类标准意图识别（仅当有分类标准时执行）
    // 使用话题意图识别后的指导（topicGuidance）而不是原始topic
    let classificationGuidance: string | null = null
    if (classificationStandard && classificationStandard.trim()) {
        classificationGuidance = await stepRecognizeClassificationIntent(topicGuidance, classificationStandard, config, callbacks)
    }
    
    return { topicGuidance, classificationGuidance }
}

// 步骤4: LLM精选（使用LLM严格判断文章是否真正讨论用户关注的主题）
// 注意：此函数使用意图识别后的指导（intentGuidance）而不是原始topic
export async function stepLLMRefine(
    articles: RSSItem[],
    intentGuidance: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<RSSItem[]> {
    const { chatApiEndpoint, chatApiKey, model } = config

    if (articles.length === 0) {
        // 即使没有文章，也要更新步骤状态，确保步骤可见
        callbacks.updateStepStatus('llm-refine', 'completed', intl.get("settings.aiMode.progress.messages.noRelatedArticlesAfterLLM"))
        return []
    }

    // 验证API配置
    if (!chatApiEndpoint || !chatApiEndpoint.trim()) {
        callbacks.updateStepStatus('llm-refine', 'error', intl.get("settings.aiMode.progress.messages.configChatApiEndpoint"))
        return articles // 容错：返回所有文章
    }
    if (!chatApiKey || !chatApiKey.trim()) {
        callbacks.updateStepStatus('llm-refine', 'error', intl.get("settings.aiMode.progress.messages.configChatApiKey"))
        return articles // 容错：返回所有文章
    }
    if (!model || !model.trim()) {
        callbacks.updateStepStatus('llm-refine', 'error', intl.get("settings.aiMode.progress.messages.configModelName"))
        return articles // 容错：返回所有文章
    }

    callbacks.updateStepStatus('llm-refine', 'in_progress', intl.get("settings.aiMode.progress.messages.llmFiltering", { count: articles.length }), 0)

    // 规范化endpoint URL
    let normalizedEndpoint = chatApiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        callbacks.updateStepStatus('llm-refine', 'error', intl.get("settings.aiMode.progress.messages.chatApiEndpointInvalid"))
        return articles // 容错：返回所有文章
    }

    // 提取base URL
    let baseURL = normalizedEndpoint
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
        callbacks.updateStepStatus('llm-refine', 'error', intl.get("settings.aiMode.progress.messages.chatApiEndpointUrlInvalid", { url: normalizedEndpoint }))
        return articles // 容错：返回所有文章
    }

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
                baseURL: baseURL,
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
                    // 解析失败，保留当前批次的所有文章（容错处理）
                    for (let i = 0; i < batch.length; i++) {
                        const globalIndex = batchStart + i
                        if (globalIndex >= 0 && globalIndex < articles.length) {
                            allRelatedIndices.add(globalIndex)
                        }
                    }
                    updateProgress()
                    return
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
                    // 如果响应格式不正确，保留当前批次的所有文章（容错处理）
                    for (let i = 0; i < batch.length; i++) {
                        const globalIndex = batchStart + i
                        if (globalIndex >= 0 && globalIndex < articles.length) {
                            allRelatedIndices.add(globalIndex)
                        }
                    }
                }
            } else {
                // 如果API调用失败或没有响应，保留当前批次的所有文章（容错处理）
                for (let i = 0; i < batch.length; i++) {
                    const globalIndex = batchStart + i
                    if (globalIndex >= 0 && globalIndex < articles.length) {
                        allRelatedIndices.add(globalIndex)
                    }
                }
            }
            
            // 更新进度
            updateProgress()
        } catch (error) {
            // 即使某个批次失败，也更新进度计数，并保留该批次的所有文章（容错处理）
            for (let i = 0; i < batch.length; i++) {
                const globalIndex = batchStart + i
                if (globalIndex >= 0 && globalIndex < articles.length) {
                    allRelatedIndices.add(globalIndex)
                }
            }
            updateProgress()
            // 不抛出错误，避免影响其他批次
        }
    }
    
    // 并行处理所有批次
    await Promise.allSettled(batches.map(batchInfo => processBatch(batchInfo)))

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
        return { articles: [], timeRangeHasArticles: false, topicGuidance: null, classificationGuidance: null }
    }

    // 如果没有话题，直接返回所有文章
    if (!topic || !topic.trim()) {
        return { articles: items, timeRangeHasArticles: true, topicGuidance: null, classificationGuidance: null }
    }

    const trimmedTopic = topic.trim()
    const { topk } = config

    // 步骤1.5: 意图识别（识别用户意图并确定查询的精细程度）
    const { topicGuidance, classificationGuidance } = await stepRecognizeIntent(trimmedTopic, classificationStandard, config, callbacks)

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
        const refinedArticles = await stepLLMRefine(items, topicGuidance, config, callbacks)
        
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
        // 步骤2: 文本向量化（仍使用原始topic，因为向量化需要语义表示）
        const topicEmbedding = await stepVectorizeText(trimmedTopic, items, config, callbacks)
        
        // 步骤3: 计算相似度并筛选
        const selectedArticles = await stepCalculateSimilarity(items, topicEmbedding, topk, callbacks)
        
        // 步骤4: LLM精选（使用改写后的查询）
        const refinedArticles = await stepLLMRefine(selectedArticles, topicGuidance, config, callbacks)
        
        // 如果LLM精选后没有文章，立即更新 queryProgress，只保留已执行的步骤，移除所有未执行的步骤（包括 classify-articles）
        if (refinedArticles.length === 0) {
            if (callbacks.updateQueryProgress && callbacks.getCurrentQueryProgress) {
                const currentProgress = callbacks.getCurrentQueryProgress()
                if (currentProgress) {
                    // 只保留已执行的步骤（query-db, intent-recognition-topic, intent-recognition-classification, vectorize-text, calculate-similarity, llm-refine）
                    // 明确排除 classify-articles 和其他未执行的步骤
                    const executedStepIds = ['query-db', 'intent-recognition-topic', 'vectorize-text', 'calculate-similarity', 'llm-refine']
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
        // 如果计算embedding失败，回退到全文匹配
        if (error instanceof Error && error.message.includes('计算话题向量失败')) {
            const topicRegex = new RegExp(trimmedTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            const filteredItems = items.filter(item => {
                return (
                    topicRegex.test(item.title) ||
                    topicRegex.test(item.snippet || '') ||
                    topicRegex.test(item.content || '')
                )
            })
            return { articles: filteredItems, timeRangeHasArticles: true, topicGuidance: null, classificationGuidance: null }
        }
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
    callbacks: ConsolidateCallbacks
): Promise<ArticleCluster[]> {
    const { chatApiEndpoint, chatApiKey, model } = config

    if (articles.length === 0) {
        return []
    }

    // 验证API配置
    if (!chatApiEndpoint || !chatApiEndpoint.trim()) {
        throw new Error('请先配置Chat API Endpoint（在设置中配置）')
    }
    if (!chatApiKey || !chatApiKey.trim()) {
        throw new Error('请先配置Chat API Key（在设置中配置）')
    }
    if (!model || !model.trim()) {
        throw new Error('请先配置模型名称（在设置中配置）')
    }

    // 更新进度：开始分类
    callbacks.updateStepStatus('classify-articles', 'in_progress', intl.get("settings.aiMode.progress.messages.analyzingAndClassifying", { count: articles.length }))

    // 规范化endpoint URL
    let normalizedEndpoint = chatApiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        throw new Error('Chat API Endpoint必须以http://或https://开头')
    }

    // 提取base URL
    let baseURL = normalizedEndpoint
    try {
        const url = new URL(normalizedEndpoint)
        if (url.pathname.includes('/v1/chat/completions')) {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
        } else {
            baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
        }
    } catch (error) {
        throw new Error(`无效的Chat API Endpoint URL: ${normalizedEndpoint}`)
    }

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
                baseURL: baseURL,
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
                    // 解析失败，跳过当前批次
                    updateProgress()
                    return
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
                }
            }

            // 更新进度
            updateProgress()
        } catch (error) {
            // 即使某个批次失败，也更新进度计数
            updateProgress()
            // 不抛出错误，避免影响其他批次
        }
    }

    // 并行处理所有批次
    await Promise.allSettled(batches.map(batchInfo => processBatch(batchInfo)))

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
                    baseURL: baseURL,
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
                        }
                    } catch (parseError) {
                        // 解析失败，使用原始分类名称
                    }
                }
            } catch (error) {
                // 去重失败，使用原始分类名称
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

