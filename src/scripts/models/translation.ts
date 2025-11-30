// ==================== 类型定义 ====================

export class TranslationState {
    translationApiEndpoint: string = ''
    translationApiKey: string = ''
    translationModel: string = ''
    showConfigPanel: boolean = false
    tempTranslationApiEndpoint: string = ''
    tempTranslationApiKey: string = ''
    tempTranslationModel: string = ''
}

// ==================== Action Types ====================

export const UPDATE_TRANSLATION_API_ENDPOINT = "UPDATE_TRANSLATION_API_ENDPOINT"
export const UPDATE_TRANSLATION_API_KEY = "UPDATE_TRANSLATION_API_KEY"
export const UPDATE_TRANSLATION_MODEL = "UPDATE_TRANSLATION_MODEL"
export const SET_TRANSLATION_SHOW_CONFIG_PANEL = "SET_TRANSLATION_SHOW_CONFIG_PANEL"
export const UPDATE_TRANSLATION_TEMP_API_ENDPOINT = "UPDATE_TRANSLATION_TEMP_API_ENDPOINT"
export const UPDATE_TRANSLATION_TEMP_API_KEY = "UPDATE_TRANSLATION_TEMP_API_KEY"
export const UPDATE_TRANSLATION_TEMP_MODEL = "UPDATE_TRANSLATION_TEMP_MODEL"
export const INIT_TRANSLATION = "INIT_TRANSLATION"

// ==================== Action Interfaces ====================

export interface UpdateTranslationApiEndpointAction {
    type: typeof UPDATE_TRANSLATION_API_ENDPOINT
    translationApiEndpoint: string
}

export interface UpdateTranslationApiKeyAction {
    type: typeof UPDATE_TRANSLATION_API_KEY
    translationApiKey: string
}

export interface UpdateTranslationModelAction {
    type: typeof UPDATE_TRANSLATION_MODEL
    translationModel: string
}

export interface SetTranslationShowConfigPanelAction {
    type: typeof SET_TRANSLATION_SHOW_CONFIG_PANEL
    showConfigPanel: boolean
}

export interface UpdateTranslationTempApiEndpointAction {
    type: typeof UPDATE_TRANSLATION_TEMP_API_ENDPOINT
    tempTranslationApiEndpoint: string
}

export interface UpdateTranslationTempApiKeyAction {
    type: typeof UPDATE_TRANSLATION_TEMP_API_KEY
    tempTranslationApiKey: string
}

export interface UpdateTranslationTempModelAction {
    type: typeof UPDATE_TRANSLATION_TEMP_MODEL
    tempTranslationModel: string
}

export interface InitTranslationAction {
    type: typeof INIT_TRANSLATION
}

export type TranslationActionTypes =
    | UpdateTranslationApiEndpointAction
    | UpdateTranslationApiKeyAction
    | UpdateTranslationModelAction
    | SetTranslationShowConfigPanelAction
    | UpdateTranslationTempApiEndpointAction
    | UpdateTranslationTempApiKeyAction
    | UpdateTranslationTempModelAction
    | InitTranslationAction

// ==================== Action Creator Functions ====================

export function updateTranslationApiEndpoint(translationApiEndpoint: string): TranslationActionTypes {
    return {
        type: UPDATE_TRANSLATION_API_ENDPOINT,
        translationApiEndpoint
    }
}

export function updateTranslationApiKey(translationApiKey: string): TranslationActionTypes {
    return {
        type: UPDATE_TRANSLATION_API_KEY,
        translationApiKey
    }
}

export function updateTranslationModel(translationModel: string): TranslationActionTypes {
    return {
        type: UPDATE_TRANSLATION_MODEL,
        translationModel
    }
}

export function setTranslationShowConfigPanel(showConfigPanel: boolean): TranslationActionTypes {
    return {
        type: SET_TRANSLATION_SHOW_CONFIG_PANEL,
        showConfigPanel
    }
}

export function updateTranslationTempApiEndpoint(tempTranslationApiEndpoint: string): TranslationActionTypes {
    return {
        type: UPDATE_TRANSLATION_TEMP_API_ENDPOINT,
        tempTranslationApiEndpoint
    }
}

export function updateTranslationTempApiKey(tempTranslationApiKey: string): TranslationActionTypes {
    return {
        type: UPDATE_TRANSLATION_TEMP_API_KEY,
        tempTranslationApiKey
    }
}

export function updateTranslationTempModel(tempTranslationModel: string): TranslationActionTypes {
    return {
        type: UPDATE_TRANSLATION_TEMP_MODEL,
        tempTranslationModel
    }
}

export function initTranslation(): TranslationActionTypes {
    return {
        type: INIT_TRANSLATION
    }
}

// ==================== Reducer ====================

// 初始化状态：从 electron-store 读取配置
function getInitialState(): TranslationState {
    // 从 electron-store 读取（持久化存储）
    const translationApiEndpoint = window.settings.getAITranslationApiEndpoint()
    const translationApiKey = window.settings.getAITranslationApiKey()
    const translationModel = window.settings.getAITranslationModel()

    const state = new TranslationState()
    state.translationApiEndpoint = translationApiEndpoint
    state.translationApiKey = translationApiKey
    state.translationModel = translationModel
    state.tempTranslationApiEndpoint = translationApiEndpoint
    state.tempTranslationApiKey = translationApiKey
    state.tempTranslationModel = translationModel
    return state
}

export function translationReducer(
    state: TranslationState = getInitialState(),
    action: TranslationActionTypes
): TranslationState {
    switch (action.type) {
        case UPDATE_TRANSLATION_API_ENDPOINT:
            // 同步到 electron-store
            window.settings.setAITranslationApiEndpoint(action.translationApiEndpoint)
            return { ...state, translationApiEndpoint: action.translationApiEndpoint }

        case UPDATE_TRANSLATION_API_KEY:
            // 同步到 electron-store
            window.settings.setAITranslationApiKey(action.translationApiKey)
            return { ...state, translationApiKey: action.translationApiKey }

        case UPDATE_TRANSLATION_MODEL:
            // 同步到 electron-store
            window.settings.setAITranslationModel(action.translationModel)
            return { ...state, translationModel: action.translationModel }

        case SET_TRANSLATION_SHOW_CONFIG_PANEL:
            return { ...state, showConfigPanel: action.showConfigPanel }

        case UPDATE_TRANSLATION_TEMP_API_ENDPOINT:
            return { ...state, tempTranslationApiEndpoint: action.tempTranslationApiEndpoint }

        case UPDATE_TRANSLATION_TEMP_API_KEY:
            return { ...state, tempTranslationApiKey: action.tempTranslationApiKey }

        case UPDATE_TRANSLATION_TEMP_MODEL:
            return { ...state, tempTranslationModel: action.tempTranslationModel }

        case INIT_TRANSLATION:
            return getInitialState()

        default:
            return state
    }
}

