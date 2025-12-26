import { AppThunk } from "../utils"
import { RSSItem } from "./item"
import intl from "react-intl-universal"

// ==================== 共享类型定义 ====================

// 文章分类结果类型
export type ArticleCluster = {
    id: string  // 分类ID
    title: string  // 分类标题（分类名称）
    description: string  // 分类描述
    articles: RSSItem[]  // 该分类中的文章列表
}

// 查询进度步骤类型
export type QueryProgressStep = {
    id: string  // 步骤ID
    title: string  // 步骤标题
    status: 'pending' | 'in_progress' | 'completed' | 'error'  // 步骤状态
    message?: string  // 步骤详细信息
    progress?: number  // 当前步骤的进度百分比（0-100）
    visible?: boolean  // 是否可见（新增）
}

// 查询进度类型
export type QueryProgress = {
    steps: QueryProgressStep[]
    currentStepIndex: number
    overallProgress: number  // 总体进度百分比（0-100）
    currentMessage: string  // 当前步骤的详细信息
}

// Token使用量类型
export type TokenUsage = {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
}

// Token统计类型
export type TokenStatistics = {
    chatModel: TokenUsage
    embeddingModel: TokenUsage
}

// Token使用记录类型
export type TokenUsageRecord = {
    model: string  // 模型名称
    prompt_tokens: number  // prompt token数量
    completion_tokens: number  // completion token数量
    total_tokens: number  // 总token数量
    timestamp: number  // 使用时间（Unix时间戳）
}

// ==================== 类型定义 ====================

export class AIModeState {
    timeRange: string | null = null
    topic: string = ''
    topicInput: string = ''
    recentTopics: string[] = []
    isComposing: boolean = false
    summary: string = ''
    isLoading: boolean = false
    isClustering: boolean = false
    error: string | null = null
    apiEndpoint: string = ''  // 保留用于向后兼容
    apiKey: string = ''  // 保留用于向后兼容
    chatApiEndpoint: string = ''
    chatApiKey: string = ''
    embeddingApiEndpoint: string = ''
    embeddingApiKey: string = ''
    model: string = ''
    embeddingModel: string = ''
    embeddingQPS: number = 30
    topk: number = 100
    showConfigPanel: boolean = false
    tempApiEndpoint: string = ''  // 保留用于向后兼容
    tempApiKey: string = ''  // 保留用于向后兼容
    tempChatApiEndpoint: string = ''
    tempChatApiKey: string = ''
    tempEmbeddingApiEndpoint: string = ''
    tempEmbeddingApiKey: string = ''
    tempModel: string = ''
    tempEmbeddingModel: string = ''
    tempEmbeddingQPS: string = '30'
    tempTopk: string = '100'
    translationApiEndpoint: string = ''
    translationApiKey: string = ''
    translationModel: string = ''
    tempTranslationApiEndpoint: string = ''
    tempTranslationApiKey: string = ''
    tempTranslationModel: string = ''
    showErrorDialog: boolean = false
    errorDialogMessage: string = ''
    showInputDialog: boolean = false
    articleCount: number = 0
    filteredArticles: RSSItem[] = []
    clusters: ArticleCluster[] = []
    queryProgress: QueryProgress | null = null
    showResults: boolean = false
    timeRangeHasArticles: boolean = false
    tokenStatistics: TokenStatistics | null = null
    tokenUsageHistory: TokenUsageRecord[] = []  // Token使用历史记录
}

// ==================== Action Types ====================

export const UPDATE_AI_MODE_TIME_RANGE = "UPDATE_AI_MODE_TIME_RANGE"
export const UPDATE_AI_MODE_TOPIC = "UPDATE_AI_MODE_TOPIC"
export const UPDATE_AI_MODE_TOPIC_INPUT = "UPDATE_AI_MODE_TOPIC_INPUT"
export const SET_AI_MODE_IS_COMPOSING = "SET_AI_MODE_IS_COMPOSING"
export const UPDATE_AI_MODE_RECENT_TOPICS = "UPDATE_AI_MODE_RECENT_TOPICS"
export const SET_AI_MODE_SUMMARY = "SET_AI_MODE_SUMMARY"
export const SET_AI_MODE_LOADING = "SET_AI_MODE_LOADING"
export const SET_AI_MODE_CLUSTERING = "SET_AI_MODE_CLUSTERING"
export const SET_AI_MODE_ERROR = "SET_AI_MODE_ERROR"
export const UPDATE_AI_MODE_API_ENDPOINT = "UPDATE_AI_MODE_API_ENDPOINT"
export const UPDATE_AI_MODE_API_KEY = "UPDATE_AI_MODE_API_KEY"
export const UPDATE_AI_MODE_MODEL = "UPDATE_AI_MODE_MODEL"
export const UPDATE_AI_MODE_EMBEDDING_MODEL = "UPDATE_AI_MODE_EMBEDDING_MODEL"
export const UPDATE_AI_MODE_EMBEDDING_QPS = "UPDATE_AI_MODE_EMBEDDING_QPS"
export const UPDATE_AI_MODE_TOPK = "UPDATE_AI_MODE_TOPK"
export const SET_AI_MODE_SHOW_CONFIG_PANEL = "SET_AI_MODE_SHOW_CONFIG_PANEL"
export const UPDATE_AI_MODE_TEMP_API_ENDPOINT = "UPDATE_AI_MODE_TEMP_API_ENDPOINT"
export const UPDATE_AI_MODE_TEMP_API_KEY = "UPDATE_AI_MODE_TEMP_API_KEY"
export const UPDATE_AI_MODE_TEMP_MODEL = "UPDATE_AI_MODE_TEMP_MODEL"
export const UPDATE_AI_MODE_TEMP_EMBEDDING_MODEL = "UPDATE_AI_MODE_TEMP_EMBEDDING_MODEL"
export const UPDATE_AI_MODE_TEMP_EMBEDDING_QPS = "UPDATE_AI_MODE_TEMP_EMBEDDING_QPS"
export const UPDATE_AI_MODE_TEMP_TOPK = "UPDATE_AI_MODE_TEMP_TOPK"
export const UPDATE_AI_MODE_CHAT_API_ENDPOINT = "UPDATE_AI_MODE_CHAT_API_ENDPOINT"
export const UPDATE_AI_MODE_CHAT_API_KEY = "UPDATE_AI_MODE_CHAT_API_KEY"
export const UPDATE_AI_MODE_EMBEDDING_API_ENDPOINT = "UPDATE_AI_MODE_EMBEDDING_API_ENDPOINT"
export const UPDATE_AI_MODE_EMBEDDING_API_KEY = "UPDATE_AI_MODE_EMBEDDING_API_KEY"
export const UPDATE_AI_MODE_TEMP_CHAT_API_ENDPOINT = "UPDATE_AI_MODE_TEMP_CHAT_API_ENDPOINT"
export const UPDATE_AI_MODE_TEMP_CHAT_API_KEY = "UPDATE_AI_MODE_TEMP_CHAT_API_KEY"
export const UPDATE_AI_MODE_TEMP_EMBEDDING_API_ENDPOINT = "UPDATE_AI_MODE_TEMP_EMBEDDING_API_ENDPOINT"
export const UPDATE_AI_MODE_TEMP_EMBEDDING_API_KEY = "UPDATE_AI_MODE_TEMP_EMBEDDING_API_KEY"
export const UPDATE_AI_MODE_TRANSLATION_API_ENDPOINT = "UPDATE_AI_MODE_TRANSLATION_API_ENDPOINT"
export const UPDATE_AI_MODE_TRANSLATION_API_KEY = "UPDATE_AI_MODE_TRANSLATION_API_KEY"
export const UPDATE_AI_MODE_TRANSLATION_MODEL = "UPDATE_AI_MODE_TRANSLATION_MODEL"
export const UPDATE_AI_MODE_TEMP_TRANSLATION_API_ENDPOINT = "UPDATE_AI_MODE_TEMP_TRANSLATION_API_ENDPOINT"
export const UPDATE_AI_MODE_TEMP_TRANSLATION_API_KEY = "UPDATE_AI_MODE_TEMP_TRANSLATION_API_KEY"
export const UPDATE_AI_MODE_TEMP_TRANSLATION_MODEL = "UPDATE_AI_MODE_TEMP_TRANSLATION_MODEL"
export const SET_AI_MODE_SHOW_ERROR_DIALOG = "SET_AI_MODE_SHOW_ERROR_DIALOG"
export const SET_AI_MODE_ERROR_DIALOG_MESSAGE = "SET_AI_MODE_ERROR_DIALOG_MESSAGE"
export const SET_AI_MODE_SHOW_INPUT_DIALOG = "SET_AI_MODE_SHOW_INPUT_DIALOG"
export const SET_AI_MODE_ARTICLE_COUNT = "SET_AI_MODE_ARTICLE_COUNT"
export const SET_AI_MODE_FILTERED_ARTICLES = "SET_AI_MODE_FILTERED_ARTICLES"
export const SET_AI_MODE_CLUSTERS = "SET_AI_MODE_CLUSTERS"
export const SET_AI_MODE_TIME_RANGE_HAS_ARTICLES = "SET_AI_MODE_TIME_RANGE_HAS_ARTICLES"
export const UPDATE_AI_MODE_QUERY_PROGRESS = "UPDATE_AI_MODE_QUERY_PROGRESS"
export const UPDATE_AI_MODE_STEP_STATUS = "UPDATE_AI_MODE_STEP_STATUS"
export const SET_AI_MODE_SHOW_RESULTS = "SET_AI_MODE_SHOW_RESULTS"
export const SET_AI_MODE_TOKEN_STATISTICS = "SET_AI_MODE_TOKEN_STATISTICS"
export const ADD_TOKEN_USAGE_RECORD = "ADD_TOKEN_USAGE_RECORD"
export const INIT_AI_MODE = "INIT_AI_MODE"

// ==================== Action Creators ====================

export interface UpdateAIModeTimeRangeAction {
    type: typeof UPDATE_AI_MODE_TIME_RANGE
    timeRange: string | null
}

export interface UpdateAIModeTopicAction {
    type: typeof UPDATE_AI_MODE_TOPIC
    topic: string
}

export interface UpdateAIModeTopicInputAction {
    type: typeof UPDATE_AI_MODE_TOPIC_INPUT
    topicInput: string
}

export interface SetAIModeIsComposingAction {
    type: typeof SET_AI_MODE_IS_COMPOSING
    isComposing: boolean
}

export interface UpdateAIModeRecentTopicsAction {
    type: typeof UPDATE_AI_MODE_RECENT_TOPICS
    recentTopics: string[]
}

export interface SetAIModeSummaryAction {
    type: typeof SET_AI_MODE_SUMMARY
    summary: string
}

export interface SetAIModeLoadingAction {
    type: typeof SET_AI_MODE_LOADING
    isLoading: boolean
}

export interface SetAIModeClusteringAction {
    type: typeof SET_AI_MODE_CLUSTERING
    isClustering: boolean
}

export interface SetAIModeErrorAction {
    type: typeof SET_AI_MODE_ERROR
    error: string | null
}

export interface UpdateAIModeApiEndpointAction {
    type: typeof UPDATE_AI_MODE_API_ENDPOINT
    apiEndpoint: string
}

export interface UpdateAIModeApiKeyAction {
    type: typeof UPDATE_AI_MODE_API_KEY
    apiKey: string
}

export interface UpdateAIModeModelAction {
    type: typeof UPDATE_AI_MODE_MODEL
    model: string
}

export interface UpdateAIModeEmbeddingModelAction {
    type: typeof UPDATE_AI_MODE_EMBEDDING_MODEL
    embeddingModel: string
}

export interface UpdateAIModeEmbeddingQPSAction {
    type: typeof UPDATE_AI_MODE_EMBEDDING_QPS
    embeddingQPS: number
}

export interface UpdateAIModeTopkAction {
    type: typeof UPDATE_AI_MODE_TOPK
    topk: number
}

export interface SetAIModeShowConfigPanelAction {
    type: typeof SET_AI_MODE_SHOW_CONFIG_PANEL
    showConfigPanel: boolean
}

export interface UpdateAIModeTempApiEndpointAction {
    type: typeof UPDATE_AI_MODE_TEMP_API_ENDPOINT
    tempApiEndpoint: string
}

export interface UpdateAIModeTempApiKeyAction {
    type: typeof UPDATE_AI_MODE_TEMP_API_KEY
    tempApiKey: string
}

export interface UpdateAIModeTempModelAction {
    type: typeof UPDATE_AI_MODE_TEMP_MODEL
    tempModel: string
}

export interface UpdateAIModeTempEmbeddingModelAction {
    type: typeof UPDATE_AI_MODE_TEMP_EMBEDDING_MODEL
    tempEmbeddingModel: string
}

export interface UpdateAIModeTempEmbeddingQPSAction {
    type: typeof UPDATE_AI_MODE_TEMP_EMBEDDING_QPS
    tempEmbeddingQPS: string
}

export interface UpdateAIModeTempTopkAction {
    type: typeof UPDATE_AI_MODE_TEMP_TOPK
    tempTopk: string
}

export interface UpdateAIModeChatApiEndpointAction {
    type: typeof UPDATE_AI_MODE_CHAT_API_ENDPOINT
    chatApiEndpoint: string
}

export interface UpdateAIModeChatApiKeyAction {
    type: typeof UPDATE_AI_MODE_CHAT_API_KEY
    chatApiKey: string
}

export interface UpdateAIModeEmbeddingApiEndpointAction {
    type: typeof UPDATE_AI_MODE_EMBEDDING_API_ENDPOINT
    embeddingApiEndpoint: string
}

export interface UpdateAIModeEmbeddingApiKeyAction {
    type: typeof UPDATE_AI_MODE_EMBEDDING_API_KEY
    embeddingApiKey: string
}

export interface UpdateAIModeTempChatApiEndpointAction {
    type: typeof UPDATE_AI_MODE_TEMP_CHAT_API_ENDPOINT
    tempChatApiEndpoint: string
}

export interface UpdateAIModeTempChatApiKeyAction {
    type: typeof UPDATE_AI_MODE_TEMP_CHAT_API_KEY
    tempChatApiKey: string
}

export interface UpdateAIModeTempEmbeddingApiEndpointAction {
    type: typeof UPDATE_AI_MODE_TEMP_EMBEDDING_API_ENDPOINT
    tempEmbeddingApiEndpoint: string
}

export interface UpdateAIModeTempEmbeddingApiKeyAction {
    type: typeof UPDATE_AI_MODE_TEMP_EMBEDDING_API_KEY
    tempEmbeddingApiKey: string
}

export interface UpdateAIModeTranslationApiEndpointAction {
    type: typeof UPDATE_AI_MODE_TRANSLATION_API_ENDPOINT
    translationApiEndpoint: string
}

export interface UpdateAIModeTranslationApiKeyAction {
    type: typeof UPDATE_AI_MODE_TRANSLATION_API_KEY
    translationApiKey: string
}

export interface UpdateAIModeTranslationModelAction {
    type: typeof UPDATE_AI_MODE_TRANSLATION_MODEL
    translationModel: string
}

export interface UpdateAIModeTempTranslationApiEndpointAction {
    type: typeof UPDATE_AI_MODE_TEMP_TRANSLATION_API_ENDPOINT
    tempTranslationApiEndpoint: string
}

export interface UpdateAIModeTempTranslationApiKeyAction {
    type: typeof UPDATE_AI_MODE_TEMP_TRANSLATION_API_KEY
    tempTranslationApiKey: string
}

export interface UpdateAIModeTempTranslationModelAction {
    type: typeof UPDATE_AI_MODE_TEMP_TRANSLATION_MODEL
    tempTranslationModel: string
}

export interface SetAIModeShowErrorDialogAction {
    type: typeof SET_AI_MODE_SHOW_ERROR_DIALOG
    showErrorDialog: boolean
}

export interface SetAIModeErrorDialogMessageAction {
    type: typeof SET_AI_MODE_ERROR_DIALOG_MESSAGE
    errorDialogMessage: string
}

export interface SetAIModeShowInputDialogAction {
    type: typeof SET_AI_MODE_SHOW_INPUT_DIALOG
    showInputDialog: boolean
}

export interface SetAIModeArticleCountAction {
    type: typeof SET_AI_MODE_ARTICLE_COUNT
    articleCount: number
}

export interface SetAIModeFilteredArticlesAction {
    type: typeof SET_AI_MODE_FILTERED_ARTICLES
    filteredArticles: RSSItem[]
}

export interface SetAIModeClustersAction {
    type: typeof SET_AI_MODE_CLUSTERS
    clusters: ArticleCluster[]
}

export interface SetAIModeTimeRangeHasArticlesAction {
    type: typeof SET_AI_MODE_TIME_RANGE_HAS_ARTICLES
    timeRangeHasArticles: boolean
}

export interface UpdateAIModeQueryProgressAction {
    type: typeof UPDATE_AI_MODE_QUERY_PROGRESS
    queryProgress: QueryProgress | null
}

export interface UpdateAIModeStepStatusAction {
    type: typeof UPDATE_AI_MODE_STEP_STATUS
    stepId: string
    status: QueryProgressStep['status']
    message?: string
    progress?: number
}

export interface SetAIModeShowResultsAction {
    type: typeof SET_AI_MODE_SHOW_RESULTS
    showResults: boolean
}

export interface SetAIModeTokenStatisticsAction {
    type: typeof SET_AI_MODE_TOKEN_STATISTICS
    tokenStatistics: TokenStatistics | null
}

export interface AddTokenUsageRecordAction {
    type: typeof ADD_TOKEN_USAGE_RECORD
    record: TokenUsageRecord
}

export interface InitAIModeAction {
    type: typeof INIT_AI_MODE
}

export type AIModeActionTypes =
    | UpdateAIModeTimeRangeAction
    | UpdateAIModeTopicAction
    | UpdateAIModeTopicInputAction
    | SetAIModeIsComposingAction
    | UpdateAIModeRecentTopicsAction
    | SetAIModeSummaryAction
    | SetAIModeLoadingAction
    | SetAIModeClusteringAction
    | SetAIModeErrorAction
    | UpdateAIModeApiEndpointAction
    | UpdateAIModeApiKeyAction
    | UpdateAIModeModelAction
    | UpdateAIModeEmbeddingModelAction
    | UpdateAIModeEmbeddingQPSAction
    | UpdateAIModeTopkAction
    | SetAIModeShowConfigPanelAction
    | UpdateAIModeTempApiEndpointAction
    | UpdateAIModeTempApiKeyAction
    | UpdateAIModeTempModelAction
    | UpdateAIModeTempEmbeddingModelAction
    | UpdateAIModeTempEmbeddingQPSAction
    | UpdateAIModeTempTopkAction
    | UpdateAIModeChatApiEndpointAction
    | UpdateAIModeChatApiKeyAction
    | UpdateAIModeEmbeddingApiEndpointAction
    | UpdateAIModeEmbeddingApiKeyAction
    | UpdateAIModeTempChatApiEndpointAction
    | UpdateAIModeTempChatApiKeyAction
    | UpdateAIModeTempEmbeddingApiEndpointAction
    | UpdateAIModeTempEmbeddingApiKeyAction
    | UpdateAIModeTranslationApiEndpointAction
    | UpdateAIModeTranslationApiKeyAction
    | UpdateAIModeTranslationModelAction
    | UpdateAIModeTempTranslationApiEndpointAction
    | UpdateAIModeTempTranslationApiKeyAction
    | UpdateAIModeTempTranslationModelAction
    | SetAIModeShowErrorDialogAction
    | SetAIModeErrorDialogMessageAction
    | SetAIModeShowInputDialogAction
    | SetAIModeArticleCountAction
    | SetAIModeFilteredArticlesAction
    | SetAIModeClustersAction
    | SetAIModeTimeRangeHasArticlesAction
    | UpdateAIModeQueryProgressAction
    | UpdateAIModeStepStatusAction
    | SetAIModeShowResultsAction
    | SetAIModeTokenStatisticsAction
    | AddTokenUsageRecordAction
    | InitAIModeAction

// ==================== Action Creator Functions ====================

export function updateAIModeTimeRange(timeRange: string | null): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TIME_RANGE,
        timeRange
    }
}

export function updateAIModeTopic(topic: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TOPIC,
        topic
    }
}

export function updateAIModeTopicInput(topicInput: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TOPIC_INPUT,
        topicInput
    }
}

export function setAIModeIsComposing(isComposing: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_IS_COMPOSING,
        isComposing
    }
}

export function updateAIModeRecentTopics(recentTopics: string[]): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_RECENT_TOPICS,
        recentTopics
    }
}

export function setAIModeSummary(summary: string): AIModeActionTypes {
    return {
        type: SET_AI_MODE_SUMMARY,
        summary
    }
}

export function setAIModeLoading(isLoading: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_LOADING,
        isLoading
    }
}

export function setAIModeClustering(isClustering: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_CLUSTERING,
        isClustering
    }
}

export function setAIModeError(error: string | null): AIModeActionTypes {
    return {
        type: SET_AI_MODE_ERROR,
        error
    }
}

export function updateAIModeApiEndpoint(apiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_API_ENDPOINT,
        apiEndpoint
    }
}

export function updateAIModeApiKey(apiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_API_KEY,
        apiKey
    }
}

export function updateAIModeModel(model: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_MODEL,
        model
    }
}

export function updateAIModeEmbeddingModel(embeddingModel: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_EMBEDDING_MODEL,
        embeddingModel
    }
}

export function updateAIModeEmbeddingQPS(embeddingQPS: number): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_EMBEDDING_QPS,
        embeddingQPS
    }
}

export function updateAIModeTopk(topk: number): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TOPK,
        topk
    }
}

export function setAIModeShowConfigPanel(showConfigPanel: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_SHOW_CONFIG_PANEL,
        showConfigPanel
    }
}

export function updateAIModeTempApiEndpoint(tempApiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_API_ENDPOINT,
        tempApiEndpoint
    }
}

export function updateAIModeTempApiKey(tempApiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_API_KEY,
        tempApiKey
    }
}

export function updateAIModeTempModel(tempModel: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_MODEL,
        tempModel
    }
}

export function updateAIModeTempEmbeddingModel(tempEmbeddingModel: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_EMBEDDING_MODEL,
        tempEmbeddingModel
    }
}

export function updateAIModeTempEmbeddingQPS(tempEmbeddingQPS: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_EMBEDDING_QPS,
        tempEmbeddingQPS
    }
}

export function updateAIModeTempTopk(tempTopk: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_TOPK,
        tempTopk
    }
}

export function updateAIModeChatApiEndpoint(chatApiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_CHAT_API_ENDPOINT,
        chatApiEndpoint
    }
}

export function updateAIModeChatApiKey(chatApiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_CHAT_API_KEY,
        chatApiKey
    }
}

export function updateAIModeEmbeddingApiEndpoint(embeddingApiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_EMBEDDING_API_ENDPOINT,
        embeddingApiEndpoint
    }
}

export function updateAIModeEmbeddingApiKey(embeddingApiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_EMBEDDING_API_KEY,
        embeddingApiKey
    }
}

export function updateAIModeTempChatApiEndpoint(tempChatApiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_CHAT_API_ENDPOINT,
        tempChatApiEndpoint
    }
}

export function updateAIModeTempChatApiKey(tempChatApiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_CHAT_API_KEY,
        tempChatApiKey
    }
}

export function updateAIModeTempEmbeddingApiEndpoint(tempEmbeddingApiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_EMBEDDING_API_ENDPOINT,
        tempEmbeddingApiEndpoint
    }
}

export function updateAIModeTempEmbeddingApiKey(tempEmbeddingApiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_EMBEDDING_API_KEY,
        tempEmbeddingApiKey
    }
}

export function updateAIModeTranslationApiEndpoint(translationApiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TRANSLATION_API_ENDPOINT,
        translationApiEndpoint
    }
}

export function updateAIModeTranslationApiKey(translationApiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TRANSLATION_API_KEY,
        translationApiKey
    }
}

export function updateAIModeTranslationModel(translationModel: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TRANSLATION_MODEL,
        translationModel
    }
}

export function updateAIModeTempTranslationApiEndpoint(tempTranslationApiEndpoint: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_TRANSLATION_API_ENDPOINT,
        tempTranslationApiEndpoint
    }
}

export function updateAIModeTempTranslationApiKey(tempTranslationApiKey: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_TRANSLATION_API_KEY,
        tempTranslationApiKey
    }
}

export function updateAIModeTempTranslationModel(tempTranslationModel: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_TRANSLATION_MODEL,
        tempTranslationModel
    }
}

export function setAIModeShowErrorDialog(showErrorDialog: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_SHOW_ERROR_DIALOG,
        showErrorDialog
    }
}

export function setAIModeErrorDialogMessage(errorDialogMessage: string): AIModeActionTypes {
    return {
        type: SET_AI_MODE_ERROR_DIALOG_MESSAGE,
        errorDialogMessage
    }
}

export function setAIModeShowInputDialog(showInputDialog: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_SHOW_INPUT_DIALOG,
        showInputDialog
    }
}

export function setAIModeArticleCount(articleCount: number): AIModeActionTypes {
    return {
        type: SET_AI_MODE_ARTICLE_COUNT,
        articleCount
    }
}

export function setAIModeFilteredArticles(filteredArticles: RSSItem[]): AIModeActionTypes {
    return {
        type: SET_AI_MODE_FILTERED_ARTICLES,
        filteredArticles
    }
}

export function setAIModeClusters(clusters: ArticleCluster[]): AIModeActionTypes {
    return {
        type: SET_AI_MODE_CLUSTERS,
        clusters
    }
}

export function setAIModeTimeRangeHasArticles(timeRangeHasArticles: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_TIME_RANGE_HAS_ARTICLES,
        timeRangeHasArticles
    }
}

export function updateAIModeQueryProgress(queryProgress: QueryProgress | null): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_QUERY_PROGRESS,
        queryProgress
    }
}

export function updateAIModeStepStatus(
    stepId: string,
    status: QueryProgressStep['status'],
    message?: string,
    progress?: number
): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_STEP_STATUS,
        stepId,
        status,
        message,
        progress
    }
}

export function setAIModeShowResults(showResults: boolean): AIModeActionTypes {
    return {
        type: SET_AI_MODE_SHOW_RESULTS,
        showResults
    }
}

export function setAIModeTokenStatistics(tokenStatistics: TokenStatistics | null): AIModeActionTypes {
    return {
        type: SET_AI_MODE_TOKEN_STATISTICS,
        tokenStatistics
    }
}

export function addTokenUsageRecord(model: string, usage: TokenUsage): AIModeActionTypes {
    return {
        type: ADD_TOKEN_USAGE_RECORD,
        record: {
            model,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            timestamp: Date.now()
        }
    }
}

// ==================== Reducer ====================

// 初始化状态：从 electron-store 读取配置（与 localStorage 向后兼容）
function getInitialState(): AIModeState {
    // 优先从 electron-store 读取（持久化存储）
    let chatApiEndpoint = window.settings.getAIChatApiEndpoint()
    let chatApiKey = window.settings.getAIChatApiKey()
    let embeddingApiEndpoint = window.settings.getAIEmbeddingApiEndpoint()
    let embeddingApiKey = window.settings.getAIEmbeddingApiKey()
    let model = window.settings.getAIModel()
    let embeddingModel = window.settings.getAIEmbeddingModel()
    let embeddingQPS = window.settings.getAIEmbeddingQPS()
    let topk = window.settings.getAITopk()
    let translationApiEndpoint = window.settings.getAITranslationApiEndpoint()
    let translationApiKey = window.settings.getAITranslationApiKey()
    let translationModel = window.settings.getAITranslationModel()
    
    // 不再从 localStorage 迁移，直接使用 electron-store 的值
    
    // 从 localStorage 读取其他配置（recent topics 等）
    const savedRecentTopics = localStorage.getItem('ai-recent-topics')
    const recentTopics = savedRecentTopics ? JSON.parse(savedRecentTopics) : []
    
    // 不设置默认值，保持为空字符串
    // 只对数字字段设置默认值（如果未设置）
    if (embeddingQPS === undefined || embeddingQPS === null || embeddingQPS === 0) embeddingQPS = 30
    if (topk === undefined || topk === null || topk === 0) topk = 100

    // 向后兼容：保留旧字段
    const oldEndpoint = chatApiEndpoint
    const oldKey = chatApiKey
    
    const state = new AIModeState()
    // 保留旧字段用于向后兼容
    state.apiEndpoint = oldEndpoint
    state.apiKey = oldKey
    // 新字段
    state.chatApiEndpoint = chatApiEndpoint
    state.chatApiKey = chatApiKey
    state.embeddingApiEndpoint = embeddingApiEndpoint
    state.embeddingApiKey = embeddingApiKey
    state.model = model
    state.embeddingModel = embeddingModel
    state.embeddingQPS = embeddingQPS
    state.topk = topk
    state.recentTopics = recentTopics
    // 临时字段
    state.tempApiEndpoint = oldEndpoint
    state.tempApiKey = oldKey
    state.tempChatApiEndpoint = chatApiEndpoint
    state.tempChatApiKey = chatApiKey
    state.tempEmbeddingApiEndpoint = embeddingApiEndpoint
    state.tempEmbeddingApiKey = embeddingApiKey
    state.tempModel = model
    state.tempEmbeddingModel = embeddingModel
    state.tempEmbeddingQPS = embeddingQPS.toString()
    state.tempTopk = topk.toString()
    // 翻译配置不再存储在 aiMode state 中，已独立到 translation state
    state.translationApiEndpoint = ''
    state.translationApiKey = ''
    state.translationModel = ''
    state.tempTranslationApiEndpoint = ''
    state.tempTranslationApiKey = ''
    state.tempTranslationModel = ''
    
    // 从持久化存储读取token使用历史记录
    try {
        const history = window.settings.getTokenUsageHistory()
        state.tokenUsageHistory = Array.isArray(history) ? history : []
    } catch (error) {
        console.error('读取token使用历史记录失败:', error)
        state.tokenUsageHistory = []
    }
    
    return state
}

export function aiModeReducer(
    state: AIModeState = getInitialState(),
    action: AIModeActionTypes
): AIModeState {
    switch (action.type) {
        case UPDATE_AI_MODE_TIME_RANGE:
            return { ...state, timeRange: action.timeRange }

        case UPDATE_AI_MODE_TOPIC:
            return { ...state, topic: action.topic }

        case UPDATE_AI_MODE_TOPIC_INPUT:
            return { ...state, topicInput: action.topicInput }

        case SET_AI_MODE_IS_COMPOSING:
            return { ...state, isComposing: action.isComposing }

        case UPDATE_AI_MODE_RECENT_TOPICS:
            // 同步到 localStorage
            localStorage.setItem('ai-recent-topics', JSON.stringify(action.recentTopics))
            return { ...state, recentTopics: action.recentTopics }

        case SET_AI_MODE_SUMMARY:
            return { ...state, summary: action.summary }

        case SET_AI_MODE_LOADING:
            return { ...state, isLoading: action.isLoading }

        case SET_AI_MODE_CLUSTERING:
            return { ...state, isClustering: action.isClustering }

        case SET_AI_MODE_ERROR:
            return { ...state, error: action.error }

        case UPDATE_AI_MODE_API_ENDPOINT:
            // 同步到 localStorage
            localStorage.setItem('ai-api-endpoint', action.apiEndpoint)
            return { ...state, apiEndpoint: action.apiEndpoint }

        case UPDATE_AI_MODE_API_KEY:
            // 同步到 localStorage
            localStorage.setItem('ai-api-key', action.apiKey)
            return { ...state, apiKey: action.apiKey }

        case UPDATE_AI_MODE_MODEL:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAIModel(action.model)
                console.log('已保存 model 到 electron-store:', action.model || '空')
            } catch (error) {
                console.error('保存 model 失败:', error)
            }
            return { ...state, model: action.model }

        case UPDATE_AI_MODE_EMBEDDING_MODEL:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAIEmbeddingModel(action.embeddingModel)
                console.log('已保存 embeddingModel 到 electron-store:', action.embeddingModel || '空')
            } catch (error) {
                console.error('保存 embeddingModel 失败:', error)
            }
            return { ...state, embeddingModel: action.embeddingModel }

        case UPDATE_AI_MODE_EMBEDDING_QPS:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAIEmbeddingQPS(action.embeddingQPS)
                console.log('已保存 embeddingQPS 到 electron-store:', action.embeddingQPS)
            } catch (error) {
                console.error('保存 embeddingQPS 失败:', error)
            }
            return { ...state, embeddingQPS: action.embeddingQPS }

        case UPDATE_AI_MODE_TOPK:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAITopk(action.topk)
                console.log('已保存 topk 到 electron-store:', action.topk)
            } catch (error) {
                console.error('保存 topk 失败:', error)
            }
            return { ...state, topk: action.topk }

        case SET_AI_MODE_SHOW_CONFIG_PANEL:
            return { ...state, showConfigPanel: action.showConfigPanel }

        case UPDATE_AI_MODE_TEMP_API_ENDPOINT:
            return { ...state, tempApiEndpoint: action.tempApiEndpoint }

        case UPDATE_AI_MODE_TEMP_API_KEY:
            return { ...state, tempApiKey: action.tempApiKey }

        case UPDATE_AI_MODE_TEMP_MODEL:
            return { ...state, tempModel: action.tempModel }

        case UPDATE_AI_MODE_TEMP_EMBEDDING_MODEL:
            return { ...state, tempEmbeddingModel: action.tempEmbeddingModel }

        case UPDATE_AI_MODE_TEMP_EMBEDDING_QPS:
            return { ...state, tempEmbeddingQPS: action.tempEmbeddingQPS }

        case UPDATE_AI_MODE_TEMP_TOPK:
            return { ...state, tempTopk: action.tempTopk }

        case UPDATE_AI_MODE_CHAT_API_ENDPOINT:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAIChatApiEndpoint(action.chatApiEndpoint)
                console.log('已保存 chatApiEndpoint 到 electron-store:', action.chatApiEndpoint ? '已设置' : '空')
            } catch (error) {
                console.error('保存 chatApiEndpoint 失败:', error)
            }
            return { ...state, chatApiEndpoint: action.chatApiEndpoint }

        case UPDATE_AI_MODE_CHAT_API_KEY:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAIChatApiKey(action.chatApiKey)
                console.log('已保存 chatApiKey 到 electron-store:', action.chatApiKey ? '已设置' : '空')
            } catch (error) {
                console.error('保存 chatApiKey 失败:', error)
            }
            return { ...state, chatApiKey: action.chatApiKey }

        case UPDATE_AI_MODE_EMBEDDING_API_ENDPOINT:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAIEmbeddingApiEndpoint(action.embeddingApiEndpoint)
                console.log('已保存 embeddingApiEndpoint 到 electron-store:', action.embeddingApiEndpoint ? '已设置' : '空')
            } catch (error) {
                console.error('保存 embeddingApiEndpoint 失败:', error)
            }
            return { ...state, embeddingApiEndpoint: action.embeddingApiEndpoint }

        case UPDATE_AI_MODE_EMBEDDING_API_KEY:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAIEmbeddingApiKey(action.embeddingApiKey)
                console.log('已保存 embeddingApiKey 到 electron-store:', action.embeddingApiKey ? '已设置' : '空')
            } catch (error) {
                console.error('保存 embeddingApiKey 失败:', error)
            }
            return { ...state, embeddingApiKey: action.embeddingApiKey }

        case UPDATE_AI_MODE_TEMP_CHAT_API_ENDPOINT:
            return { ...state, tempChatApiEndpoint: action.tempChatApiEndpoint }

        case UPDATE_AI_MODE_TEMP_CHAT_API_KEY:
            return { ...state, tempChatApiKey: action.tempChatApiKey }

        case UPDATE_AI_MODE_TEMP_EMBEDDING_API_ENDPOINT:
            return { ...state, tempEmbeddingApiEndpoint: action.tempEmbeddingApiEndpoint }

        case UPDATE_AI_MODE_TEMP_EMBEDDING_API_KEY:
            return { ...state, tempEmbeddingApiKey: action.tempEmbeddingApiKey }

        case UPDATE_AI_MODE_TRANSLATION_API_ENDPOINT:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAITranslationApiEndpoint(action.translationApiEndpoint)
                console.log('已保存 translationApiEndpoint 到 electron-store:', action.translationApiEndpoint || '空')
            } catch (error) {
                console.error('保存 translationApiEndpoint 失败:', error)
            }
            return { ...state, translationApiEndpoint: action.translationApiEndpoint }

        case UPDATE_AI_MODE_TRANSLATION_API_KEY:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAITranslationApiKey(action.translationApiKey)
                console.log('已保存 translationApiKey 到 electron-store:', action.translationApiKey ? '已设置' : '空')
            } catch (error) {
                console.error('保存 translationApiKey 失败:', error)
            }
            return { ...state, translationApiKey: action.translationApiKey }

        case UPDATE_AI_MODE_TRANSLATION_MODEL:
            // 同步到 electron-store（持久化存储）
            try {
                window.settings.setAITranslationModel(action.translationModel)
                console.log('已保存 translationModel 到 electron-store:', action.translationModel || '空')
            } catch (error) {
                console.error('保存 translationModel 失败:', error)
            }
            return { ...state, translationModel: action.translationModel }

        case UPDATE_AI_MODE_TEMP_TRANSLATION_API_ENDPOINT:
            return { ...state, tempTranslationApiEndpoint: action.tempTranslationApiEndpoint }

        case UPDATE_AI_MODE_TEMP_TRANSLATION_API_KEY:
            return { ...state, tempTranslationApiKey: action.tempTranslationApiKey }

        case UPDATE_AI_MODE_TEMP_TRANSLATION_MODEL:
            return { ...state, tempTranslationModel: action.tempTranslationModel }

        case SET_AI_MODE_SHOW_ERROR_DIALOG:
            return { ...state, showErrorDialog: action.showErrorDialog }

        case SET_AI_MODE_ERROR_DIALOG_MESSAGE:
            return { ...state, errorDialogMessage: action.errorDialogMessage }

        case SET_AI_MODE_SHOW_INPUT_DIALOG:
            return { ...state, showInputDialog: action.showInputDialog }

        case SET_AI_MODE_ARTICLE_COUNT:
            return { ...state, articleCount: action.articleCount }

        case SET_AI_MODE_FILTERED_ARTICLES:
            return { ...state, filteredArticles: action.filteredArticles }

        case SET_AI_MODE_CLUSTERS:
            return { ...state, clusters: action.clusters }

        case SET_AI_MODE_TIME_RANGE_HAS_ARTICLES:
            return { ...state, timeRangeHasArticles: action.timeRangeHasArticles }

        case UPDATE_AI_MODE_QUERY_PROGRESS:
            return { ...state, queryProgress: action.queryProgress }

        case UPDATE_AI_MODE_STEP_STATUS: {
            if (!state.queryProgress) return state

            // 先更新步骤状态，如果步骤不存在则动态添加
            let steps = state.queryProgress.steps
            const existingStepIndex = steps.findIndex(step => step.id === action.stepId)
            
            if (existingStepIndex >= 0) {
                // 步骤存在，更新它
                steps = steps.map(step => {
                    if (step.id === action.stepId) {
                        return { 
                            ...step, 
                            status: action.status, 
                            message: action.message !== undefined ? action.message : step.message,  // 如果 message 是 undefined，保留旧消息
                            progress: action.progress !== undefined ? action.progress : step.progress  // 如果 progress 是 undefined，保留旧进度
                        }
                    }
                    return step
                })
            } else {
                // 步骤不存在，动态添加（根据步骤ID确定标题）
                const stepTitles: { [key: string]: string } = {
                    'intent-recognition': intl.get("settings.aiMode.progress.steps.intentRecognition"),
                    'intent-recognition-topic': intl.get("settings.aiMode.progress.steps.intentRecognitionTopic"),
                    'intent-recognition-classification': intl.get("settings.aiMode.progress.steps.intentRecognitionClassification"),
                    'hyde-generation': intl.get("settings.aiMode.progress.steps.hydeGeneration"),
                    'vector-retrieval': intl.get("settings.aiMode.progress.steps.vectorRetrieval"),
                    'calculate-similarity': intl.get("settings.aiMode.progress.steps.calculateSimilarity"),
                    'llm-refine': intl.get("settings.aiMode.progress.steps.llmRefine")
                }
                const stepTitle = stepTitles[action.stepId] || action.stepId
                const newStep: QueryProgressStep = {
                    id: action.stepId,
                    title: stepTitle,
                    status: action.status,
                    message: action.message,
                    progress: action.progress,
                    visible: false
                }
                steps = [...steps, newStep]
            }

            // 然后计算可见性（基于更新后的状态）
            const stepsWithVisibility = steps.map((step, index) => {
                const isFirstStep = index === 0
                const prevStep = index > 0 ? steps[index - 1] : null

                // 第一步总是可见
                if (isFirstStep) {
                    return { ...step, visible: true }
                }

                // 如果步骤状态是 in_progress、completed 或 error，则可见
                if (step.status === 'in_progress' || step.status === 'completed' || step.status === 'error') {
                    return { ...step, visible: true }
                }

                // 如果前一步是 completed，则下一步可见（即使还是 pending）
                if (prevStep && prevStep.status === 'completed') {
                    return { ...step, visible: true }
                }

                // 如果步骤已经可见，保持可见
                if (step.visible === true) {
                    return step
                }

                return step
            })

            const currentStepIndex = stepsWithVisibility.findIndex(s => s.status === 'in_progress')
            const currentMessage = stepsWithVisibility.find(s => s.status === 'in_progress')?.message ||
                                   stepsWithVisibility.find(s => s.status === 'completed')?.message ||
                                   state.queryProgress.currentMessage

            // 计算总体进度
            const totalSteps = stepsWithVisibility.length
            const completedSteps = stepsWithVisibility.filter(s => s.status === 'completed').length
            const currentStep = stepsWithVisibility[currentStepIndex >= 0 ? currentStepIndex : state.queryProgress.currentStepIndex]
            const stepProgress = currentStep?.progress || 0
            const baseProgress = (completedSteps / totalSteps) * 100
            const currentStepWeight = 1 / totalSteps
            const currentStepProgress = (stepProgress / 100) * currentStepWeight * 100
            const overallProgress = Math.min(100, baseProgress + currentStepProgress)

            return {
                ...state,
                queryProgress: {
                    ...state.queryProgress,
                    steps: stepsWithVisibility,
                    currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : state.queryProgress.currentStepIndex,
                    currentMessage,
                    overallProgress
                }
            }
        }

        case SET_AI_MODE_SHOW_RESULTS:
            return { ...state, showResults: action.showResults }

        case SET_AI_MODE_TOKEN_STATISTICS:
            return { ...state, tokenStatistics: action.tokenStatistics }

        case ADD_TOKEN_USAGE_RECORD:
            const newHistory = [...state.tokenUsageHistory, action.record]
            // 持久化到electron-store
            try {
                window.settings.setTokenUsageHistory(newHistory)
            } catch (error) {
                console.error('保存token使用历史记录失败:', error)
            }
            return { ...state, tokenUsageHistory: newHistory }

        default:
            return state
    }
}

