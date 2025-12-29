import * as React from "react"
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
import { callLLM, chatApiConfigToLLMConfig } from "../scripts/llm-client"
import intl from "react-intl-universal"

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

// 包装器组件，用于管理测试状态
const AIConfigWithTest = (props: any) => {
    const [isTestingApi, setIsTestingApi] = React.useState(false)

    const handleTestApi = async () => {
        const { tempChatApiEndpoint, tempChatApiKey, tempModel } = props

        if (!tempChatApiEndpoint || !tempChatApiKey || !tempModel) {
            await window.utils.showMessageBox(
                intl.get("settings.aiMode.config.testApiFailed"),
                intl.get("settings.aiMode.config.testApiFailed") + ": " + intl.get("settings.aiMode.config.testApiIncomplete"),
                "OK",
                "",
                false,
                "error"
            )
            return
        }

        setIsTestingApi(true)

        try {
            // 使用 callLLM 进行测试，与实际使用保持一致
            const llmConfig = chatApiConfigToLLMConfig({
                apiEndpoint: tempChatApiEndpoint,
                apiKey: tempChatApiKey,
                model: tempModel
            })

            await callLLM(
                llmConfig,
                {
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello'
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 8000,
                },
                'api-test'
            )

            // 测试成功
            await window.utils.showMessageBox(
                intl.get("settings.aiMode.config.testApiSuccess"),
                intl.get("settings.aiMode.config.testApiSuccessMessage"),
                "OK",
                "",
                false,
                "info"
            )
        } catch (error: any) {
            // 测试失败 - 直接显示 callLLM 已经格式化好的错误消息（包含状态码、错误代码等）
            const errorMessage = error instanceof Error ? error.message : String(error)
            
            await window.utils.showMessageBox(
                intl.get("settings.aiMode.config.testApiFailed"),
                errorMessage,
                "OK",
                "",
                false,
                "error"
            )
        } finally {
            setIsTestingApi(false)
        }
    }

    return (
        <AIConfig
            {...props}
            onTestApi={handleTestApi}
            isTestingApi={isTestingApi}
        />
    )
}

const ConnectedAIConfig = connect(mapStateToProps, mapDispatchToProps)(AIConfigWithTest)
export default ConnectedAIConfig

