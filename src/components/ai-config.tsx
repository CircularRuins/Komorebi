import * as React from "react"
import intl from "react-intl-universal"
import { Stack } from "@fluentui/react"
import { Label } from "@fluentui/react/lib/Label"
import { TextField } from "@fluentui/react/lib/TextField"
import { PrimaryButton } from "@fluentui/react/lib/Button"

type AIConfigProps = {
    display: boolean
    tempChatApiEndpoint: string
    tempChatApiKey: string
    tempEmbeddingApiEndpoint: string
    tempEmbeddingApiKey: string
    tempModel: string
    tempEmbeddingModel: string
    tempEmbeddingQPS: string
    tempTopk: string
    tempTranslationApiEndpoint: string
    tempTranslationApiKey: string
    tempTranslationModel: string
    chatApiEndpoint: string
    chatApiKey: string
    embeddingApiEndpoint: string
    embeddingApiKey: string
    model: string
    embeddingModel: string
    embeddingQPS: number
    topk: number
    translationApiEndpoint: string
    translationApiKey: string
    translationModel: string
    onChatApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onChatApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingQPSChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTopkChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTranslationApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTranslationApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTranslationModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onClearEmbeddings: () => Promise<void>
}

class AIConfig extends React.Component<AIConfigProps> {
    constructor(props) {
        super(props)
    }

    // 移除键盘事件处理，因为现在在页面模式下不需要 ESC 关闭

    render = () =>
        this.props.display && (
            <div className="tab-body" style={{ paddingBottom: '20px' }}>
                {/* Chat 模型配置区域 */}
                <div style={{
                    padding: '20px',
                    marginBottom: '24px',
                    backgroundColor: 'var(--neutralLighterAlt)',
                    borderRadius: '4px',
                    border: '1px solid var(--neutralLight)'
                }}>
                    <Label style={{ fontSize: '14px', fontWeight: 600, marginTop: '0', marginBottom: '12px' }}>{intl.get("settings.aiMode.config.chatModelTitle")}</Label>
                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.chatApiEndpoint")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempChatApiEndpoint}
                                onChange={this.props.onChatApiEndpointChange}
                                placeholder="https://api.openai.com/v1/chat/completions"
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.chatApiEndpointHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.chatApiKey")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                type="password"
                                value={this.props.tempChatApiKey}
                                onChange={this.props.onChatApiKeyChange}
                                placeholder="sk-..."
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.chatApiKeyHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.chatModelName")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempModel}
                                onChange={this.props.onModelChange}
                                placeholder={intl.get("settings.aiMode.config.chatModelPlaceholder")}
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.chatModelHint")}
                    </span>
                </div>

                {/* Embedding 模型配置区域 */}
                <div style={{
                    padding: '20px',
                    marginBottom: '24px',
                    backgroundColor: 'var(--neutralLighterAlt)',
                    borderRadius: '4px',
                    border: '1px solid var(--neutralLight)'
                }}>
                    <Label style={{ fontSize: '14px', fontWeight: 600, marginTop: '0', marginBottom: '12px' }}>{intl.get("settings.aiMode.config.embeddingModelTitle")}</Label>
                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.embeddingApiEndpoint")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempEmbeddingApiEndpoint}
                                onChange={this.props.onEmbeddingApiEndpointChange}
                                placeholder="https://api.openai.com/v1/embeddings"
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.embeddingApiEndpointHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.embeddingApiKey")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                type="password"
                                value={this.props.tempEmbeddingApiKey}
                                onChange={this.props.onEmbeddingApiKeyChange}
                                placeholder="sk-..."
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.embeddingApiKeyHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.embeddingModelName")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempEmbeddingModel}
                                onChange={this.props.onEmbeddingModelChange}
                                placeholder="text-embedding-ada-002"
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.embeddingModelHint")}
                    </span>
                    <span className="settings-hint up" style={{ color: '#ffffff', fontWeight: 500, fontSize: '11px', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {intl.get("settings.aiMode.config.embeddingModelChangeHint")}
                    </span>

                    <Stack horizontal>
                        <Stack.Item>
                            <PrimaryButton
                                text={intl.get("settings.aiMode.config.clearEmbeddings")}
                                onClick={async () => {
                                    if (window.utils && window.utils.showMessageBox) {
                                        const confirmed = await window.utils.showMessageBox(
                                            intl.get("settings.aiMode.config.clearEmbeddings"),
                                            intl.get("settings.aiMode.config.clearEmbeddingsHint"),
                                            intl.get("confirm"),
                                            intl.get("cancel"),
                                            true,
                                            "warning"
                                        )
                                        if (confirmed) {
                                            try {
                                                await this.props.onClearEmbeddings()
                                                if (window.utils && window.utils.showMessageBox) {
                                                    await window.utils.showMessageBox(
                                                        intl.get("settings.aiMode.config.clearEmbeddings"),
                                                        intl.get("settings.aiMode.common.clearEmbeddingsSuccess", { defaultValue: "文章Embedding已清除" }),
                                                        intl.get("settings.aiMode.common.ok"),
                                                        "",
                                                        false,
                                                        "none"
                                                    )
                                                }
                                            } catch (error) {
                                                if (window.utils && window.utils.showMessageBox) {
                                                    await window.utils.showMessageBox(
                                                        intl.get("settings.aiMode.common.error"),
                                                        error instanceof Error ? error.message : String(error),
                                                        intl.get("settings.aiMode.common.ok"),
                                                        "",
                                                        false,
                                                        "error"
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.clearEmbeddingsHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.embeddingQPS")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempEmbeddingQPS}
                                onChange={this.props.onEmbeddingQPSChange}
                                placeholder="30"
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("settings.aiMode.config.embeddingQPSHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("settings.aiMode.config.topk")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempTopk}
                                onChange={this.props.onTopkChange}
                                placeholder="100"
                                type="number"
                                min={1}
                                step={1}
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                </div>

                {/* Translation 模型配置区域 */}
                <div style={{
                    padding: '20px',
                    marginBottom: '24px',
                    backgroundColor: 'var(--neutralLighterAlt)',
                    borderRadius: '4px',
                    border: '1px solid var(--neutralLight)'
                }}>
                    <Label style={{ fontSize: '14px', fontWeight: 600, marginTop: '0', marginBottom: '12px' }}>{intl.get("translation.config.title")}</Label>
                    <Label style={{ fontSize: '12px' }}>{intl.get("translation.config.apiEndpoint")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempTranslationApiEndpoint}
                                onChange={this.props.onTranslationApiEndpointChange}
                                placeholder="https://api.openai.com/v1/chat/completions"
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("translation.config.apiEndpointHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("translation.config.apiKey")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                type="password"
                                value={this.props.tempTranslationApiKey}
                                onChange={this.props.onTranslationApiKeyChange}
                                placeholder="sk-..."
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("translation.config.apiKeyHint")}
                    </span>

                    <Label style={{ fontSize: '12px' }}>{intl.get("translation.config.model")}</Label>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                value={this.props.tempTranslationModel}
                                onChange={this.props.onTranslationModelChange}
                                placeholder={intl.get("translation.config.modelPlaceholder")}
                                styles={{ field: { fontSize: '12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up" style={{ fontSize: '11px' }}>
                        {intl.get("translation.config.modelHint")}
                    </span>
                </div>
            </div>
        )
}

export default AIConfig
