import * as React from "react"
import { TextField, ITextField } from "@fluentui/react/lib/TextField"
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown"
import { Label } from "@fluentui/react/lib/Label"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Spinner, SpinnerSize, MessageBar, MessageBarType, Stack } from "@fluentui/react"
import { Icon } from "@fluentui/react/lib/Icon"
import OpenAI from "openai"
import * as db from "../scripts/db"
import lf from "lovefield"
import type { RSSItem } from "../scripts/models/item"
import { connect } from "react-redux"
import { RootState } from "../scripts/reducer"
import { RSSSource } from "../scripts/models/source"
import { markRead } from "../scripts/models/item"
import { openItemMenu } from "../scripts/models/app"
import { showItem } from "../scripts/models/page"
import { itemShortcuts } from "../scripts/models/item"
import { FeedFilter } from "../scripts/models/feed"
import ListCard from "./cards/list-card"
import { ViewConfigs } from "../schema-types"
import { ActionStatus } from "../scripts/utils"
import { AIModeMenuContent } from "./ai-mode-menu-content"
import {
    ArticleCluster,
    QueryProgress,
    QueryProgressStep,
    AIModeState,
    updateAIModeTimeRange,
    updateAIModeTopic,
    updateAIModeTopicInput,
    setAIModeIsComposing,
    updateAIModeRecentTopics,
    setAIModeSummary,
    setAIModeLoading,
    setAIModeClustering,
    setAIModeError,
    updateAIModeApiEndpoint,
    updateAIModeApiKey,
    updateAIModeModel,
    updateAIModeEmbeddingModel,
    updateAIModeSimilarityThreshold,
    setAIModeShowConfigPanel,
    updateAIModeTempApiEndpoint,
    updateAIModeTempApiKey,
    updateAIModeTempModel,
    updateAIModeTempEmbeddingModel,
    updateAIModeTempSimilarityThreshold,
    setAIModeShowErrorDialog,
    setAIModeErrorDialogMessage,
    setAIModeArticleCount,
    setAIModeFilteredArticles,
    setAIModeClusters,
    updateAIModeQueryProgress,
    updateAIModeStepStatus,
    setAIModeShowResults,
} from "../scripts/models/ai-mode"

// 重新导出类型以便其他文件使用
export type { ArticleCluster, QueryProgress, QueryProgressStep }

// AIMode Context 类型定义
export type AIModeContextType = {
    timeRange: string | null
    topic: string  // 单个话题文本
    topicInput: string
    recentTopics: string[]  // 最近使用的话题（最多5个）
    isComposing: boolean
    isLoading: boolean
    isClustering: boolean  // 是否正在聚类
    summary: string
    apiEndpoint: string
    apiKey: string
    model: string
    showConfigPanel: boolean
    articleCount: number
    error: string | null
    filteredArticles: RSSItem[]  // 筛选后的文章列表
    clusters: ArticleCluster[]  // 文章聚类结果
    setTimeRange: (timeRange: string | null) => void
    setTopic: (topic: string) => void
    setTopicInput: (topicInput: string) => void
    setIsComposing: (isComposing: boolean) => void
    handleGenerateSummary: () => void
    handleClearSummary: () => void
    handleConfigPanelOpen: () => void
    handleTopicInputChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    handleTopicInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
    handleTopicInputCompositionStart: () => void
    handleTopicInputCompositionEnd: () => void
    handleTimeRangeChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void
    handleRecentTopicClick: (topic: string) => void
    topicInputRef: React.RefObject<ITextField>
}

type AIModeProps = {
    sources: { [sid: number]: RSSSource }
    items: { [id: number]: RSSItem }
    markRead: (item: RSSItem) => void
    contextMenu: (feedId: string, item: RSSItem, e: React.MouseEvent) => void
    showItem: (fid: string, item: RSSItem) => void
    shortcuts: (item: RSSItem, e: KeyboardEvent) => void
    dispatch: any
    hideArticleList?: boolean  // 是否隐藏文章列表（在侧边栏模式下）
    // Redux state
    aiMode: AIModeState
    // Redux actions
    updateTimeRange: (timeRange: string | null) => void
    updateTopic: (topic: string) => void
    updateTopicInput: (topicInput: string) => void
    setIsComposing: (isComposing: boolean) => void
    updateRecentTopics: (recentTopics: string[]) => void
    setSummary: (summary: string) => void
    setLoading: (isLoading: boolean) => void
    setClustering: (isClustering: boolean) => void
    setError: (error: string | null) => void
    updateApiEndpoint: (apiEndpoint: string) => void
    updateApiKey: (apiKey: string) => void
    updateModel: (model: string) => void
    updateEmbeddingModel: (embeddingModel: string) => void
    updateSimilarityThreshold: (similarityThreshold: number) => void
    setShowConfigPanel: (showConfigPanel: boolean) => void
    updateTempApiEndpoint: (tempApiEndpoint: string) => void
    updateTempApiKey: (tempApiKey: string) => void
    updateTempModel: (tempModel: string) => void
    updateTempEmbeddingModel: (tempEmbeddingModel: string) => void
    updateTempSimilarityThreshold: (tempSimilarityThreshold: string) => void
    setShowErrorDialog: (showErrorDialog: boolean) => void
    setErrorDialogMessage: (errorDialogMessage: string) => void
    setArticleCount: (articleCount: number) => void
    setFilteredArticles: (filteredArticles: RSSItem[]) => void
    setClusters: (clusters: ArticleCluster[]) => void
    updateQueryProgress: (queryProgress: QueryProgress | null) => void
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => void
    setShowResults: (showResults: boolean) => void
}

// 创建 Context
export const AIModeContext = React.createContext<AIModeContextType | null>(null)

export class AIModeComponent extends React.Component<AIModeProps> {
    static contextType = AIModeContext
    declare context: React.ContextType<typeof AIModeContext>
    private summaryContainerRef: React.RefObject<HTMLDivElement>
    private topicInputRef: React.RefObject<ITextField>
    private updateTimeout: NodeJS.Timeout | null = null

    componentDidMount() {
        // 注册全局回调，让导航栏可以打开配置面板
        if (typeof window !== 'undefined') {
            (window as any).openAIConfigPanel = () => {
                this.handleConfigPanelOpen()
            }
        }
        // 通知Root组件更新Context
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeMounted')
            window.dispatchEvent(event)
        }
    }

    constructor(props: AIModeProps) {
        super(props)
        this.summaryContainerRef = React.createRef()
        this.topicInputRef = React.createRef()
    }

    componentDidUpdate(prevProps: AIModeProps) {
        const { aiMode } = this.props
        if (aiMode.queryProgress) {
            // 话题必填，总是6个步骤，如果步骤数量不对，重新创建进度
            const currentStepCount = aiMode.queryProgress.steps?.length || 0
            if (currentStepCount !== 6) {
                const queryProgress = this.initializeQueryProgress()
                this.props.updateQueryProgress(queryProgress)
            }
        }
        
        // 只在关键状态改变时通知Root组件更新Context（排除输入框变化以避免打断输入）
        const prevAiMode = prevProps.aiMode
        if (
            prevAiMode.timeRange !== aiMode.timeRange ||
            prevAiMode.topic !== aiMode.topic ||
            prevAiMode.summary !== aiMode.summary ||
            prevAiMode.isLoading !== aiMode.isLoading ||
            prevAiMode.isClustering !== aiMode.isClustering ||
            prevAiMode.showConfigPanel !== aiMode.showConfigPanel ||
            prevAiMode.apiEndpoint !== aiMode.apiEndpoint ||
            prevAiMode.apiKey !== aiMode.apiKey ||
            prevAiMode.model !== aiMode.model ||
            prevAiMode.filteredArticles.length !== aiMode.filteredArticles.length ||
            prevAiMode.clusters.length !== aiMode.clusters.length ||
            prevAiMode.articleCount !== aiMode.articleCount ||
            prevAiMode.error !== aiMode.error
        ) {
            // 通知Root组件更新Context
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }
        }
    }

    componentWillUnmount() {
        // 清理全局回调
        if (typeof window !== 'undefined') {
            delete (window as any).openAIConfigPanel
        }
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout)
        }
    }

    // Context value 生成器
    getContextValue = (): AIModeContextType => {
        const { aiMode, updateTimeRange, updateTopic, updateTopicInput, setIsComposing } = this.props
        return {
            timeRange: aiMode.timeRange,
            topic: aiMode.topic,
            topicInput: aiMode.topicInput,
            recentTopics: aiMode.recentTopics,
            isComposing: aiMode.isComposing,
            isLoading: aiMode.isLoading,
            isClustering: aiMode.isClustering,
            summary: aiMode.summary,
            apiEndpoint: aiMode.apiEndpoint,
            apiKey: aiMode.apiKey,
            model: aiMode.model,
            showConfigPanel: aiMode.showConfigPanel,
            articleCount: aiMode.articleCount,
            error: aiMode.error,
            filteredArticles: aiMode.filteredArticles,
            clusters: aiMode.clusters,
            setTimeRange: updateTimeRange,
            setTopic: updateTopic,
            setTopicInput: updateTopicInput,
            setIsComposing: setIsComposing,
            handleGenerateSummary: this.handleGenerateSummary,
            handleClearSummary: this.handleClearSummary,
            handleConfigPanelOpen: this.handleConfigPanelOpen,
            handleTopicInputChange: this.handleTopicInputChange,
            handleTopicInputKeyDown: this.handleTopicInputKeyDown,
            handleTopicInputCompositionStart: this.handleTopicInputCompositionStart,
            handleTopicInputCompositionEnd: this.handleTopicInputCompositionEnd,
            handleTimeRangeChange: this.handleTimeRangeChange,
            handleRecentTopicClick: this.handleRecentTopicClick,
            topicInputRef: this.topicInputRef
        }
    }

    handleTimeRangeChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        this.props.updateTimeRange(option ? option.key as string : null)
    }

    handleTopicInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        this.props.updateTopicInput(newValue || '')
        // 状态更新后立即更新Context，确保输入框能正常显示输入
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeInputChanged')
            window.dispatchEvent(event)
        }
    }

    handleTopicInputCompositionStart = () => {
        this.props.setIsComposing(true)
    }

    handleTopicInputCompositionEnd = () => {
        this.props.setIsComposing(false)
        // 输入法结束后更新Context
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeInputChanged')
            window.dispatchEvent(event)
        }
    }

    handleTopicInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        // 处理Enter键确认话题
        const { aiMode, updateTopic } = this.props
        if (event.key === 'Enter' && !aiMode.isComposing) {
            event.preventDefault()
            const trimmed = aiMode.topicInput.trim()
            if (trimmed) {
                updateTopic(trimmed)
            }
        }
    }

    handleRecentTopicClick = (topic: string) => {
        // 点击常选话题时填充到输入框和话题字段
        const { updateTopicInput, updateTopic } = this.props
        updateTopicInput(topic)
        updateTopic(topic)
        // 直接设置 TextField 的值（如果引用存在）
        if (this.topicInputRef.current) {
            const inputElement = this.topicInputRef.current as any
            if (inputElement.setValue) {
                inputElement.setValue(topic)
            }
            // 聚焦到输入框
            inputElement.focus()
        }
        // 状态更新后立即更新Context，确保输入框能正常显示输入
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeInputChanged')
            window.dispatchEvent(event)
        }
    }

    // 保存话题到最近话题列表
    saveTopicToRecent = (topic: string) => {
        const trimmed = topic.trim()
        if (!trimmed) return

        const { aiMode, updateRecentTopics } = this.props
        // 移除已存在的相同话题
        const filtered = aiMode.recentTopics.filter(t => t !== trimmed)
        // 添加到最前面
        const updated = [trimmed, ...filtered].slice(0, 5)  // 最多保留5个
        
        updateRecentTopics(updated)
        // localStorage 同步在 reducer 中处理
    }

    handleApiEndpointChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempApiEndpoint(value)
    }

    handleApiKeyChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempApiKey(value)
    }

    handleModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempModel(value)
    }

    handleEmbeddingModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempEmbeddingModel(value)
    }

    handleSimilarityThresholdChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempSimilarityThreshold(value)
    }

    handleConfigConfirm = () => {
        const { aiMode, updateApiEndpoint, updateApiKey, updateModel, updateEmbeddingModel, updateSimilarityThreshold, setShowConfigPanel, setShowErrorDialog, setErrorDialogMessage } = this.props
        const { tempApiEndpoint, tempApiKey, tempModel, tempEmbeddingModel, tempSimilarityThreshold } = aiMode
        
        // 验证相似度阈值
        const similarityThreshold = parseFloat(tempSimilarityThreshold)
        if (isNaN(similarityThreshold) || similarityThreshold < 0 || similarityThreshold > 1) {
            setShowErrorDialog(true)
            setErrorDialogMessage('相似度阈值必须是0到1之间的数字')
            return
        }
        
        // 保存到 Redux（localStorage 同步在 reducer 中处理）
        updateApiEndpoint(tempApiEndpoint)
        updateApiKey(tempApiKey)
        updateModel(tempModel)
        updateEmbeddingModel(tempEmbeddingModel)
        updateSimilarityThreshold(similarityThreshold)
        setShowConfigPanel(false)
    }

    handleConfigCancel = () => {
        // 恢复临时状态为已保存的值
        const { aiMode, updateTempApiEndpoint, updateTempApiKey, updateTempModel, updateTempEmbeddingModel, updateTempSimilarityThreshold, setShowConfigPanel } = this.props
        const { apiEndpoint, apiKey, model, embeddingModel, similarityThreshold } = aiMode
        updateTempApiEndpoint(apiEndpoint)
        updateTempApiKey(apiKey)
        updateTempModel(model)
        updateTempEmbeddingModel(embeddingModel)
        updateTempSimilarityThreshold(similarityThreshold.toString())
        setShowConfigPanel(false)
    }

    handleConfigPanelOpen = () => {
        // 打开面板时，初始化临时状态为当前保存的值
        const { aiMode, setShowConfigPanel, updateTempApiEndpoint, updateTempApiKey, updateTempModel, updateTempEmbeddingModel, updateTempSimilarityThreshold } = this.props
        const { apiEndpoint, apiKey, model, embeddingModel, similarityThreshold } = aiMode
        setShowConfigPanel(true)
        updateTempApiEndpoint(apiEndpoint)
        updateTempApiKey(apiKey)
        updateTempModel(model)
        updateTempEmbeddingModel(embeddingModel)
        updateTempSimilarityThreshold(similarityThreshold.toString())
    }

    // 解析时间范围key，返回天数
    parseTimeRange = (timeRange: string | null): number | null => {
        if (!timeRange) return null
        
        // 直接解析key值（已经是天数）
        const days = parseInt(timeRange, 10)
        if (!isNaN(days) && days > 0) {
            return days
        }
        
        return null
    }

    // 初始化查询进度（话题必填，总是6个步骤）
    initializeQueryProgress = (): QueryProgress => {
        const steps: QueryProgressStep[] = [
            { id: 'query-db', title: '根据时间范围筛选', status: 'in_progress', message: '正在从数据库查询文章...', visible: true },
            { id: 'compute-topic-embedding', title: '计算话题向量', status: 'pending', visible: false },
            { id: 'load-embeddings', title: '加载已有文章向量', status: 'pending', visible: false },
            { id: 'compute-embeddings', title: '计算新文章向量', status: 'pending', visible: false },
            { id: 'calculate-similarity', title: '计算相似度并筛选', status: 'pending', visible: false },
            { id: 'cluster-articles', title: '分析文章内容并聚类', status: 'pending', visible: false }
        ]
        
        return {
            steps,
            currentStepIndex: 0,
            overallProgress: 0,
            currentMessage: '开始查询...'
        }
    }

    // 更新查询进度（现在直接使用 Redux action）
    updateQueryProgress = (updates: Partial<QueryProgress>) => {
        const { aiMode, updateQueryProgress } = this.props
        if (!aiMode.queryProgress) return
        
        const progress = { ...aiMode.queryProgress, ...updates }
        
        // 计算总体进度
        const totalSteps = progress.steps.length
        const completedSteps = progress.steps.filter(s => s.status === 'completed').length
        const currentStep = progress.steps[progress.currentStepIndex]
        const stepProgress = currentStep?.progress || 0
        const baseProgress = (completedSteps / totalSteps) * 100
        const currentStepWeight = 1 / totalSteps
        const currentStepProgress = (stepProgress / 100) * currentStepWeight * 100
        progress.overallProgress = Math.min(100, baseProgress + currentStepProgress)
        
        updateQueryProgress(progress)
    }

    // 更新步骤状态（现在直接使用 Redux action，逻辑在 reducer 中）
    updateStepStatus = (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => {
        this.props.updateStepStatus(stepId, status, message, progress)
    }

    // 获取时间范围选项
    getTimeRangeOptions = (): IDropdownOption[] => {
        return [
            { key: '1', text: '1日内' },
            { key: '3', text: '3日内' },
            { key: '7', text: '1周内' },
            { key: '30', text: '1月内' }
        ]
    }

    // 获取话题embedding的缓存key
    getTopicEmbeddingCacheKey = (topic: string, embeddingModel: string): string => {
        const normalizedTopic = topic.trim().toLowerCase()
        const normalizedModel = embeddingModel.trim()
        return `topic-embedding-${normalizedModel}-${normalizedTopic}`
    }

    // 从缓存加载话题embedding
    loadTopicEmbeddingFromCache = (topic: string, embeddingModel: string): number[] | null => {
        try {
            const cacheKey = this.getTopicEmbeddingCacheKey(topic, embeddingModel)
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

    // 保存话题embedding到缓存
    saveTopicEmbeddingToCache = (topic: string, embeddingModel: string, embedding: number[]): void => {
        const cacheKey = this.getTopicEmbeddingCacheKey(topic, embeddingModel)
        try {
            localStorage.setItem(cacheKey, JSON.stringify(embedding))
            
            // 限制缓存数量，避免localStorage过大（最多保留100个话题的embedding）
            this.cleanupTopicEmbeddingCache(embeddingModel, 100)
        } catch (error) {
            // 如果localStorage满了，尝试清理一些旧的缓存
            if (error instanceof DOMException && error.code === 22) {
                this.cleanupTopicEmbeddingCache(embeddingModel, 50)
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(embedding))
                } catch (retryError) {
                }
            }
        }
    }

    // 清理话题embedding缓存，保留最新的N个
    cleanupTopicEmbeddingCache = (embeddingModel: string, keepCount: number): void => {
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

    // 计算话题的embedding
    computeTopicEmbedding = async (topic: string): Promise<number[]> => {
        const { aiMode } = this.props
        const { apiEndpoint, apiKey, embeddingModel } = aiMode

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
        const cachedEmbedding = this.loadTopicEmbeddingFromCache(trimmedTopic, modelToUse)
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
                this.saveTopicEmbeddingToCache(trimmedTopic, modelToUse, embedding)
                
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

    // 计算余弦相似度
    cosineSimilarity = (vecA: number[], vecB: number[]): number => {
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

    // ==================== 步骤1: 根据时间范围筛选 ====================
    stepQueryDatabase = async (timeRangeDays: number | null): Promise<RSSItem[]> => {
        this.updateStepStatus('query-db', 'in_progress', '正在从数据库查询文章...')
        
        // 等待数据库初始化
        let retries = 0
        while ((!db.itemsDB || !db.items) && retries < 50) {
            await new Promise(resolve => setTimeout(resolve, 100))
            retries++
        }
        
        if (!db.itemsDB || !db.items) {
            this.updateStepStatus('query-db', 'error', '数据库未初始化')
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
            .limit(1000)  // 先查询更多文章，然后使用向量相似度筛选

        const items = query 
            ? await queryBuilder.where(query).exec() as RSSItem[]
            : await queryBuilder.exec() as RSSItem[]
        
        this.updateStepStatus('query-db', 'completed', `已查询到 ${items.length} 篇文章`)
        return items
    }

    // ==================== 步骤2: 计算话题向量 ====================
    stepComputeTopicEmbedding = async (topic: string): Promise<number[]> => {
        const trimmedTopic = topic.trim()
        this.updateStepStatus('compute-topic-embedding', 'in_progress', `正在计算话题"${trimmedTopic}"的向量...`)
        
        try {
            const topicEmbedding = await this.computeTopicEmbedding(trimmedTopic)
            this.updateStepStatus('compute-topic-embedding', 'completed', '话题向量计算完成')
            return topicEmbedding
        } catch (error) {
            this.updateStepStatus('compute-topic-embedding', 'error', '计算话题向量失败，使用全文匹配')
            throw error
        }
    }

    // ==================== 步骤3: 加载已有文章向量 ====================
    stepLoadEmbeddings = async (items: RSSItem[]): Promise<void> => {
        this.updateStepStatus('load-embeddings', 'in_progress', '正在从数据库加载已有文章向量...')
        
        const itemIds = items.map(item => item._id)
        if (itemIds.length === 0) {
            this.updateStepStatus('load-embeddings', 'completed', '没有需要加载的文章')
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
            
            this.updateStepStatus('load-embeddings', 'completed', `已加载 ${loadedCount} 篇文章的向量`)
        } catch (error) {
            this.updateStepStatus('load-embeddings', 'error', '加载向量失败')
        }
    }

    // ==================== 步骤4: 计算新文章向量 ====================
    stepComputeEmbeddings = async (items: RSSItem[]): Promise<void> => {
        // 过滤出还没有embedding的文章
        const articlesNeedingEmbedding = items.filter(item => {
            const embedding = item.embedding
            const hasEmbedding = embedding && Array.isArray(embedding) && embedding.length > 0
            return !hasEmbedding
        })

        if (articlesNeedingEmbedding.length === 0) {
            this.updateStepStatus('compute-embeddings', 'completed', '所有文章已有向量，跳过计算')
            return
        }

        this.updateStepStatus('compute-embeddings', 'in_progress', `需要计算 ${articlesNeedingEmbedding.length} 篇文章的向量...`, 0)
        
        try {
            await this.computeAndStoreEmbeddings(articlesNeedingEmbedding)
            
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
            
            this.updateStepStatus('compute-embeddings', 'completed', `已完成 ${articlesNeedingEmbedding.length} 篇文章的向量计算`)
        } catch (error) {
            this.updateStepStatus('compute-embeddings', 'error', '计算向量失败，继续使用已有向量')
            // 继续执行，只使用已有embedding的文章
        }
    }

    // ==================== 步骤5: 计算相似度并筛选 ====================
    stepCalculateSimilarity = async (items: RSSItem[], topicEmbedding: number[], similarityThreshold: number): Promise<RSSItem[]> => {
        this.updateStepStatus('calculate-similarity', 'in_progress', '正在计算文章相似度...', 0)
        
        const articlesWithSimilarity: Array<{ article: RSSItem, similarity: number }> = []
        const totalItems = items.length
        let processedCount = 0
        
        for (const item of items) {
            if (item.embedding && Array.isArray(item.embedding) && item.embedding.length > 0) {
                try {
                    const similarity = this.cosineSimilarity(topicEmbedding, item.embedding)
                    if (similarity >= similarityThreshold) {
                        articlesWithSimilarity.push({ article: item, similarity })
                    }
                } catch (error) {
                    // 忽略单个文章的计算错误
                }
            }
            processedCount++
            // 每处理10%更新一次进度
            if (processedCount % Math.max(1, Math.floor(totalItems / 10)) === 0) {
                const progress = Math.floor((processedCount / totalItems) * 100)
                this.updateStepStatus('calculate-similarity', 'in_progress', `正在计算相似度... (${processedCount}/${totalItems})`, progress)
            }
        }

        // 按相似度降序排序
        articlesWithSimilarity.sort((a, b) => b.similarity - a.similarity)

        // 选择相似度最高的100篇（如果没有100篇就全选）
        const maxArticles = 100
        const selectedArticles = articlesWithSimilarity
            .slice(0, maxArticles)
            .map(item => item.article)

        this.updateStepStatus('calculate-similarity', 'completed', `找到 ${articlesWithSimilarity.length} 篇相关文章，已选择前 ${selectedArticles.length} 篇`)

        return selectedArticles
    }

    // ==================== 主函数: 查询符合条件的文章（顺序执行各个步骤）====================
    queryArticles = async (timeRangeDays: number | null, topic: string | null): Promise<RSSItem[]> => {
        // 步骤1: 根据时间范围筛选
        const items = await this.stepQueryDatabase(timeRangeDays)

        // 如果没有话题，直接返回所有文章
        if (!topic || !topic.trim()) {
            return items
        }

        const trimmedTopic = topic.trim()
        
        // 从 Redux state 读取相似度阈值
        const { aiMode } = this.props
        const similarityThreshold = aiMode.similarityThreshold || 0.7

        try {
            // 步骤2: 计算话题向量
            const topicEmbedding = await this.stepComputeTopicEmbedding(trimmedTopic)
            
            // 步骤3: 加载已有文章向量
            await this.stepLoadEmbeddings(items)
            
            // 步骤4: 计算新文章向量
            await this.stepComputeEmbeddings(items)
            
            // 步骤5: 计算相似度并筛选
            const selectedArticles = await this.stepCalculateSimilarity(items, topicEmbedding, similarityThreshold)
            
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

    // 计算文章的embedding并存储
    computeAndStoreEmbeddings = async (articles: RSSItem[]): Promise<void> => {
        const { aiMode } = this.props
        const { apiEndpoint, apiKey, embeddingModel } = aiMode

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
                this.updateStepStatus('compute-embeddings', 'in_progress', 
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

    // 对文章进行聚类分析
    clusterArticles = async (articles: RSSItem[], topic: string | null): Promise<ArticleCluster[]> => {
        const { aiMode } = this.props
        const { apiEndpoint, apiKey, model } = aiMode

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
        this.updateStepStatus('cluster-articles', 'in_progress', `正在分析 ${articles.length} 篇文章的内容并进行聚类...`)

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
            
            this.updateStepStatus('cluster-articles', 'in_progress', '正在调用AI模型分析文章...')
            const completion = await openai.chat.completions.create(completionParams)
            this.updateStepStatus('cluster-articles', 'in_progress', '正在解析聚类结果...')

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

                // 如果有未分配的文章，创建一个"其他"分组
                if (unassignedArticles.length > 0) {
                    clusters.push({
                        id: `cluster-other`,
                        title: '其他文章',
                        description: '这些文章暂时无法归类到其他分组中',
                        articles: unassignedArticles
                    })
                }

                // 验证：确保没有重复的文章，并统计过滤掉的文章
                const allArticleIds = new Set<number>()
                clusters.forEach(cluster => {
                    cluster.articles.forEach(article => {
                        if (allArticleIds.has(article._id)) {
                        }
                        allArticleIds.add(article._id)
                    })
                })
                const filteredCount = unrelatedIndices.size
                const displayedCount = allArticleIds.size
                this.updateStepStatus('cluster-articles', 'completed', `聚类完成：共 ${clusters.length} 个分组，${displayedCount} 篇文章`)
                return clusters
            } else {
                throw new Error('API返回格式不正确，未找到choices数组或message内容')
            }
        } catch (error: any) {
            // 更新步骤状态为错误
            let errorMessage = '聚类分析失败'
            if (error instanceof OpenAI.APIError) {
                errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查:\n1. API Endpoint是否正确（完整的URL路径）\n2. 是否需要包含特定的路径（如 /v1/chat/completions）\n3. API服务是否正常运行\n当前请求URL: ${normalizedEndpoint}`
                }
            } else if (error instanceof Error) {
                errorMessage = error.message
            } else {
                errorMessage = `聚类分析失败: ${String(error)}`
            }
            this.updateStepStatus('cluster-articles', 'error', errorMessage)
            throw new Error(errorMessage)
        }
    }

    // 生成总结
    generateSummary = async (articles: RSSItem[], topic: string): Promise<string> => {
        const { aiMode } = this.props
        const { apiEndpoint, apiKey, model } = aiMode

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

        // 准备文章内容
        const articlesText = articles.slice(0, 50).map((article, index) => {
            const dateStr = article.date.toLocaleDateString('zh-CN')
            return `文章 ${index + 1}:
标题: ${article.title}
发布时间: ${dateStr}
摘要: ${article.snippet || article.content.substring(0, 200)}`
        }).join('\n\n')

        const topicText = topic ? `，重点关注话题：${topic}` : ''

        const prompt = `请帮我总结整理以下RSS文章${topicText}。

要求：
1. 按照主题或类别对文章进行分组
2. 为每个分组提供简要总结
3. 突出重要信息和趋势
4. 使用清晰的结构和格式

文章列表：
${articlesText}

请生成详细的总结报告：`

        try {
            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: baseURL,
                dangerouslyAllowBrowser: true
            })

            const completion = await openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的RSS阅读助手，擅长总结和整理文章内容。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000,
            })

            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                return completion.choices[0].message.content || ''
            } else {
                throw new Error('API返回格式不正确，未找到choices数组或message内容')
            }
        } catch (error: any) {
            
            if (error instanceof OpenAI.APIError) {
                let errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查:\n1. API Endpoint是否正确（完整的URL路径）\n2. 是否需要包含特定的路径（如 /v1/chat/completions）\n3. API服务是否正常运行\n当前请求URL: ${normalizedEndpoint}`
                }
                throw new Error(errorMessage)
            } else if (error instanceof Error) {
                throw error
            } else {
                throw new Error(`请求失败: ${String(error)}`)
            }
        }
    }

    handleGenerateSummary = async () => {
        const { aiMode } = this.props
        const { timeRange, topicInput } = aiMode
        const { updateTopic, updateTopicInput, setLoading, setClustering, setError, setSummary, setArticleCount, setFilteredArticles, setClusters, updateQueryProgress, setShowResults, setShowErrorDialog, setErrorDialogMessage } = this.props

        // 验证时间范围必须选择
        if (!timeRange) {
            setShowErrorDialog(true)
            setErrorDialogMessage('请先选择文章发布时间')
            return
        }

        // 验证话题必须输入（话题是必填的）
        const trimmedTopic = topicInput.trim() || aiMode.topic?.trim() || ''
        if (!trimmedTopic) {
            setShowErrorDialog(true)
            setErrorDialogMessage('请输入话题关键词')
            return
        }

        // 保存当前话题到状态和最近话题列表
        const currentTopic = trimmedTopic
        this.saveTopicToRecent(currentTopic)
        
        // 初始化查询进度（话题必填，总是6个步骤）
        const queryProgress = this.initializeQueryProgress()

        // 更新状态
        updateTopic(currentTopic)
        updateTopicInput(currentTopic) // 确保 topicInput 和 topic 一致
        setLoading(true)
        setError(null)
        setSummary('')
        setArticleCount(0)
        setFilteredArticles([])
        setClusters([])
        updateQueryProgress(queryProgress)
        setShowResults(false)
        
        // 通知 Context 更新
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeUpdated')
            window.dispatchEvent(event)
        }

        try {
            // 解析时间范围
            const timeRangeDays = this.parseTimeRange(timeRange)

            // 查询文章（根据时间范围和话题）
            const articles = await this.queryArticles(timeRangeDays, currentTopic)
            
            if (articles.length === 0) {
                const topicMessage = currentTopic ? `或话题"${currentTopic}"` : ''
                setLoading(false)
                setError(`没有找到符合条件的文章。请尝试调整时间范围${topicMessage}。`)
                updateQueryProgress(null)
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
                return
            }

            // 将文章添加到 Redux store，确保可以点击查看
            const { sources } = this.props
            
            // 确保所有文章的 source 都存在
            const articlesWithValidSources = articles.filter(item => {
                const source = sources[item.source]
                if (!source) {
                    return false
                }
                return true
            })
            
            // 保存筛选后的文章列表
            setArticleCount(articlesWithValidSources.length)
            setFilteredArticles(articlesWithValidSources)
            setClusters([])
            setLoading(false)
            setClustering(true)
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }

            // 使用LLM对文章进行聚类分析
            try {
                const clusters = await this.clusterArticles(articlesWithValidSources, currentTopic)
                
                setClusters(clusters)
                setClustering(false)
                setLoading(false)
                setShowResults(false)  // 不自动显示结果，等待用户点击按钮
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
            } catch (clusterError) {
                const errorMsg = clusterError instanceof Error ? clusterError.message : '聚类分析失败，已显示原始文章列表'
                // 聚类失败时仍然显示文章列表，但不进行分组
                setClusters([])
                setClustering(false)
                setLoading(false)
                setError(errorMsg)
                setShowResults(false)  // 不自动显示结果
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '查询失败，请稍后重试'
            setLoading(false)
            setError(errorMessage)
            setShowErrorDialog(true)
            setErrorDialogMessage(errorMessage)
            updateQueryProgress(null)
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }
        }
    }

    handleClearSummary = () => {
        const { setSummary, setError, setArticleCount, setFilteredArticles, setClusters, setShowResults, updateQueryProgress } = this.props
        setSummary('')
        setError(null)
        setArticleCount(0)
        setFilteredArticles([])
        setClusters([])
        setShowResults(false)
        updateQueryProgress(null)
    }

    handleShowResults = () => {
        this.props.setShowResults(true)
    }

    handleCloseErrorDialog = () => {
        this.props.setShowErrorDialog(false)
        this.props.setErrorDialogMessage('')
    }

    render() {
        // 优先使用 Context 中的状态（如果存在），否则使用 Redux state
        const context = this.context
        const useContext = context !== null && context !== undefined
        const { aiMode } = this.props
        
        const { 
            timeRange, 
            topic,
            topicInput,
            summary, 
            isLoading, 
            isClustering,
            error, 
            apiEndpoint, 
            apiKey, 
            model, 
            showConfigPanel, 
            tempApiEndpoint, 
            tempApiKey, 
            tempModel,
            tempEmbeddingModel,
            tempSimilarityThreshold,
            showErrorDialog, 
            errorDialogMessage,
            articleCount,
            filteredArticles,
            clusters,
            queryProgress,
            showResults
        } = useContext ? {
            ...aiMode,
            summary: context.summary !== undefined ? context.summary : aiMode.summary,
            filteredArticles: context.filteredArticles !== undefined ? context.filteredArticles : aiMode.filteredArticles,
            articleCount: context.articleCount !== undefined ? context.articleCount : aiMode.articleCount,
            isLoading: context.isLoading !== undefined ? context.isLoading : aiMode.isLoading,
            isClustering: context.isClustering !== undefined ? context.isClustering : aiMode.isClustering,
            error: context.error !== undefined ? context.error : aiMode.error,
            clusters: context.clusters !== undefined ? context.clusters : aiMode.clusters,
            queryProgress: aiMode.queryProgress,
            showResults: aiMode.showResults
        } : aiMode
        
        const { sources, markRead, contextMenu, showItem, shortcuts } = this.props

        // 统一管理加载界面：只使用深色进度界面
        const currentProgress = queryProgress || aiMode.queryProgress
        const hasResults = filteredArticles.length > 0
        
        // 检查所有步骤是否完成
        const allStepsCompleted = currentProgress ? 
            currentProgress.steps.every(step => step.status === 'completed' || step.status === 'error') : 
            false
        
        // 关键逻辑：如果所有步骤完成且有结果但未显示结果，必须显示进度界面（带"查看结果"按钮）
        // 这个条件优先级最高，确保步骤完成后页面不会消失
        // 即使没有 currentProgress，只要有结果且不在加载中，也认为步骤已完成
        const shouldShowProgressForCompleted = !showResults && hasResults && !isLoading && !isClustering && (
            allStepsCompleted ||  // 有进度且所有步骤完成
            (!currentProgress && hasResults)  // 没有进度但有结果（说明步骤已完成，只是进度信息丢失了）
        )
        
        // 其他情况显示进度界面：正在加载或聚类中，或有进度但未完成
        const shouldShowDarkProgress = !showResults && !shouldShowProgressForCompleted && (
            (isLoading || isClustering) ||  // 正在加载时，即使没有progress也显示（会创建默认的）
            (currentProgress && !allStepsCompleted)  // 有进度但未完成
        )
        

        return (
            <div className={`ai-mode-container ${summary ? 'has-summary' : 'no-summary'}`} style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* 按聚类分组的文章列表 */}
                {filteredArticles.length > 0 && clusters.length > 0 && !isClustering && showResults && (
                    <div 
                        ref={this.summaryContainerRef}
                        className="ai-summary-container has-summary"
                        style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: 'calc(16px + var(--navHeight, 32px)) 20px 20px 20px',  // 顶部间距 = 16px + 导航栏高度
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--neutralLighterAlt)',
                            minHeight: 0,
                            gap: '20px'
                        }}
                    >
                        <div style={{
                            backgroundColor: 'var(--white)',
                            borderRadius: '8px',
                            padding: '16px 24px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                        }}>
                            <h3 style={{
                                margin: '0',
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'var(--neutralPrimary)'
                            }}>
                                总结
                            </h3>
                        </div>
                        
                        {clusters.map((cluster) => (
                            <div
                                key={cluster.id}
                                style={{
                                    backgroundColor: 'var(--white)',
                                    borderRadius: '8px',
                                    padding: '24px',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}
                            >
                                <div style={{
                                    borderBottom: '1px solid var(--neutralLight)',
                                    paddingBottom: '12px',
                                    marginBottom: '8px'
                                }}>
                                    <h4 style={{
                                        margin: '0 0 8px 0',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: 'var(--neutralPrimary)'
                                    }}>
                                        {cluster.title}
                                    </h4>
                                    {cluster.description && (
                                        <p style={{
                                            margin: '0',
                                            fontSize: '14px',
                                            color: 'var(--neutralSecondary)',
                                            lineHeight: '1.5'
                                        }}>
                                            {cluster.description}
                                        </p>
                                    )}
                                    <div style={{
                                        marginTop: '8px',
                                        fontSize: '12px',
                                        color: 'var(--neutralTertiary)'
                                    }}>
                                        共 {cluster.articles.length} 篇文章
                                    </div>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    {cluster.articles.map((item) => {
                                        const source = sources[item.source]
                                        if (!source) return null
                                        const filter = new FeedFilter()
                                        return (
                                            <div key={item._id} className="ai-mode-card-wrapper">
                                                <ListCard
                                                    feedId="ai-mode"
                                                    item={item}
                                                    source={source}
                                                    filter={filter}
                                                    viewConfigs={ViewConfigs.ShowSnippet}
                                                    shortcuts={shortcuts}
                                                    markRead={markRead}
                                                    contextMenu={contextMenu}
                                                    showItem={showItem}
                                                />
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* 如果没有聚类结果，显示原始文章列表 */}
                {filteredArticles.length > 0 && clusters.length === 0 && !isClustering && showResults && (
                    <div 
                        ref={this.summaryContainerRef}
                        className="ai-summary-container has-summary"
                        style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: 'calc(16px + var(--navHeight, 32px)) 20px 20px 20px',  // 顶部间距 = 16px + 导航栏高度
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--neutralLighterAlt)',
                            minHeight: 0
                        }}
                    >
                        <div style={{
                            backgroundColor: 'var(--white)',
                            borderRadius: '8px',
                            padding: '24px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                            overflow: 'hidden'
                        }}>
                            <h3 style={{
                                margin: '0 0 16px 0',
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'var(--neutralPrimary)'
                            }}>
                                筛选后的文章 ({filteredArticles.length} 篇)
                            </h3>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                {filteredArticles.map((item) => {
                                    const source = sources[item.source]
                                    if (!source) return null
                                    const filter = new FeedFilter()
                                    return (
                                        <div key={item._id} className="ai-mode-card-wrapper">
                                            <ListCard
                                                feedId="ai-mode"
                                                item={item}
                                                source={source}
                                                filter={filter}
                                                viewConfigs={ViewConfigs.ShowSnippet}
                                                shortcuts={shortcuts}
                                                markRead={markRead}
                                                contextMenu={contextMenu}
                                                showItem={showItem}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* 加载和错误状态 - Cursor风格深色界面 */}
                {(shouldShowDarkProgress || shouldShowProgressForCompleted) && (() => {
                    // 话题必填，总是6个步骤
                    // 始终使用 aiMode.queryProgress，不要使用 currentProgress，因为它可能在某些情况下为 null
                    // 如果 aiMode.queryProgress 存在，直接使用它，不要重新创建
                    let progress = aiMode.queryProgress
                    if (!progress) {
                        progress = currentProgress
                    }
                    const actualStepCount = progress?.steps?.length || 0
                    const needsRecreate = !progress || actualStepCount !== 6
                    
                    // 只有在确实没有进度时才创建默认进度
                    // 如果 aiMode.queryProgress 存在，即使步骤数量不对，也不要重新创建，因为状态可能正在更新中
                    if (needsRecreate && !aiMode.queryProgress) {
                        const defaultStatus = shouldShowProgressForCompleted ? 'completed' as const : 'in_progress' as const
                        const defaultMessage = shouldShowProgressForCompleted ? '所有步骤已完成' : '正在从数据库查询文章...'
                        
                        progress = {
                            steps: [
                                { id: 'query-db', title: '根据时间范围筛选', status: defaultStatus, message: defaultMessage, visible: true },
                                { id: 'compute-topic-embedding', title: '计算话题向量', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const, visible: shouldShowProgressForCompleted },
                                { id: 'load-embeddings', title: '加载已有文章向量', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const, visible: shouldShowProgressForCompleted },
                                { id: 'compute-embeddings', title: '计算新文章向量', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const, visible: shouldShowProgressForCompleted },
                                { id: 'calculate-similarity', title: '计算相似度并筛选', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const, visible: shouldShowProgressForCompleted },
                                { id: 'cluster-articles', title: '分析文章内容并聚类', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const, visible: shouldShowProgressForCompleted }
                            ],
                            currentStepIndex: shouldShowProgressForCompleted ? 5 : 0,
                            overallProgress: shouldShowProgressForCompleted ? 100 : 0,
                            currentMessage: defaultMessage
                        }
                    }
                    
                    
                    return (
                    <>
                        {/* 添加CSS动画样式 */}
                        <style>{`
                            @keyframes fadeInUp {
                                from {
                                    opacity: 0;
                                    transform: translateY(10px);
                                }
                                to {
                                    opacity: 1;
                                    transform: translateY(0);
                                }
                            }
                        `}</style>
                    <div key="query-progress-dark" style={{ 
                        position: 'absolute', // 使用absolute只覆盖内容区域，不遮挡菜单栏
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex', 
                        flexDirection: 'column',
                        backgroundColor: 'var(--neutralLighterAlt)', // 使用应用背景色
                        zIndex: 100, // 在内容区域内确保在最上层
                        overflow: 'auto',
                        color: 'var(--neutralPrimary)',
                        pointerEvents: 'auto', // 确保可以交互
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            width: 'calc(100% - 40px)',
                            maxWidth: 'min(800px, calc(100% - 40px))',
                            margin: '0 auto',
                            padding: `calc(20px + var(--navHeight, 32px)) 20px 20px 20px`, // 顶部间距 = 20px + 导航栏高度
                            boxSizing: 'border-box',
                            minHeight: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px' // 卡片之间的间距
                        }}>
                            {/* 步骤列表 - Todo风格 - 深色卡片容器 */}
                            <div style={{
                                backgroundColor: '#1e1e1e', // Cursor风格的深色背景
                                borderRadius: '8px',
                                padding: '20px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                flex: 1,
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                overflow: 'auto'
                            }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#858585',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    执行步骤 ({progress.steps.filter(s => s.status === 'completed').length}/{progress.steps.length})
                                </div>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    flex: 1,
                                    minHeight: 0,
                                    overflow: 'auto'
                                }}>
                                {(() => {
                                    // 向后兼容：如果 visible 字段不存在，默认显示（visible !== false）
                                    const visibleSteps = progress.steps.filter(step => step.visible !== false)
                                    return visibleSteps
                                })().map((step, index) => {
                                    const isActive = step.status === 'in_progress'
                                    const isCompleted = step.status === 'completed'
                                    const isError = step.status === 'error'
                                    const isPending = step.status === 'pending'
                                    
                                    return (
                                        <div
                                            key={step.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '12px',
                                                padding: '14px 16px',
                                                borderRadius: '6px',
                                                backgroundColor: isActive 
                                                    ? '#2a2d2e' 
                                                    : isCompleted 
                                                        ? '#1e3a1e' 
                                                        : isError
                                                            ? '#3a1e1e'
                                                            : '#252526',
                                                border: isActive 
                                                    ? '1px solid #4ec9b0' 
                                                    : isCompleted
                                                        ? '1px solid #4ec9b0'
                                                        : isError
                                                            ? '1px solid #f48771'
                                                            : '1px solid #3e3e3e',
                                                borderLeft: isActive 
                                                    ? '3px solid #4ec9b0' 
                                                    : isCompleted
                                                        ? '3px solid #4ec9b0'
                                                        : isError
                                                            ? '3px solid #f48771'
                                                            : '3px solid #3e3e3e',
                                                transition: 'all 0.6s ease-in-out',
                                                opacity: isPending ? 0.6 : 1,
                                                animation: 'fadeInUp 0.6s ease-in-out',
                                                animationDelay: `${index * 0.1}s`,  // 基于索引的延迟
                                                animationFillMode: 'both',
                                                transform: 'translateY(0)'
                                            }}
                                        >
                                            {/* 步骤图标 - 更明显的状态指示 */}
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                marginTop: '2px',
                                                backgroundColor: isError 
                                                    ? '#f48771' 
                                                    : isCompleted 
                                                        ? '#4ec9b0' 
                                                        : isActive 
                                                            ? '#4ec9b0' 
                                                            : '#3e3e3e',
                                                border: isPending ? '1px solid #5a5a5a' : 'none',
                                                transition: 'all 0.6s ease-in-out',
                                                opacity: 1
                                            }}>
                                                {isError ? (
                                                    <Icon iconName="Error" style={{ fontSize: '12px', color: '#ffffff' }} />
                                                ) : isCompleted ? (
                                                    <Icon iconName="CheckMark" style={{ fontSize: '12px', color: '#ffffff' }} />
                                                ) : isActive ? (
                                                    <Spinner size={SpinnerSize.small} styles={{ circle: { borderColor: '#ffffff #ffffff transparent' } }} />
                                                ) : (
                                                    <span style={{ fontSize: '11px', color: '#858585', fontWeight: 600 }}>{index + 1}</span>
                                                )}
                                            </div>
                                            
                                            {/* 步骤内容 */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: isActive || isCompleted ? 500 : 400,
                                                    color: isError 
                                                        ? '#f48771' 
                                                        : isActive 
                                                            ? '#ffffff' 
                                                            : isCompleted 
                                                                ? '#4ec9b0' 
                                                                : '#858585',
                                                    marginBottom: (step.message || step.progress !== undefined) ? '6px' : '0',
                                                    lineHeight: '1.4',
                                                    transition: 'color 0.6s ease-in-out'
                                                }}>
                                                    {step.title}
                                                </div>
                                                {step.message && (
                                                    <div style={{
                                                        fontSize: '12px',
                                                        color: isError 
                                                            ? '#f48771' 
                                                            : isCompleted
                                                                ? '#6a9a6a'
                                                                : '#a0a0a0',
                                                        lineHeight: '1.5',
                                                        marginTop: '4px',
                                                        transition: 'color 0.6s ease-in-out'
                                                    }}>
                                                        {step.message}
                                                    </div>
                                                )}
                                                {step.progress !== undefined && step.status === 'in_progress' && (
                                                    <div style={{ marginTop: '10px' }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            marginBottom: '4px',
                                                            fontSize: '11px',
                                                            color: '#858585'
                                                        }}>
                                                            <span>处理中...</span>
                                                            <span>{step.progress}%</span>
                                                        </div>
                                                        <div style={{
                                                            width: '100%',
                                                            height: '4px',
                                                            backgroundColor: '#3e3e3e',
                                                            borderRadius: '2px',
                                                            overflow: 'hidden'
                                                        }}>
                                                            <div style={{
                                                                width: `${step.progress}%`,
                                                                height: '100%',
                                                                backgroundColor: '#4ec9b0',
                                                                transition: 'width 0.5s ease-out',
                                                                borderRadius: '2px',
                                                                boxShadow: '0 0 4px rgba(78, 201, 176, 0.3)'
                                                            }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                </div>
                            </div>

                            {/* 所有步骤完成后的"查看结果"按钮 - 深色卡片 */}
                            {(() => {
                                const allStepsCompleted = progress.steps.every(step => 
                                    step.status === 'completed' || step.status === 'error'
                                )
                                const hasResults = filteredArticles.length > 0
                                
                                if (allStepsCompleted && hasResults && !showResults) {
                                    return (
                                        <div style={{
                                            backgroundColor: '#1e1e1e', // Cursor风格的深色背景
                                            borderRadius: '8px',
                                            padding: '24px',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                            textAlign: 'center',
                                            flexShrink: 0
                                        }}>
                                            <div style={{
                                                fontSize: '16px',
                                                fontWeight: 500,
                                                color: '#ffffff',
                                                marginBottom: '12px'
                                            }}>
                                                所有步骤已完成！
                                            </div>
                                            <div style={{
                                                fontSize: '13px',
                                                color: '#858585',
                                                marginBottom: '20px'
                                            }}>
                                                已找到 {filteredArticles.length} 篇文章，{clusters.length > 0 ? `分为 ${clusters.length} 个主题` : '未进行聚类'}
                                            </div>
                                            <PrimaryButton
                                                iconProps={{ iconName: 'View' }}
                                                text="查看结果"
                                                onClick={this.handleShowResults}
                                                styles={{
                                                    root: {
                                                        backgroundColor: '#4ec9b0',
                                                        borderColor: '#4ec9b0',
                                                        minWidth: '150px'
                                                    },
                                                    rootHovered: {
                                                        backgroundColor: '#5ed9c0',
                                                        borderColor: '#5ed9c0'
                                                    },
                                                    rootPressed: {
                                                        backgroundColor: '#3eb9a0',
                                                        borderColor: '#3eb9a0'
                                                    }
                                                }}
                                            />
                                        </div>
                                    )
                                }
                                return null
                            })()}
                        </div>
                    </div>
                    </>
                    )
                })()}
                

                {error && !isLoading && filteredArticles.length === 0 && (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        gap: '16px',
                        padding: '20px'
                    }}>
                        <Icon iconName="Error" style={{ fontSize: 48, color: 'var(--error)' }} />
                        <p style={{ color: 'var(--error)', fontSize: '14px', textAlign: 'center' }}>
                            {error}
                        </p>
                    </div>
                )}

                {/* 占位符文本 - 只在没有文章且没有错误且未显示进度界面时显示 */}
                {filteredArticles.length === 0 && !isLoading && !error && !shouldShowDarkProgress && !showResults && (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        flex: 1,
                        gap: '16px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        maxWidth: '600px',
                        width: 'calc(100% - 40px)',
                        margin: '0 auto'
                    }}>
                        <Icon iconName="Robot" style={{ fontSize: 64, color: 'var(--neutralTertiary)' }} />
                        <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutralPrimary)' }}>
                            AI总结助手
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--neutralSecondary)', maxWidth: '500px' }}>
                            在左侧菜单栏选择文章发布时间，和感兴趣的话题，然后点击"整理汇总"按钮生成总结
                        </p>
                    </div>
                )}

                {/* 错误对话框 */}
                {showErrorDialog && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)'
                    }} onClick={this.handleCloseErrorDialog}>
                        <div style={{
                            backgroundColor: 'var(--white)',
                            borderRadius: '4px',
                            padding: '24px',
                            maxWidth: '500px',
                            width: '90%',
                            boxShadow: '0 6.4px 14.4px rgba(0, 0, 0, 0.132), 0 1.2px 3.6px rgba(0, 0, 0, 0.108)',
                            maxHeight: '90%',
                            overflow: 'auto'
                        }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ marginBottom: '16px' }}>
                                <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 600, color: 'var(--neutralPrimary)' }}>错误</h2>
                            </div>
                            <div style={{ marginBottom: '20px', color: 'var(--neutralPrimary)', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                                {errorDialogMessage}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <DefaultButton onClick={this.handleCloseErrorDialog} text="确定" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }
}

const mapStateToProps = (state: RootState) => ({
    sources: state.sources,
    items: state.items,
    aiMode: state.aiMode
})

const mapDispatchToProps = dispatch => ({
    dispatch: dispatch,
    markRead: (item: RSSItem) => dispatch(markRead(item)),
    contextMenu: (feedId: string, item: RSSItem, e: React.MouseEvent) => 
        dispatch(openItemMenu(item, feedId, e)),
    showItem: (fid: string, item: RSSItem) => dispatch(showItem(fid, item)),
    shortcuts: (item: RSSItem, e: KeyboardEvent) => dispatch(itemShortcuts(item, e)),
    // AI Mode actions
    updateTimeRange: (timeRange: string | null) => dispatch(updateAIModeTimeRange(timeRange)),
    updateTopic: (topic: string) => dispatch(updateAIModeTopic(topic)),
    updateTopicInput: (topicInput: string) => dispatch(updateAIModeTopicInput(topicInput)),
    setIsComposing: (isComposing: boolean) => dispatch(setAIModeIsComposing(isComposing)),
    updateRecentTopics: (recentTopics: string[]) => dispatch(updateAIModeRecentTopics(recentTopics)),
    setSummary: (summary: string) => dispatch(setAIModeSummary(summary)),
    setLoading: (isLoading: boolean) => dispatch(setAIModeLoading(isLoading)),
    setClustering: (isClustering: boolean) => dispatch(setAIModeClustering(isClustering)),
    setError: (error: string | null) => dispatch(setAIModeError(error)),
    updateApiEndpoint: (apiEndpoint: string) => dispatch(updateAIModeApiEndpoint(apiEndpoint)),
    updateApiKey: (apiKey: string) => dispatch(updateAIModeApiKey(apiKey)),
    updateModel: (model: string) => dispatch(updateAIModeModel(model)),
    updateEmbeddingModel: (embeddingModel: string) => dispatch(updateAIModeEmbeddingModel(embeddingModel)),
    updateSimilarityThreshold: (similarityThreshold: number) => dispatch(updateAIModeSimilarityThreshold(similarityThreshold)),
    setShowConfigPanel: (showConfigPanel: boolean) => dispatch(setAIModeShowConfigPanel(showConfigPanel)),
    updateTempApiEndpoint: (tempApiEndpoint: string) => dispatch(updateAIModeTempApiEndpoint(tempApiEndpoint)),
    updateTempApiKey: (tempApiKey: string) => dispatch(updateAIModeTempApiKey(tempApiKey)),
    updateTempModel: (tempModel: string) => dispatch(updateAIModeTempModel(tempModel)),
    updateTempEmbeddingModel: (tempEmbeddingModel: string) => dispatch(updateAIModeTempEmbeddingModel(tempEmbeddingModel)),
    updateTempSimilarityThreshold: (tempSimilarityThreshold: string) => dispatch(updateAIModeTempSimilarityThreshold(tempSimilarityThreshold)),
    setShowErrorDialog: (showErrorDialog: boolean) => dispatch(setAIModeShowErrorDialog(showErrorDialog)),
    setErrorDialogMessage: (errorDialogMessage: string) => dispatch(setAIModeErrorDialogMessage(errorDialogMessage)),
    setArticleCount: (articleCount: number) => dispatch(setAIModeArticleCount(articleCount)),
    setFilteredArticles: (filteredArticles: RSSItem[]) => dispatch(setAIModeFilteredArticles(filteredArticles)),
    setClusters: (clusters: ArticleCluster[]) => dispatch(setAIModeClusters(clusters)),
    updateQueryProgress: (queryProgress: QueryProgress | null) => dispatch(updateAIModeQueryProgress(queryProgress)),
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => 
        dispatch(updateAIModeStepStatus(stepId, status, message, progress)),
    setShowResults: (showResults: boolean) => dispatch(setAIModeShowResults(showResults))
})

const AIMode = connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(AIModeComponent)
export default AIMode
