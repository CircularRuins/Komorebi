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
    tempApiEndpoint: string
    tempApiKey: string
    tempModel: string
    tempEmbeddingModel: string
    tempTopk: string
    apiEndpoint: string
    apiKey: string
    model: string
    embeddingModel: string
    topk: number
    onApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onEmbeddingModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTopkChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onConfirm: (tempApiEndpoint: string, tempApiKey: string, tempModel: string, tempEmbeddingModel: string, tempTopk: string) => void
    onCancel: (apiEndpoint: string, apiKey: string, model: string, embeddingModel: string, topk: number) => void
}

class AIConfig extends React.Component<AIConfigProps> {
    constructor(props) {
        super(props)
    }

    onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && this.props.display) {
            this.props.onCancel(this.props.apiEndpoint, this.props.apiKey, this.props.model, this.props.embeddingModel, this.props.topk)
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
                        onClick={() => this.props.onCancel(this.props.apiEndpoint, this.props.apiKey, this.props.model, this.props.embeddingModel, this.props.topk)}>
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
                            <Label>API Endpoint</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        value={this.props.tempApiEndpoint}
                                        onChange={this.props.onApiEndpointChange}
                                        placeholder="https://api.openai.com/v1/chat/completions"
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                OpenAI兼容的API端点地址。必须是完整的URL，包含协议(https://)和完整路径(如/v1/chat/completions)
                            </span>

                            <Label>API Key</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        type="password"
                                        value={this.props.tempApiKey}
                                        onChange={this.props.onApiKeyChange}
                                        placeholder="sk-..."
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                您的API密钥
                            </span>

                            <Label>模型名称</Label>
                            <Stack horizontal>
                                <Stack.Item grow>
                                    <TextField
                                        value={this.props.tempModel}
                                        onChange={this.props.onModelChange}
                                        placeholder="请输入模型名称"
                                    />
                                </Stack.Item>
                            </Stack>
                            <span className="settings-hint up">
                                要使用的模型名称，例如：gpt-3.5-turbo, gpt-4, claude-3-opus 等
                            </span>

                            <Label>Embedding模型名称</Label>
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
                                用于计算文章embedding的模型名称，例如：text-embedding-ada-002, text-embedding-3-small 等
                            </span>

                            <Label>TopK 结果数量</Label>
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
                                选择相似度最高的前K篇文章。必须是正整数，建议值：50-200
                            </span>

                            <Stack horizontal>
                                <Stack.Item>
                                    <DefaultButton
                                        text="取消"
                                        onClick={() => this.props.onCancel(this.props.apiEndpoint, this.props.apiKey, this.props.model, this.props.embeddingModel, this.props.topk)}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <PrimaryButton
                                        text="确认"
                                        onClick={() => this.props.onConfirm(this.props.tempApiEndpoint, this.props.tempApiKey, this.props.tempModel, this.props.tempEmbeddingModel, this.props.tempTopk)}
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
