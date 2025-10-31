import * as React from "react"
import { TextField } from "@fluentui/react/lib/TextField"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Spinner, MessageBar, MessageBarType, Panel, PanelType } from "@fluentui/react"
import { Icon } from "@fluentui/react/lib/Icon"
import OpenAI from "openai"

type AIModeProps = {
    // 可以添加需要的props
}

type Message = {
    role: 'user' | 'assistant'
    content: string
    timestamp: number
}

type AIModeState = {
    inputValue: string
    messages: Message[]
    isLoading: boolean
    error: string | null
    apiEndpoint: string
    apiKey: string
    model: string
    showConfigPanel: boolean
}

class AIMode extends React.Component<AIModeProps, AIModeState> {
    private messagesEndRef: React.RefObject<HTMLDivElement>
    private messagesContainerRef: React.RefObject<HTMLDivElement>

    constructor(props: AIModeProps) {
        super(props)
        this.messagesEndRef = React.createRef()
        this.messagesContainerRef = React.createRef()
        this.state = {
            inputValue: '',
            messages: [],
            isLoading: false,
            error: null,
            apiEndpoint: localStorage.getItem('ai-api-endpoint') || 'https://api.openai.com/v1/chat/completions',
            apiKey: localStorage.getItem('ai-api-key') || '',
            model: localStorage.getItem('ai-model') || 'gpt-3.5-turbo',
            showConfigPanel: false
        }
    }

    componentDidMount() {
        this.scrollToBottom()
    }

    componentDidUpdate() {
        this.scrollToBottom()
    }

    scrollToBottom = () => {
        // 只滚动消息容器，而不是整个页面
        if (this.messagesContainerRef.current) {
            const container = this.messagesContainerRef.current
            container.scrollTop = container.scrollHeight
        }
    }

    handleInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        this.setState({ inputValue: newValue || '' })
    }

    handleApiEndpointChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ apiEndpoint: value })
        localStorage.setItem('ai-api-endpoint', value)
    }

    handleApiKeyChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ apiKey: value })
        localStorage.setItem('ai-api-key', value)
    }

    handleModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ model: value })
        localStorage.setItem('ai-model', value)
    }

    handleSendMessage = async () => {
        const { inputValue, apiEndpoint, apiKey, model, messages } = this.state
        if (!inputValue.trim()) return

        if (!apiEndpoint.trim() || !apiKey.trim()) {
            this.setState({ error: '请先配置API Endpoint和API Key', showConfigPanel: true })
            return
        }

        if (!model.trim()) {
            this.setState({ error: '请先配置模型名称', showConfigPanel: true })
            return
        }

        const userMessage: Message = {
            role: 'user',
            content: inputValue.trim(),
            timestamp: Date.now()
        }

        const updatedMessages = [...messages, userMessage]
        this.setState({ 
            inputValue: '', 
            messages: updatedMessages,
            isLoading: true,
            error: null
        })

        try {
            const response = await this.callLLMAPI(inputValue.trim(), updatedMessages.slice(0, -1), apiEndpoint, apiKey, model)
            
            const assistantMessage: Message = {
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            }

            this.setState({ 
                messages: [...updatedMessages, assistantMessage],
                isLoading: false
            })
        } catch (error) {
            console.error('API调用失败:', error)
            const errorMessage = error instanceof Error ? error.message : '请求失败，请检查API配置和网络连接'
            this.setState({ 
                isLoading: false,
                error: errorMessage
            })
        }
    }

    callLLMAPI = async (question: string, conversationHistory: Message[], endpoint: string, apiKey: string, model: string): Promise<string> => {
        // 规范化endpoint URL
        let normalizedEndpoint = endpoint.trim()
        if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
            throw new Error('API Endpoint必须以http://或https://开头')
        }

        // 提取base URL (OpenAI库会自动添加/v1/chat/completions路径)
        let baseURL = normalizedEndpoint
        try {
            const url = new URL(normalizedEndpoint)
            // 如果endpoint包含/v1/chat/completions，去掉这个路径作为baseURL
            if (url.pathname.includes('/v1/chat/completions')) {
                baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
            } else {
                // 否则使用完整的URL作为baseURL（支持自定义路径）
                baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
            }
        } catch (error) {
            throw new Error(`无效的API Endpoint URL: ${normalizedEndpoint}`)
        }

        // 构建消息历史，只保留最近的对话
        const messages = [
            ...conversationHistory.slice(-10).map(msg => ({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content
            })),
            {
                role: 'user' as const,
                content: question
            }
        ]

        try {
            // 使用OpenAI库
            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: baseURL,
                dangerouslyAllowBrowser: true // 在Electron中需要这个选项
            })

            const completion = await openai.chat.completions.create({
                model: model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
            })

            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                return completion.choices[0].message.content || ''
            } else {
                throw new Error('API返回格式不正确，未找到choices数组或message内容')
            }
        } catch (error: any) {
            console.error('API调用失败:', error)
            
            // 处理OpenAI库的错误
            if (error instanceof OpenAI.APIError) {
                let errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查:\n1. API Endpoint是否正确（完整的URL路径）\n2. 是否需要包含特定的路径（如 /v1/chat/completions）\n3. API服务是否正常运行\n当前请求URL: ${normalizedEndpoint}`
                }
                throw new Error(errorMessage)
            } else if (error instanceof Error) {
                throw error
            } else {
                throw new Error(`请求失败: ${String(error)}`)
            }
        }
    }

    handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            if (!this.state.isLoading) {
                this.handleSendMessage()
            }
        }
    }

    handleClearMessages = () => {
        this.setState({ messages: [], error: null })
    }

    render() {
        const { inputValue, messages, isLoading, error, apiEndpoint, apiKey, model, showConfigPanel } = this.state

        return (
            <div className="ai-mode-container">
                {/* 配置面板 */}
                <Panel
                    isOpen={showConfigPanel}
                    type={PanelType.smallFixedFar}
                    onDismiss={() => this.setState({ showConfigPanel: false })}
                    headerText="AI API 配置"
                    closeButtonAriaLabel="关闭"
                >
                    <div style={{ padding: '20px 0' }}>
                        <TextField
                            label="API Endpoint"
                            value={apiEndpoint}
                            onChange={this.handleApiEndpointChange}
                            placeholder="https://api.openai.com/v1/chat/completions"
                            description="OpenAI兼容的API端点地址。必须是完整的URL，包含协议(https://)和完整路径(如/v1/chat/completions)"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="API Key"
                            type="password"
                            value={apiKey}
                            onChange={this.handleApiKeyChange}
                            placeholder="sk-..."
                            description="您的API密钥"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="模型名称"
                            value={model}
                            onChange={this.handleModelChange}
                            placeholder="gpt-3.5-turbo"
                            description="要使用的模型名称，例如：gpt-3.5-turbo, gpt-4, claude-3-opus 等"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                    </div>
                </Panel>

                {/* 消息显示区域 */}
                <div 
                    ref={this.messagesContainerRef}
                    className={`ai-messages-container ${messages.length === 0 ? 'has-placeholder' : 'has-messages'}`}
                >
                    {messages.length === 0 ? (
                        <div className="ai-mode-placeholder">
                            <Icon iconName="Robot" style={{ fontSize: 64, color: 'var(--neutralTertiary)', marginBottom: '16px' }} />
                            <p>开始与AI对话</p>
                            <p className="ai-mode-description">在下方输入您的问题，AI将为您提供回答</p>
                            {(!apiEndpoint.trim() || !apiKey.trim() || !model.trim()) && (
                                <MessageBar
                                    messageBarType={MessageBarType.warning}
                                    styles={{ root: { marginTop: '20px', maxWidth: '600px' } }}
                                    actions={
                                        <DefaultButton
                                            text="配置API"
                                            onClick={() => this.setState({ showConfigPanel: true })}
                                        />
                                    }
                                >
                                    请先配置API Endpoint、API Key和模型名称才能使用AI功能
                                </MessageBar>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="ai-messages-list">
                                {messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={`ai-message ai-message-${message.role}`}
                                    >
                                        <div className="ai-message-role">
                                            {message.role === 'user' ? '你' : 'AI'}
                                        </div>
                                        <div className="ai-message-content">
                                            {message.content.split('\n').map((line, i) => (
                                                <React.Fragment key={i}>
                                                    {line}
                                                    {i < message.content.split('\n').length - 1 && <br />}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="ai-message ai-message-assistant">
                                        <div className="ai-message-role">AI</div>
                                        <div className="ai-message-content">
                                            <Spinner label="正在思考..." />
                                        </div>
                                    </div>
                                )}
                                <div ref={this.messagesEndRef} />
                            </div>
                            
                            {error && (
                                <MessageBar
                                    messageBarType={MessageBarType.error}
                                    onDismiss={() => this.setState({ error: null })}
                                    dismissButtonAriaLabel="关闭"
                                    styles={{ root: { margin: '10px 20px' } }}
                                >
                                    {error}
                                </MessageBar>
                            )}
                        </>
                    )}
                </div>

                {/* 配置按钮 - 固定在左下角 */}
                <div className="ai-config-button-fixed">
                    <DefaultButton
                        iconProps={{ iconName: 'Settings' }}
                        text="配置"
                        onClick={() => this.setState({ showConfigPanel: true })}
                    />
                </div>

                {/* 输入区域 */}
                <div className="ai-input-wrapper">
                    {messages.length > 0 && (
                        <div className="ai-input-actions">
                            <DefaultButton
                                iconProps={{ iconName: 'Clear' }}
                                text="清空"
                                onClick={this.handleClearMessages}
                                styles={{ root: { marginRight: '8px' } }}
                            />
                        </div>
                    )}
                    <TextField
                        multiline
                        rows={4}
                        value={inputValue}
                        onChange={this.handleInputChange}
                        onKeyDown={this.handleKeyPress}
                        placeholder="请输入你的问题... (Shift+Enter 换行，Enter 发送)"
                        className="ai-simple-input"
                        disabled={isLoading}
                        styles={{
                            root: {
                                width: '100%',
                                maxWidth: '100%'
                            },
                            fieldGroup: {
                                border: '1px solid var(--neutralLight)',
                                borderRadius: '12px',
                                backgroundColor: 'var(--white)',
                                width: '100%',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                '&:hover': {
                                    borderColor: 'var(--neutralSecondary)'
                                },
                                '&:focus-within': {
                                    borderColor: 'var(--themePrimary)',
                                    boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.2)'
                                }
                            },
                            field: {
                                padding: '16px 60px 16px 20px',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                resize: 'none',
                                width: '100%',
                                boxSizing: 'border-box'
                            }
                        }}
                    />
                    <div className="ai-send-button">
                        <PrimaryButton
                            iconProps={{ iconName: 'Send' }}
                            onClick={this.handleSendMessage}
                            disabled={!inputValue.trim() || isLoading}
                            className="send-btn"
                            title="发送消息"
                        />
                    </div>
                </div>
            </div>
        )
    }
}

export default AIMode
