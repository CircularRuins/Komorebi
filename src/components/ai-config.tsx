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
    tempModel: string
    chatApiEndpoint: string
    chatApiKey: string
    model: string
    onChatApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onChatApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTestApi?: () => Promise<void>
    isTestingApi?: boolean
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

                    <Stack horizontal style={{ marginTop: '16px' }}>
                        <PrimaryButton
                            text={this.props.isTestingApi ? intl.get("settings.aiMode.config.testingApi") : intl.get("settings.aiMode.config.testApi")}
                            onClick={this.props.onTestApi}
                            disabled={this.props.isTestingApi || !this.props.tempChatApiEndpoint || !this.props.tempChatApiKey || !this.props.tempModel}
                            styles={{ root: { fontSize: '12px' } }}
                        />
                    </Stack>
                </div>
            </div>
        )
}

export default AIConfig
