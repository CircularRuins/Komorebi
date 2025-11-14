import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import AIConfig from "../components/ai-config"
import {
    setAIModeShowConfigPanel,
    updateAIModeTempApiEndpoint,
    updateAIModeTempApiKey,
    updateAIModeTempModel,
    updateAIModeTempEmbeddingModel,
    updateAIModeTempTopk,
    updateAIModeApiEndpoint,
    updateAIModeApiKey,
    updateAIModeModel,
    updateAIModeEmbeddingModel,
    updateAIModeTopk,
    setAIModeShowErrorDialog,
    setAIModeErrorDialogMessage,
} from "../scripts/models/ai-mode"

const getAIMode = (state: RootState) => state.aiMode

const mapStateToProps = createSelector([getAIMode], aiMode => ({
    display: aiMode.showConfigPanel,
    tempApiEndpoint: aiMode.tempApiEndpoint,
    tempApiKey: aiMode.tempApiKey,
    tempModel: aiMode.tempModel,
    tempEmbeddingModel: aiMode.tempEmbeddingModel,
    tempTopk: aiMode.tempTopk,
    // 需要保存的值，用于取消时恢复
    apiEndpoint: aiMode.apiEndpoint,
    apiKey: aiMode.apiKey,
    model: aiMode.model,
    embeddingModel: aiMode.embeddingModel,
    topk: aiMode.topk,
}))

const mapDispatchToProps = dispatch => {
    return {
        onApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempApiEndpoint(newValue || ""))
        },
        onApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempApiKey(newValue || ""))
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
        onConfirm: (tempApiEndpoint: string, tempApiKey: string, tempModel: string, tempEmbeddingModel: string, tempTopk: string) => {
            // 验证topk
            const topk = parseInt(tempTopk, 10)
            if (isNaN(topk) || topk < 1 || !Number.isInteger(topk)) {
                dispatch(setAIModeShowErrorDialog(true))
                dispatch(setAIModeErrorDialogMessage('TopK必须是大于0的正整数'))
                return
            }
            
            // 保存到 Redux（localStorage 同步在 reducer 中处理）
            dispatch(updateAIModeApiEndpoint(tempApiEndpoint))
            dispatch(updateAIModeApiKey(tempApiKey))
            dispatch(updateAIModeModel(tempModel))
            dispatch(updateAIModeEmbeddingModel(tempEmbeddingModel))
            dispatch(updateAIModeTopk(topk))
            dispatch(setAIModeShowConfigPanel(false))
        },
        onCancel: (apiEndpoint: string, apiKey: string, model: string, embeddingModel: string, topk: number) => {
            // 恢复临时状态为已保存的值
            dispatch(updateAIModeTempApiEndpoint(apiEndpoint))
            dispatch(updateAIModeTempApiKey(apiKey))
            dispatch(updateAIModeTempModel(model))
            dispatch(updateAIModeTempEmbeddingModel(embeddingModel))
            dispatch(updateAIModeTempTopk(topk.toString()))
            dispatch(setAIModeShowConfigPanel(false))
        },
    }
}

const AIConfigContainer = connect(mapStateToProps, mapDispatchToProps)(AIConfig)
export default AIConfigContainer

