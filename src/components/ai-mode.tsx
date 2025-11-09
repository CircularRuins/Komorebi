import * as React from "react"
import { TextField, ITextField } from "@fluentui/react/lib/TextField"
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown"
import { Label } from "@fluentui/react/lib/Label"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Spinner, SpinnerSize, MessageBar, MessageBarType, Panel, PanelType } from "@fluentui/react"
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

// 文章聚类结果类型
export type ArticleCluster = {
    id: string  // 聚类ID
    title: string  // 聚类标题（说明这些文章讲的是什么）
    description: string  // 聚类描述
    articles: RSSItem[]  // 该聚类中的文章列表
}

// 查询进度步骤类型
export type QueryProgressStep = {
    id: string  // 步骤ID
    title: string  // 步骤标题
    status: 'pending' | 'in_progress' | 'completed' | 'error'  // 步骤状态
    message?: string  // 步骤详细信息
    progress?: number  // 当前步骤的进度百分比（0-100）
}

// 查询进度类型
export type QueryProgress = {
    steps: QueryProgressStep[]
    currentStepIndex: number
    overallProgress: number  // 总体进度百分比（0-100）
    currentMessage: string  // 当前步骤的详细信息
}

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
}

// 创建 Context
export const AIModeContext = React.createContext<AIModeContextType | null>(null)

type AIModeState = {
    timeRange: string | null  // 时间范围key，例如 "1" 表示1天，"7" 表示7天
    topic: string  // 单个话题文本
    topicInput: string  // 当前输入的话题文本
    recentTopics: string[]  // 最近使用的话题（最多5个）
    isComposing: boolean  // 是否正在使用输入法输入
    summary: string    // AI生成的总结
    isLoading: boolean
    isClustering: boolean  // 是否正在聚类
    error: string | null
    apiEndpoint: string
    apiKey: string
    model: string
    embeddingModel: string
    similarityThreshold: number  // 相似度阈值
    showConfigPanel: boolean
    tempApiEndpoint: string
    tempApiKey: string
    tempModel: string
    tempEmbeddingModel: string
    tempSimilarityThreshold: string  // 临时相似度阈值（字符串，用于输入框）
    showErrorDialog: boolean
    errorDialogMessage: string
    articleCount: number  // 筛选到的文章数量
    filteredArticles: RSSItem[]  // 筛选后的文章列表
    clusters: ArticleCluster[]  // 文章聚类结果
    queryProgress: QueryProgress | null  // 查询进度
    showResults: boolean  // 是否显示结果（所有步骤完成后，需要点击按钮才显示）
}

export class AIModeComponent extends React.Component<AIModeProps, AIModeState> {
    static contextType = AIModeContext
    declare context: React.ContextType<typeof AIModeContext>
    private summaryContainerRef: React.RefObject<HTMLDivElement>
    private topicInputRef: React.RefObject<ITextField>
    private updateTimeout: NodeJS.Timeout | null = null

    constructor(props: AIModeProps) {
        super(props)
        this.summaryContainerRef = React.createRef()
        this.topicInputRef = React.createRef()
        const savedEndpoint = localStorage.getItem('ai-api-endpoint') || 'https://api.openai.com/v1/chat/completions'
        const savedKey = localStorage.getItem('ai-api-key') || ''
        const savedModel = localStorage.getItem('ai-model') || ''
        const savedEmbeddingModel = localStorage.getItem('ai-embedding-model') || 'text-embedding-ada-002'
        const savedSimilarityThreshold = parseFloat(localStorage.getItem('ai-similarity-threshold') || '0.7')
        // 从localStorage加载最近话题
        const savedRecentTopics = localStorage.getItem('ai-recent-topics')
        const recentTopics = savedRecentTopics ? JSON.parse(savedRecentTopics) : []
        
        this.state = {
            timeRange: null,
            topic: '',
            topicInput: '',
            recentTopics: recentTopics,
            isComposing: false,
            summary: '',
            isLoading: false,
            isClustering: false,
            error: null,
            apiEndpoint: savedEndpoint,
            apiKey: savedKey,
            model: savedModel,
            embeddingModel: savedEmbeddingModel,
            similarityThreshold: savedSimilarityThreshold,
            showConfigPanel: false,
            tempApiEndpoint: savedEndpoint,
            tempApiKey: savedKey,
            tempModel: savedModel,
            tempEmbeddingModel: savedEmbeddingModel,
            tempSimilarityThreshold: savedSimilarityThreshold.toString(),
            showErrorDialog: false,
            errorDialogMessage: '',
            articleCount: 0,
            filteredArticles: [],
            clusters: [],
            queryProgress: null,
            showResults: false
        }
    }

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

    componentDidUpdate(prevProps: AIModeProps, prevState: AIModeState) {
        // 只在关键状态改变时通知Root组件更新Context（排除输入框变化以避免打断输入）
        if (
            prevState.timeRange !== this.state.timeRange ||
            prevState.topic !== this.state.topic ||
            prevState.summary !== this.state.summary ||
            prevState.isLoading !== this.state.isLoading ||
            prevState.isClustering !== this.state.isClustering ||
            prevState.showConfigPanel !== this.state.showConfigPanel ||
            prevState.apiEndpoint !== this.state.apiEndpoint ||
            prevState.apiKey !== this.state.apiKey ||
            prevState.model !== this.state.model ||
            prevState.filteredArticles.length !== this.state.filteredArticles.length ||
            prevState.clusters.length !== this.state.clusters.length ||
            prevState.articleCount !== this.state.articleCount ||
            prevState.error !== this.state.error
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
        return {
            timeRange: this.state.timeRange,
            topic: this.state.topic,
            topicInput: this.state.topicInput,
            recentTopics: this.state.recentTopics,
            isComposing: this.state.isComposing,
            isLoading: this.state.isLoading,
            isClustering: this.state.isClustering,
            summary: this.state.summary,
            apiEndpoint: this.state.apiEndpoint,
            apiKey: this.state.apiKey,
            model: this.state.model,
            showConfigPanel: this.state.showConfigPanel,
            articleCount: this.state.articleCount,
            error: this.state.error,
            filteredArticles: this.state.filteredArticles,
            clusters: this.state.clusters,
            setTimeRange: (timeRange: string | null) => this.setState({ timeRange }),
            setTopic: (topic: string) => this.setState({ topic }),
            setTopicInput: (topicInput: string) => this.setState({ topicInput }),
            setIsComposing: (isComposing: boolean) => this.setState({ isComposing }),
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
        this.setState({ timeRange: option ? option.key as string : null })
    }

    handleTopicInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        this.setState({ topicInput: newValue || '' }, () => {
            // 状态更新后立即更新Context，确保输入框能正常显示输入
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeInputChanged')
                window.dispatchEvent(event)
            }
        })
    }

    handleTopicInputCompositionStart = () => {
        this.setState({ isComposing: true })
    }

    handleTopicInputCompositionEnd = () => {
        this.setState({ isComposing: false }, () => {
            // 输入法结束后更新Context
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeInputChanged')
                window.dispatchEvent(event)
            }
        })
    }

    handleTopicInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        // 处理Enter键确认话题
        if (event.key === 'Enter' && !this.state.isComposing) {
            event.preventDefault()
            const trimmed = this.state.topicInput.trim()
            if (trimmed) {
                this.setState({ topic: trimmed })
            }
        }
    }

    handleRecentTopicClick = (topic: string) => {
        // 点击常选话题时填充到输入框和话题字段
        this.setState({ 
            topicInput: topic,
            topic: topic
        }, () => {
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
        })
    }

    // 保存话题到最近话题列表
    saveTopicToRecent = (topic: string) => {
        const trimmed = topic.trim()
        if (!trimmed) return

        const { recentTopics } = this.state
        // 移除已存在的相同话题
        const filtered = recentTopics.filter(t => t !== trimmed)
        // 添加到最前面
        const updated = [trimmed, ...filtered].slice(0, 5)  // 最多保留5个
        
        this.setState({ recentTopics: updated })
        // 保存到localStorage
        localStorage.setItem('ai-recent-topics', JSON.stringify(updated))
    }

    handleApiEndpointChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ tempApiEndpoint: value })
    }

    handleApiKeyChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ tempApiKey: value })
    }

    handleModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ tempModel: value })
    }

    handleEmbeddingModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ tempEmbeddingModel: value })
    }

    handleSimilarityThresholdChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ tempSimilarityThreshold: value })
    }

    handleConfigConfirm = () => {
        const { tempApiEndpoint, tempApiKey, tempModel, tempEmbeddingModel, tempSimilarityThreshold } = this.state
        
        // 验证相似度阈值
        const similarityThreshold = parseFloat(tempSimilarityThreshold)
        if (isNaN(similarityThreshold) || similarityThreshold < 0 || similarityThreshold > 1) {
            this.setState({
                showErrorDialog: true,
                errorDialogMessage: '相似度阈值必须是0到1之间的数字'
            })
            return
        }
        
        // 保存到localStorage和state
        localStorage.setItem('ai-api-endpoint', tempApiEndpoint)
        localStorage.setItem('ai-api-key', tempApiKey)
        localStorage.setItem('ai-model', tempModel)
        localStorage.setItem('ai-embedding-model', tempEmbeddingModel)
        localStorage.setItem('ai-similarity-threshold', similarityThreshold.toString())
        console.log('保存embedding模型配置:', tempEmbeddingModel)
        console.log('保存相似度阈值配置:', similarityThreshold)
        this.setState({
            apiEndpoint: tempApiEndpoint,
            apiKey: tempApiKey,
            model: tempModel,
            embeddingModel: tempEmbeddingModel,
            similarityThreshold: similarityThreshold,
            showConfigPanel: false
        })
    }

    handleConfigCancel = () => {
        // 恢复临时状态为已保存的值
        const { apiEndpoint, apiKey, model, embeddingModel, similarityThreshold } = this.state
        this.setState({
            tempApiEndpoint: apiEndpoint,
            tempApiKey: apiKey,
            tempModel: model,
            tempEmbeddingModel: embeddingModel,
            tempSimilarityThreshold: similarityThreshold.toString(),
            showConfigPanel: false
        })
    }

    handleConfigPanelOpen = () => {
        // 打开面板时，初始化临时状态为当前保存的值
        const { apiEndpoint, apiKey, model, embeddingModel, similarityThreshold } = this.state
        this.setState({
            showConfigPanel: true,
            tempApiEndpoint: apiEndpoint,
            tempApiKey: apiKey,
            tempModel: model,
            tempEmbeddingModel: embeddingModel,
            tempSimilarityThreshold: similarityThreshold.toString()
        })
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

    // 初始化查询进度
    initializeQueryProgress = (hasTopic: boolean): QueryProgress => {
        const steps: QueryProgressStep[] = [
            { id: 'query-db', title: '查询数据库文章', status: 'in_progress', message: '正在从数据库查询文章...' },
        ]
        
        if (hasTopic) {
            steps.push(
                { id: 'compute-topic-embedding', title: '计算话题向量', status: 'pending' },
                { id: 'load-embeddings', title: '加载已有文章向量', status: 'pending' },
                { id: 'compute-embeddings', title: '计算新文章向量', status: 'pending' },
                { id: 'calculate-similarity', title: '计算相似度并筛选', status: 'pending' }
            )
        }
        
        steps.push(
            { id: 'cluster-articles', title: '分析文章内容并聚类', status: 'pending' }
        )
        
        return {
            steps,
            currentStepIndex: 0,
            overallProgress: 0,
            currentMessage: '开始查询...'
        }
    }

    // 更新查询进度
    updateQueryProgress = (updates: Partial<QueryProgress>) => {
        this.setState(prevState => {
            if (!prevState.queryProgress) return prevState
            
            const progress = { ...prevState.queryProgress, ...updates }
            
            // 计算总体进度
            const totalSteps = progress.steps.length
            const completedSteps = progress.steps.filter(s => s.status === 'completed').length
            const currentStep = progress.steps[progress.currentStepIndex]
            const stepProgress = currentStep?.progress || 0
            const baseProgress = (completedSteps / totalSteps) * 100
            const currentStepWeight = 1 / totalSteps
            const currentStepProgress = (stepProgress / 100) * currentStepWeight * 100
            progress.overallProgress = Math.min(100, baseProgress + currentStepProgress)
            
            return { ...prevState, queryProgress: progress }
        })
    }

    // 更新步骤状态
    updateStepStatus = (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => {
        this.setState(prevState => {
            if (!prevState.queryProgress) return prevState
            
            const steps = prevState.queryProgress.steps.map(step => {
                if (step.id === stepId) {
                    return { ...step, status, message, progress }
                }
                return step
            })
            
            const currentStepIndex = steps.findIndex(s => s.status === 'in_progress')
            const currentMessage = steps.find(s => s.status === 'in_progress')?.message || 
                                   steps.find(s => s.status === 'completed')?.message || 
                                   prevState.queryProgress.currentMessage
            
            // 计算总体进度
            const totalSteps = steps.length
            const completedSteps = steps.filter(s => s.status === 'completed').length
            const currentStep = steps[currentStepIndex >= 0 ? currentStepIndex : prevState.queryProgress.currentStepIndex]
            const stepProgress = currentStep?.progress || 0
            const baseProgress = (completedSteps / totalSteps) * 100
            const currentStepWeight = 1 / totalSteps
            const currentStepProgress = (stepProgress / 100) * currentStepWeight * 100
            const overallProgress = Math.min(100, baseProgress + currentStepProgress)
            
            return {
                ...prevState,
                queryProgress: {
                    ...prevState.queryProgress,
                    steps,
                    currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : prevState.queryProgress.currentStepIndex,
                    currentMessage,
                    overallProgress
                }
            }
        })
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
                    console.log('从缓存加载话题embedding，话题:', topic)
                    return embedding
                }
            }
        } catch (error) {
            console.warn('加载话题embedding缓存失败:', error)
        }
        return null
    }

    // 保存话题embedding到缓存
    saveTopicEmbeddingToCache = (topic: string, embeddingModel: string, embedding: number[]): void => {
        const cacheKey = this.getTopicEmbeddingCacheKey(topic, embeddingModel)
        try {
            localStorage.setItem(cacheKey, JSON.stringify(embedding))
            console.log('保存话题embedding到缓存，话题:', topic)
            
            // 限制缓存数量，避免localStorage过大（最多保留100个话题的embedding）
            this.cleanupTopicEmbeddingCache(embeddingModel, 100)
        } catch (error) {
            console.warn('保存话题embedding缓存失败:', error)
            // 如果localStorage满了，尝试清理一些旧的缓存
            if (error instanceof DOMException && error.code === 22) {
                console.log('localStorage已满，尝试清理旧缓存...')
                this.cleanupTopicEmbeddingCache(embeddingModel, 50)
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(embedding))
                } catch (retryError) {
                    console.warn('清理后仍无法保存缓存:', retryError)
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
                console.log(`清理了${toDelete.length}个旧的话题embedding缓存`)
            }
        } catch (error) {
            console.warn('清理话题embedding缓存失败:', error)
        }
    }

    // 计算话题的embedding
    computeTopicEmbedding = async (topic: string): Promise<number[]> => {
        const { apiEndpoint, apiKey, embeddingModel } = this.state

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
        console.log('计算话题embedding，话题:', trimmedTopic, '模型:', modelToUse)

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
            console.error('计算话题embedding失败:', error)
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

    // 查询符合条件的文章（根据时间范围和话题筛选）
    queryArticles = async (timeRangeDays: number | null, topic: string | null): Promise<RSSItem[]> => {
        // 更新进度：查询数据库
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

        // 如果有话题，使用向量相似度筛选
        if (topic && topic.trim()) {
            const trimmedTopic = topic.trim()
            
            // 从localStorage读取最新的相似度阈值（确保使用最新配置）
            const savedThreshold = localStorage.getItem('ai-similarity-threshold')
            const similarityThreshold = savedThreshold ? parseFloat(savedThreshold) : (this.state.similarityThreshold || 0.7)
            
            console.log('开始使用向量相似度筛选文章，话题:', trimmedTopic, '阈值:', similarityThreshold)

            // 计算话题的embedding
            this.updateStepStatus('compute-topic-embedding', 'in_progress', `正在计算话题"${trimmedTopic}"的向量...`)
            let topicEmbedding: number[]
            try {
                topicEmbedding = await this.computeTopicEmbedding(trimmedTopic)
                this.updateStepStatus('compute-topic-embedding', 'completed', '话题向量计算完成')
            } catch (error) {
                console.error('计算话题embedding失败，回退到全文匹配:', error)
                this.updateStepStatus('compute-topic-embedding', 'error', '计算话题向量失败，使用全文匹配')
                // 如果计算embedding失败，回退到全文匹配
                const topicRegex = new RegExp(trimmedTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                return items.filter(item => {
                    return (
                        topicRegex.test(item.title) ||
                        topicRegex.test(item.snippet || '') ||
                        topicRegex.test(item.content || '')
                    )
                })
            }

            // 检查哪些文章需要计算embedding
            // 先从数据库批量重新加载embedding字段，确保获取最新数据
            this.updateStepStatus('load-embeddings', 'in_progress', '正在从数据库加载已有文章向量...')
            const itemIds = items.map(item => item._id)
            if (itemIds.length > 0) {
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
                    
                    console.log(`从数据库加载了${loadedCount}篇文章的embedding，共${items.length}篇文章`)
                    this.updateStepStatus('load-embeddings', 'completed', `已加载 ${loadedCount} 篇文章的向量`)
                } catch (error) {
                    console.warn('批量加载embedding失败:', error)
                    this.updateStepStatus('load-embeddings', 'error', '加载向量失败')
                }
            }

            // 过滤出还没有embedding的文章
            const articlesNeedingEmbedding = items.filter(item => {
                const embedding = item.embedding
                const hasEmbedding = embedding && Array.isArray(embedding) && embedding.length > 0
                return !hasEmbedding
            })

            console.log(`总共${items.length}篇文章，其中${items.length - articlesNeedingEmbedding.length}篇已有embedding，${articlesNeedingEmbedding.length}篇需要计算`)

            if (articlesNeedingEmbedding.length > 0) {
                console.log(`发现${articlesNeedingEmbedding.length}篇文章没有embedding，开始计算...`)
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
                            
                            console.log(`重新加载了${embeddingMap.size}篇新计算的文章的embedding`)
                        } catch (error) {
                            console.warn('重新加载embedding失败:', error)
                        }
                    }
                    this.updateStepStatus('compute-embeddings', 'completed', `已完成 ${articlesNeedingEmbedding.length} 篇文章的向量计算`)
                } catch (error) {
                    console.error('计算文章embedding失败:', error)
                    this.updateStepStatus('compute-embeddings', 'error', '计算向量失败，继续使用已有向量')
                    // 继续执行，只使用已有embedding的文章
                }
            } else {
                this.updateStepStatus('compute-embeddings', 'completed', '所有文章已有向量，跳过计算')
            }

            // 计算每篇文章与话题的相似度
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
                        console.warn(`计算文章 ${item._id} 的相似度失败:`, error)
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

            console.log(`向量相似度筛选完成: 找到${articlesWithSimilarity.length}篇相似度>=${similarityThreshold}的文章，选择了前${selectedArticles.length}篇`)
            this.updateStepStatus('calculate-similarity', 'completed', `找到 ${articlesWithSimilarity.length} 篇相关文章，已选择前 ${selectedArticles.length} 篇`)

            return selectedArticles
        }

        return items
    }

    // 计算文章的embedding并存储
    computeAndStoreEmbeddings = async (articles: RSSItem[]): Promise<void> => {
        const { apiEndpoint, apiKey, embeddingModel } = this.state
        console.log('computeAndStoreEmbeddings - 当前embeddingModel配置:', embeddingModel)

        if (articles.length === 0) {
            return
        }

        // 验证API配置
        if (!apiEndpoint || !apiEndpoint.trim()) {
            console.warn('API Endpoint未配置，跳过embedding计算')
            return
        }
        if (!apiKey || !apiKey.trim()) {
            console.warn('API Key未配置，跳过embedding计算')
            return
        }

        // 规范化endpoint URL
        let normalizedEndpoint = apiEndpoint.trim()
        if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
            console.warn('API Endpoint格式不正确，跳过embedding计算')
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
            console.warn('无效的API Endpoint URL，跳过embedding计算:', normalizedEndpoint)
            return
        }

        // 过滤出还没有embedding的文章
        const articlesNeedingEmbedding = articles.filter(article => {
            const embedding = article.embedding
            return !embedding || !Array.isArray(embedding) || embedding.length === 0
        })
        
        if (articlesNeedingEmbedding.length === 0) {
            console.log('所有文章都已计算过embedding')
            return
        }

        console.log(`开始计算${articlesNeedingEmbedding.length}篇文章的embedding`)

        try {
            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: baseURL,
                dangerouslyAllowBrowser: true
            })

            // 验证embedding模型配置
            if (!embeddingModel || !embeddingModel.trim()) {
                console.warn('Embedding模型未配置，跳过embedding计算')
                return
            }

            const modelToUse = embeddingModel.trim()
            const batchSize = 10  // API限制：每批最多10篇
            const totalArticles = articlesNeedingEmbedding.length
            const totalBatches = Math.ceil(totalArticles / batchSize)
            
            // 将文章分批处理
            for (let batchStart = 0; batchStart < articlesNeedingEmbedding.length; batchStart += batchSize) {
                const batchEnd = Math.min(batchStart + batchSize, articlesNeedingEmbedding.length)
                const batch = articlesNeedingEmbedding.slice(batchStart, batchEnd)
                const batchNumber = Math.floor(batchStart / batchSize) + 1
                const progress = Math.floor((batchStart / totalArticles) * 100)
                
                // 更新进度
                this.updateStepStatus('compute-embeddings', 'in_progress', 
                    `正在计算向量... 第 ${batchNumber}/${totalBatches} 批 (${batchStart + batch.length}/${totalArticles})`, 
                    progress)
                
                // 准备当前批次的文本
                const texts = batch.map(article => {
                    // 拼接标题和摘要
                    const title = article.title || ''
                    const snippet = article.snippet || ''
                    return `${title}\n${snippet}`.trim()
                })

                console.log(`处理第 ${batchNumber} 批，共 ${batch.length} 篇文章`)

                // 调用embedding API
                const response = await openai.embeddings.create({
                    model: modelToUse,
                    input: texts,
                })

                // 存储embedding到数据库
                const embeddings = response.data.map(item => item.embedding)
                
                for (let i = 0; i < batch.length; i++) {
                    const article = batch[i]
                    const embedding = embeddings[i]
                    
                    // 更新数据库
                    await db.itemsDB
                        .update(db.items)
                        .where(db.items._id.eq(article._id))
                        .set(db.items.embedding, embedding)
                        .exec()
                    
                    // 更新内存中的对象
                    article.embedding = embedding
                }
            }

            console.log(`成功计算并存储了${articlesNeedingEmbedding.length}篇文章的embedding`)
        } catch (error: any) {
            console.error('计算embedding失败:', error)
            // 不抛出错误，避免影响主流程
        }
    }

    // 对文章进行聚类分析
    clusterArticles = async (articles: RSSItem[], topic: string | null): Promise<ArticleCluster[]> => {
        const { apiEndpoint, apiKey, model } = this.state

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

        console.log('开始聚类分析，文章数量:', articles.length, '话题:', topic)
        
        // 更新进度：开始聚类
        this.updateStepStatus('cluster-articles', 'in_progress', `正在分析 ${articles.length} 篇文章的内容并进行聚类...`, 0)

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
            
            console.log('发送聚类请求到API，模型:', model, '文章数量:', articlesToAnalyze.length)
            this.updateStepStatus('cluster-articles', 'in_progress', '正在调用AI模型分析文章...', 50)
            const completion = await openai.chat.completions.create(completionParams)
            console.log('收到API响应')
            this.updateStepStatus('cluster-articles', 'in_progress', '正在解析聚类结果...', 80)

            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                const responseText = completion.choices[0].message.content || ''
                console.log('API返回的原始文本长度:', responseText.length)
                console.log('API返回的原始文本前500字符:', responseText.substring(0, 500))
                
                // 解析JSON响应
                let responseData
                try {
                    // 尝试提取JSON（可能包含markdown代码块）
                    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/)
                    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText
                    console.log('提取的JSON文本长度:', jsonText.length)
                    responseData = JSON.parse(jsonText)
                    console.log('解析JSON成功，clusters数量:', responseData.clusters?.length)
                } catch (parseError) {
                    console.error('解析聚类结果失败:', parseError)
                    console.error('原始响应文本:', responseText)
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
                    console.log('发现与话题无关的文章，数量:', unrelatedIndices.size, '索引:', Array.from(unrelatedIndices))
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
                            console.warn(`文章索引 ${idx} 被重复分配到聚类 ${index}，已忽略（已属于聚类 ${articleToClusterMap.get(idx)}）`)
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
                    console.log('发现未分配的文章，数量:', unassignedArticles.length)
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
                            console.error('发现重复的文章:', article._id, article.title)
                        }
                        allArticleIds.add(article._id)
                    })
                })
                const filteredCount = unrelatedIndices.size
                const displayedCount = allArticleIds.size
                console.log('验证完成：显示文章数', displayedCount, '，过滤掉无关文章数', filteredCount, '，原始文章数', articlesToAnalyze.length)

                console.log('最终聚类结果:', clusters.length, '个分组，总文章数:', clusters.reduce((sum, c) => sum + c.articles.length, 0))
                this.updateStepStatus('cluster-articles', 'completed', `聚类完成：共 ${clusters.length} 个分组，${displayedCount} 篇文章`)
                return clusters
            } else {
                throw new Error('API返回格式不正确，未找到choices数组或message内容')
            }
        } catch (error: any) {
            console.error('聚类分析失败:', error)
            
            if (error instanceof OpenAI.APIError) {
                let errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查:\n1. API Endpoint是否正确（完整的URL路径）\n2. 是否需要包含特定的路径（如 /v1/chat/completions）\n3. API服务是否正常运行\n当前请求URL: ${normalizedEndpoint}`
                }
                throw new Error(errorMessage)
            } else if (error instanceof Error) {
                throw error
            } else {
                throw new Error(`聚类分析失败: ${String(error)}`)
            }
        }
    }

    // 生成总结
    generateSummary = async (articles: RSSItem[], topic: string): Promise<string> => {
        const { apiEndpoint, apiKey, model } = this.state

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
            console.error('API调用失败:', error)
            
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
        const { timeRange, topicInput } = this.state

        // 验证时间范围必须选择
        if (!timeRange) {
            this.setState({ 
                showErrorDialog: true,
                errorDialogMessage: '请先选择文章发布时间'
            })
            return
        }

        // 保存当前话题到状态和最近话题列表
        const trimmedTopic = topicInput.trim()
        if (trimmedTopic) {
            this.setState({ topic: trimmedTopic })
            this.saveTopicToRecent(trimmedTopic)
        }

        // 获取当前话题（如果有的话）
        const currentTopic = trimmedTopic || this.state.topic || null
        
        // 初始化查询进度
        const queryProgress = this.initializeQueryProgress(!!currentTopic)
        console.log('初始化查询进度:', queryProgress)

        this.setState({ 
            isLoading: true,
            error: null,
            summary: '',
            articleCount: 0,
            filteredArticles: [],
            clusters: [],
            queryProgress: queryProgress,
            showResults: false
        }, () => {
            console.log('状态已更新，queryProgress:', this.state.queryProgress)
            // 状态更新后立即通知 Context 更新
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }
        })

        try {
            // 解析时间范围
            const timeRangeDays = this.parseTimeRange(timeRange)

            // 查询文章（根据时间范围和话题）
            // queryArticles内部已经处理了：
            // 1. 先通过时间范围筛选文章
            // 2. 如果有话题，只对时间范围内的文章计算embedding（如果还没有的话）
            // 3. 然后进行向量相似度筛选
            const articles = await this.queryArticles(timeRangeDays, currentTopic)
            
            if (articles.length === 0) {
                const topicMessage = currentTopic ? `或话题"${currentTopic}"` : ''
                this.setState({
                    isLoading: false,
                    error: `没有找到符合条件的文章。请尝试调整时间范围${topicMessage}。`,
                    queryProgress: null
                }, () => {
                    if (typeof window !== 'undefined') {
                        const event = new CustomEvent('aiModeUpdated')
                        window.dispatchEvent(event)
                    }
                })
                return
            }

            // 将文章添加到 Redux store，确保可以点击查看
            const { dispatch, items, sources } = this.props
            
            // 确保所有文章的 source 都存在
            const articlesWithValidSources = articles.filter(item => {
                const source = sources[item.source]
                if (!source) {
                    console.warn(`文章 ${item._id} 的 source ${item.source} 不存在`)
                    return false
                }
                return true
            })
            
            if (articlesWithValidSources.length !== articles.length) {
                console.warn(`有 ${articles.length - articlesWithValidSources.length} 篇文章的 source 不存在，已过滤`)
            }
            
            // 注意：这些文章已经在数据库和 store 中了（因为我们是从数据库查询的）
            // 我们不需要调用 fetchItemsSuccess，因为：
            // 1. 这些文章已经在 itemReducer 的 state 中了
            // 2. 调用 fetchItemsSuccess 会导致 feedReducer 将它们再次添加到 feed 中，造成重复
            // 3. showItem 可以直接使用 store 中已有的文章
            
            // 保存筛选后的文章列表
            this.setState({ 
                articleCount: articlesWithValidSources.length, 
                filteredArticles: articlesWithValidSources,
                clusters: [],
                isLoading: false,
                isClustering: true
            }, () => {
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
            })

            // 使用LLM对文章进行聚类分析
            try {
                console.log('开始调用聚类分析，文章数量:', articlesWithValidSources.length)
                const clusters = await this.clusterArticles(articlesWithValidSources, currentTopic)
                console.log('聚类分析完成，聚类数量:', clusters.length, clusters)
                
                if (clusters.length === 0) {
                    console.warn('聚类分析返回空结果')
                }
                
                this.setState({ 
                    clusters: clusters,
                    isClustering: false,
                    isLoading: false,
                    showResults: false  // 不自动显示结果，等待用户点击按钮
                }, () => {
                    console.log('状态已更新，clusters:', this.state.clusters.length)
                    if (typeof window !== 'undefined') {
                        const event = new CustomEvent('aiModeUpdated')
                        window.dispatchEvent(event)
                    }
                })
            } catch (clusterError) {
                console.error('聚类分析失败:', clusterError)
                const errorMsg = clusterError instanceof Error ? clusterError.message : '聚类分析失败，已显示原始文章列表'
                console.error('错误详情:', errorMsg)
                // 聚类失败时仍然显示文章列表，但不进行分组
                this.setState({ 
                    clusters: [],
                    isClustering: false,
                    isLoading: false,
                    error: errorMsg,
                    showResults: false  // 不自动显示结果
                }, () => {
                    if (typeof window !== 'undefined') {
                        const event = new CustomEvent('aiModeUpdated')
                        window.dispatchEvent(event)
                    }
                })
            }
        } catch (error) {
            console.error('查询文章失败:', error)
            const errorMessage = error instanceof Error ? error.message : '查询失败，请稍后重试'
            this.setState({ 
                isLoading: false,
                error: errorMessage,
                showErrorDialog: true,
                errorDialogMessage: errorMessage,
                queryProgress: null
            }, () => {
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
            })
        }
    }

    handleClearSummary = () => {
        this.setState({ 
            summary: '',
            error: null,
            articleCount: 0,
            filteredArticles: [],
            clusters: [],
            showResults: false,
            queryProgress: null
        })
    }

    handleShowResults = () => {
        this.setState({ 
            showResults: true
        })
    }

    handleCloseErrorDialog = () => {
        this.setState({ showErrorDialog: false, errorDialogMessage: '' })
    }

    render() {
        // 优先使用 Context 中的状态（如果存在），否则使用本地 state
        const context = this.context
        const useContext = context !== null && context !== undefined
        
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
            ...this.state,
            summary: context.summary !== undefined ? context.summary : this.state.summary,
            filteredArticles: context.filteredArticles !== undefined ? context.filteredArticles : this.state.filteredArticles,
            articleCount: context.articleCount !== undefined ? context.articleCount : this.state.articleCount,
            isLoading: context.isLoading !== undefined ? context.isLoading : this.state.isLoading,
            isClustering: context.isClustering !== undefined ? context.isClustering : this.state.isClustering,
            error: context.error !== undefined ? context.error : this.state.error,
            clusters: context.clusters !== undefined ? context.clusters : this.state.clusters,
            queryProgress: this.state.queryProgress,
            showResults: this.state.showResults
        } : this.state
        
        const { sources, markRead, contextMenu, showItem, shortcuts } = this.props

        // 统一管理加载界面：只使用深色进度界面
        const currentProgress = queryProgress || this.state.queryProgress
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
        
        console.log('页面显示判断:', {
            showResults,
            isLoading,
            isClustering,
            allStepsCompleted,
            hasResults,
            hasProgress: !!currentProgress,
            shouldShowDarkProgress,
            shouldShowProgressForCompleted,
            filteredArticlesCount: filteredArticles.length,
            clustersCount: clusters.length
        })

        return (
            <div className={`ai-mode-container ${summary ? 'has-summary' : 'no-summary'}`} style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* 配置面板 */}
                <Panel
                    isOpen={showConfigPanel}
                    type={PanelType.smallFixedFar}
                    onDismiss={this.handleConfigCancel}
                    headerText="AI API 配置"
                    closeButtonAriaLabel="关闭"
                >
                    <div style={{ padding: '20px 0' }}>
                        <TextField
                            label="API Endpoint"
                            value={tempApiEndpoint}
                            onChange={this.handleApiEndpointChange}
                            placeholder="https://api.openai.com/v1/chat/completions"
                            description="OpenAI兼容的API端点地址。必须是完整的URL，包含协议(https://)和完整路径(如/v1/chat/completions)"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="API Key"
                            type="password"
                            value={tempApiKey}
                            onChange={this.handleApiKeyChange}
                            placeholder="sk-..."
                            description="您的API密钥"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="模型名称"
                            value={tempModel}
                            onChange={this.handleModelChange}
                            placeholder="请输入模型名称"
                            description="要使用的模型名称，例如：gpt-3.5-turbo, gpt-4, claude-3-opus 等"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="Embedding模型名称"
                            value={tempEmbeddingModel}
                            onChange={this.handleEmbeddingModelChange}
                            placeholder="text-embedding-ada-002"
                            description="用于计算文章embedding的模型名称，例如：text-embedding-ada-002, text-embedding-3-small 等"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="相似度阈值"
                            value={tempSimilarityThreshold}
                            onChange={this.handleSimilarityThresholdChange}
                            placeholder="0.7"
                            description="话题筛选的相似度阈值，范围0-1。值越高，筛选出的文章与话题越相关。建议值：0.6-0.8"
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <DefaultButton
                                text="取消"
                                onClick={this.handleConfigCancel}
                            />
                            <PrimaryButton
                                text="确认"
                                onClick={this.handleConfigConfirm}
                            />
                        </div>
                    </div>
                </Panel>


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
                    // 如果没有进度信息，创建一个完整的默认进度对象
                    let progress = currentProgress
                    if (!progress) {
                        // 获取当前话题来判断是否需要显示话题相关的步骤
                        const hasTopic = (topicInput || topic || '').trim().length > 0
                        
                        // 如果步骤已完成（shouldShowProgressForCompleted为true），所有步骤都应该是完成状态
                        const defaultStatus = shouldShowProgressForCompleted ? 'completed' as const : 'in_progress' as const
                        const defaultMessage = shouldShowProgressForCompleted ? '所有步骤已完成' : '正在从数据库查询文章...'
                        
                        progress = {
                            steps: [
                                { id: 'query-db', title: '查询数据库文章', status: defaultStatus, message: defaultMessage },
                                ...(hasTopic ? [
                                    { id: 'compute-topic-embedding', title: '计算话题向量', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const },
                                    { id: 'load-embeddings', title: '加载已有文章向量', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const },
                                    { id: 'compute-embeddings', title: '计算新文章向量', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const },
                                    { id: 'calculate-similarity', title: '计算相似度并筛选', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const }
                                ] : []),
                                { id: 'cluster-articles', title: '分析文章内容并聚类', status: shouldShowProgressForCompleted ? 'completed' as const : 'pending' as const }
                            ],
                            currentStepIndex: shouldShowProgressForCompleted ? (hasTopic ? 5 : 1) : 0,
                            overallProgress: shouldShowProgressForCompleted ? 100 : 0,
                            currentMessage: defaultMessage
                        }
                    }
                    
                    console.log('显示深色进度界面，progress:', progress, 'steps:', progress.steps?.length, 'currentProgress存在:', !!currentProgress)
                    
                    return (
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
                            {/* 标题区域 - 深色卡片 */}
                            <div style={{
                                backgroundColor: '#1e1e1e', // Cursor风格的深色背景
                                borderRadius: '8px',
                                padding: '20px 24px',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                flexShrink: 0
                            }}>
                                <h2 style={{
                                    margin: '0 0 8px 0',
                                    fontSize: '20px',
                                    fontWeight: 600,
                                    color: '#ffffff'
                                }}>
                                    正在查询文章
                                </h2>
                                <div style={{
                                    fontSize: '13px',
                                    color: '#858585'
                                }}>
                                    正在处理您的请求，请稍候...
                                </div>
                            </div>

                            {/* 总体进度条 - 深色卡片 */}
                            <div style={{ 
                                padding: '16px',
                                backgroundColor: '#1e1e1e', // Cursor风格的深色背景
                                borderRadius: '8px',
                                border: '1px solid #3e3e3e',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                flexShrink: 0,
                                boxSizing: 'border-box'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px'
                                }}>
                                    <span style={{
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: '#cccccc'
                                    }}>
                                        总体进度
                                    </span>
                                    <span style={{
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        color: '#4ec9b0' // Cursor风格的青色
                                    }}>
                                        {Math.round(progress.overallProgress)}%
                                    </span>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '6px',
                                    backgroundColor: '#3e3e3e',
                                    borderRadius: '3px',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}>
                                    <div style={{
                                        width: `${progress.overallProgress}%`,
                                        height: '100%',
                                        backgroundColor: '#4ec9b0',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '3px',
                                        boxShadow: '0 0 8px rgba(78, 201, 176, 0.4)'
                                    }} />
                                </div>
                            </div>

                            {/* 当前步骤信息 - 深色卡片 */}
                            {progress.currentMessage && (
                                <div style={{
                                    padding: '12px 16px',
                                    backgroundColor: '#1e1e1e', // Cursor风格的深色背景
                                    borderRadius: '8px',
                                    border: '1px solid #3e3e3e',
                                    borderLeft: '3px solid #4ec9b0',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                    fontSize: '13px',
                                    color: '#cccccc',
                                    lineHeight: '1.5',
                                    flexShrink: 0,
                                    boxSizing: 'border-box'
                                }}>
                                    <Icon iconName="Info" style={{ 
                                        fontSize: '14px', 
                                        color: '#4ec9b0',
                                        marginRight: '8px',
                                        verticalAlign: 'middle'
                                    }} />
                                    {progress.currentMessage}
                                </div>
                            )}

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
                                overflow: 'visible'
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
                                    overflow: 'visible'
                                }}>
                                {progress.steps.map((step, index) => {
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
                                                transition: 'all 0.2s ease',
                                                opacity: isPending ? 0.6 : 1
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
                                                border: isPending ? '1px solid #5a5a5a' : 'none'
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
                                                    lineHeight: '1.4'
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
                                                        marginTop: '4px'
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
                                                                transition: 'width 0.3s ease',
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
                            在左侧菜单栏选择文章发布时间，和感兴趣的话题，然后点击"查询文章"按钮生成总结
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
    items: state.items
})

const mapDispatchToProps = dispatch => ({
    dispatch: dispatch,
    markRead: (item: RSSItem) => dispatch(markRead(item)),
    contextMenu: (feedId: string, item: RSSItem, e: React.MouseEvent) => 
        dispatch(openItemMenu(item, feedId, e)),
    showItem: (fid: string, item: RSSItem) => dispatch(showItem(fid, item)),
    shortcuts: (item: RSSItem, e: KeyboardEvent) => dispatch(itemShortcuts(item, e))
})

const AIMode = connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(AIModeComponent)
export default AIMode
