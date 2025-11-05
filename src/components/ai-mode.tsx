import * as React from "react"
import { TextField, ITextField } from "@fluentui/react/lib/TextField"
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown"
import { Label } from "@fluentui/react/lib/Label"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Spinner, MessageBar, MessageBarType, Panel, PanelType } from "@fluentui/react"
import { Icon } from "@fluentui/react/lib/Icon"
import OpenAI from "openai"
import * as db from "../scripts/db"
import lf from "lovefield"
import type { RSSItem } from "../scripts/models/item"

// AIMode Context 类型定义
export type AIModeContextType = {
    timeRange: string | null
    topics: string[]
    topicInput: string
    isComposing: boolean
    isLoading: boolean
    summary: string
    apiEndpoint: string
    apiKey: string
    model: string
    showConfigPanel: boolean
    articleCount: number
    error: string | null
    setTimeRange: (timeRange: string | null) => void
    setTopics: (topics: string[]) => void
    setTopicInput: (topicInput: string) => void
    setIsComposing: (isComposing: boolean) => void
    addTopic: () => void
    removeTopic: (index: number) => void
    handleGenerateSummary: () => void
    handleClearSummary: () => void
    handleConfigPanelOpen: () => void
    handleTopicInputChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    handleTopicInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
    handleTopicInputCompositionStart: () => void
    handleTopicInputCompositionEnd: () => void
    handleTimeRangeChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void
    topicInputRef: React.RefObject<ITextField>
}

// 创建 Context
export const AIModeContext = React.createContext<AIModeContextType | null>(null)

type AIModeProps = {
    // 可以添加需要的props
}

type AIModeState = {
    timeRange: string | null  // 时间范围key，例如 "1" 表示1天，"7" 表示7天
    topics: string[]  // 话题标签数组
    topicInput: string  // 当前输入的话题文本
    isComposing: boolean  // 是否正在使用输入法输入
    summary: string    // AI生成的总结
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
    articleCount: number  // 筛选到的文章数量
}

class AIMode extends React.Component<AIModeProps, AIModeState> {
    private summaryContainerRef: React.RefObject<HTMLDivElement>
    private topicInputRef: React.RefObject<ITextField>
    private updateTimeout: NodeJS.Timeout | null = null

    constructor(props: AIModeProps) {
        super(props)
        this.summaryContainerRef = React.createRef()
        this.topicInputRef = React.createRef()
        const savedEndpoint = localStorage.getItem('ai-api-endpoint') || 'https://api.openai.com/v1/chat/completions'
        const savedKey = localStorage.getItem('ai-api-key') || ''
        const savedModel = localStorage.getItem('ai-model') || ''
        this.state = {
            timeRange: null,
            topics: [],
            topicInput: '',
            isComposing: false,
            summary: '',
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
            errorDialogMessage: '',
            articleCount: 0
        }
    }

    componentDidMount() {
        // 注册全局回调，让导航栏可以打开配置面板
        if (typeof window !== 'undefined') {
            (window as any).openAIConfigPanel = () => {
                this.handleConfigPanelOpen()
            }
        }
        // 通知Root组件更新Context
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('aiModeMounted')
            window.dispatchEvent(event)
        }
    }

    componentDidUpdate(prevProps: AIModeProps, prevState: AIModeState) {
        // 只在关键状态改变时通知Root组件更新Context（排除输入框变化以避免打断输入）
        if (
            prevState.timeRange !== this.state.timeRange ||
            prevState.topics.length !== this.state.topics.length ||
            prevState.summary !== this.state.summary ||
            prevState.isLoading !== this.state.isLoading ||
            prevState.showConfigPanel !== this.state.showConfigPanel ||
            prevState.apiEndpoint !== this.state.apiEndpoint ||
            prevState.apiKey !== this.state.apiKey ||
            prevState.model !== this.state.model
        ) {
            // 通知Root组件更新Context
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }
        }
    }

    componentWillUnmount() {
        // 清理全局回调
        if (typeof window !== 'undefined') {
            delete (window as any).openAIConfigPanel
        }
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout)
        }
    }

    // Context value 生成器
    getContextValue = (): AIModeContextType => {
        return {
            timeRange: this.state.timeRange,
            topics: this.state.topics,
            topicInput: this.state.topicInput,
            isComposing: this.state.isComposing,
            isLoading: this.state.isLoading,
            summary: this.state.summary,
            apiEndpoint: this.state.apiEndpoint,
            apiKey: this.state.apiKey,
            model: this.state.model,
            showConfigPanel: this.state.showConfigPanel,
            articleCount: this.state.articleCount,
            error: this.state.error,
            setTimeRange: (timeRange: string | null) => this.setState({ timeRange }),
            setTopics: (topics: string[]) => this.setState({ topics }),
            setTopicInput: (topicInput: string) => this.setState({ topicInput }),
            setIsComposing: (isComposing: boolean) => this.setState({ isComposing }),
            addTopic: this.addTopic,
            removeTopic: this.removeTopic,
            handleGenerateSummary: this.handleGenerateSummary,
            handleClearSummary: this.handleClearSummary,
            handleConfigPanelOpen: this.handleConfigPanelOpen,
            handleTopicInputChange: this.handleTopicInputChange,
            handleTopicInputKeyDown: this.handleTopicInputKeyDown,
            handleTopicInputCompositionStart: this.handleTopicInputCompositionStart,
            handleTopicInputCompositionEnd: this.handleTopicInputCompositionEnd,
            handleTimeRangeChange: this.handleTimeRangeChange,
            topicInputRef: this.topicInputRef
        }
    }

    handleTimeRangeChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        this.setState({ timeRange: option ? option.key as string : null })
    }

    handleTopicInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        this.setState({ topicInput: newValue || '' }, () => {
            // 状态更新后立即更新Context，确保输入框能正常显示输入
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeInputChanged')
                window.dispatchEvent(event)
            }
        })
    }

    handleTopicInputCompositionStart = () => {
        this.setState({ isComposing: true })
    }

    handleTopicInputCompositionEnd = () => {
        this.setState({ isComposing: false }, () => {
            // 输入法结束后更新Context
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeInputChanged')
                window.dispatchEvent(event)
            }
        })
    }

    handleTopicInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const { isComposing } = this.state
        // 如果正在使用输入法，不处理Enter键
        if (isComposing) {
            return
        }
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            this.addTopic()
        }
        // 移除了Backspace删除标签的逻辑，避免误删
    }

    addTopic = () => {
        const { topicInput, topics } = this.state
        const trimmed = topicInput.trim()
        if (trimmed && !topics.includes(trimmed)) {
            this.setState({
                topics: [...topics, trimmed],
                topicInput: ''
            })
        } else if (trimmed && topics.includes(trimmed)) {
            // 如果标签已存在，只清空输入
            this.setState({ topicInput: '' })
        }
    }

    removeTopic = (index: number) => {
        const { topics } = this.state
        this.setState({
            topics: topics.filter((_, i) => i !== index)
        })
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

    // 解析时间范围key，返回天数
    parseTimeRange = (timeRange: string | null): number | null => {
        if (!timeRange) return null
        
        // 直接解析key值（已经是天数）
        const days = parseInt(timeRange, 10)
        if (!isNaN(days) && days > 0) {
            return days
        }
        
        return null
    }

    // 获取时间范围选项
    getTimeRangeOptions = (): IDropdownOption[] => {
        return [
            { key: '1', text: '1日内' },
            { key: '3', text: '3日内' },
            { key: '7', text: '1周内' },
            { key: '30', text: '1月内' }
        ]
    }

    // 查询符合条件的文章
    queryArticles = async (timeRangeDays: number | null, topics: string[]): Promise<RSSItem[]> => {
        // 等待数据库初始化
        let retries = 0
        while ((!db.itemsDB || !db.items) && retries < 50) {
            await new Promise(resolve => setTimeout(resolve, 100))
            retries++
        }
        
        if (!db.itemsDB || !db.items) {
            throw new Error('数据库未初始化，请稍后再试')
        }

        const predicates: lf.Predicate[] = []
        
        // 时间范围筛选
        if (timeRangeDays !== null) {
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - timeRangeDays)
            predicates.push(db.items.date.gte(cutoffDate))
        }
        
        // 话题筛选（在标题和内容中搜索，多个标签需要同时匹配）
        if (topics.length > 0) {
            const topicPredicates: lf.Predicate[] = []
            for (const topic of topics) {
                const topicRegex = RegExp(topic.trim(), 'i')
                topicPredicates.push(
                    lf.op.or(
                        db.items.title.match(topicRegex),
                        db.items.snippet.match(topicRegex)
                    )
                )
            }
            // 所有标签都需要匹配（AND关系）
            if (topicPredicates.length > 0) {
                predicates.push(lf.op.and.apply(null, topicPredicates))
            }
        }

        const query = predicates.length > 0 
            ? lf.op.and.apply(null, predicates)
            : null

        const queryBuilder = db.itemsDB
            .select()
            .from(db.items)
            .orderBy(db.items.date, lf.Order.DESC)
            .limit(100)  // 限制最多100篇文章

        const items = query 
            ? await queryBuilder.where(query).exec() as RSSItem[]
            : await queryBuilder.exec() as RSSItem[]

        return items
    }

    // 生成总结
    generateSummary = async (articles: RSSItem[], topics: string[]): Promise<string> => {
        const { apiEndpoint, apiKey, model } = this.state

        // 规范化endpoint URL
        let normalizedEndpoint = apiEndpoint.trim()
        if (!normalizedEndpoint.startsWith('http://') && !normalizedEndpoint.startsWith('https://')) {
            throw new Error('API Endpoint必须以http://或https://开头')
        }

        // 提取base URL
        let baseURL = normalizedEndpoint
        try {
            const url = new URL(normalizedEndpoint)
            if (url.pathname.includes('/v1/chat/completions')) {
                baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`
            } else {
                baseURL = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}`
            }
        } catch (error) {
            throw new Error(`无效的API Endpoint URL: ${normalizedEndpoint}`)
        }

        // 准备文章内容
        const articlesText = articles.slice(0, 50).map((article, index) => {
            const dateStr = article.date.toLocaleDateString('zh-CN')
            return `文章 ${index + 1}:
标题: ${article.title}
发布时间: ${dateStr}
摘要: ${article.snippet || article.content.substring(0, 200)}`
        }).join('\n\n')

        const topicText = topics.length > 0 ? `，重点关注话题：${topics.join('、')}` : ''

        const prompt = `请帮我总结整理以下RSS文章${topicText}。

要求：
1. 按照主题或类别对文章进行分组
2. 为每个分组提供简要总结
3. 突出重要信息和趋势
4. 使用清晰的结构和格式

文章列表：
${articlesText}

请生成详细的总结报告：`

        try {
            const openai = new OpenAI({
                apiKey: apiKey,
                baseURL: baseURL,
                dangerouslyAllowBrowser: true
            })

            const completion = await openai.chat.completions.create({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的RSS阅读助手，擅长总结和整理文章内容。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000,
            })

            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                return completion.choices[0].message.content || ''
            } else {
                throw new Error('API返回格式不正确，未找到choices数组或message内容')
            }
        } catch (error: any) {
            console.error('API调用失败:', error)
            
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

    handleGenerateSummary = async () => {
        const { timeRange, topics, apiEndpoint, apiKey, model } = this.state

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

        // 验证至少需要一个标签
        if (topics.length === 0) {
            this.setState({ 
                showErrorDialog: true,
                errorDialogMessage: '请至少输入一个话题标签'
            })
            return
        }

        // 验证时间范围必须选择
        if (!timeRange) {
            this.setState({ 
                showErrorDialog: true,
                errorDialogMessage: '请先选择文章发布时间'
            })
            return
        }

        this.setState({ 
            isLoading: true,
            error: null,
            summary: '',
            articleCount: 0
        })

        try {
            // 解析时间范围
            const timeRangeDays = this.parseTimeRange(timeRange)

            // 查询文章
            const articles = await this.queryArticles(timeRangeDays, topics)
            
            if (articles.length === 0) {
                this.setState({
                    isLoading: false,
                    error: '没有找到符合条件的文章。请尝试调整时间范围或话题。'
                })
                return
            }

            this.setState({ articleCount: articles.length })

            // 生成总结
            const summary = await this.generateSummary(articles, topics)
            
            this.setState({ 
                summary,
                isLoading: false
            })
        } catch (error) {
            console.error('生成总结失败:', error)
            const errorMessage = error instanceof Error ? error.message : '请求失败，请检查API配置和网络连接'
            this.setState({ 
                isLoading: false,
                error: errorMessage,
                showErrorDialog: true,
                errorDialogMessage: errorMessage
            })
        }
    }

    handleClearSummary = () => {
        this.setState({ 
            summary: '',
            error: null,
            articleCount: 0
        })
    }

    handleCloseErrorDialog = () => {
        this.setState({ showErrorDialog: false, errorDialogMessage: '' })
    }

    render() {
        const { 
            timeRange, 
            topics,
            topicInput,
            summary, 
            isLoading, 
            error, 
            apiEndpoint, 
            apiKey, 
            model, 
            showConfigPanel, 
            tempApiEndpoint, 
            tempApiKey, 
            tempModel, 
            showErrorDialog, 
            errorDialogMessage,
            articleCount
        } = this.state

        return (
            <div className={`ai-mode-container ${summary ? 'has-summary' : 'no-summary'}`} style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
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

                {/* 总结显示区域 */}
                {summary && (
                    <div 
                        ref={this.summaryContainerRef}
                        className="ai-summary-container has-summary"
                        style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--neutralLighterAlt)'
                        }}
                    >
                        <div style={{ 
                            backgroundColor: 'var(--white)',
                            borderRadius: '8px',
                            padding: '24px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                        }}>
                            {articleCount > 0 && (
                                <div style={{ 
                                    marginBottom: '16px', 
                                    paddingBottom: '16px',
                                    borderBottom: '1px solid var(--neutralLight)'
                                }}>
                                    <p style={{ 
                                        margin: 0, 
                                        fontSize: '14px', 
                                        color: 'var(--neutralSecondary)'
                                    }}>
                                        基于 {articleCount} 篇文章生成
                                    </p>
                                </div>
                            )}
                            <div style={{ 
                                fontSize: '15px',
                                lineHeight: '1.8',
                                color: 'var(--neutralPrimary)',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {summary.split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                        {line}
                                        {i < summary.split('\n').length - 1 && <br />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 加载和错误状态 */}
                {isLoading && (
                    <div style={{ 
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        zIndex: 100
                    }}>
                        <Spinner label="正在分析文章并生成总结..." />
                        {articleCount > 0 && (
                            <p style={{ color: 'var(--neutralSecondary)', fontSize: '14px', marginTop: '16px' }}>
                                已找到 {articleCount} 篇文章，正在生成总结...
                            </p>
                        )}
                    </div>
                )}

                {error && !isLoading && !summary && (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        gap: '16px',
                        padding: '20px'
                    }}>
                        <Icon iconName="Error" style={{ fontSize: 48, color: 'var(--error)' }} />
                        <p style={{ color: 'var(--error)', fontSize: '14px', textAlign: 'center' }}>
                            {error}
                        </p>
                    </div>
                )}

                {/* 占位符文本 - 只在没有总结且没有错误时显示 */}
                {!summary && !isLoading && !error && (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        flex: 1,
                        gap: '16px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        maxWidth: '600px',
                        width: 'calc(100% - 40px)',
                        margin: '0 auto'
                    }}>
                        <Icon iconName="Sparkle" style={{ fontSize: 64, color: 'var(--neutralTertiary)' }} />
                        <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--neutralPrimary)' }}>
                            AI文章总结助手
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--neutralSecondary)', maxWidth: '500px' }}>
                            在上方选择文章发布时间和输入话题标签（至少一个），AI将帮您筛选并总结整理RSS文章
                        </p>
                    </div>
                )}

                {/* 错误对话框 */}
                {showErrorDialog && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        backgroundColor: 'rgba(0, 0, 0, 0.3)'
                    }} onClick={this.handleCloseErrorDialog}>
                        <div style={{
                            backgroundColor: 'var(--white)',
                            borderRadius: '4px',
                            padding: '24px',
                            maxWidth: '500px',
                            width: '90%',
                            boxShadow: '0 6.4px 14.4px rgba(0, 0, 0, 0.132), 0 1.2px 3.6px rgba(0, 0, 0, 0.108)',
                            maxHeight: '90%',
                            overflow: 'auto'
                        }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ marginBottom: '16px' }}>
                                <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 600, color: 'var(--neutralPrimary)' }}>错误</h2>
                            </div>
                            <div style={{ marginBottom: '20px', color: 'var(--neutralPrimary)', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                                {errorDialogMessage}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <DefaultButton onClick={this.handleCloseErrorDialog} text="确定" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }
}

export default AIMode
