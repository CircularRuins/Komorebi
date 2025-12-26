import * as React from "react"
import intl from "react-intl-universal"
import { TextField, ITextField } from "@fluentui/react/lib/TextField"
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown"
import { Label } from "@fluentui/react/lib/Label"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Spinner, SpinnerSize, MessageBar, MessageBarType, Stack } from "@fluentui/react"
import { Icon } from "@fluentui/react/lib/Icon"
import OpenAI from "openai"
import type { RSSItem } from "../scripts/models/item"
import { connect } from "react-redux"
import { RootState } from "../scripts/reducer"
import { RSSSource, updateSourceDone } from "../scripts/models/source"
import { markRead, fetchItemsSuccess } from "../scripts/models/item"
import * as db from "../scripts/db"
import { openItemMenu } from "../scripts/models/app"
import { showItem, selectAIConfig, PageType, SELECT_PAGE } from "../scripts/models/page"
import { getWindowBreakpoint } from "../scripts/utils"
import { itemShortcuts } from "../scripts/models/item"
import { FeedFilter } from "../scripts/models/feed"
import ListCard from "./cards/list-card"
import { ViewConfigs } from "../schema-types"
import { ActionStatus } from "../scripts/utils"
import { SmartSearchMenuContent } from "./smart-search-menu-content"
import { SmartSearchInputDialog } from "./smart-search-input-dialog"
import {
    ArticleCluster,
    QueryProgress,
    QueryProgressStep,
    TokenStatistics,
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
    updateAIModeChatApiEndpoint,
    updateAIModeChatApiKey,
    updateAIModeEmbeddingApiEndpoint,
    updateAIModeEmbeddingApiKey,
    updateAIModeModel,
    updateAIModeEmbeddingModel,
    updateAIModeEmbeddingQPS,
    updateAIModeTopk,
    setAIModeShowConfigPanel,
    updateAIModeTempChatApiEndpoint,
    updateAIModeTempChatApiKey,
    updateAIModeTempEmbeddingApiEndpoint,
    updateAIModeTempEmbeddingApiKey,
    updateAIModeTempModel,
    updateAIModeTempEmbeddingModel,
    updateAIModeTempEmbeddingQPS,
    updateAIModeTempTopk,
    setAIModeShowErrorDialog,
    setAIModeErrorDialogMessage,
    setAIModeShowInputDialog,
    setAIModeArticleCount,
    setAIModeFilteredArticles,
    setAIModeClusters,
    setAIModeTimeRangeHasArticles,
    updateAIModeQueryProgress,
    updateAIModeStepStatus,
    setAIModeShowResults,
    setAIModeTokenStatistics,
    addTokenUsageRecord,
} from "../scripts/models/ai-mode"
import {
    consolidate,
    ConsolidateConfig,
    ConsolidateCallbacks,
} from "../scripts/consolidate"

// 重新导出类型以便其他文件使用
export type { ArticleCluster, QueryProgress, QueryProgressStep }

// SmartSearch Context 类型定义
export type SmartSearchContextType = {
    timeRange: string | null
    topic: string  // 单个话题文本
    topicInput: string
    recentTopics: string[]  // 最近使用的话题（最多5个）
    isComposing: boolean
    isLoading: boolean
    isClustering: boolean  // 是否正在聚类
    summary: string
    chatApiEndpoint: string
    chatApiKey: string
    embeddingApiEndpoint: string
    embeddingApiKey: string
    model: string
    showConfigPanel: boolean
    articleCount: number
    error: string | null
    filteredArticles: RSSItem[]  // 筛选后的文章列表
    clusters: ArticleCluster[]  // 文章分类结果
    setTimeRange: (timeRange: string | null) => void
    setTopic: (topic: string) => void
    setTopicInput: (topicInput: string) => void
    setIsComposing: (isComposing: boolean) => void
    queryProgress: QueryProgress | null
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

type SmartSearchProps = {
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
    updateChatApiEndpoint: (chatApiEndpoint: string) => void
    updateChatApiKey: (chatApiKey: string) => void
    updateEmbeddingApiEndpoint: (embeddingApiEndpoint: string) => void
    updateEmbeddingApiKey: (embeddingApiKey: string) => void
    updateModel: (model: string) => void
    updateEmbeddingModel: (embeddingModel: string) => void
    updateEmbeddingQPS: (embeddingQPS: number) => void
    updateTopk: (topk: number) => void
    setShowConfigPanel: (showConfigPanel: boolean) => void
    updateTempChatApiEndpoint: (tempChatApiEndpoint: string) => void
    updateTempChatApiKey: (tempChatApiKey: string) => void
    updateTempEmbeddingApiEndpoint: (tempEmbeddingApiEndpoint: string) => void
    updateTempEmbeddingApiKey: (tempEmbeddingApiKey: string) => void
    updateTempModel: (tempModel: string) => void
    updateTempEmbeddingModel: (tempEmbeddingModel: string) => void
    updateTempEmbeddingQPS: (tempEmbeddingQPS: string) => void
    updateTempTopk: (tempTopk: string) => void
    setShowInputDialog: (showInputDialog: boolean) => void
    setArticleCount: (articleCount: number) => void
    setFilteredArticles: (filteredArticles: RSSItem[]) => void
    setClusters: (clusters: ArticleCluster[]) => void
    setTimeRangeHasArticles: (timeRangeHasArticles: boolean) => void
    updateQueryProgress: (queryProgress: QueryProgress | null) => void
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => void
    setShowResults: (showResults: boolean) => void
    setAIModeTokenStatistics: (tokenStatistics: import("../scripts/models/ai-mode").TokenStatistics | null) => void
    addTokenUsageRecord: (model: string, usage: import("../scripts/models/ai-mode").TokenUsage) => void
}

// 创建 Context
export const SmartSearchContext = React.createContext<SmartSearchContextType | null>(null)

export class SmartSearchComponent extends React.Component<SmartSearchProps> {
    static contextType = SmartSearchContext
    declare context: React.ContextType<typeof SmartSearchContext>
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
            const event = new CustomEvent('smartSearchMounted')
            window.dispatchEvent(event)
        }
    }

    constructor(props: SmartSearchProps) {
        super(props)
        this.summaryContainerRef = React.createRef()
        this.topicInputRef = React.createRef()
    }

    componentDidUpdate(prevProps: SmartSearchProps) {
        const { aiMode } = this.props
        if (aiMode.queryProgress) {
            // 如果queryProgress存在但没有步骤，重新创建进度
            const currentStepCount = aiMode.queryProgress.steps?.length || 0
            if (currentStepCount === 0) {
                const hasTopic = !!(aiMode.topic && aiMode.topic.trim())
                const queryProgress = this.initializeQueryProgress(hasTopic)
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
            prevAiMode.chatApiEndpoint !== aiMode.chatApiEndpoint ||
            prevAiMode.chatApiKey !== aiMode.chatApiKey ||
            prevAiMode.embeddingApiEndpoint !== aiMode.embeddingApiEndpoint ||
            prevAiMode.embeddingApiKey !== aiMode.embeddingApiKey ||
            prevAiMode.model !== aiMode.model ||
            prevAiMode.filteredArticles.length !== aiMode.filteredArticles.length ||
            prevAiMode.clusters.length !== aiMode.clusters.length ||
            prevAiMode.articleCount !== aiMode.articleCount ||
            prevAiMode.error !== aiMode.error
        ) {
            // 通知Root组件更新Context
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('smartSearchUpdated')
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
    getContextValue = (): SmartSearchContextType => {
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
            chatApiEndpoint: aiMode.chatApiEndpoint,
            chatApiKey: aiMode.chatApiKey,
            embeddingApiEndpoint: aiMode.embeddingApiEndpoint,
            embeddingApiKey: aiMode.embeddingApiKey,
            model: aiMode.model,
            showConfigPanel: aiMode.showConfigPanel,
            articleCount: aiMode.articleCount,
            error: aiMode.error,
            filteredArticles: aiMode.filteredArticles,
            clusters: aiMode.clusters,
            queryProgress: aiMode.queryProgress,
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
        // 只更新Redux state，不触发Context更新事件
        // Context更新由componentDidUpdate中的逻辑控制，避免频繁更新打断输入
        this.props.updateTopicInput(newValue || '')
    }

    handleTopicInputCompositionStart = () => {
        this.props.setIsComposing(true)
    }

    handleTopicInputCompositionEnd = () => {
        this.props.setIsComposing(false)
        // 输入法结束后更新Context
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('smartSearchInputChanged')
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
        // 点击常选主题时填充到输入框和话题字段
        const { updateTopicInput, updateTopic } = this.props
        updateTopicInput(topic)
        updateTopic(topic)
        // 聚焦到输入框（通过ref）
        if (this.topicInputRef.current) {
            const inputElement = this.topicInputRef.current as any
            inputElement.focus()
        }
        // 触发Context更新，让本地state同步
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('smartSearchInputChanged')
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


    handleChatApiEndpointChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempChatApiEndpoint(value)
    }

    handleChatApiKeyChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempChatApiKey(value)
    }

    handleEmbeddingApiEndpointChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempEmbeddingApiEndpoint(value)
    }

    handleEmbeddingApiKeyChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempEmbeddingApiKey(value)
    }

    handleModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempModel(value)
    }

    handleEmbeddingModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempEmbeddingModel(value)
    }

    handleEmbeddingQPSChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempEmbeddingQPS(value)
    }

    handleTopkChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.props.updateTempTopk(value)
    }

    handleConfigConfirm = async () => {
        const { aiMode, updateChatApiEndpoint, updateChatApiKey, updateEmbeddingApiEndpoint, updateEmbeddingApiKey, updateModel, updateEmbeddingModel, updateEmbeddingQPS, updateTopk, setShowConfigPanel } = this.props
        const { tempChatApiEndpoint, tempChatApiKey, tempEmbeddingApiEndpoint, tempEmbeddingApiKey, tempModel, tempEmbeddingModel, tempEmbeddingQPS, tempTopk } = aiMode
        
        // 验证topk
        const topk = parseInt(tempTopk, 10)
        if (isNaN(topk) || topk < 1 || !Number.isInteger(topk)) {
            if (window.utils && window.utils.showMessageBox) {
                await window.utils.showMessageBox(
                    intl.get("settings.aiMode.common.error") || "错误",
                    intl.get("settings.aiMode.errors.topkInvalid") || "TopK值无效",
                    intl.get("settings.aiMode.common.ok") || "确定",
                    "",
                    false,
                    "error"
                )
            }
            return
        }
        
        // 验证embeddingQPS
        const embeddingQPS = parseInt(tempEmbeddingQPS, 10)
        if (isNaN(embeddingQPS) || embeddingQPS < 1 || !Number.isInteger(embeddingQPS)) {
            if (window.utils && window.utils.showMessageBox) {
                await window.utils.showMessageBox(
                    intl.get("settings.aiMode.common.error") || "错误",
                    intl.get("settings.aiMode.errors.embeddingQPSInvalid") || "Embedding QPS值无效",
                    intl.get("settings.aiMode.common.ok") || "确定",
                    "",
                    false,
                    "error"
                )
            }
            return
        }
        
        // 保存到 Redux（localStorage 同步在 reducer 中处理）
        updateChatApiEndpoint(tempChatApiEndpoint)
        updateChatApiKey(tempChatApiKey)
        updateEmbeddingApiEndpoint(tempEmbeddingApiEndpoint)
        updateEmbeddingApiKey(tempEmbeddingApiKey)
        updateModel(tempModel)
        updateEmbeddingModel(tempEmbeddingModel)
        updateEmbeddingQPS(embeddingQPS)
        updateTopk(topk)
        setShowConfigPanel(false)
    }

    handleConfigCancel = () => {
        // 恢复临时状态为已保存的值
        const { aiMode, updateTempChatApiEndpoint, updateTempChatApiKey, updateTempEmbeddingApiEndpoint, updateTempEmbeddingApiKey, updateTempModel, updateTempEmbeddingModel, updateTempEmbeddingQPS, updateTempTopk, setShowConfigPanel } = this.props
        const { chatApiEndpoint, chatApiKey, embeddingApiEndpoint, embeddingApiKey, model, embeddingModel, embeddingQPS, topk } = aiMode
        updateTempChatApiEndpoint(chatApiEndpoint)
        updateTempChatApiKey(chatApiKey)
        updateTempEmbeddingApiEndpoint(embeddingApiEndpoint)
        updateTempEmbeddingApiKey(embeddingApiKey)
        updateTempModel(model)
        updateTempEmbeddingModel(embeddingModel)
        updateTempEmbeddingQPS(embeddingQPS.toString())
        updateTempTopk(topk.toString())
        setShowConfigPanel(false)
    }

    handleConfigPanelOpen = () => {
        // 打开面板时，初始化临时状态为当前保存的值
        const { aiMode, setShowConfigPanel, updateTempChatApiEndpoint, updateTempChatApiKey, updateTempEmbeddingApiEndpoint, updateTempEmbeddingApiKey, updateTempModel, updateTempEmbeddingModel, updateTempEmbeddingQPS, updateTempTopk } = this.props
        const { chatApiEndpoint, chatApiKey, embeddingApiEndpoint, embeddingApiKey, model, embeddingModel, embeddingQPS, topk } = aiMode
        setShowConfigPanel(true)
        updateTempChatApiEndpoint(chatApiEndpoint)
        updateTempChatApiKey(chatApiKey)
        updateTempEmbeddingApiEndpoint(embeddingApiEndpoint)
        updateTempEmbeddingApiKey(embeddingApiKey)
        updateTempModel(model)
        updateTempEmbeddingModel(embeddingModel)
        updateTempEmbeddingQPS(embeddingQPS.toString())
        updateTempTopk(topk.toString())
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

    // 初始化查询进度（只添加第一步，后续步骤根据实际执行情况动态添加）
    initializeQueryProgress = (hasTopic: boolean): QueryProgress => {
        // 只添加第一步，后续步骤根据实际执行情况动态添加
        // 如果按时间范围筛选后没有文章，流程会提前结束，不会有后续步骤
        const steps: QueryProgressStep[] = [
            { id: 'query-db', title: intl.get("settings.aiMode.progress.steps.queryDb"), status: 'in_progress', message: intl.get("settings.aiMode.progress.messages.querying"), visible: true }
        ]
        
        // 注意：所有后续步骤（vector-retrieval, llm-refine）
        // 都根据实际执行情况动态添加，不在这里预先添加
        // 注意：calculate-similarity 不再作为独立步骤，它现在是 vector-retrieval 的子步骤
        
        return {
            steps,
            currentStepIndex: 0,
            overallProgress: 0,
            currentMessage: intl.get("settings.aiMode.progress.messages.startQuery")
        }
    }

    // 更新查询进度（现在直接使用 Redux action）
    updateQueryProgress = (updates: Partial<QueryProgress> | QueryProgress) => {
        const { aiMode, updateQueryProgress } = this.props
        
        // 如果传入的是完整的 QueryProgress 对象（有 steps 且所有必需字段都存在），直接使用
        if ('steps' in updates && 'currentStepIndex' in updates && 'overallProgress' in updates && 'currentMessage' in updates) {
            updateQueryProgress(updates as QueryProgress)
            return
        }
        
        if (!aiMode.queryProgress) return
        
        // 如果传入了 steps，完全替换；否则合并
        let progress: QueryProgress
        if (updates.steps) {
            // 完全替换，使用传入的 steps，确保移除所有未执行的步骤
            progress = {
                steps: updates.steps,
                currentStepIndex: updates.currentStepIndex ?? (updates.steps.length - 1),
                overallProgress: updates.overallProgress ?? 100,
                currentMessage: updates.currentMessage ?? updates.steps[updates.steps.length - 1]?.message ?? intl.get("settings.aiMode.progress.messages.completed")
            }
        } else {
            // 合并更新
            progress = { ...aiMode.queryProgress, ...updates }
            // 计算总体进度
            const totalSteps = progress.steps.length
            const completedSteps = progress.steps.filter(s => s.status === 'completed').length
            const currentStep = progress.steps[progress.currentStepIndex]
            const stepProgress = currentStep?.progress || 0
            const baseProgress = (completedSteps / totalSteps) * 100
            const currentStepWeight = 1 / totalSteps
            const currentStepProgress = (stepProgress / 100) * currentStepWeight * 100
            progress.overallProgress = Math.min(100, baseProgress + currentStepProgress)
        }
        
        updateQueryProgress(progress)
    }

    // 更新步骤状态（现在直接使用 Redux action，逻辑在 reducer 中）
    updateStepStatus = (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => {
        this.props.updateStepStatus(stepId, status, message, progress)
    }

    // 获取时间范围选项
    getTimeRangeOptions = (): IDropdownOption[] => {
        return [
            { key: '1', text: intl.get("settings.aiMode.menu.timeRangeOptions.1") },
            { key: '3', text: intl.get("settings.aiMode.menu.timeRangeOptions.3") },
            { key: '7', text: intl.get("settings.aiMode.menu.timeRangeOptions.7") },
            { key: '14', text: intl.get("settings.aiMode.menu.timeRangeOptions.14") }
        ]
    }


    // ==================== 主函数: 查询符合条件的文章（使用consolidate函数）====================
    queryArticles = async (timeRangeDays: number | null, topic: string | null): Promise<{ articles: RSSItem[], timeRangeHasArticles: boolean, topicGuidance: string | null, tokenStatistics: TokenStatistics, summaries: Map<number, string>, reasons: Map<number, string>, clusters: ArticleCluster[] }> => {
        const { aiMode, updateQueryProgress } = this.props
        
        // 从 window.settings 读取配置（与检查配置的地方一致）
        const chatApiEndpoint = window.settings.getAIChatApiEndpoint()
        const chatApiKey = window.settings.getAIChatApiKey()
        const model = window.settings.getAIModel()
        const embeddingApiEndpoint = window.settings.getAIEmbeddingApiEndpoint()
        const embeddingApiKey = window.settings.getAIEmbeddingApiKey()
        const embeddingModel = window.settings.getAIEmbeddingModel()
        const embeddingQPS = window.settings.getAIEmbeddingQPS()
        const topk = window.settings.getAITopk()
        
        const config: ConsolidateConfig = {
            chatApiEndpoint,
            chatApiKey,
            embeddingApiEndpoint: embeddingApiEndpoint || undefined,  // 可选
            embeddingApiKey: embeddingApiKey || undefined,  // 可选
            embeddingModel: embeddingModel || undefined,  // 可选
            embeddingQPS: embeddingQPS || undefined,
            model,
            topk: topk || 100,
        }
        
        const callbacks: ConsolidateCallbacks = {
            updateStepStatus: this.updateStepStatus,
            updateQueryProgress: updateQueryProgress,
            getCurrentQueryProgress: () => aiMode.queryProgress,
            updateTokenStatistics: (tokenStatistics) => {
                this.props.setAIModeTokenStatistics(tokenStatistics)
            },
            addTokenUsageRecord: (model: string, usage: any) => {
                this.props.addTokenUsageRecord(model, usage)
            }
        }
        
        return await consolidate(timeRangeDays, topic, null, config, callbacks)
    }

    handleGenerateSummary = async () => {
        const { aiMode } = this.props
        const { timeRange, topicInput } = aiMode
        const { updateTopic, updateTopicInput, setLoading, setClustering, setError, setSummary, setArticleCount, setFilteredArticles, setClusters, setTimeRangeHasArticles, updateQueryProgress, setShowResults, setAIModeTokenStatistics } = this.props

        // 使用 window.settings 检查配置（与 selectSmartSearch 和文章翻译一致）
        if (typeof window === 'undefined' || !window.settings) {
            console.error('Settings not available')
            if (window.utils && window.utils.showMessageBox) {
                const openConfig = await window.utils.showMessageBox(
                    intl.get("translation.error.configNotSet") || "AI模型未配置",
                    intl.get("translation.error.configIncomplete") || "AI模型未配置，请先配置AI模型",
                    intl.get("translation.error.openConfig") || "打开配置",
                    intl.get("cancel") || "取消",
                    false,
                    "warning"
                )
                if (openConfig && window.utils && window.utils.openAIConfig) {
                    await window.utils.openAIConfig()
                } else if (openConfig) {
                    this.props.dispatch(selectAIConfig())
                }
            } else {
                this.props.dispatch(selectAIConfig())
            }
            return
        }

        // 只检查Chat API配置（不需要Embedding API）
        const chatApiEndpoint = window.settings.getAIChatApiEndpoint()
        const chatApiKey = window.settings.getAIChatApiKey()
        const model = window.settings.getAIModel()
        
        if (!chatApiEndpoint || !chatApiKey || !model) {
            // 显示错误提示并提供打开配置的选项（使用与文章翻译相同的i18n键）
            if (window.utils && window.utils.showMessageBox) {
                const openConfig = await window.utils.showMessageBox(
                    intl.get("translation.error.configNotSet") || "AI模型未配置",
                    intl.get("translation.error.configIncomplete") || "AI模型未配置，请先配置AI模型",
                    intl.get("translation.error.openConfig") || "打开配置",
                    intl.get("cancel") || "取消",
                    false,
                    "warning"
                )
                if (openConfig && window.utils && window.utils.openAIConfig) {
                    await window.utils.openAIConfig()
                } else if (openConfig) {
                    this.props.dispatch(selectAIConfig())
                }
            } else {
                this.props.dispatch(selectAIConfig())
            }
            return
        }

        // 验证时间范围必须选择
        if (!timeRange) {
            if (window.utils && window.utils.showMessageBox) {
                await window.utils.showMessageBox(
                    intl.get("settings.aiMode.common.error") || "错误",
                    intl.get("settings.aiMode.errors.selectTimeRange") || "请选择时间范围",
                    intl.get("settings.aiMode.common.ok") || "确定",
                    "",
                    false,
                    "error"
                )
            }
            return
        }

        // 验证话题必须输入（话题是必填的）
        const trimmedTopic = topicInput.trim() || aiMode.topic?.trim() || ''
        if (!trimmedTopic) {
            if (window.utils && window.utils.showMessageBox) {
                await window.utils.showMessageBox(
                    intl.get("settings.aiMode.common.error") || "错误",
                    intl.get("settings.aiMode.errors.enterTopic") || "请输入话题",
                    intl.get("settings.aiMode.common.ok") || "确定",
                    "",
                    false,
                    "error"
                )
            }
            return
        }

        // 保存当前话题到状态和最近话题列表
        const currentTopic = trimmedTopic
        this.saveTopicToRecent(currentTopic)
        
        // 初始化查询进度
        const hasTopic = !!currentTopic
        const queryProgress = this.initializeQueryProgress(hasTopic)

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
        setAIModeTokenStatistics(null) // 清空 token statistics，确保每次新查询都从零开始
        
        // 通知 Context 更新
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeUpdated')
            window.dispatchEvent(event)
        }

        try {
            // 解析时间范围
            const timeRangeDays = this.parseTimeRange(timeRange)

            // 查询文章（根据时间范围和话题，包括分类）
            const result = await this.queryArticles(timeRangeDays, currentTopic)
            const { articles, timeRangeHasArticles, topicGuidance, tokenStatistics, summaries, reasons, clusters } = result
            
            // 保存时间范围内是否有文章的信息
            setTimeRangeHasArticles(timeRangeHasArticles)
            
            // 将文章添加到 Redux store，确保可以点击查看
            const { sources, dispatch } = this.props
            
            // 收集所有文章的唯一source IDs
            const sourceIds = new Set<number>()
            articles.forEach(item => {
                sourceIds.add(item.source)
            })
            
            // 检查哪些source不在store中，从数据库批量加载
            const missingSourceIds: number[] = []
            sourceIds.forEach(sid => {
                if (!sources[sid]) {
                    missingSourceIds.push(sid)
                }
            })
            
            // 批量加载缺失的sources到store
            if (missingSourceIds.length > 0) {
                try {
                    // 等待数据库初始化
                    let retries = 0
                    while ((!db.sourcesDB || !db.sources) && retries < 50) {
                        await new Promise(resolve => setTimeout(resolve, 100))
                        retries++
                    }
                    
                    if (db.sourcesDB && db.sources) {
                        const missingSources = await db.sourcesDB
                            .select()
                            .from(db.sources)
                            .where(db.sources.sid.in(missingSourceIds))
                            .exec() as RSSSource[]
                        
                        // 将缺失的sources添加到store，保留数据库中的unreadCount
                        for (const source of missingSources) {
                            // 如果source已经在store中，跳过（避免覆盖unreadCount）
                            if (!sources[source.sid]) {
                                // 保留数据库中的unreadCount，不重置为0
                                dispatch(updateSourceDone(source))
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Failed to load missing sources:', error)
                }
            }
            
            // 确保所有文章的 source 都存在（现在应该都在store中了）
            // 由于Redux dispatch是同步的，store已经更新了，但props可能还没更新
            // 我们需要等待一下让props更新，或者直接使用dispatch后的结果
            // 为了确保准确性，我们重新从props获取sources（虽然可能还没更新，但大部分情况下应该已经更新了）
            // 如果source仍然不在store中，会在showItem中作为fallback加载
            const articlesWithValidSources = articles.filter(item => {
                // 检查当前的sources props
                let source = sources[item.source]
                // 如果source不在props中，可能刚加载但props还没更新
                // 我们仍然允许这些文章通过，因为：
                // 1. showItem函数会处理source的加载（作为fallback）
                // 2. ArticleContainer也会尝试加载source
                if (!source) {
                    console.warn('Source not found in store after loading attempt, will be loaded on click:', item.source)
                }
                // 允许所有文章通过，让showItem和ArticleContainer处理source加载
                return true
            })
            
            // 将所有文章的item添加到Redux store
            if (articlesWithValidSources.length > 0) {
                const currentItems = this.props.items
                const itemState = { ...currentItems }
                articlesWithValidSources.forEach(item => {
                    itemState[item._id] = item
                })
                dispatch(fetchItemsSuccess(articlesWithValidSources, itemState))
            }
            
            // 保存筛选后的文章列表和分类结果
            setArticleCount(articlesWithValidSources.length)
            setFilteredArticles(articlesWithValidSources)
            setClusters(clusters)  // 直接使用 consolidate 返回的 clusters
            setError(null) // 清除错误状态
            setLoading(false)
            setClustering(false)  // consolidate 已完成，包括分类步骤
            
            // 如果无文章，完成查询进度并保持在进度界面
            // consolidate 函数已经更新了 queryProgress，只包含实际执行的步骤，移除了所有未执行的步骤
            // 这里不需要再做任何处理，直接使用 consolidate 函数更新后的 queryProgress
            if (articlesWithValidSources.length === 0) {
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('smartSearchUpdated')
                    window.dispatchEvent(event)
                }
                return
            }
            
            // 不自动显示结果，等待用户点击按钮
            setShowResults(false)
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('smartSearchUpdated')
                window.dispatchEvent(event)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : intl.get("settings.aiMode.errors.queryFailed")
            // 清理所有状态，确保UI正确显示错误状态
            setLoading(false)
            setClustering(false)
            setError(errorMessage)
            updateQueryProgress(null)
            setArticleCount(0)
            setFilteredArticles([])
            setClusters([])
            setShowResults(false)
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('smartSearchUpdated')
                window.dispatchEvent(event)
            }
            // 使用与AI配置一致的弹窗样式
            if (window.utils && window.utils.showMessageBox) {
                await window.utils.showMessageBox(
                    intl.get("settings.aiMode.common.error") || "错误",
                    errorMessage,
                    intl.get("settings.aiMode.common.ok") || "确定",
                    "",
                    false,
                    "error"
                )
            }
        }
    }

    handleClearSummary = () => {
        const { setSummary, setError, setArticleCount, setFilteredArticles, setClusters, setShowResults, updateQueryProgress, setAIModeTokenStatistics } = this.props
        setSummary('')
        setError(null)
        setArticleCount(0)
        setFilteredArticles([])
        setClusters([])
        setShowResults(false)
        updateQueryProgress(null)
        setAIModeTokenStatistics(null)
        
        // 延迟触发事件，确保 Redux 状态更新完成后再更新 Context
        if (typeof window !== 'undefined') {
            setTimeout(() => {
                const event = new CustomEvent('smartSearchUpdated')
                window.dispatchEvent(event)
            }, 0)
        }
    }

    handleShowResults = () => {
        this.props.setShowResults(true)
    }


    handleCloseInputDialog = () => {
        this.props.setShowInputDialog(false)
    }

    handleInputDialogConfirm = async (timeRange: string, topic: string, classificationStandard: string) => {
        const { updateTimeRange, updateTopic, updateTopicInput, setShowInputDialog, dispatch } = this.props
        
        // 更新输入值
        updateTimeRange(timeRange)
        updateTopic(topic)
        updateTopicInput(topic)
        
        // 关闭弹窗
        setShowInputDialog(false)
        
        // 跳转到智能搜索页面
        dispatch({
            type: SELECT_PAGE,
            pageType: PageType.SmartSearch,
            keepMenu: getWindowBreakpoint(),
            filter: new FeedFilter(),
            init: true,
        } as any)
        
        // 等待一下让页面渲染完成，然后自动开始搜索
        setTimeout(() => {
            this.handleGenerateSummary()
        }, 100)
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
            chatApiEndpoint, 
            chatApiKey, 
            embeddingApiEndpoint, 
            embeddingApiKey, 
            model, 
            showConfigPanel, 
            tempChatApiEndpoint, 
            tempChatApiKey,
            tempEmbeddingApiEndpoint, 
            tempEmbeddingApiKey, 
            tempModel,
            tempEmbeddingModel,
            showInputDialog,
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
        
        // 动态检查所有可见步骤是否完成
        const allStepsCompleted = currentProgress ? (() => {
            const visibleSteps = currentProgress.steps.filter(step => step.visible !== false)
            // 确保没有 in_progress 的步骤，且所有可见步骤都是 completed 或 error
            const hasInProgress = visibleSteps.some(step => step.status === 'in_progress')
            const allVisibleCompleted = visibleSteps.length > 0 && visibleSteps.every(step => step.status === 'completed' || step.status === 'error')
            return !hasInProgress && allVisibleCompleted
        })() : false
        
        // 关键逻辑：如果所有步骤完成但未显示结果，必须显示进度界面（带"查看结果"按钮或"无结果"提示）
        // 这个条件优先级最高，确保步骤完成后页面不会消失
        // 即使没有 currentProgress，只要不在加载中且已完成查询，也认为步骤已完成
        const shouldShowProgressForCompleted = !showResults && !isLoading && !isClustering && (
            (hasResults && (allStepsCompleted || !currentProgress)) ||  // 有结果且步骤完成
            (!hasResults && allStepsCompleted && currentProgress)  // 无结果但步骤完成（显示无结果提示）
        )
        
        // 其他情况显示进度界面：正在加载或聚类中，或有进度但未完成
        const shouldShowDarkProgress = !showResults && !shouldShowProgressForCompleted && (
            (isLoading || isClustering) ||  // 正在加载时，即使没有progress也显示（会创建默认的）
            (currentProgress && !allStepsCompleted)  // 有进度但未完成
        )
        

        return (
            <div className={`ai-mode-container ${summary ? 'has-summary' : 'no-summary'}`} style={{ position: 'relative', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* 输入界面 - 只在非隐藏模式下显示在内容页顶部，且不在查看结果时显示 */}
                {!this.props.hideArticleList && !showResults && (
                    <div style={{
                        flexShrink: 0,
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            maxWidth: '800px',
                            margin: '0 auto'
                        }}>
                            <SmartSearchMenuContent />
                        </div>
                    </div>
                )}
                
                {/* 按聚类分组的文章列表 */}
                {filteredArticles.length > 0 && clusters.length > 0 && !isClustering && showResults && (
                    <div 
                        ref={this.summaryContainerRef}
                        className="ai-summary-container has-summary"
                        style={{
                            height: 'calc((100vh - var(--navHeight, 32px)) * 0.9)', // 固定高度为内容页的0.9倍
                            maxHeight: 'calc((100vh - var(--navHeight, 32px)) * 0.9)', // 确保不超过最大高度
                            overflowY: 'scroll',
                            overflowX: 'hidden',
                            padding: '16px 20px 20px 20px',  // 移除导航栏高度的额外 padding
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--neutralLighterAlt)',
                            minHeight: 0,
                            gap: '20px',
                            boxSizing: 'border-box',
                            flexShrink: 0,
                            WebkitOverflowScrolling: 'touch',
                            position: 'relative'
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
                                {intl.get("settings.aiMode.results.summary")}
                            </h3>
                        </div>
                        
                        {[...clusters].sort((a, b) => {
                            // "其他"分类始终排在最后
                            if (a.id === 'cluster-other') return 1
                            if (b.id === 'cluster-other') return -1
                            // 其他分类按文章数量从多到少排序
                            return b.articles.length - a.articles.length
                        }).map((cluster) => (
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
                                                    feedId="smart-search"
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

                {/* 如果没有分类结果，显示原始文章列表 */}
                {filteredArticles.length > 0 && clusters.length === 0 && !isClustering && showResults && (
                    <div 
                        ref={this.summaryContainerRef}
                        className="ai-summary-container has-summary"
                        style={{
                            height: 'calc((100vh - var(--navHeight, 32px)) * 0.9)', // 固定高度为内容页的0.9倍
                            maxHeight: 'calc((100vh - var(--navHeight, 32px)) * 0.9)', // 确保不超过最大高度
                            overflowY: 'scroll',
                            overflowX: 'hidden',
                            padding: '16px 20px 20px 20px',  // 移除导航栏高度的额外 padding
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--neutralLighterAlt)',
                            minHeight: 0,
                            boxSizing: 'border-box',
                            flexShrink: 0,
                            WebkitOverflowScrolling: 'touch',
                            position: 'relative'
                        }}
                    >
                        <div style={{
                            backgroundColor: 'var(--white)',
                            borderRadius: '8px',
                            padding: '24px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                            flexShrink: 0
                        }}>
                            <h3 style={{
                                margin: '0 0 16px 0',
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'var(--neutralPrimary)'
                            }}>
                                {intl.get("settings.aiMode.results.filteredArticles", { count: filteredArticles.length })}
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
                                                feedId="smart-search"
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
                    // 始终使用 aiMode.queryProgress，不要使用 currentProgress，因为它可能在某些情况下为 null
                    // 如果 aiMode.queryProgress 存在，直接使用它，不要重新创建
                    let progress = aiMode.queryProgress
                    if (!progress) {
                        progress = currentProgress
                    }
                    const actualStepCount = progress?.steps?.length || 0
                    const needsRecreate = !progress || actualStepCount === 0
                    
                    // 确保 shouldShowProgressForCompleted 是布尔值
                    const isCompleted = Boolean(shouldShowProgressForCompleted)
                    
                    // 只有在确实没有进度时才创建默认进度
                    // 如果 aiMode.queryProgress 存在，即使步骤数量不对，也不要重新创建，因为状态可能正在更新中
                    // 步骤数量可能是2（文章数量<=topk且无分类依据）、3（文章数量<=topk且有分类依据）、6（文章数量>topk且无分类依据）或7（文章数量>topk且有分类依据）
                    if (needsRecreate && !aiMode.queryProgress) {
                        const defaultStatus = isCompleted ? 'completed' as const : 'in_progress' as const
                        const defaultMessage = isCompleted ? intl.get("settings.aiMode.progress.messages.completed") : intl.get("settings.aiMode.progress.messages.querying")
                        
                        // 注意：不再进行分类步骤
                        // 注意：calculate-similarity 不再作为独立步骤，它现在是 vector-retrieval 的子步骤
                        progress = {
                            steps: [
                                { id: 'query-db', title: intl.get("settings.aiMode.progress.steps.queryDb"), status: defaultStatus, message: defaultMessage, visible: true },
                                { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: isCompleted ? 'completed' as const : 'pending' as const, visible: isCompleted }
                            ],
                            currentStepIndex: isCompleted ? 1 : 0,
                            overallProgress: isCompleted ? 100 : 0,
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
                            padding: '20px', // 移除导航栏高度的额外 padding
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
                                flexShrink: 0,
                                height: 'calc((100vh - var(--navHeight, 32px)) * 0.4)', // 固定为内容页高度的0.4倍
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                overflow: 'hidden' // 外层容器不滚动
                            }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#858585',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {intl.get("settings.aiMode.progress.executionSteps")} ({progress.steps.filter(s => s.status === 'completed').length}/{progress.steps.length})
                                </div>
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    flex: 1,
                                    minHeight: 0,
                                    overflowY: 'auto', // 允许垂直滚动
                                    overflowX: 'hidden'
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
                                                            <span>{intl.get("settings.aiMode.progress.messages.processing")}</span>
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

                            {/* 所有步骤完成后的"查看结果"按钮或"无结果"提示 - 深色卡片 */}
                            {(() => {
                                // 动态检查所有可见步骤是否完成
                                const allStepsCompleted = progress ? (() => {
                                    const visibleSteps = progress.steps.filter(step => step.visible !== false)
                                    // 确保没有 in_progress 的步骤，且所有可见步骤都是 completed 或 error
                                    const hasInProgress = visibleSteps.some(step => step.status === 'in_progress')
                                    const allVisibleCompleted = visibleSteps.length > 0 && visibleSteps.every(step => step.status === 'completed' || step.status === 'error')
                                    return !hasInProgress && allVisibleCompleted
                                })() : false
                                const hasResults = filteredArticles.length > 0
                                
                                // 如果所有步骤完成且未显示结果，显示提示
                                if (allStepsCompleted && !showResults) {
                                    // 有结果时显示"查看结果"按钮
                                    if (hasResults) {
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
                                                    {intl.get("settings.aiMode.progress.messages.completed")}
                                                </div>
                                                <div style={{
                                                    fontSize: '13px',
                                                    color: '#858585',
                                                    marginBottom: '20px'
                                                }}>
                                                    {intl.get("settings.aiMode.progress.foundArticles", { 
                                                        count: filteredArticles.length
                                                    })}
                                                </div>
                                                <PrimaryButton
                                                    iconProps={{ iconName: 'View' }}
                                                    text={intl.get("settings.aiMode.progress.viewResults")}
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
                                    } else {
                                        // 无结果时显示"无结果"提示卡片
                                        const { aiMode } = this.props
                                        const timeRangeHasArticles = aiMode.timeRangeHasArticles
                                        const noResultTitle = timeRangeHasArticles 
                                            ? intl.get("settings.aiMode.results.noArticlesMatchTopic")
                                            : intl.get("settings.aiMode.results.noArticlesInTimeRange")
                                        const noResultDescription = timeRangeHasArticles
                                            ? intl.get("settings.aiMode.results.noArticlesMatchTopicDescription")
                                            : intl.get("settings.aiMode.results.noArticlesInTimeRangeDescription")
                                        
                                        return (
                                            <div style={{
                                                backgroundColor: '#1e1e1e', // Cursor风格的深色背景
                                                borderRadius: '8px',
                                                padding: '24px',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                                textAlign: 'center',
                                                flexShrink: 0
                                            }}>
                                                <Icon 
                                                    iconName="Info" 
                                                    style={{ 
                                                        fontSize: '48px', 
                                                        color: '#4ec9b0',
                                                        marginBottom: '16px'
                                                    }} 
                                                />
                                                <div style={{
                                                    fontSize: '16px',
                                                    fontWeight: 500,
                                                    color: '#ffffff',
                                                    marginBottom: '12px'
                                                }}>
                                                    {noResultTitle}
                                                </div>
                                                <div style={{
                                                    fontSize: '13px',
                                                    color: '#858585',
                                                    lineHeight: '1.5',
                                                    maxWidth: '500px',
                                                    margin: '0 auto'
                                                }}>
                                                    {noResultDescription}
                                                </div>
                                            </div>
                                        )
                                    }
                                }
                                return null
                            })()}
                        </div>
                    </div>
                    </>
                    )
                })()}
                


                {/* 输入弹窗 */}
                <SmartSearchInputDialog
                    show={showInputDialog}
                    timeRange={aiMode.timeRange}
                    topicInput={aiMode.topicInput}
                    recentTopics={aiMode.recentTopics}
                    onClose={this.handleCloseInputDialog}
                    onConfirm={this.handleInputDialogConfirm}
                    onTimeRangeChange={(timeRange) => this.props.updateTimeRange(timeRange)}
                    onTopicInputChange={(topic) => this.props.updateTopicInput(topic)}
                    onRecentTopicClick={(topic) => {
                        this.props.updateTopicInput(topic)
                        this.saveTopicToRecent(topic)
                    }}
                />
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
    updateChatApiEndpoint: (chatApiEndpoint: string) => dispatch(updateAIModeChatApiEndpoint(chatApiEndpoint)),
    updateChatApiKey: (chatApiKey: string) => dispatch(updateAIModeChatApiKey(chatApiKey)),
    updateEmbeddingApiEndpoint: (embeddingApiEndpoint: string) => dispatch(updateAIModeEmbeddingApiEndpoint(embeddingApiEndpoint)),
    updateEmbeddingApiKey: (embeddingApiKey: string) => dispatch(updateAIModeEmbeddingApiKey(embeddingApiKey)),
    updateModel: (model: string) => dispatch(updateAIModeModel(model)),
    updateEmbeddingModel: (embeddingModel: string) => dispatch(updateAIModeEmbeddingModel(embeddingModel)),
    updateEmbeddingQPS: (embeddingQPS: number) => dispatch(updateAIModeEmbeddingQPS(embeddingQPS)),
    updateTopk: (topk: number) => dispatch(updateAIModeTopk(topk)),
    setShowConfigPanel: (showConfigPanel: boolean) => dispatch(setAIModeShowConfigPanel(showConfigPanel)),
    updateTempChatApiEndpoint: (tempChatApiEndpoint: string) => dispatch(updateAIModeTempChatApiEndpoint(tempChatApiEndpoint)),
    updateTempChatApiKey: (tempChatApiKey: string) => dispatch(updateAIModeTempChatApiKey(tempChatApiKey)),
    updateTempEmbeddingApiEndpoint: (tempEmbeddingApiEndpoint: string) => dispatch(updateAIModeTempEmbeddingApiEndpoint(tempEmbeddingApiEndpoint)),
    updateTempEmbeddingApiKey: (tempEmbeddingApiKey: string) => dispatch(updateAIModeTempEmbeddingApiKey(tempEmbeddingApiKey)),
    updateTempModel: (tempModel: string) => dispatch(updateAIModeTempModel(tempModel)),
    updateTempEmbeddingModel: (tempEmbeddingModel: string) => dispatch(updateAIModeTempEmbeddingModel(tempEmbeddingModel)),
    updateTempEmbeddingQPS: (tempEmbeddingQPS: string) => dispatch(updateAIModeTempEmbeddingQPS(tempEmbeddingQPS)),
    updateTempTopk: (tempTopk: string) => dispatch(updateAIModeTempTopk(tempTopk)),
    setShowInputDialog: (showInputDialog: boolean) => dispatch(setAIModeShowInputDialog(showInputDialog)),
    setArticleCount: (articleCount: number) => dispatch(setAIModeArticleCount(articleCount)),
    setFilteredArticles: (filteredArticles: RSSItem[]) => dispatch(setAIModeFilteredArticles(filteredArticles)),
    setClusters: (clusters: ArticleCluster[]) => dispatch(setAIModeClusters(clusters)),
    setTimeRangeHasArticles: (timeRangeHasArticles: boolean) => dispatch(setAIModeTimeRangeHasArticles(timeRangeHasArticles)),
    updateQueryProgress: (queryProgress: QueryProgress | null) => dispatch(updateAIModeQueryProgress(queryProgress)),
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => 
        dispatch(updateAIModeStepStatus(stepId, status, message, progress)),
    setShowResults: (showResults: boolean) => dispatch(setAIModeShowResults(showResults)),
    setAIModeTokenStatistics: (tokenStatistics: import("../scripts/models/ai-mode").TokenStatistics | null) => dispatch(setAIModeTokenStatistics(tokenStatistics)),
    addTokenUsageRecord: (model: string, usage: import("../scripts/models/ai-mode").TokenUsage) => dispatch(addTokenUsageRecord(model, usage))
})

const SmartSearch = connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(SmartSearchComponent)
export default SmartSearch
