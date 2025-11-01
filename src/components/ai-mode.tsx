import * as React from "react"
import { TextField } from "@fluentui/react/lib/TextField"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Spinner, MessageBar, MessageBarType, Panel, PanelType, Dialog, DialogType } from "@fluentui/react"
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
    tempApiEndpoint: string
    tempApiKey: string
    tempModel: string
    showErrorDialog: boolean
    errorDialogMessage: string
}

class AIMode extends React.Component<AIModeProps, AIModeState> {
    private messagesEndRef: React.RefObject<HTMLDivElement>
    private messagesContainerRef: React.RefObject<HTMLDivElement>

    constructor(props: AIModeProps) {
        super(props)
        this.messagesEndRef = React.createRef()
        this.messagesContainerRef = React.createRef()
        const savedEndpoint = localStorage.getItem('ai-api-endpoint') || 'https://api.openai.com/v1/chat/completions'
        const savedKey = localStorage.getItem('ai-api-key') || ''
        const savedModel = localStorage.getItem('ai-model') || ''
        this.state = {
            inputValue: '',
            messages: [],
            isLoading: false,
            error: null,
            apiEndpoint: savedEndpoint,
            apiKey: savedKey,
            model: savedModel,
            showConfigPanel: false,
            tempApiEndpoint: savedEndpoint,
            tempApiKey: savedKey,
            tempModel: savedModel,
            showErrorDialog: false,
            errorDialogMessage: ''
        }
    }

    componentDidMount() {
        this.scrollToBottom()
        // 注册全局回调，让导航栏可以打开配置面板
        if (typeof window !== 'undefined') {
            (window as any).openAIConfigPanel = () => {
                this.handleConfigPanelOpen()
            }
            // 初始化是否有消息的标志
            (window as any).hasAIMessages = this.state.messages.length > 0
        }
    }

    componentDidUpdate() {
        this.scrollToBottom()
        // 更新全局标志，通知导航栏是否有消息
        if (typeof window !== 'undefined') {
            (window as any).hasAIMessages = this.state.messages.length > 0
        }
    }

    componentWillUnmount() {
        // 清理全局回调和标志
        if (typeof window !== 'undefined') {
            delete (window as any).openAIConfigPanel
            delete (window as any).hasAIMessages
        }
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
        this.setState({ tempApiEndpoint: value })
    }

    handleApiKeyChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ tempApiKey: value })
    }

    handleModelChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        this.setState({ tempModel: value })
    }

    handleConfigConfirm = () => {
        const { tempApiEndpoint, tempApiKey, tempModel } = this.state
        // 保存到localStorage和state
        localStorage.setItem('ai-api-endpoint', tempApiEndpoint)
        localStorage.setItem('ai-api-key', tempApiKey)
        localStorage.setItem('ai-model', tempModel)
        this.setState({
            apiEndpoint: tempApiEndpoint,
            apiKey: tempApiKey,
            model: tempModel,
            showConfigPanel: false
        })
    }

    handleConfigCancel = () => {
        // 恢复临时状态为已保存的值
        const { apiEndpoint, apiKey, model } = this.state
        this.setState({
            tempApiEndpoint: apiEndpoint,
            tempApiKey: apiKey,
            tempModel: model,
            showConfigPanel: false
        })
    }

    handleConfigPanelOpen = () => {
        // 打开面板时，初始化临时状态为当前保存的值
        const { apiEndpoint, apiKey, model } = this.state
        this.setState({
            showConfigPanel: true,
            tempApiEndpoint: apiEndpoint,
            tempApiKey: apiKey,
            tempModel: model
        })
    }

    handleSendMessage = async () => {
        const { inputValue, apiEndpoint, apiKey, model, messages } = this.state
        if (!inputValue.trim()) return

        if (!apiEndpoint.trim() || !apiKey.trim()) {
            this.setState({ 
                showErrorDialog: true,
                errorDialogMessage: '请先配置API Endpoint和API Key'
            })
            this.handleConfigPanelOpen()
            return
        }

        if (!model.trim()) {
            this.setState({ 
                showErrorDialog: true,
                errorDialogMessage: '请先配置模型名称'
            })
            this.handleConfigPanelOpen()
            return
        }

        const userMessage: Message = {
            role: 'user',
            content: inputValue.trim(),
            timestamp: Date.now()
        }

        const updatedMessages = [...messages, userMessage]
        // 先保存输入值，以便在错误时恢复
        const savedInputValue = inputValue
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
            // 移除已添加的用户消息，因为请求失败了，并恢复输入框的值
            this.setState({ 
                messages: messages,
                inputValue: savedInputValue,
                isLoading: false,
                showErrorDialog: true,
                errorDialogMessage: errorMessage
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
        this.setState({ messages: [], error: null }, () => {
            // 更新全局标志，通知导航栏没有消息了
            if (typeof window !== 'undefined') {
                (window as any).hasAIMessages = false
            }
        })
    }

    handleCloseErrorDialog = () => {
        this.setState({ showErrorDialog: false, errorDialogMessage: '' })
    }

    render() {
        const { inputValue, messages, isLoading, error, apiEndpoint, apiKey, model, showConfigPanel, tempApiEndpoint, tempApiKey, tempModel, showErrorDialog, errorDialogMessage } = this.state

        return (
            <div className={`ai-mode-container ${messages.length === 0 ? 'no-messages' : 'has-messages'}`}>
                {/* 配置面板 */}
                <Panel
                    isOpen={showConfigPanel}
                    type={PanelType.smallFixedFar}
                    onDismiss={this.handleConfigCancel}
                    headerText="AI API 配置"
                    closeButtonAriaLabel="关闭"
                >
                    <div style={{ padding: '20px 0' }}>
                        <TextField
                            label="API Endpoint"
                            value={tempApiEndpoint}
                            onChange={this.handleApiEndpointChange}
                            placeholder="https://api.openai.com/v1/chat/completions"
                            description="OpenAI兼容的API端点地址。必须是完整的URL，包含协议(https://)和完整路径(如/v1/chat/completions)"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="API Key"
                            type="password"
                            value={tempApiKey}
                            onChange={this.handleApiKeyChange}
                            placeholder="sk-..."
                            description="您的API密钥"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <TextField
                            label="模型名称"
                            value={tempModel}
                            onChange={this.handleModelChange}
                            placeholder="请输入模型名称"
                            description="要使用的模型名称，例如：gpt-3.5-turbo, gpt-4, claude-3-opus 等"
                            styles={{ root: { marginBottom: '20px' } }}
                        />
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                            <DefaultButton
                                text="取消"
                                onClick={this.handleConfigCancel}
                            />
                            <PrimaryButton
                                text="确认"
                                onClick={this.handleConfigConfirm}
                            />
                        </div>
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
                                            onClick={this.handleConfigPanelOpen}
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
                                        <div 
                                            className="ai-message-role"
                                            style={{
                                                display: 'block',
                                                visibility: 'visible',
                                                opacity: 1,
                                                ...(index === 0 && message.role === 'user' ? {
                                                    width: '100%',
                                                    maxWidth: '75%',
                                                    alignSelf: 'flex-end',
                                                    textAlign: 'right' as const,
                                                    paddingRight: '4px',
                                                    minHeight: '16px',
                                                    lineHeight: '16px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    color: 'var(--neutralSecondary)'
                                                } : {})
                                            }}
                                        >
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
                        </>
                    )}
                </div>

                {/* 错误对话框 */}
                <Dialog
                    hidden={!showErrorDialog}
                    onDismiss={this.handleCloseErrorDialog}
                    dialogContentProps={{
                        type: DialogType.normal,
                        title: '错误',
                        subText: errorDialogMessage
                    }}
                    modalProps={{
                        isBlocking: false,
                        styles: { main: { maxWidth: 500 } }
                    }}
                >
                    <DefaultButton onClick={this.handleCloseErrorDialog} text="确定" />
                </Dialog>

                {/* 输入区域 */}
                <div className="ai-input-wrapper">
                    <div className={`ai-input-actions ${messages.length === 0 ? 'hidden' : ''}`}>
                        <DefaultButton
                            iconProps={{ iconName: 'Clear' }}
                            text="清空"
                            onClick={this.handleClearMessages}
                            styles={{ root: { marginRight: '8px' } }}
                        />
                    </div>
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
                                maxWidth: '100%',
                                margin: 0
                            },
                            fieldGroup: {
                                border: '1px solid var(--neutralLight)',
                                borderRadius: '12px',
                                backgroundColor: 'var(--white)',
                                width: '100%',
                                maxWidth: '100%',
                                boxSizing: 'border-box',
                                margin: 0,
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
