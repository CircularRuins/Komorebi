import OpenAI from "openai"
import * as db from "./db"
import lf from "lovefield"
import type { RSSItem } from "./models/item"
import type { QueryProgressStep, QueryProgress, ArticleCluster } from "./models/ai-mode"

// ==================== 配置和回调接口 ====================

export interface ConsolidateConfig {
    apiEndpoint: string
    apiKey: string
    embeddingModel: string
    model: string
    topk: number
}

export interface ConsolidateCallbacks {
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => void
    updateQueryProgress?: (progress: Partial<QueryProgress>) => void
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
    const { apiEndpoint, apiKey, embeddingModel } = config

    // 验证API配置
    if (!apiEndpoint || !apiEndpoint.trim()) {
        throw new Error('请先配置API Endpoint（在设置中配置）')
    }
    if (!apiKey || !apiKey.trim()) {
        throw new Error('请先配置API Key（在设置中配置）')
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
    let normalizedEndpoint = apiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        throw new Error('API Endpoint必须以http://或https://开头')
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
        throw new Error(`无效的API Endpoint URL: ${normalizedEndpoint}`)
    }

    try {
        const openai = new OpenAI({
            apiKey: apiKey,
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
    const { apiEndpoint, apiKey, embeddingModel } = config

    if (articles.length === 0) {
        return
    }

    // 验证API配置
    if (!apiEndpoint || !apiEndpoint.trim()) {
        return
    }
    if (!apiKey || !apiKey.trim()) {
        return
    }

    // 规范化endpoint URL
    let normalizedEndpoint = apiEndpoint.trim()
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
            apiKey: apiKey,
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
                `正在并行计算向量... 已完成 ${completedCount}/${totalBatches} 批 (${Math.min(completedCount * batchSize, totalArticles)}/${totalArticles})`, 
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
    callbacks.updateStepStatus('query-db', 'in_progress', '正在从数据库查询文章...')
    
    // 等待数据库初始化
    let retries = 0
    while ((!db.itemsDB || !db.items) && retries < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
    }
    
    if (!db.itemsDB || !db.items) {
        callbacks.updateStepStatus('query-db', 'error', '数据库未初始化')
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
    
    callbacks.updateStepStatus('query-db', 'completed', `已查询到 ${items.length} 篇文章`)
    return items
}

// 子步骤: 计算话题向量
async function stepComputeTopicEmbedding(
    topic: string,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<number[]> {
    const trimmedTopic = topic.trim()
    callbacks.updateStepStatus('vectorize-text', 'in_progress', `正在计算话题"${trimmedTopic}"的向量...`)
    
    try {
        const topicEmbedding = await computeTopicEmbedding(trimmedTopic, config)
        callbacks.updateStepStatus('vectorize-text', 'in_progress', '话题向量计算完成')
        return topicEmbedding
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', '计算话题向量失败，使用全文匹配')
        throw error
    }
}

// 子步骤: 加载已有文章向量
async function stepLoadEmbeddings(
    items: RSSItem[],
    callbacks: ConsolidateCallbacks
): Promise<void> {
    callbacks.updateStepStatus('vectorize-text', 'in_progress', '正在从数据库加载已有文章向量...')
    
    const itemIds = items.map(item => item._id)
    if (itemIds.length === 0) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', '没有需要加载的文章')
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
        
        callbacks.updateStepStatus('vectorize-text', 'in_progress', `已加载 ${loadedCount} 篇文章的向量`)
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', '加载向量失败')
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
        callbacks.updateStepStatus('vectorize-text', 'in_progress', '所有文章已有向量，跳过计算', 100)
        return
    }

    callbacks.updateStepStatus('vectorize-text', 'in_progress', `需要计算 ${articlesNeedingEmbedding.length} 篇文章的向量...`, 0)
    
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
        
        callbacks.updateStepStatus('vectorize-text', 'in_progress', `已完成 ${articlesNeedingEmbedding.length} 篇文章的向量计算`, 100)
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'in_progress', '计算向量失败，继续使用已有向量')
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
    callbacks.updateStepStatus('vectorize-text', 'in_progress', '开始文本向量化...')
    
    const trimmedTopic = topic.trim()
    
    try {
        // 子步骤1: 计算话题向量
        const topicEmbedding = await stepComputeTopicEmbedding(trimmedTopic, config, callbacks)
        
        // 子步骤2: 加载已有文章向量
        await stepLoadEmbeddings(items, callbacks)
        
        // 子步骤3: 计算新文章向量
        await stepComputeEmbeddings(items, config, callbacks)
        
        callbacks.updateStepStatus('vectorize-text', 'completed', '文本向量化完成')
        return topicEmbedding
    } catch (error) {
        callbacks.updateStepStatus('vectorize-text', 'error', '文本向量化失败')
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
    callbacks.updateStepStatus('calculate-similarity', 'in_progress', '正在计算文章相似度...', 0)
    
    // 过滤出有embedding的文章
    const articlesWithEmbedding = items.filter(item => 
        item.embedding && Array.isArray(item.embedding) && item.embedding.length > 0
    )
    
    if (articlesWithEmbedding.length === 0) {
        callbacks.updateStepStatus('calculate-similarity', 'completed', '没有可计算相似度的文章')
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
        callbacks.updateStepStatus('calculate-similarity', 'in_progress', `正在计算相似度... (${processedCount}/${totalItems})`, progress)
    }

    // 按相似度降序排序
    articlesWithSimilarity.sort((a, b) => b.similarity - a.similarity)

    // 选择相似度最高的topk篇
    const selectedArticles = articlesWithSimilarity
        .slice(0, topk)
        .map(item => item.article)

    callbacks.updateStepStatus('calculate-similarity', 'completed', `计算了 ${articlesWithSimilarity.length} 篇文章的相似度，已选择前 ${selectedArticles.length} 篇`)

    return selectedArticles
}

// ==================== 主函数 ====================

// 整理汇总文章（主函数）
export async function consolidate(
    timeRangeDays: number | null,
    topic: string | null,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<RSSItem[]> {
    // 步骤1: 根据时间范围筛选
    const items = await stepQueryDatabase(timeRangeDays, callbacks)

    // 如果没有话题，直接返回所有文章
    if (!topic || !topic.trim()) {
        return items
    }

    const trimmedTopic = topic.trim()
    const { topk } = config

    // 如果文章数量小于等于topk，不需要计算embedding和相似度，直接返回所有文章
    if (items.length <= topk) {
        // 更新queryProgress，移除embedding相关步骤，只保留步骤1和聚类步骤
        if (callbacks.updateQueryProgress) {
            const steps: QueryProgressStep[] = [
                { id: 'query-db', title: '根据时间范围筛选', status: 'completed', message: `已查询到 ${items.length} 篇文章`, visible: true },
                { id: 'cluster-articles', title: '分析文章内容并聚类', status: 'pending', visible: true }
            ]
            
            callbacks.updateQueryProgress({
                steps,
                currentStepIndex: 1, // 指向聚类步骤
                currentMessage: `文章数量(${items.length})小于等于TopK(${topk})，跳过相似度计算`
            })
        }
        
        return items
    }

    try {
        // 步骤2: 文本向量化
        const topicEmbedding = await stepVectorizeText(trimmedTopic, items, config, callbacks)
        
        // 步骤3: 计算相似度并筛选
        const selectedArticles = await stepCalculateSimilarity(items, topicEmbedding, topk, callbacks)
        
        return selectedArticles
    } catch (error) {
        // 如果计算embedding失败，回退到全文匹配
        if (error instanceof Error && error.message.includes('计算话题向量失败')) {
            const topicRegex = new RegExp(trimmedTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            return items.filter(item => {
                return (
                    topicRegex.test(item.title) ||
                    topicRegex.test(item.snippet || '') ||
                    topicRegex.test(item.content || '')
                )
            })
        }
        throw error
    }
}

// ==================== 聚类函数 ====================

// 对文章进行聚类分析
export async function clusterArticles(
    articles: RSSItem[],
    topic: string | null,
    config: ConsolidateConfig,
    callbacks: ConsolidateCallbacks
): Promise<ArticleCluster[]> {
    const { apiEndpoint, apiKey, model } = config

    if (articles.length === 0) {
        return []
    }

    // 验证API配置
    if (!apiEndpoint || !apiEndpoint.trim()) {
        throw new Error('请先配置API Endpoint（在设置中配置）')
    }
    if (!apiKey || !apiKey.trim()) {
        throw new Error('请先配置API Key（在设置中配置）')
    }
    if (!model || !model.trim()) {
        throw new Error('请先配置模型名称（在设置中配置）')
    }

    
    // 更新进度：开始聚类
    callbacks.updateStepStatus('cluster-articles', 'in_progress', `正在分析 ${articles.length} 篇文章的内容并进行聚类...`)

    // 规范化endpoint URL
    let normalizedEndpoint = apiEndpoint.trim()
    if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
        throw new Error('API Endpoint必须以http://或https://开头')
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
        throw new Error(`无效的API Endpoint URL: ${normalizedEndpoint}`)
    }

    // 准备文章内容（限制数量以避免token过多）
    const articlesToAnalyze = articles.slice(0, 100)  // 最多分析100篇文章
    const articlesText = articlesToAnalyze.map((article, index) => {
        const dateStr = article.date.toLocaleDateString('zh-CN')
        const snippet = article.snippet || (article.content ? article.content.substring(0, 300) : '')
        return `文章${index + 1}:
标题: ${article.title}
发布时间: ${dateStr}
摘要: ${snippet}`
    }).join('\n\n')

    const topicText = topic ? `，这些文章都与话题"${topic}"相关` : ''
    const topicFilterText = topic ? `\n\n重要：如果文章内容与话题"${topic}"完全无关，请将其放入unrelatedArticleIndices数组中，这些文章将不会被展示。` : ''

    const prompt = `请分析以下RSS文章，将讲同一件事情或相关主题的文章归类到一起。

${topicText}${topicFilterText}

要求：
1. 仔细阅读每篇文章的标题和摘要
2. 识别文章讨论的核心主题或事件
3. 将讨论同一件事情或相关主题的文章归为一组
4. 为每个分组提供一个简洁的标题（说明这些文章讲的是什么，不超过20字）
5. 为每个分组提供一段简要描述（说明这些文章的共同主题或事件，不超过100字）
6. ${topic ? '如果文章内容与话题无关，请将其索引放入unrelatedArticleIndices数组中' : ''}
7. 返回JSON格式，格式如下：
{
  "clusters": [
    {
      "title": "分组标题",
      "description": "分组描述",
      "articleIndices": [0, 2, 5]
    }
  ],
  ${topic ? '"unrelatedArticleIndices": [3, 7]' : ''}
}

注意：
- articleIndices是文章在列表中的索引（从0开始）
- 每个分组至少包含1篇文章
- ${topic ? '只有与话题相关的文章才应该被分配到分组中' : '所有文章都应该被分配到某个分组中'}
- ${topic ? '与话题无关的文章应放入unrelatedArticleIndices数组中' : '如果某篇文章无法归类，可以单独成组'}
- unrelatedArticleIndices是可选的，如果没有无关文章，可以省略此字段或设为空数组

文章列表：
${articlesText}

请返回JSON格式的聚类结果：`

    try {
        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL,
            dangerouslyAllowBrowser: true
        })

        // 尝试使用JSON格式，如果不支持则回退到普通格式
        const completionParams: any = {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: '你是一个专业的文章分析助手，擅长识别文章主题并进行分类。请严格按照JSON格式返回结果，只返回JSON对象，不要包含任何其他文本。'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,  // 降低温度以获得更稳定的聚类结果
            max_tokens: 4000
        }
        
        // 某些模型可能不支持response_format，尝试添加但不强制
        try {
            completionParams.response_format = { type: "json_object" }
        } catch (e) {
            // 忽略错误，继续使用普通格式
        }
        
        callbacks.updateStepStatus('cluster-articles', 'in_progress', '正在调用AI模型分析文章...')
        const completion = await openai.chat.completions.create(completionParams)
        callbacks.updateStepStatus('cluster-articles', 'in_progress', '正在解析聚类结果...')

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
                throw new Error(`LLM返回的聚类结果格式不正确，无法解析JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
            }

            // 验证并转换聚类结果
            if (!responseData.clusters || !Array.isArray(responseData.clusters)) {
                throw new Error('聚类结果格式不正确：缺少clusters数组')
            }

            // 提取与话题无关的文章索引
            const unrelatedIndices = new Set<number>()
            if (responseData.unrelatedArticleIndices && Array.isArray(responseData.unrelatedArticleIndices)) {
                responseData.unrelatedArticleIndices.forEach((idx: number) => {
                    if (typeof idx === 'number' && idx >= 0 && idx < articlesToAnalyze.length) {
                        unrelatedIndices.add(idx)
                    }
                })
            }

            // 用于跟踪每个文章被分配到哪个聚类（确保每个文章只属于一个聚类）
            const articleToClusterMap = new Map<number, number>() // 文章索引 -> 聚类索引

            const clusters: ArticleCluster[] = responseData.clusters.map((cluster: any, index: number) => {
                if (!cluster.articleIndices || !Array.isArray(cluster.articleIndices)) {
                    throw new Error(`聚类${index}格式不正确：缺少articleIndices数组`)
                }

                // 过滤无效的索引，并去重，同时排除与话题无关的文章
                const validIndicesSet = new Set<number>()
                cluster.articleIndices.forEach((idx: number) => {
                    if (typeof idx === 'number' && idx >= 0 && idx < articlesToAnalyze.length && !unrelatedIndices.has(idx)) {
                        validIndicesSet.add(idx)
                    }
                })

                // 过滤掉已经被分配到其他聚类的文章（如果LLM返回了重复分配，优先使用第一个聚类）
                const uniqueIndices: number[] = []
                validIndicesSet.forEach(idx => {
                    if (!articleToClusterMap.has(idx)) {
                        articleToClusterMap.set(idx, index)
                        uniqueIndices.push(idx)
                    } else {
                    }
                })

                if (uniqueIndices.length === 0) {
                    return null
                }

                return {
                    id: `cluster-${index}`,
                    title: cluster.title || `分组 ${index + 1}`,
                    description: cluster.description || '',
                    articles: uniqueIndices.map((idx: number) => articlesToAnalyze[idx])
                }
            }).filter((cluster: ArticleCluster | null) => cluster !== null) as ArticleCluster[]

            // 处理未被分配的文章（如果有），但排除与话题无关的文章
            const assignedIndices = new Set(articleToClusterMap.keys())
            const unassignedArticles: RSSItem[] = []
            articlesToAnalyze.forEach((article, idx) => {
                if (!assignedIndices.has(idx) && !unrelatedIndices.has(idx)) {
                    unassignedArticles.push(article)
                }
            })

            // 如果有未分配的文章，创建一个"其他"聚类
            if (unassignedArticles.length > 0) {
                clusters.push({
                    id: 'cluster-other',
                    title: '其他',
                    description: '未明确分类的文章',
                    articles: unassignedArticles
                })
            }

            callbacks.updateStepStatus('cluster-articles', 'completed', `已完成聚类，共 ${clusters.length} 个分组`)
            return clusters
        } else {
            throw new Error('LLM返回的响应格式不正确')
        }
    } catch (error: any) {
        if (error instanceof Error) {
            callbacks.updateStepStatus('cluster-articles', 'error', error.message)
            throw error
        } else {
            const errorMessage = `聚类分析失败: ${String(error)}`
            callbacks.updateStepStatus('cluster-articles', 'error', errorMessage)
            throw new Error(errorMessage)
        }
    }
}

