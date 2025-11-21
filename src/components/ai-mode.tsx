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
    updateAIModeClassificationStandard,
    updateAIModeClassificationStandardInput,
    updateAIModeRecentClassificationStandards,
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
    setAIModeArticleCount,
    setAIModeFilteredArticles,
    setAIModeClusters,
    setAIModeTimeRangeHasArticles,
    updateAIModeQueryProgress,
    updateAIModeStepStatus,
    setAIModeShowResults,
    setAIModeTokenStatistics,
} from "../scripts/models/ai-mode"
import {
    consolidate,
    classifyArticles as consolidateClassifyArticles,
    ConsolidateConfig,
    ConsolidateCallbacks,
    normalizeApiEndpoint,
} from "../scripts/consolidate"

// 重新导出类型以便其他文件使用
export type { ArticleCluster, QueryProgress, QueryProgressStep }

// AIMode Context 类型定义
export type AIModeContextType = {
    timeRange: string | null
    topic: string  // 单个话题文本
    topicInput: string
    recentTopics: string[]  // 最近使用的话题（最多5个）
    classificationStandard: string
    classificationStandardInput: string
    recentClassificationStandards: string[]
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
    setClassificationStandard: (standard: string) => void
    setClassificationStandardInput: (input: string) => void
    handleClassificationStandardInputChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    handleClassificationStandardInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
    handleClassificationStandardInputCompositionStart: () => void
    handleClassificationStandardInputCompositionEnd: () => void
    handleRecentClassificationStandardClick: (standard: string) => void
    classificationStandardInputRef: React.RefObject<ITextField>
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
    updateClassificationStandard: (classificationStandard: string) => void
    updateClassificationStandardInput: (classificationStandardInput: string) => void
    updateRecentClassificationStandards: (recentClassificationStandards: string[]) => void
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
    setShowErrorDialog: (showErrorDialog: boolean) => void
    setErrorDialogMessage: (errorDialogMessage: string) => void
    setArticleCount: (articleCount: number) => void
    setFilteredArticles: (filteredArticles: RSSItem[]) => void
    setClusters: (clusters: ArticleCluster[]) => void
    setTimeRangeHasArticles: (timeRangeHasArticles: boolean) => void
    updateQueryProgress: (queryProgress: QueryProgress | null) => void
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => void
    setShowResults: (showResults: boolean) => void
    setAIModeTokenStatistics: (tokenStatistics: import("../scripts/models/ai-mode").TokenStatistics | null) => void
}

// 创建 Context
export const AIModeContext = React.createContext<AIModeContextType | null>(null)

// Token统计组件
interface TokenStatisticsProps {
    tokenStatistics: {
        chatModel: {
            prompt_tokens: number
            completion_tokens: number
            total_tokens: number
        }
        embeddingModel: {
            prompt_tokens: number
            completion_tokens: number
            total_tokens: number
        }
    } | null
}

const TokenStatisticsComponent: React.FC<TokenStatisticsProps> = ({ tokenStatistics }) => {
    if (!tokenStatistics || !tokenStatistics.chatModel || !tokenStatistics.embeddingModel) {
        return null
    }

    return (
        <div style={{
            backgroundColor: '#1e1e1e', // Cursor风格的深色背景
            borderRadius: '8px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            flexShrink: 0
        }}>
            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: 600,
                color: '#ffffff'
            }}>
                {intl.get("settings.aiMode.results.tokenStatistics")}
            </h3>
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '12px'
            }}>
                {/* Chat Model统计 */}
                <div style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '6px'
                }}>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#e0e0e0',
                        marginBottom: '8px'
                    }}>
                        Chat Model
                    </div>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '13px',
                        color: '#a0a0a0'
                    }}>
                        <div>Prompt Tokens: {(tokenStatistics.chatModel.prompt_tokens || 0).toLocaleString()}</div>
                        <div>Completion Tokens: {(tokenStatistics.chatModel.completion_tokens || 0).toLocaleString()}</div>
                        <div style={{ fontWeight: 600, color: '#e0e0e0' }}>
                            Total Tokens: {(tokenStatistics.chatModel.total_tokens || 0).toLocaleString()}
                        </div>
                    </div>
                </div>
                {/* Embedding Model统计 */}
                <div style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '6px'
                }}>
                    <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#e0e0e0',
                        marginBottom: '8px'
                    }}>
                        Embedding Model
                    </div>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#e0e0e0'
                    }}>
                        Total Tokens: {(tokenStatistics.embeddingModel.total_tokens || 0).toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    )
}

export class AIModeComponent extends React.Component<AIModeProps> {
    static contextType = AIModeContext
    declare context: React.ContextType<typeof AIModeContext>
    private summaryContainerRef: React.RefObject<HTMLDivElement>
    private topicInputRef: React.RefObject<ITextField>
    private classificationStandardInputRef: React.RefObject<ITextField>
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
        this.classificationStandardInputRef = React.createRef()
    }

    componentDidUpdate(prevProps: AIModeProps) {
        const { aiMode } = this.props
        if (aiMode.queryProgress) {
            // 如果queryProgress存在但没有步骤，重新创建进度
            const currentStepCount = aiMode.queryProgress.steps?.length || 0
            if (currentStepCount === 0) {
                const hasTopic = !!(aiMode.topic && aiMode.topic.trim())
                const hasClassificationStandard = !!(aiMode.classificationStandardInput && aiMode.classificationStandardInput.trim())
                const queryProgress = this.initializeQueryProgress(hasTopic, hasClassificationStandard)
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
        const { aiMode, updateTimeRange, updateTopic, updateTopicInput, setIsComposing, updateClassificationStandard, updateClassificationStandardInput } = this.props
        return {
            timeRange: aiMode.timeRange,
            topic: aiMode.topic,
            topicInput: aiMode.topicInput,
            recentTopics: aiMode.recentTopics,
            classificationStandard: aiMode.classificationStandard,
            classificationStandardInput: aiMode.classificationStandardInput,
            recentClassificationStandards: aiMode.recentClassificationStandards,
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
            topicInputRef: this.topicInputRef,
            setClassificationStandard: updateClassificationStandard,
            setClassificationStandardInput: updateClassificationStandardInput,
            handleClassificationStandardInputChange: this.handleClassificationStandardInputChange,
            handleClassificationStandardInputKeyDown: this.handleClassificationStandardInputKeyDown,
            handleClassificationStandardInputCompositionStart: this.handleClassificationStandardInputCompositionStart,
            handleClassificationStandardInputCompositionEnd: this.handleClassificationStandardInputCompositionEnd,
            handleRecentClassificationStandardClick: this.handleRecentClassificationStandardClick,
            classificationStandardInputRef: this.classificationStandardInputRef
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
            const event = new CustomEvent('aiModeInputChanged')
            window.dispatchEvent(event)
        }
    }

    handleClassificationStandardInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        // 只更新Redux state，不触发Context更新事件
        // Context更新由componentDidUpdate中的逻辑控制，避免频繁更新打断输入
        this.props.updateClassificationStandardInput(newValue || '')
    }

    handleClassificationStandardInputCompositionStart = () => {
        this.props.setIsComposing(true)
    }

    handleClassificationStandardInputCompositionEnd = () => {
        this.props.setIsComposing(false)
        // 输入法结束后更新Context
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeInputChanged')
            window.dispatchEvent(event)
        }
    }

    handleClassificationStandardInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        // 处理Enter键确认分类标准
        const { aiMode, updateClassificationStandard } = this.props
        if (event.key === 'Enter' && !aiMode.isComposing) {
            event.preventDefault()
            const trimmed = aiMode.classificationStandardInput.trim()
            if (trimmed) {
                updateClassificationStandard(trimmed)
            }
        }
    }

    handleRecentClassificationStandardClick = (standard: string) => {
        // 点击常用分类标准时填充到输入框和分类标准字段
        const { updateClassificationStandardInput, updateClassificationStandard } = this.props
        updateClassificationStandardInput(standard)
        updateClassificationStandard(standard)
        // 聚焦到输入框（通过ref）
        if (this.classificationStandardInputRef.current) {
            const inputElement = this.classificationStandardInputRef.current as any
            inputElement.focus()
        }
        // 触发Context更新，让本地state同步
        // 使用 requestAnimationFrame 确保在下一个渲染周期更新，此时 Redux state 已经同步
        if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
                const event = new CustomEvent('aiModeInputChanged')
                window.dispatchEvent(event)
            })
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

    // 保存分类标准到最近分类标准列表
    saveClassificationStandardToRecent = (standard: string) => {
        const trimmed = standard.trim()
        if (!trimmed) return

        const { aiMode, updateRecentClassificationStandards } = this.props
        // 移除已存在的相同分类标准
        const filtered = aiMode.recentClassificationStandards.filter(s => s !== trimmed)
        // 添加到最前面
        const updated = [trimmed, ...filtered].slice(0, 5)  // 最多保留5个
        
        updateRecentClassificationStandards(updated)
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

    handleConfigConfirm = () => {
        const { aiMode, updateChatApiEndpoint, updateChatApiKey, updateEmbeddingApiEndpoint, updateEmbeddingApiKey, updateModel, updateEmbeddingModel, updateEmbeddingQPS, updateTopk, setShowConfigPanel, setShowErrorDialog, setErrorDialogMessage } = this.props
        const { tempChatApiEndpoint, tempChatApiKey, tempEmbeddingApiEndpoint, tempEmbeddingApiKey, tempModel, tempEmbeddingModel, tempEmbeddingQPS, tempTopk } = aiMode
        
        // 验证topk
        const topk = parseInt(tempTopk, 10)
        if (isNaN(topk) || topk < 1 || !Number.isInteger(topk)) {
            setShowErrorDialog(true)
            setErrorDialogMessage(intl.get("settings.aiMode.errors.topkInvalid"))
            return
        }
        
        // 验证embeddingQPS
        const embeddingQPS = parseInt(tempEmbeddingQPS, 10)
        if (isNaN(embeddingQPS) || embeddingQPS < 1 || !Number.isInteger(embeddingQPS)) {
            setShowErrorDialog(true)
            setErrorDialogMessage(intl.get("settings.aiMode.errors.embeddingQPSInvalid"))
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
    initializeQueryProgress = (hasTopic: boolean, hasClassificationStandard: boolean): QueryProgress => {
        // 只添加第一步，后续步骤根据实际执行情况动态添加
        // 如果按时间范围筛选后没有文章，流程会提前结束，不会有后续步骤
        const steps: QueryProgressStep[] = [
            { id: 'query-db', title: intl.get("settings.aiMode.progress.steps.queryDb"), status: 'in_progress', message: intl.get("settings.aiMode.progress.messages.querying"), visible: true }
        ]
        
        // 注意：所有后续步骤（vector-retrieval, llm-refine, classify-articles）
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
    queryArticles = async (timeRangeDays: number | null, topic: string | null, classificationStandard: string | null = null): Promise<{ articles: RSSItem[], timeRangeHasArticles: boolean, topicGuidance: string | null, classificationGuidance: string | null }> => {
        const { aiMode, updateQueryProgress } = this.props
        
        const config: ConsolidateConfig = {
            chatApiEndpoint: aiMode.chatApiEndpoint,
            chatApiKey: aiMode.chatApiKey,
            embeddingApiEndpoint: aiMode.embeddingApiEndpoint,
            embeddingApiKey: aiMode.embeddingApiKey,
            embeddingModel: aiMode.embeddingModel,
            embeddingQPS: aiMode.embeddingQPS,
            model: aiMode.model,
            topk: aiMode.topk || 100,
        }
        
        const callbacks: ConsolidateCallbacks = {
            updateStepStatus: this.updateStepStatus,
            updateQueryProgress: updateQueryProgress,
            getCurrentQueryProgress: () => aiMode.queryProgress,
            updateTokenStatistics: (tokenStatistics) => {
                this.props.setAIModeTokenStatistics(tokenStatistics)
            }
        }
        
        return await consolidate(timeRangeDays, topic, classificationStandard, config, callbacks)
    }


    // 对文章进行分类分析
    classifyArticles = async (articles: RSSItem[], topicGuidance: string | null = null, classificationGuidance: string | null = null): Promise<ArticleCluster[]> => {
        const { aiMode } = this.props
        
        // 验证配置
        if (!aiMode.chatApiEndpoint || !aiMode.chatApiEndpoint.trim()) {
            throw new Error('请先配置Chat API Endpoint（在设置中配置）')
        }
        if (!aiMode.chatApiKey || !aiMode.chatApiKey.trim()) {
            throw new Error('请先配置Chat API Key（在设置中配置）')
        }
        if (!aiMode.model || !aiMode.model.trim()) {
            throw new Error('请先配置模型名称（在设置中配置）')
        }
        
        // 规范化 URL
        let chatApiBaseURL: string
        try {
            chatApiBaseURL = normalizeApiEndpoint(aiMode.chatApiEndpoint)
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Chat API Endpoint配置错误: ${error.message}`)
            }
            throw error
        }
        
        const config: ConsolidateConfig = {
            chatApiEndpoint: aiMode.chatApiEndpoint,
            chatApiKey: aiMode.chatApiKey,
            embeddingApiEndpoint: aiMode.embeddingApiEndpoint,
            embeddingApiKey: aiMode.embeddingApiKey,
            embeddingModel: aiMode.embeddingModel,
            embeddingQPS: aiMode.embeddingQPS,
            model: aiMode.model,
            topk: aiMode.topk || 100,
            chatApiBaseURL,
        }
        
        const callbacks: ConsolidateCallbacks = {
            updateStepStatus: this.updateStepStatus,
            updateTokenStatistics: (tokenStatistics) => {
                this.props.setAIModeTokenStatistics(tokenStatistics)
            }
        }
        
        // 获取当前的tokenStatistics，继续累加而不是重新创建
        const currentTokenStatistics = aiMode.tokenStatistics || null
        
        return await consolidateClassifyArticles(articles, topicGuidance, classificationGuidance, config, callbacks, currentTokenStatistics)
    }

    // 生成总结
    generateSummary = async (articles: RSSItem[], topic: string): Promise<string> => {
        const { aiMode } = this.props
        const { chatApiEndpoint, chatApiKey, model } = aiMode

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
                apiKey: chatApiKey,
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
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查:\n1. Chat API Endpoint是否正确（完整的URL路径）\n2. 是否需要包含特定的路径（如 /v1/chat/completions）\n3. API服务是否正常运行\n当前请求URL: ${normalizedEndpoint}`
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
        const { updateTopic, updateTopicInput, updateClassificationStandard, updateClassificationStandardInput, setLoading, setClustering, setError, setSummary, setArticleCount, setFilteredArticles, setClusters, setTimeRangeHasArticles, updateQueryProgress, setShowResults, setShowErrorDialog, setErrorDialogMessage } = this.props

        // 验证时间范围必须选择
        if (!timeRange) {
            setShowErrorDialog(true)
            setErrorDialogMessage(intl.get("settings.aiMode.errors.selectTimeRange"))
            return
        }

        // 验证话题必须输入（话题是必填的）
        const trimmedTopic = topicInput.trim() || aiMode.topic?.trim() || ''
        if (!trimmedTopic) {
            setShowErrorDialog(true)
            setErrorDialogMessage(intl.get("settings.aiMode.errors.enterTopic"))
            return
        }

        // 保存当前话题到状态和最近话题列表
        const currentTopic = trimmedTopic
        this.saveTopicToRecent(currentTopic)
        
        // 获取分类标准（可选）- 只使用用户当前输入的值，不自动填充
        const trimmedClassificationStandard = aiMode.classificationStandardInput.trim()
        if (trimmedClassificationStandard) {
            updateClassificationStandard(trimmedClassificationStandard)
            // 确保 classificationStandardInput 和 classificationStandard 一致
            updateClassificationStandardInput(trimmedClassificationStandard)
            this.saveClassificationStandardToRecent(trimmedClassificationStandard)
        } else {
            // 如果用户清空了输入框，也应该清空 classificationStandard，避免使用旧值
            updateClassificationStandard('')
            updateClassificationStandardInput('')
        }
        
        // 初始化查询进度（根据是否有话题和分类依据决定是否包含分类步骤）
        const hasTopic = !!currentTopic
        const hasClassificationStandard = !!trimmedClassificationStandard
        const queryProgress = this.initializeQueryProgress(hasTopic, hasClassificationStandard)

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
            const result = await this.queryArticles(timeRangeDays, currentTopic, trimmedClassificationStandard)
            const { articles, timeRangeHasArticles, topicGuidance, classificationGuidance } = result
            
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
            
            // 保存筛选后的文章列表
            setArticleCount(articlesWithValidSources.length)
            setFilteredArticles(articlesWithValidSources)
            setClusters([])
            setError(null) // 清除错误状态
            setLoading(false)
            
            // 如果无文章，完成查询进度并保持在进度界面
            // consolidate 函数已经更新了 queryProgress，只包含实际执行的步骤，移除了所有未执行的步骤
            // 这里不需要再做任何处理，直接使用 consolidate 函数更新后的 queryProgress
            if (articlesWithValidSources.length === 0) {
                // 确保分类相关状态已清除
                setClustering(false)
                setClusters([])
                
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
                return
            }
            
            // 检查是否有话题和分类依据
            const hasTopic = currentTopic && currentTopic.trim()
            const currentClassificationStandard = aiMode.classificationStandardInput.trim() || null
            
            // 如果没有话题或没有分类依据，不执行分类步骤，直接展示所有文章
            if (!hasTopic || !currentClassificationStandard) {
                setClustering(false)
                setShowResults(false)  // 不自动显示结果，等待用户点击按钮
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
                return
            }
            
            // 有分类依据，执行分类步骤
            // 只有在真正需要执行分类时，才添加 classify-articles 步骤
            if (aiMode.queryProgress) {
                // 检查是否已经有 classify-articles 步骤
                const hasClassifyStep = aiMode.queryProgress.steps.some(step => step.id === 'classify-articles')
                if (!hasClassifyStep) {
                    // 添加 classify-articles 步骤
                    const updatedSteps: QueryProgressStep[] = [
                        ...aiMode.queryProgress.steps,
                        { id: 'classify-articles', title: intl.get("settings.aiMode.progress.steps.classifyArticles"), status: 'pending' as const, visible: false }
                    ]
                    updateQueryProgress({
                        steps: updatedSteps,
                        currentStepIndex: aiMode.queryProgress.currentStepIndex,
                        overallProgress: aiMode.queryProgress.overallProgress,
                        currentMessage: aiMode.queryProgress.currentMessage
                    })
                }
            }
            
            setClustering(true)
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }

            // 使用LLM对文章进行分类分析
            try {
                const clusters = await this.classifyArticles(articlesWithValidSources, topicGuidance, classificationGuidance)
                
                setClusters(clusters)
                setClustering(false)
                setLoading(false)
                setShowResults(false)  // 不自动显示结果，等待用户点击按钮
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
            } catch (clusterError) {
                const errorMsg = clusterError instanceof Error ? clusterError.message : intl.get("settings.aiMode.errors.clusterFailed")
                // 分类失败时仍然显示文章列表，但不进行分组
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
            const errorMessage = error instanceof Error ? error.message : intl.get("settings.aiMode.errors.queryFailed")
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
        
        // 延迟触发事件，确保 Redux 状态更新完成后再更新 Context
        if (typeof window !== 'undefined') {
            setTimeout(() => {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }, 0)
        }
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

                {/* 如果没有分类结果，显示原始文章列表 */}
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
                        
                        // 注意：分类步骤由 initializeQueryProgress 根据是否有话题和分类依据决定是否添加
                        // 注意：calculate-similarity 不再作为独立步骤，它现在是 vector-retrieval 的子步骤
                        progress = {
                            steps: [
                                { id: 'query-db', title: intl.get("settings.aiMode.progress.steps.queryDb"), status: defaultStatus, message: defaultMessage, visible: true },
                                { id: 'compute-topic-embedding', title: intl.get("settings.aiMode.progress.steps.computeTopicEmbedding"), status: isCompleted ? 'completed' as const : 'pending' as const, visible: isCompleted },
                                { id: 'load-embeddings', title: intl.get("settings.aiMode.progress.steps.loadEmbeddings"), status: isCompleted ? 'completed' as const : 'pending' as const, visible: isCompleted },
                                { id: 'compute-embeddings', title: intl.get("settings.aiMode.progress.steps.computeEmbeddings"), status: isCompleted ? 'completed' as const : 'pending' as const, visible: isCompleted },
                                { id: 'llm-refine', title: intl.get("settings.aiMode.progress.steps.llmRefine"), status: isCompleted ? 'completed' as const : 'pending' as const, visible: isCompleted }
                            ],
                            currentStepIndex: isCompleted ? 4 : 0,
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
                                    {intl.get("settings.aiMode.progress.executionSteps")} ({progress.steps.filter(s => s.status === 'completed').length}/{progress.steps.length})
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

                            {/* Token统计显示 */}
                            <TokenStatisticsComponent tokenStatistics={aiMode.tokenStatistics} />

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
                                                        count: filteredArticles.length, 
                                                        clusters: clusters.length > 0 
                                                            ? intl.get("settings.aiMode.progress.foundArticlesWithClusters", { count: clusters.length })
                                                            : intl.get("settings.aiMode.progress.foundArticlesNoClusters")
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
                

                {/* 只在真正的错误（非无文章情况）时显示错误提示 */}
                {error && !isLoading && filteredArticles.length === 0 && !shouldShowDarkProgress && !shouldShowProgressForCompleted && (
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
                        <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutralPrimary)' }}>
                            {intl.get("settings.aiMode.placeholder.title")}
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--neutralSecondary)', maxWidth: '500px' }}>
                            {intl.get("settings.aiMode.placeholder.description")}
                        </p>
                        <div style={{ 
                            marginTop: '24px',
                            width: '100%',
                            maxWidth: '500px',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'var(--neutralLighterAlt)',
                                borderRadius: '6px',
                                border: '1px solid var(--neutralLight)'
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--neutralPrimary)', marginBottom: '4px' }}>
                                    {intl.get("settings.aiMode.menu.timeRange")}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--neutralSecondary)', lineHeight: '1.5' }}>
                                    {intl.get("settings.aiMode.placeholder.timeRangeHint")}
                                </div>
                            </div>
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'var(--neutralLighterAlt)',
                                borderRadius: '6px',
                                border: '1px solid var(--neutralLight)'
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--neutralPrimary)', marginBottom: '4px' }}>
                                    {intl.get("settings.aiMode.menu.topic")}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--neutralSecondary)', lineHeight: '1.5' }}>
                                    {intl.get("settings.aiMode.placeholder.topicHint")}
                                </div>
                            </div>
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'var(--neutralLighterAlt)',
                                borderRadius: '6px',
                                border: '1px solid var(--neutralLight)'
                            }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--neutralPrimary)', marginBottom: '4px' }}>
                                    {intl.get("settings.aiMode.menu.classificationStandard")}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--neutralSecondary)', lineHeight: '1.5' }}>
                                    {intl.get("settings.aiMode.placeholder.classificationStandardHint")}
                                </div>
                            </div>
                        </div>
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
                                <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 600, color: 'var(--neutralPrimary)' }}>{intl.get("settings.aiMode.common.error")}</h2>
                            </div>
                            <div style={{ marginBottom: '20px', color: 'var(--neutralPrimary)', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                                {errorDialogMessage}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <DefaultButton onClick={this.handleCloseErrorDialog} text={intl.get("settings.aiMode.common.ok")} />
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
    updateClassificationStandard: (classificationStandard: string) => dispatch(updateAIModeClassificationStandard(classificationStandard)),
    updateClassificationStandardInput: (classificationStandardInput: string) => dispatch(updateAIModeClassificationStandardInput(classificationStandardInput)),
    updateRecentClassificationStandards: (recentClassificationStandards: string[]) => dispatch(updateAIModeRecentClassificationStandards(recentClassificationStandards)),
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
    setShowErrorDialog: (showErrorDialog: boolean) => dispatch(setAIModeShowErrorDialog(showErrorDialog)),
    setErrorDialogMessage: (errorDialogMessage: string) => dispatch(setAIModeErrorDialogMessage(errorDialogMessage)),
    setArticleCount: (articleCount: number) => dispatch(setAIModeArticleCount(articleCount)),
    setFilteredArticles: (filteredArticles: RSSItem[]) => dispatch(setAIModeFilteredArticles(filteredArticles)),
    setClusters: (clusters: ArticleCluster[]) => dispatch(setAIModeClusters(clusters)),
    setTimeRangeHasArticles: (timeRangeHasArticles: boolean) => dispatch(setAIModeTimeRangeHasArticles(timeRangeHasArticles)),
    updateQueryProgress: (queryProgress: QueryProgress | null) => dispatch(updateAIModeQueryProgress(queryProgress)),
    updateStepStatus: (stepId: string, status: QueryProgressStep['status'], message?: string, progress?: number) => 
        dispatch(updateAIModeStepStatus(stepId, status, message, progress)),
    setShowResults: (showResults: boolean) => dispatch(setAIModeShowResults(showResults)),
    setAIModeTokenStatistics: (tokenStatistics: import("../scripts/models/ai-mode").TokenStatistics | null) => dispatch(setAIModeTokenStatistics(tokenStatistics))
})

const AIMode = connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(AIModeComponent)
export default AIMode
