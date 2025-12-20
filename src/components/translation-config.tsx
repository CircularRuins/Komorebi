import * as React from "react"
import intl from "react-intl-universal"
import { Stack } from "@fluentui/react"
import { Label } from "@fluentui/react/lib/Label"
import { TextField } from "@fluentui/react/lib/TextField"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"

type TranslationConfigProps = {
    display: boolean
    tempTranslationApiEndpoint: string
    tempTranslationApiKey: string
    tempTranslationModel: string
    translationApiEndpoint: string
    translationApiKey: string
    translationModel: string
    onTranslationApiEndpointChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTranslationApiKeyChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onTranslationModelChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    onConfirm: (tempTranslationApiEndpoint: string, tempTranslationApiKey: string, tempTranslationModel: string) => void
    onCancel: (translationApiEndpoint: string, translationApiKey: string, translationModel: string) => void
}

class TranslationConfig extends React.Component<TranslationConfigProps> {
    constructor(props) {
        super(props)
    }

    render = () =>
        this.props.display && (
            <div className="tab-body">
                <div style={{
                    padding: '20px',
                    marginBottom: '24px',
                    backgroundColor: 'var(--neutralLighterAlt)',
                    borderRadius: '4px',
                    border: '1px solid var(--neutralLight)'
                }}>
                    <Label style={{ fontSize: '14px', fontWeight: 600, marginTop: '0', marginBottom: '12px' }}>
                        {intl.get("translation.config.title")}
                    </Label>
                    
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

                {/* 操作按钮区域 */}
                <Stack horizontal>
                    <Stack.Item>
                        <DefaultButton
                            text={intl.get("translation.config.cancel")}
                            onClick={() => this.props.onCancel(
                                this.props.translationApiEndpoint,
                                this.props.translationApiKey,
                                this.props.translationModel
                            )}
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text={intl.get("translation.config.confirm")}
                            onClick={() => this.props.onConfirm(
                                this.props.tempTranslationApiEndpoint,
                                this.props.tempTranslationApiKey,
                                this.props.tempTranslationModel
                            )}
                        />
                    </Stack.Item>
                </Stack>
            </div>
        )
}

export default TranslationConfig




