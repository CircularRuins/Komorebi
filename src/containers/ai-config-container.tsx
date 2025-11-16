import { connect } from "react-redux"
import { createSelector } from "reselect"
import intl from "react-intl-universal"
import { RootState } from "../scripts/reducer"
import AIConfig from "../components/ai-config"
import {
    setAIModeShowConfigPanel,
    updateAIModeTempChatApiEndpoint,
    updateAIModeTempChatApiKey,
    updateAIModeTempEmbeddingApiEndpoint,
    updateAIModeTempEmbeddingApiKey,
    updateAIModeTempModel,
    updateAIModeTempEmbeddingModel,
    updateAIModeTempTopk,
    updateAIModeChatApiEndpoint,
    updateAIModeChatApiKey,
    updateAIModeEmbeddingApiEndpoint,
    updateAIModeEmbeddingApiKey,
    updateAIModeModel,
    updateAIModeEmbeddingModel,
    updateAIModeTopk,
    setAIModeShowErrorDialog,
    setAIModeErrorDialogMessage,
} from "../scripts/models/ai-mode"

const getAIMode = (state: RootState) => state.aiMode

const mapStateToProps = createSelector([getAIMode], aiMode => ({
    display: aiMode.showConfigPanel,
    tempChatApiEndpoint: aiMode.tempChatApiEndpoint,
    tempChatApiKey: aiMode.tempChatApiKey,
    tempEmbeddingApiEndpoint: aiMode.tempEmbeddingApiEndpoint,
    tempEmbeddingApiKey: aiMode.tempEmbeddingApiKey,
    tempModel: aiMode.tempModel,
    tempEmbeddingModel: aiMode.tempEmbeddingModel,
    tempTopk: aiMode.tempTopk,
    // 需要保存的值，用于取消时恢复
    chatApiEndpoint: aiMode.chatApiEndpoint,
    chatApiKey: aiMode.chatApiKey,
    embeddingApiEndpoint: aiMode.embeddingApiEndpoint,
    embeddingApiKey: aiMode.embeddingApiKey,
    model: aiMode.model,
    embeddingModel: aiMode.embeddingModel,
    topk: aiMode.topk,
}))

const mapDispatchToProps = dispatch => {
    return {
        onChatApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempChatApiEndpoint(newValue || ""))
        },
        onChatApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempChatApiKey(newValue || ""))
        },
        onEmbeddingApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempEmbeddingApiEndpoint(newValue || ""))
        },
        onEmbeddingApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempEmbeddingApiKey(newValue || ""))
        },
        onModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempModel(newValue || ""))
        },
        onEmbeddingModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempEmbeddingModel(newValue || ""))
        },
        onTopkChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempTopk(newValue || ""))
        },
        onConfirm: (tempChatApiEndpoint: string, tempChatApiKey: string, tempEmbeddingApiEndpoint: string, tempEmbeddingApiKey: string, tempModel: string, tempEmbeddingModel: string, tempTopk: string) => {
            // 验证topk
            const topk = parseInt(tempTopk, 10)
            if (isNaN(topk) || topk < 1 || !Number.isInteger(topk)) {
                dispatch(setAIModeShowErrorDialog(true))
                dispatch(setAIModeErrorDialogMessage(intl.get("settings.aiMode.errors.topkInvalid")))
                return
            }
            
            // 保存到 Redux（localStorage 同步在 reducer 中处理）
            dispatch(updateAIModeChatApiEndpoint(tempChatApiEndpoint))
            dispatch(updateAIModeChatApiKey(tempChatApiKey))
            dispatch(updateAIModeEmbeddingApiEndpoint(tempEmbeddingApiEndpoint))
            dispatch(updateAIModeEmbeddingApiKey(tempEmbeddingApiKey))
            dispatch(updateAIModeModel(tempModel))
            dispatch(updateAIModeEmbeddingModel(tempEmbeddingModel))
            dispatch(updateAIModeTopk(topk))
            dispatch(setAIModeShowConfigPanel(false))
        },
        onCancel: (chatApiEndpoint: string, chatApiKey: string, embeddingApiEndpoint: string, embeddingApiKey: string, model: string, embeddingModel: string, topk: number) => {
            // 恢复临时状态为已保存的值
            dispatch(updateAIModeTempChatApiEndpoint(chatApiEndpoint))
            dispatch(updateAIModeTempChatApiKey(chatApiKey))
            dispatch(updateAIModeTempEmbeddingApiEndpoint(embeddingApiEndpoint))
            dispatch(updateAIModeTempEmbeddingApiKey(embeddingApiKey))
            dispatch(updateAIModeTempModel(model))
            dispatch(updateAIModeTempEmbeddingModel(embeddingModel))
            dispatch(updateAIModeTempTopk(topk.toString()))
            dispatch(setAIModeShowConfigPanel(false))
        },
    }
}

const AIConfigContainer = connect(mapStateToProps, mapDispatchToProps)(AIConfig)
export default AIConfigContainer

