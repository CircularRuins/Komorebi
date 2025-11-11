import { AppThunk } from "../utils"
import { RSSItem } from "./item"

// ==================== 共享类型定义 ====================

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
    visible?: boolean  // 是否可见（新增）
}

// 查询进度类型
export type QueryProgress = {
    steps: QueryProgressStep[]
    currentStepIndex: number
    overallProgress: number  // 总体进度百分比（0-100）
    currentMessage: string  // 当前步骤的详细信息
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
    apiEndpoint: string = ''
    apiKey: string = ''
    model: string = ''
    embeddingModel: string = ''
    similarityThreshold: number = 0.7
    showConfigPanel: boolean = false
    tempApiEndpoint: string = ''
    tempApiKey: string = ''
    tempModel: string = ''
    tempEmbeddingModel: string = ''
    tempSimilarityThreshold: string = '0.7'
    showErrorDialog: boolean = false
    errorDialogMessage: string = ''
    articleCount: number = 0
    filteredArticles: RSSItem[] = []
    clusters: ArticleCluster[] = []
    queryProgress: QueryProgress | null = null
    showResults: boolean = false
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
export const UPDATE_AI_MODE_SIMILARITY_THRESHOLD = "UPDATE_AI_MODE_SIMILARITY_THRESHOLD"
export const SET_AI_MODE_SHOW_CONFIG_PANEL = "SET_AI_MODE_SHOW_CONFIG_PANEL"
export const UPDATE_AI_MODE_TEMP_API_ENDPOINT = "UPDATE_AI_MODE_TEMP_API_ENDPOINT"
export const UPDATE_AI_MODE_TEMP_API_KEY = "UPDATE_AI_MODE_TEMP_API_KEY"
export const UPDATE_AI_MODE_TEMP_MODEL = "UPDATE_AI_MODE_TEMP_MODEL"
export const UPDATE_AI_MODE_TEMP_EMBEDDING_MODEL = "UPDATE_AI_MODE_TEMP_EMBEDDING_MODEL"
export const UPDATE_AI_MODE_TEMP_SIMILARITY_THRESHOLD = "UPDATE_AI_MODE_TEMP_SIMILARITY_THRESHOLD"
export const SET_AI_MODE_SHOW_ERROR_DIALOG = "SET_AI_MODE_SHOW_ERROR_DIALOG"
export const SET_AI_MODE_ERROR_DIALOG_MESSAGE = "SET_AI_MODE_ERROR_DIALOG_MESSAGE"
export const SET_AI_MODE_ARTICLE_COUNT = "SET_AI_MODE_ARTICLE_COUNT"
export const SET_AI_MODE_FILTERED_ARTICLES = "SET_AI_MODE_FILTERED_ARTICLES"
export const SET_AI_MODE_CLUSTERS = "SET_AI_MODE_CLUSTERS"
export const UPDATE_AI_MODE_QUERY_PROGRESS = "UPDATE_AI_MODE_QUERY_PROGRESS"
export const UPDATE_AI_MODE_STEP_STATUS = "UPDATE_AI_MODE_STEP_STATUS"
export const SET_AI_MODE_SHOW_RESULTS = "SET_AI_MODE_SHOW_RESULTS"
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

export interface UpdateAIModeSimilarityThresholdAction {
    type: typeof UPDATE_AI_MODE_SIMILARITY_THRESHOLD
    similarityThreshold: number
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

export interface UpdateAIModeTempSimilarityThresholdAction {
    type: typeof UPDATE_AI_MODE_TEMP_SIMILARITY_THRESHOLD
    tempSimilarityThreshold: string
}

export interface SetAIModeShowErrorDialogAction {
    type: typeof SET_AI_MODE_SHOW_ERROR_DIALOG
    showErrorDialog: boolean
}

export interface SetAIModeErrorDialogMessageAction {
    type: typeof SET_AI_MODE_ERROR_DIALOG_MESSAGE
    errorDialogMessage: string
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
    | UpdateAIModeSimilarityThresholdAction
    | SetAIModeShowConfigPanelAction
    | UpdateAIModeTempApiEndpointAction
    | UpdateAIModeTempApiKeyAction
    | UpdateAIModeTempModelAction
    | UpdateAIModeTempEmbeddingModelAction
    | UpdateAIModeTempSimilarityThresholdAction
    | SetAIModeShowErrorDialogAction
    | SetAIModeErrorDialogMessageAction
    | SetAIModeArticleCountAction
    | SetAIModeFilteredArticlesAction
    | SetAIModeClustersAction
    | UpdateAIModeQueryProgressAction
    | UpdateAIModeStepStatusAction
    | SetAIModeShowResultsAction
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

export function updateAIModeSimilarityThreshold(similarityThreshold: number): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_SIMILARITY_THRESHOLD,
        similarityThreshold
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

export function updateAIModeTempSimilarityThreshold(tempSimilarityThreshold: string): AIModeActionTypes {
    return {
        type: UPDATE_AI_MODE_TEMP_SIMILARITY_THRESHOLD,
        tempSimilarityThreshold
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

// ==================== Reducer ====================

// 初始化状态：从 localStorage 读取配置
function getInitialState(): AIModeState {
    const savedEndpoint = localStorage.getItem('ai-api-endpoint') || 'https://api.openai.com/v1/chat/completions'
    const savedKey = localStorage.getItem('ai-api-key') || ''
    const savedModel = localStorage.getItem('ai-model') || ''
    const savedEmbeddingModel = localStorage.getItem('ai-embedding-model') || 'text-embedding-ada-002'
    const savedSimilarityThreshold = parseFloat(localStorage.getItem('ai-similarity-threshold') || '0.7')
    const savedRecentTopics = localStorage.getItem('ai-recent-topics')
    const recentTopics = savedRecentTopics ? JSON.parse(savedRecentTopics) : []

    const state = new AIModeState()
    state.apiEndpoint = savedEndpoint
    state.apiKey = savedKey
    state.model = savedModel
    state.embeddingModel = savedEmbeddingModel
    state.similarityThreshold = savedSimilarityThreshold
    state.recentTopics = recentTopics
    state.tempApiEndpoint = savedEndpoint
    state.tempApiKey = savedKey
    state.tempModel = savedModel
    state.tempEmbeddingModel = savedEmbeddingModel
    state.tempSimilarityThreshold = savedSimilarityThreshold.toString()
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
            // 同步到 localStorage
            localStorage.setItem('ai-model', action.model)
            return { ...state, model: action.model }

        case UPDATE_AI_MODE_EMBEDDING_MODEL:
            // 同步到 localStorage
            localStorage.setItem('ai-embedding-model', action.embeddingModel)
            return { ...state, embeddingModel: action.embeddingModel }

        case UPDATE_AI_MODE_SIMILARITY_THRESHOLD:
            // 同步到 localStorage
            localStorage.setItem('ai-similarity-threshold', action.similarityThreshold.toString())
            return { ...state, similarityThreshold: action.similarityThreshold }

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

        case UPDATE_AI_MODE_TEMP_SIMILARITY_THRESHOLD:
            return { ...state, tempSimilarityThreshold: action.tempSimilarityThreshold }

        case SET_AI_MODE_SHOW_ERROR_DIALOG:
            return { ...state, showErrorDialog: action.showErrorDialog }

        case SET_AI_MODE_ERROR_DIALOG_MESSAGE:
            return { ...state, errorDialogMessage: action.errorDialogMessage }

        case SET_AI_MODE_ARTICLE_COUNT:
            return { ...state, articleCount: action.articleCount }

        case SET_AI_MODE_FILTERED_ARTICLES:
            return { ...state, filteredArticles: action.filteredArticles }

        case SET_AI_MODE_CLUSTERS:
            return { ...state, clusters: action.clusters }

        case UPDATE_AI_MODE_QUERY_PROGRESS:
            return { ...state, queryProgress: action.queryProgress }

        case UPDATE_AI_MODE_STEP_STATUS: {
            if (!state.queryProgress) return state

            // 先更新步骤状态
            const steps = state.queryProgress.steps.map(step => {
                if (step.id === action.stepId) {
                    return { ...step, status: action.status, message: action.message, progress: action.progress }
                }
                return step
            })

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

        default:
            return state
    }
}

