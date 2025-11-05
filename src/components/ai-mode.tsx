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
import { connect } from "react-redux"
import { RootState } from "../scripts/reducer"
import { RSSSource } from "../scripts/models/source"
import { markRead } from "../scripts/models/item"
import { openItemMenu } from "../scripts/models/app"
import { showItem } from "../scripts/models/page"
import { itemShortcuts } from "../scripts/models/item"
import { FeedFilter } from "../scripts/models/feed"
import ListCard from "./cards/list-card"
import { ViewConfigs } from "../schema-types"
import { ActionStatus } from "../scripts/utils"
import { AIModeMenuContent } from "./ai-mode-menu-content"

// AIMode Context 类型定义
export type AIModeContextType = {
    timeRange: string | null
    topic: string  // 单个话题文本
    topicInput: string
    recentTopics: string[]  // 最近使用的话题（最多5个）
    isComposing: boolean
    isLoading: boolean
    summary: string
    apiEndpoint: string
    apiKey: string
    model: string
    showConfigPanel: boolean
    articleCount: number
    error: string | null
    filteredArticles: RSSItem[]  // 筛选后的文章列表
    setTimeRange: (timeRange: string | null) => void
    setTopic: (topic: string) => void
    setTopicInput: (topicInput: string) => void
    setIsComposing: (isComposing: boolean) => void
    handleGenerateSummary: () => void
    handleClearSummary: () => void
    handleConfigPanelOpen: () => void
    handleTopicInputChange: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => void
    handleTopicInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
    handleTopicInputCompositionStart: () => void
    handleTopicInputCompositionEnd: () => void
    handleTimeRangeChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void
    handleRecentTopicClick: (topic: string) => void
    topicInputRef: React.RefObject<ITextField>
}

type AIModeProps = {
    sources: { [sid: number]: RSSSource }
    items: { [id: number]: RSSItem }
    markRead: (item: RSSItem) => void
    contextMenu: (feedId: string, item: RSSItem, e: React.MouseEvent) => void
    showItem: (fid: string, item: RSSItem) => void
    shortcuts: (item: RSSItem, e: KeyboardEvent) => void
    dispatch: any
    hideArticleList?: boolean  // 是否隐藏文章列表（在侧边栏模式下）
}

// 创建 Context
export const AIModeContext = React.createContext<AIModeContextType | null>(null)

type AIModeState = {
    timeRange: string | null  // 时间范围key，例如 "1" 表示1天，"7" 表示7天
    topic: string  // 单个话题文本
    topicInput: string  // 当前输入的话题文本
    recentTopics: string[]  // 最近使用的话题（最多5个）
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
    filteredArticles: RSSItem[]  // 筛选后的文章列表
}

export class AIModeComponent extends React.Component<AIModeProps, AIModeState> {
    static contextType = AIModeContext
    declare context: React.ContextType<typeof AIModeContext>
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
        // 从localStorage加载最近话题
        const savedRecentTopics = localStorage.getItem('ai-recent-topics')
        const recentTopics = savedRecentTopics ? JSON.parse(savedRecentTopics) : []
        
        this.state = {
            timeRange: null,
            topic: '',
            topicInput: '',
            recentTopics: recentTopics,
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
            articleCount: 0,
            filteredArticles: []
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
            prevState.topic !== this.state.topic ||
            prevState.summary !== this.state.summary ||
            prevState.isLoading !== this.state.isLoading ||
            prevState.showConfigPanel !== this.state.showConfigPanel ||
            prevState.apiEndpoint !== this.state.apiEndpoint ||
            prevState.apiKey !== this.state.apiKey ||
            prevState.model !== this.state.model ||
            prevState.filteredArticles.length !== this.state.filteredArticles.length ||
            prevState.articleCount !== this.state.articleCount ||
            prevState.error !== this.state.error
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
            topic: this.state.topic,
            topicInput: this.state.topicInput,
            recentTopics: this.state.recentTopics,
            isComposing: this.state.isComposing,
            isLoading: this.state.isLoading,
            summary: this.state.summary,
            apiEndpoint: this.state.apiEndpoint,
            apiKey: this.state.apiKey,
            model: this.state.model,
            showConfigPanel: this.state.showConfigPanel,
            articleCount: this.state.articleCount,
            error: this.state.error,
            filteredArticles: this.state.filteredArticles,
            setTimeRange: (timeRange: string | null) => this.setState({ timeRange }),
            setTopic: (topic: string) => this.setState({ topic }),
            setTopicInput: (topicInput: string) => this.setState({ topicInput }),
            setIsComposing: (isComposing: boolean) => this.setState({ isComposing }),
            handleGenerateSummary: this.handleGenerateSummary,
            handleClearSummary: this.handleClearSummary,
            handleConfigPanelOpen: this.handleConfigPanelOpen,
            handleTopicInputChange: this.handleTopicInputChange,
            handleTopicInputKeyDown: this.handleTopicInputKeyDown,
            handleTopicInputCompositionStart: this.handleTopicInputCompositionStart,
            handleTopicInputCompositionEnd: this.handleTopicInputCompositionEnd,
            handleTimeRangeChange: this.handleTimeRangeChange,
            handleRecentTopicClick: this.handleRecentTopicClick,
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
        // 处理Enter键确认话题
        if (event.key === 'Enter' && !this.state.isComposing) {
            event.preventDefault()
            const trimmed = this.state.topicInput.trim()
            if (trimmed) {
                this.setState({ topic: trimmed })
            }
        }
    }

    handleRecentTopicClick = (topic: string) => {
        // 点击常选话题时填充到输入框和话题字段
        this.setState({ 
            topicInput: topic,
            topic: topic
        }, () => {
            // 直接设置 TextField 的值（如果引用存在）
            if (this.topicInputRef.current) {
                const inputElement = this.topicInputRef.current as any
                if (inputElement.setValue) {
                    inputElement.setValue(topic)
                }
                // 聚焦到输入框
                inputElement.focus()
            }
            // 状态更新后立即更新Context，确保输入框能正常显示输入
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeInputChanged')
                window.dispatchEvent(event)
            }
        })
    }

    // 保存话题到最近话题列表
    saveTopicToRecent = (topic: string) => {
        const trimmed = topic.trim()
        if (!trimmed) return

        const { recentTopics } = this.state
        // 移除已存在的相同话题
        const filtered = recentTopics.filter(t => t !== trimmed)
        // 添加到最前面
        const updated = [trimmed, ...filtered].slice(0, 5)  // 最多保留5个
        
        this.setState({ recentTopics: updated })
        // 保存到localStorage
        localStorage.setItem('ai-recent-topics', JSON.stringify(updated))
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

    // 查询符合条件的文章（根据时间范围和话题筛选）
    queryArticles = async (timeRangeDays: number | null, topic: string | null): Promise<RSSItem[]> => {
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

        const query = predicates.length > 0 
            ? lf.op.and.apply(null, predicates)
            : null

        const queryBuilder = db.itemsDB
            .select()
            .from(db.items)
            .orderBy(db.items.date, lf.Order.DESC)
            .limit(1000)  // 增加限制以支持话题筛选（先查询更多，然后在内存中过滤）

        const items = query 
            ? await queryBuilder.where(query).exec() as RSSItem[]
            : await queryBuilder.exec() as RSSItem[]

        // 如果有话题，在内存中过滤标题和内容
        if (topic && topic.trim()) {
            const trimmedTopic = topic.trim()
            const topicRegex = new RegExp(trimmedTopic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') // 转义特殊字符，不区分大小写
            
            return items.filter(item => {
                // 搜索标题、snippet 和 content
                return (
                    topicRegex.test(item.title) ||
                    topicRegex.test(item.snippet || '') ||
                    topicRegex.test(item.content || '')
                )
            })
        }

        return items
    }

    // 生成总结
    generateSummary = async (articles: RSSItem[], topic: string): Promise<string> => {
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

        const topicText = topic ? `，重点关注话题：${topic}` : ''

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
        const { timeRange, topicInput } = this.state

        // 验证时间范围必须选择
        if (!timeRange) {
            this.setState({ 
                showErrorDialog: true,
                errorDialogMessage: '请先选择文章发布时间'
            })
            return
        }

        // 保存当前话题到状态和最近话题列表
        const trimmedTopic = topicInput.trim()
        if (trimmedTopic) {
            this.setState({ topic: trimmedTopic })
            this.saveTopicToRecent(trimmedTopic)
        }

        this.setState({ 
            isLoading: true,
            error: null,
            summary: '',
            articleCount: 0,
            filteredArticles: []
        }, () => {
            // 状态更新后立即通知 Context 更新
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('aiModeUpdated')
                window.dispatchEvent(event)
            }
        })

        try {
            // 解析时间范围
            const timeRangeDays = this.parseTimeRange(timeRange)

            // 获取当前话题（如果有的话）
            const currentTopic = trimmedTopic || this.state.topic || null

            // 查询文章（根据时间范围和话题）
            const articles = await this.queryArticles(timeRangeDays, currentTopic)
            
            if (articles.length === 0) {
                const topicMessage = currentTopic ? `或话题"${currentTopic}"` : ''
                this.setState({
                    isLoading: false,
                    error: `没有找到符合条件的文章。请尝试调整时间范围${topicMessage}。`
                }, () => {
                    if (typeof window !== 'undefined') {
                        const event = new CustomEvent('aiModeUpdated')
                        window.dispatchEvent(event)
                    }
                })
                return
            }

            // 将文章添加到 Redux store，确保可以点击查看
            const { dispatch, items, sources } = this.props
            
            // 确保所有文章的 source 都存在
            const articlesWithValidSources = articles.filter(item => {
                const source = sources[item.source]
                if (!source) {
                    console.warn(`文章 ${item._id} 的 source ${item.source} 不存在`)
                    return false
                }
                return true
            })
            
            if (articlesWithValidSources.length !== articles.length) {
                console.warn(`有 ${articles.length - articlesWithValidSources.length} 篇文章的 source 不存在，已过滤`)
            }
            
            // 注意：这些文章已经在数据库和 store 中了（因为我们是从数据库查询的）
            // 我们不需要调用 fetchItemsSuccess，因为：
            // 1. 这些文章已经在 itemReducer 的 state 中了
            // 2. 调用 fetchItemsSuccess 会导致 feedReducer 将它们再次添加到 feed 中，造成重复
            // 3. showItem 可以直接使用 store 中已有的文章
            
            // 保存筛选后的文章列表
            this.setState({ 
                articleCount: articlesWithValidSources.length, 
                filteredArticles: articlesWithValidSources,
                isLoading: false
            }, () => {
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
            })
        } catch (error) {
            console.error('查询文章失败:', error)
            const errorMessage = error instanceof Error ? error.message : '查询失败，请稍后重试'
            this.setState({ 
                isLoading: false,
                error: errorMessage,
                showErrorDialog: true,
                errorDialogMessage: errorMessage
            }, () => {
                if (typeof window !== 'undefined') {
                    const event = new CustomEvent('aiModeUpdated')
                    window.dispatchEvent(event)
                }
            })
        }
    }

    handleClearSummary = () => {
        this.setState({ 
            summary: '',
            error: null,
            articleCount: 0,
            filteredArticles: []
        })
    }

    handleCloseErrorDialog = () => {
        this.setState({ showErrorDialog: false, errorDialogMessage: '' })
    }

    render() {
        // 优先使用 Context 中的状态（如果存在），否则使用本地 state
        const context = this.context
        const useContext = context !== null && context !== undefined
        
        const { 
            timeRange, 
            topic,
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
            articleCount,
            filteredArticles
        } = useContext ? {
            ...this.state,
            summary: context.summary !== undefined ? context.summary : this.state.summary,
            filteredArticles: context.filteredArticles !== undefined ? context.filteredArticles : this.state.filteredArticles,
            articleCount: context.articleCount !== undefined ? context.articleCount : this.state.articleCount,
            isLoading: context.isLoading !== undefined ? context.isLoading : this.state.isLoading,
            error: context.error !== undefined ? context.error : this.state.error
        } : this.state
        
        const { sources, markRead, contextMenu, showItem, shortcuts } = this.props

        return (
            <div className={`ai-mode-container ${summary ? 'has-summary' : 'no-summary'}`} style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

                {/* 筛选后的文章列表 */}
                {filteredArticles.length > 0 && (
                    <div 
                        ref={this.summaryContainerRef}
                        className="ai-summary-container has-summary"
                        style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: 'var(--neutralLighterAlt)',
                            minHeight: 0
                        }}
                    >
                        <div style={{
                            backgroundColor: 'var(--white)',
                            borderRadius: '8px',
                            padding: '24px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                            overflow: 'hidden'
                        }}>
                            <h3 style={{
                                margin: '0 0 16px 0',
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'var(--neutralPrimary)'
                            }}>
                                筛选后的文章 ({filteredArticles.length} 篇)
                            </h3>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                {filteredArticles.map((item) => {
                                    const source = sources[item.source]
                                    if (!source) return null
                                    const filter = new FeedFilter()
                                    return (
                                        <ListCard
                                            key={item._id}
                                            feedId="ai-mode"
                                            item={item}
                                            source={source}
                                            filter={filter}
                                            viewConfigs={ViewConfigs.ShowSnippet}
                                            shortcuts={shortcuts}
                                            markRead={markRead}
                                            contextMenu={contextMenu}
                                            showItem={showItem}
                                        />
                                    )
                                })}
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
                        <Spinner label="正在查询文章..." />
                    </div>
                )}

                {error && !isLoading && filteredArticles.length === 0 && (
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

                {/* 占位符文本 - 只在没有文章且没有错误时显示 */}
                {filteredArticles.length === 0 && !isLoading && !error && (
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
                            在上方选择文章发布时间，然后点击"查询文章"按钮筛选RSS文章
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

const mapStateToProps = (state: RootState) => ({
    sources: state.sources,
    items: state.items
})

const mapDispatchToProps = dispatch => ({
    dispatch: dispatch,
    markRead: (item: RSSItem) => dispatch(markRead(item)),
    contextMenu: (feedId: string, item: RSSItem, e: React.MouseEvent) => 
        dispatch(openItemMenu(item, feedId, e)),
    showItem: (fid: string, item: RSSItem) => dispatch(showItem(fid, item)),
    shortcuts: (item: RSSItem, e: KeyboardEvent) => dispatch(itemShortcuts(item, e))
})

const AIMode = connect(mapStateToProps, mapDispatchToProps, null, { forwardRef: true })(AIModeComponent)
export default AIMode
