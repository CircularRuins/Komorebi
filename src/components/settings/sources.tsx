import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    DefaultButton,
    TextField,
    Stack,
    PrimaryButton,
    MessageBar,
    MessageBarType,
    Icon,
    ProgressIndicator,
} from "@fluentui/react"
import {
    SourceState,
    RSSSource,
} from "../../scripts/models/source"
import { urlTest } from "../../scripts/utils"
import { loadRecommendedFeeds, RecommendedFeedGroup, RecommendedFeed } from "../../scripts/utils/recommended-feeds"
import RecommendedFeeds from "./recommended-feeds"

type SourcesTabProps = {
    sources: SourceState
    serviceOn: boolean
    fetchingItems: boolean
    fetchingTotal: number
    fetchingProgress: number
    isOPMLImport: boolean
    addSource: (url: string) => Promise<number>
    clearSourceIcon: (source: RSSSource) => void
    importOPML: (onError?: (title: string, content: string) => void) => void
    exportOPML: () => void
}

type SourcesTabState = {
    showSuccessMessage: boolean
    showImportErrorDialog: boolean
    importErrorTitle: string
    importErrorContent: string
    newUrl: string
    recommendedFeeds: RecommendedFeedGroup[]
    isSubscribing: { [url: string]: boolean }
}

class SourcesTab extends React.Component<SourcesTabProps, SourcesTabState> {
    private tabBodyRef: React.RefObject<HTMLDivElement>

    constructor(props) {
        super(props)
        this.tabBodyRef = React.createRef()
        this.state = {
            newUrl: "",
            showSuccessMessage: false,
            showImportErrorDialog: false,
            importErrorTitle: "",
            importErrorContent: "",
            recommendedFeeds: [],
            isSubscribing: {},
        }
    }

    componentDidMount = async () => {
        // 加载推荐订阅源
        try {
            const feeds = await loadRecommendedFeeds()
            this.setState({ recommendedFeeds: feeds })
        } catch (error) {
            console.error("Failed to load recommended feeds:", error)
        }
    }

    handleInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        // Fluent UI TextField 的 onChange 事件签名是 (event, newValue?: string)
        // 直接使用 newValue 参数更新状态，避免访问可能为 null 的 currentTarget
        if (newValue !== undefined) {
            this.setState({ newUrl: newValue })
        }
    }

    handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // 防止Command+V或Ctrl+V触发表单提交
        if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
            event.stopPropagation()
        }
    }

    handleImportError = (title: string, content: string) => {
        this.setState({
            showImportErrorDialog: true,
            importErrorTitle: title,
            importErrorContent: content,
        })
    }

    handleCloseImportErrorDialog = () => {
        this.setState({
            showImportErrorDialog: false,
            importErrorTitle: "",
            importErrorContent: "",
        })
    }

    handleCopyImportError = () => {
        const text = `${this.state.importErrorTitle}: ${this.state.importErrorContent}`
        window.utils.writeClipboard(text)
    }

    addSource = async (event: React.FormEvent) => {
        event.preventDefault()
        let trimmed = this.state.newUrl.trim()
        if (urlTest(trimmed)) {
            try {
                await this.props.addSource(trimmed)
                // 添加成功，显示提示并清空输入框
                this.setState({
                    newUrl: "",
                    showSuccessMessage: true,
                })
            } catch (e) {
                // 错误已经在 addSource 中处理了，这里不需要额外处理
            }
        }
    }

    handleSubscribeRecommended = async (feed: RecommendedFeed) => {
        const url = feed.url
        if (this.state.isSubscribing[url]) {
            return
        }

        // 检查是否已订阅
        const isAlreadySubscribed = Object.values(this.props.sources).some(
            source => source.url === url
        )
        if (isAlreadySubscribed) {
            return
        }

        // 设置订阅中状态
        this.setState(prevState => ({
            isSubscribing: {
                ...prevState.isSubscribing,
                [url]: true,
            },
        }))

        try {
            await this.props.addSource(url)
            // 订阅成功，显示提示
            this.setState({
                showSuccessMessage: true,
            })
        } catch (e) {
            // 错误已经在 addSource 中处理了
        } finally {
            // 清除订阅中状态
            this.setState(prevState => {
                const newState = { ...prevState.isSubscribing }
                delete newState[url]
                return { isSubscribing: newState }
            })
        }
    }

    getSubscribedUrls = (): Set<string> => {
        return new Set(Object.values(this.props.sources).map(source => source.url))
    }



    render = () => (
        <div className="tab-body" ref={this.tabBodyRef}>
            {this.props.serviceOn && (
                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("sources.serviceWarning")}
                </MessageBar>
            )}
            {/* 成功提示弹窗 */}
            {this.state.showSuccessMessage && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}>
                    {/* 弹窗内容 */}
                    <div
                        style={{
                            position: 'relative',
                            backgroundColor: 'var(--white)',
                            borderRadius: '4px',
                            padding: '24px',
                            minWidth: '280px',
                            maxWidth: '90%',
                            boxShadow: '0 6.4px 14.4px rgba(0, 0, 0, 0.132), 0 1.2px 3.6px rgba(0, 0, 0, 0.108)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '16px',
                            pointerEvents: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        {/* 成功图标 */}
                        <div
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                backgroundColor: '#e8f5e9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                            <Icon
                                iconName="CheckMark"
                                styles={{
                                    root: {
                                        fontSize: '32px',
                                        color: '#2e7d32',
                                        fontWeight: 600,
                                    },
                                }}
                            />
                        </div>
                        {/* 提示文字 */}
                        <div
                            style={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: 'var(--neutralPrimary)',
                                textAlign: 'center',
                                lineHeight: '1.4',
                            }}>
                            {intl.get("sources.successAdd")}
                        </div>
                        {/* 确认按钮 */}
                        <PrimaryButton
                            text={intl.get("confirm")}
                            onClick={() => this.setState({ showSuccessMessage: false })}
                            styles={{
                                root: {
                                    minWidth: '100px',
                                    height: '32px',
                                    borderRadius: '4px',
                                },
                            }}
                        />
                    </div>
                </div>
            )}
            {/* OPML导入导出部分 */}
            <div style={{ marginTop: '0', marginBottom: '32px' }}>
                <Label styles={{ root: { fontSize: '14px', fontWeight: 600 } }}>{intl.get("sources.opmlFile")}</Label>
                <Stack horizontal>
                    <Stack.Item>
                        <PrimaryButton
                            onClick={() => this.props.importOPML(this.handleImportError)}
                            text={intl.get("sources.import")}
                            styles={{
                                root: {
                                    height: '28px',
                                    minWidth: '80px',
                                    fontSize: '13px',
                                },
                            }}
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <DefaultButton
                            onClick={this.props.exportOPML}
                            text={intl.get("sources.export")}
                            styles={{
                                root: {
                                    height: '28px',
                                    minWidth: '80px',
                                    fontSize: '13px',
                                },
                            }}
                        />
                    </Stack.Item>
                </Stack>
                {this.props.isOPMLImport && this.props.fetchingItems && this.props.fetchingTotal > 0 && (
                    <div style={{ marginTop: '12px' }}>
                        <ProgressIndicator
                            percentComplete={this.props.fetchingProgress / this.props.fetchingTotal}
                        />
                    </div>
                )}
            </div>

            {/* 添加订阅源部分 */}
            <div style={{ marginTop: '32px', marginBottom: '32px' }}>
                <form onSubmit={this.addSource}>
                <Label htmlFor="newUrl" styles={{ root: { fontSize: '14px', fontWeight: 600 } }}>{intl.get("sources.add")}</Label>
                <Stack horizontal>
                    <Stack.Item grow>
                        <TextField
                            onGetErrorMessage={v => {
                                const trimmed = v.trim()
                                // 空字符串不显示错误（允许清空）
                                if (trimmed === "") return ""
                                return urlTest(trimmed)
                                    ? ""
                                    : intl.get("sources.badUrl")
                            }}
                            validateOnLoad={false}
                            placeholder={intl.get("sources.inputUrl")}
                            value={this.state.newUrl}
                            id="newUrl"
                            name="newUrl"
                            onChange={this.handleInputChange}
                            onKeyDown={this.handleInputKeyDown}
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            disabled={!urlTest(this.state.newUrl.trim())}
                            type="submit"
                            text={intl.get("add")}
                        />
                    </Stack.Item>
                </Stack>
                </form>
            </div>

            {/* 推荐订阅源模块 - 放在添加订阅源表单下方 */}
            {this.state.recommendedFeeds.length > 0 && (
                <div style={{ marginTop: '32px', marginBottom: '32px' }}>
                    <RecommendedFeeds
                        groups={this.state.recommendedFeeds}
                        subscribedUrls={this.getSubscribedUrls()}
                        onSubscribe={this.handleSubscribeRecommended}
                        isSubscribing={this.state.isSubscribing}
                    />
                </div>
            )}

            {/* OPML导入错误对话框 */}
            {this.state.showImportErrorDialog && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                    onClick={this.handleCloseImportErrorDialog}>
                    {/* 对话框内容 */}
                    <div
                        style={{
                            position: 'relative',
                            backgroundColor: 'var(--white)',
                            borderRadius: '4px',
                            padding: '20px',
                            maxWidth: '400px',
                            width: '85%',
                            boxShadow: '0 6.4px 14.4px rgba(0, 0, 0, 0.132), 0 1.2px 3.6px rgba(0, 0, 0, 0.108)',
                            maxHeight: '80%',
                            overflow: 'auto',
                            pointerEvents: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        {/* 标题 */}
                        <div style={{ marginBottom: '12px' }}>
                            <h2 style={{ 
                                margin: 0, 
                                fontSize: '18px', 
                                fontWeight: 600, 
                                color: 'var(--neutralPrimary)' 
                            }}>
                                {this.state.importErrorTitle}
                            </h2>
                        </div>
                        {/* 错误内容区域 */}
                        <div style={{ 
                            marginBottom: '16px', 
                            color: 'var(--neutralPrimary)', 
                            fontSize: '13px', 
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.5',
                        }}>
                            {this.state.importErrorContent}
                        </div>
                        {/* 按钮区域 */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'flex-end',
                            gap: '8px',
                        }}>
                            <DefaultButton 
                                onClick={this.handleCopyImportError} 
                                text={intl.get("context.copy")} 
                            />
                            <DefaultButton 
                                onClick={this.handleCloseImportErrorDialog} 
                                text={intl.get("confirm")} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SourcesTab
