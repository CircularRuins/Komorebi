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
    updateAIModeTempSimilarityThreshold,
    updateAIModeApiEndpoint,
    updateAIModeApiKey,
    updateAIModeModel,
    updateAIModeEmbeddingModel,
    updateAIModeSimilarityThreshold,
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
    tempSimilarityThreshold: aiMode.tempSimilarityThreshold,
    // 需要保存的值，用于取消时恢复
    apiEndpoint: aiMode.apiEndpoint,
    apiKey: aiMode.apiKey,
    model: aiMode.model,
    embeddingModel: aiMode.embeddingModel,
    similarityThreshold: aiMode.similarityThreshold,
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
        onSimilarityThresholdChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            dispatch(updateAIModeTempSimilarityThreshold(newValue || ""))
        },
        onConfirm: (tempApiEndpoint: string, tempApiKey: string, tempModel: string, tempEmbeddingModel: string, tempSimilarityThreshold: string) => {
            // 验证相似度阈值
            const similarityThreshold = parseFloat(tempSimilarityThreshold)
            if (isNaN(similarityThreshold) || similarityThreshold < 0 || similarityThreshold > 1) {
                dispatch(setAIModeShowErrorDialog(true))
                dispatch(setAIModeErrorDialogMessage('相似度阈值必须是0到1之间的数字'))
                return
            }
            
            // 保存到 Redux（localStorage 同步在 reducer 中处理）
            dispatch(updateAIModeApiEndpoint(tempApiEndpoint))
            dispatch(updateAIModeApiKey(tempApiKey))
            dispatch(updateAIModeModel(tempModel))
            dispatch(updateAIModeEmbeddingModel(tempEmbeddingModel))
            dispatch(updateAIModeSimilarityThreshold(similarityThreshold))
            dispatch(setAIModeShowConfigPanel(false))
        },
        onCancel: (apiEndpoint: string, apiKey: string, model: string, embeddingModel: string, similarityThreshold: number) => {
            // 恢复临时状态为已保存的值
            dispatch(updateAIModeTempApiEndpoint(apiEndpoint))
            dispatch(updateAIModeTempApiKey(apiKey))
            dispatch(updateAIModeTempModel(model))
            dispatch(updateAIModeTempEmbeddingModel(embeddingModel))
            dispatch(updateAIModeTempSimilarityThreshold(similarityThreshold.toString()))
            dispatch(setAIModeShowConfigPanel(false))
        },
    }
}

const AIConfigContainer = connect(mapStateToProps, mapDispatchToProps)(AIConfig)
export default AIConfigContainer

