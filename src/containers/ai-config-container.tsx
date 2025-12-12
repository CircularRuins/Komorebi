import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import AIConfig from "../components/ai-config"
import {
    updateAIModeTempChatApiEndpoint,
    updateAIModeTempChatApiKey,
    updateAIModeTempModel,
    updateAIModeChatApiEndpoint,
    updateAIModeChatApiKey,
    updateAIModeModel,
} from "../scripts/models/ai-mode"

const getAIMode = (state: RootState) => state.aiMode

const mapStateToProps = createSelector([getAIMode], (aiMode) => ({
    display: aiMode.showConfigPanel,
    tempChatApiEndpoint: aiMode.tempChatApiEndpoint,
    tempChatApiKey: aiMode.tempChatApiKey,
    tempModel: aiMode.tempModel,
    // 需要保存的值，用于取消时恢复
    chatApiEndpoint: aiMode.chatApiEndpoint,
    chatApiKey: aiMode.chatApiKey,
    model: aiMode.model,
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
        onModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = newValue || ""
            dispatch(updateAIModeTempModel(value))
            // 实时保存到 electron-store（像应用偏好那样）
            dispatch(updateAIModeModel(value))
        },
    }
}

const AIConfigContainer = connect(mapStateToProps, mapDispatchToProps)(AIConfig)
export default AIConfigContainer

