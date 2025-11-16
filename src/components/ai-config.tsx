import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react/lib/Icon"
import { AnimationClassNames } from "@fluentui/react/lib/Styling"
import { Stack, Pivot, PivotItem } from "@fluentui/react"
import { Label } from "@fluentui/react/lib/Label"
import { TextField } from "@fluentui/react/lib/TextField"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"

type AIConfigProps = {
    display: boolean
    tempChatApiEndpoint: string
    tempChatApiKey: string
    tempEmbeddingApiEndpoint: string
    tempEmbeddingApiKey: string
    tempModel: string
    tempEmbeddingModel: string
    tempTopk: string
    chatApiEndpoint: string
    chatApiKey: string
    embeddingApiEndpoint: string
    embeddingApiKey: string
    model: string
    embeddingModel: string
    topk: number
    onChatApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onChatApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTopkChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onConfirm: (tempChatApiEndpoint: string, tempChatApiKey: string, tempEmbeddingApiEndpoint: string, tempEmbeddingApiKey: string, tempModel: string, tempEmbeddingModel: string, tempTopk: string) => void
    onCancel: (chatApiEndpoint: string, chatApiKey: string, embeddingApiEndpoint: string, embeddingApiKey: string, model: string, embeddingModel: string, topk: number) => void
}

class AIConfig extends React.Component<AIConfigProps> {
    constructor(props) {
        super(props)
    }

    onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && this.props.display) {
            this.props.onCancel(this.props.chatApiEndpoint, this.props.chatApiKey, this.props.embeddingApiEndpoint, this.props.embeddingApiKey, this.props.model, this.props.embeddingModel, this.props.topk)
        }
    }

    componentDidUpdate = (prevProps: AIConfigProps) => {
        if (this.props.display !== prevProps.display) {
            if (this.props.display) {
                document.body.addEventListener("keydown", this.onKeyDown)
            } else {
                document.body.removeEventListener("keydown", this.onKeyDown)
            }
        }
    }

    componentWillUnmount() {
        document.body.removeEventListener("keydown", this.onKeyDown)
    }

    render = () =>
        this.props.display && (
            <div className="settings-container">
                <div
                    className="btn-group"
                    style={{
                        position: "absolute",
                        top: 70,
                        left: "calc(50% - 404px)",
                    }}>
                    <a
                        className="btn"
                        title={intl.get("settings.exit")}
                        onClick={() => this.props.onCancel(this.props.chatApiEndpoint, this.props.chatApiKey, this.props.embeddingApiEndpoint, this.props.embeddingApiKey, this.props.model, this.props.embeddingModel, this.props.topk)}>
                        <Icon iconName="Back" />
                    </a>
                </div>
                <div className={"settings " + AnimationClassNames.slideUpIn20}>
                    <Pivot selectedKey="ai-config">
                        <PivotItem
                            headerText={intl.get("settings.ai")}
                            itemIcon="Cloud"
                            itemKey="ai-config">
                            <div className="tab-body">
                            <Label style={{ fontSize: '16px', fontWeight: 600, marginTop: '16px', marginBottom: '8px' }}>{intl.get("settings.aiMode.config.chatModelTitle")}</Label>
                            <Label>{intl.get("settings.aiMode.config.chatApiEndpoint")}</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        value={this.props.tempChatApiEndpoint}
                                        onChange={this.props.onChatApiEndpointChange}
                                        placeholder="https://api.openai.com/v1/chat/completions"
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                {intl.get("settings.aiMode.config.chatApiEndpointHint")}
                            </span>

                            <Label>{intl.get("settings.aiMode.config.chatApiKey")}</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        type="password"
                                        value={this.props.tempChatApiKey}
                                        onChange={this.props.onChatApiKeyChange}
                                        placeholder="sk-..."
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                {intl.get("settings.aiMode.config.chatApiKeyHint")}
                            </span>

                            <Label>{intl.get("settings.aiMode.config.chatModelName")}</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        value={this.props.tempModel}
                                        onChange={this.props.onModelChange}
                                        placeholder={intl.get("settings.aiMode.config.chatModelPlaceholder")}
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                {intl.get("settings.aiMode.config.chatModelHint")}
                            </span>

                            <Label style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>{intl.get("settings.aiMode.config.embeddingModelTitle")}</Label>
                            <Label>{intl.get("settings.aiMode.config.embeddingApiEndpoint")}</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        value={this.props.tempEmbeddingApiEndpoint}
                                        onChange={this.props.onEmbeddingApiEndpointChange}
                                        placeholder="https://api.openai.com/v1/embeddings"
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                {intl.get("settings.aiMode.config.embeddingApiEndpointHint")}
                            </span>

                            <Label>{intl.get("settings.aiMode.config.embeddingApiKey")}</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        type="password"
                                        value={this.props.tempEmbeddingApiKey}
                                        onChange={this.props.onEmbeddingApiKeyChange}
                                        placeholder="sk-..."
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                {intl.get("settings.aiMode.config.embeddingApiKeyHint")}
                            </span>

                            <Label>{intl.get("settings.aiMode.config.embeddingModelName")}</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        value={this.props.tempEmbeddingModel}
                                        onChange={this.props.onEmbeddingModelChange}
                                        placeholder="text-embedding-ada-002"
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                {intl.get("settings.aiMode.config.embeddingModelHint")}
                            </span>

                            <Label>{intl.get("settings.aiMode.config.topk")}</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        value={this.props.tempTopk}
                                        onChange={this.props.onTopkChange}
                                        placeholder="100"
                                        type="number"
                                        min={1}
                                        step={1}
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                {intl.get("settings.aiMode.config.topkHint")}
                            </span>

                            <Stack horizontal>
                                <Stack.Item>
                                    <DefaultButton
                                        text={intl.get("settings.aiMode.config.cancel")}
                                        onClick={() => this.props.onCancel(this.props.chatApiEndpoint, this.props.chatApiKey, this.props.embeddingApiEndpoint, this.props.embeddingApiKey, this.props.model, this.props.embeddingModel, this.props.topk)}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <PrimaryButton
                                        text={intl.get("settings.aiMode.config.confirm")}
                                        onClick={() => this.props.onConfirm(this.props.tempChatApiEndpoint, this.props.tempChatApiKey, this.props.tempEmbeddingApiEndpoint, this.props.tempEmbeddingApiKey, this.props.tempModel, this.props.tempEmbeddingModel, this.props.tempTopk)}
                                    />
                                </Stack.Item>
                            </Stack>
                            </div>
                        </PivotItem>
                    </Pivot>
                </div>
            </div>
        )
}

export default AIConfig
