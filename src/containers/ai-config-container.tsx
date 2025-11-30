import { connect } from "react-redux"
import { createSelector } from "reselect"
import intl from "react-intl-universal"
import { RootState } from "../scripts/reducer"
import AIConfig from "../components/ai-config"
import { clearArticleEmbeddings } from "../scripts/consolidate"
import {
    updateAIModeTempChatApiEndpoint,
    updateAIModeTempChatApiKey,
    updateAIModeTempEmbeddingApiEndpoint,
    updateAIModeTempEmbeddingApiKey,
    updateAIModeTempModel,
    updateAIModeTempEmbeddingModel,
    updateAIModeTempEmbeddingQPS,
    updateAIModeTempTopk,
    updateAIModeChatApiEndpoint,
    updateAIModeChatApiKey,
    updateAIModeEmbeddingApiEndpoint,
    updateAIModeEmbeddingApiKey,
    updateAIModeModel,
    updateAIModeEmbeddingModel,
    updateAIModeEmbeddingQPS,
    updateAIModeTopk,
} from "../scripts/models/ai-mode"
import {
    updateTranslationTempApiEndpoint,
    updateTranslationTempApiKey,
    updateTranslationTempModel,
    updateTranslationApiEndpoint,
    updateTranslationApiKey,
    updateTranslationModel,
} from "../scripts/models/translation"

const getAIMode = (state: RootState) => state.aiMode
const getTranslation = (state: RootState) => state.translation

const mapStateToProps = createSelector([getAIMode, getTranslation], (aiMode, translation) => ({
    display: aiMode.showConfigPanel,
    tempChatApiEndpoint: aiMode.tempChatApiEndpoint,
    tempChatApiKey: aiMode.tempChatApiKey,
    tempEmbeddingApiEndpoint: aiMode.tempEmbeddingApiEndpoint,
    tempEmbeddingApiKey: aiMode.tempEmbeddingApiKey,
    tempModel: aiMode.tempModel,
    tempEmbeddingModel: aiMode.tempEmbeddingModel,
    tempEmbeddingQPS: aiMode.tempEmbeddingQPS,
    tempTopk: aiMode.tempTopk,
    // 翻译配置从独立的 translation state 读取
    tempTranslationApiEndpoint: translation.tempTranslationApiEndpoint,
    tempTranslationApiKey: translation.tempTranslationApiKey,
    tempTranslationModel: translation.tempTranslationModel,
    // 需要保存的值，用于取消时恢复
    chatApiEndpoint: aiMode.chatApiEndpoint,
    chatApiKey: aiMode.chatApiKey,
    embeddingApiEndpoint: aiMode.embeddingApiEndpoint,
    embeddingApiKey: aiMode.embeddingApiKey,
    model: aiMode.model,
    embeddingModel: aiMode.embeddingModel,
    embeddingQPS: aiMode.embeddingQPS,
    topk: aiMode.topk,
    translationApiEndpoint: translation.translationApiEndpoint,
    translationApiKey: translation.translationApiKey,
    translationModel: translation.translationModel,
}))

const mapDispatchToProps = dispatch => {
    return {
        onChatApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempChatApiEndpoint(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateAIModeChatApiEndpoint(value))
        },
        onChatApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempChatApiKey(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateAIModeChatApiKey(value))
        },
        onEmbeddingApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempEmbeddingApiEndpoint(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateAIModeEmbeddingApiEndpoint(value))
        },
        onEmbeddingApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempEmbeddingApiKey(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateAIModeEmbeddingApiKey(value))
        },
        onModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempModel(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateAIModeModel(value))
        },
        onEmbeddingModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempEmbeddingModel(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateAIModeEmbeddingModel(value))
        },
        onEmbeddingQPSChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempEmbeddingQPS(value))
            // 实时保存到 electron-store（像应用偏好那样）
            const qps = parseInt(value, 10)
            if (!isNaN(qps) && qps > 0 && Number.isInteger(qps)) {
                dispatch(updateAIModeEmbeddingQPS(qps))
            }
        },
        onTopkChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempTopk(value))
            // 实时保存到 electron-store（像应用偏好那样）
            const topk = parseInt(value, 10)
            if (!isNaN(topk) && topk > 0 && Number.isInteger(topk)) {
                dispatch(updateAIModeTopk(topk))
            }
        },
        onTranslationApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateTranslationTempApiEndpoint(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateTranslationApiEndpoint(value))
        },
        onTranslationApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateTranslationTempApiKey(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateTranslationApiKey(value))
        },
        onTranslationModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateTranslationTempModel(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateTranslationModel(value))
        },
        onClearEmbeddings: async () => {
            await clearArticleEmbeddings()
        },
    }
}

const AIConfigContainer = connect(mapStateToProps, mapDispatchToProps)(AIConfig)
export default AIConfigContainer

