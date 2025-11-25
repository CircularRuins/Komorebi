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
    addSource: (url: string) => Promise<number>
    deleteSource: (source: RSSSource) => Promise<void>
    clearSourceIcon: (source: RSSSource) => void
}

type SourcesTabState = {
    showSuccessMessage: boolean
    newUrl: string
    recommendedFeeds: RecommendedFeedGroup[]
    isSubscribing: { [url: string]: boolean }
    lastOperationType: "subscribe" | "unsubscribe" | null
}

class SourcesTab extends React.Component<SourcesTabProps, SourcesTabState> {
    private tabBodyRef: React.RefObject<HTMLDivElement>

    constructor(props) {
        super(props)
        this.tabBodyRef = React.createRef()
        this.state = {
            newUrl: "",
            showSuccessMessage: false,
            recommendedFeeds: [],
            isSubscribing: {},
            lastOperationType: null,
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
                // 1秒后自动隐藏
                setTimeout(() => {
                    this.setState({ showSuccessMessage: false })
                }, 1000)
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
        const existingSource = Object.values(this.props.sources).find(
            source => source.url === url
        )
        const isAlreadySubscribed = !!existingSource

        // 设置操作中状态
        this.setState(prevState => ({
            isSubscribing: {
                ...prevState.isSubscribing,
                [url]: true,
            },
        }))

        try {
            if (isAlreadySubscribed) {
                // 取消订阅
                await this.props.deleteSource(existingSource)
                // 操作成功，显示提示
                this.setState({
                    showSuccessMessage: true,
                    lastOperationType: "unsubscribe",
                })
            } else {
                // 订阅
                await this.props.addSource(url)
                // 操作成功，显示提示
                this.setState({
                    showSuccessMessage: true,
                    lastOperationType: "subscribe",
                })
            }
            // 1秒后自动隐藏
            setTimeout(() => {
                this.setState({ showSuccessMessage: false, lastOperationType: null })
            }, 1000)
        } catch (e) {
            // 错误已经在 addSource/deleteSource 中处理了
        } finally {
            // 清除操作中状态
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
        <div className="tab-body" ref={this.tabBodyRef} style={{ position: 'relative' }}>
            {this.props.serviceOn && (
                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("sources.serviceWarning")}
                </MessageBar>
            )}
            {/* 成功提示 Toast */}
            {this.state.showSuccessMessage && (
                <Stack
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10000,
                        backgroundColor: 'var(--neutralDark)',
                        color: 'var(--white)',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        transition: 'opacity 0.2s ease-out',
                    }}
                    horizontal
                    tokens={{ childrenGap: 8 }}
                    verticalAlign="center"
                    horizontalAlign="center">
                    <Icon iconName="CheckMark" style={{ fontSize: 16 }} />
                    <span style={{ fontSize: 13 }}>
                        {this.state.lastOperationType === "unsubscribe"
                            ? intl.get("sources.successUnsubscribe")
                            : intl.get("sources.successAdd")}
                    </span>
                </Stack>
            )}
            {/* 添加订阅源部分 */}
            <div style={{ marginTop: '32px', marginBottom: '32px' }}>
                <form onSubmit={this.addSource}>
                <Stack horizontal>
                    <Stack.Item styles={{ root: { width: "66.67%" } }}>
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
                            placeholder="RSS URL"
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
                            iconProps={{ iconName: "Add" }}
                            styles={{
                                root: {
                                    minWidth: "32px",
                                    width: "32px",
                                    height: "32px",
                                    padding: 0,
                                },
                                icon: {
                                    fontSize: "16px",
                                },
                            }}
                            title={intl.get("add")}
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
                        sources={this.props.sources}
                    />
                </div>
            )}
        </div>
    )
}

export default SourcesTab
