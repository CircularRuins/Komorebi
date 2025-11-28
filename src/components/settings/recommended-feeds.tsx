import * as React from "react"
import intl from "react-intl-universal"
import {
    Pivot,
    PivotItem,
    Icon,
} from "@fluentui/react"
import {
    RecommendedFeedGroup,
    RecommendedFeed,
} from "../../scripts/utils/recommended-feeds"
import {
    MoreSection,
    loadMoreSections,
} from "../../scripts/utils/more-sections"
import RecommendedFeedCard from "./recommended-feed-card"
import { getFeedIcon, getCachedFeedIcon } from "../../scripts/utils"

type RecommendedFeedsProps = {
    groups: RecommendedFeedGroup[]
    subscribedUrls: Set<string>
    onSubscribe: (feed: RecommendedFeed) => Promise<void>
    isSubscribing: { [url: string]: boolean }
    sources?: { [sid: number]: { url: string; iconurl?: string } }
}

type RecommendedFeedsState = {
    selectedGroupKey: string
    feedIcons: { [url: string]: string }
    moreSections: MoreSection[]
    expandedSections: Set<string>
}

class RecommendedFeeds extends React.Component<RecommendedFeedsProps, RecommendedFeedsState> {
    markdownContentRefs: { [key: string]: React.RefObject<HTMLDivElement> } = {}

    constructor(props: RecommendedFeedsProps) {
        super(props)
        // 默认选中第一个分组
        this.state = {
            selectedGroupKey: props.groups.length > 0 ? props.groups[0].groupName : "",
            feedIcons: {},
            moreSections: [],
            expandedSections: new Set<string>(),
        }
    }

    fetchIconsForFeeds = async (feeds: RecommendedFeed[], force: boolean = false) => {
        const iconPromises = feeds.map(async (feed) => {
            try {
                let iconUrl: string | null = null
                
                // 统一获取顺序：1. localStorage 缓存 → 2. XML
                // 1. 检查 localStorage 缓存
                if (!force) {
                    iconUrl = getCachedFeedIcon(feed.url)
                }
                
                // 2. 从 XML 获取
                if (!iconUrl) {
                    iconUrl = await getFeedIcon(feed.url, force)
                }
                
                if (iconUrl) {
                    this.setState(prevState => ({
                        feedIcons: {
                            ...prevState.feedIcons,
                            [feed.url]: iconUrl,
                        },
                    }))
                }
            } catch (error) {
                console.error(`Failed to fetch icon for ${feed.url}:`, error)
            }
        })
        
        await Promise.all(iconPromises)
    }

    componentDidMount = async () => {
        // 为所有推荐源获取图标
        const allFeeds = this.props.groups.flatMap(group => group.feeds)
        
        // 统一获取顺序：1. localStorage 缓存 → 2. XML
        const cachedIcons: { [url: string]: string } = {}
        allFeeds.forEach(feed => {
            // YouTube feed 使用本地图标，不需要缓存
            if (/youtube\.com/.test(feed.url)) {
                cachedIcons[feed.url] = "icons/youtube-favicon-32x32.png"
            } else {
                let iconUrl: string | null = null
                
                // 1. 检查 localStorage 缓存
                iconUrl = getCachedFeedIcon(feed.url)
                
                if (iconUrl) {
                    cachedIcons[feed.url] = iconUrl
                }
            }
        })
        
        // 如果有缓存的图标，先更新 state
        if (Object.keys(cachedIcons).length > 0) {
            this.setState(prevState => ({
                feedIcons: {
                    ...prevState.feedIcons,
                    ...cachedIcons,
                },
            }))
        }
        
        // 为没有缓存的 feed 获取图标
        const feedsNeedingFetch = allFeeds.filter(feed => !cachedIcons[feed.url])
        await this.fetchIconsForFeeds(feedsNeedingFetch, false)
        
        // 加载 More sections 数据
        const moreSections = await loadMoreSections()
        console.log("Loaded more sections:", moreSections)
        this.setState({ moreSections }, () => {
            // 在状态更新后添加链接事件处理器
            setTimeout(() => this.attachLinkHandlers(), 0)
        })
    }

    componentDidUpdate = async (prevProps: RecommendedFeedsProps, prevState: RecommendedFeedsState) => {
        const allFeeds = this.props.groups.flatMap(group => group.feeds)
        let needsUpdate = false
        const feedsToUpdate: RecommendedFeed[] = []
        
        // 如果 groups 发生变化，重新获取图标
        if (prevProps.groups !== this.props.groups) {
            const prevFeeds = prevProps.groups.flatMap(group => group.feeds)
            
            // 找出新增的 feed
            const newFeeds = allFeeds.filter(feed => 
                !prevFeeds.some(prevFeed => prevFeed.url === feed.url)
            )
            
            if (newFeeds.length > 0) {
                feedsToUpdate.push(...newFeeds)
                needsUpdate = true
            }
            
            // 找出之前获取失败但现在需要重新获取的 feed
            const failedFeeds = allFeeds.filter(feed => {
                const hasIcon = this.state.feedIcons[feed.url]
                const wasInPrev = prevFeeds.some(prevFeed => prevFeed.url === feed.url)
                return !hasIcon && wasInPrev
            })
            
            if (failedFeeds.length > 0) {
                feedsToUpdate.push(...failedFeeds)
                needsUpdate = true
            }
        }
        
        // 统一处理需要更新的 feed
        if (needsUpdate && feedsToUpdate.length > 0) {
            // 去重
            const uniqueFeeds = Array.from(
                new Map(feedsToUpdate.map(feed => [feed.url, feed])).values()
            )
            await this.fetchIconsForFeeds(uniqueFeeds, false)
        }
        
        // 如果 moreSections 发生变化，重新添加链接事件处理器
        if (this.state.moreSections !== prevState.moreSections || this.state.expandedSections !== prevState.expandedSections) {
            setTimeout(() => this.attachLinkHandlers(), 0)
        }
    }

    attachLinkHandlers = () => {
        // 为所有 markdown-content 中的链接添加点击事件
        this.state.moreSections.forEach(section => {
            if (!this.markdownContentRefs[section.id]) {
                this.markdownContentRefs[section.id] = React.createRef<HTMLDivElement>()
            }
            const ref = this.markdownContentRefs[section.id]
            if (ref && ref.current) {
                const links = ref.current.querySelectorAll('a[href]')
                links.forEach(link => {
                    // 检查是否已经添加过事件监听器
                    if ((link as any).__linkHandlerAttached) {
                        return
                    }
                    
                    // 标记为已处理
                    (link as any).__linkHandlerAttached = true
                    
                    // 添加点击事件监听器
                    link.addEventListener('click', (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const href = link.getAttribute('href')
                        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                            if (window.utils && window.utils.openExternal) {
                                window.utils.openExternal(href, false)
                            } else {
                                // 降级方案：使用 window.open
                                window.open(href, '_blank')
                            }
                        }
                    })
                })
            }
        })
    }

    handlePivotChange = (item?: PivotItem, ev?: React.MouseEvent<HTMLElement>) => {
        if (item && item.props.itemKey) {
            this.setState({ selectedGroupKey: item.props.itemKey })
        }
    }

    toggleSection = (sectionId: string) => {
        this.setState(prevState => {
            const newExpandedSections = new Set(prevState.expandedSections)
            const wasExpanded = newExpandedSections.has(sectionId)
            if (wasExpanded) {
                newExpandedSections.delete(sectionId)
            } else {
                newExpandedSections.add(sectionId)
            }
            return { expandedSections: newExpandedSections }
        }, () => {
            // 在展开section后，添加链接事件处理器
            setTimeout(() => this.attachLinkHandlers(), 0)
        })
    }

    render() {
        const { groups, subscribedUrls, onSubscribe, isSubscribing } = this.props
        const { selectedGroupKey } = this.state

        if (groups.length === 0) {
            return null
        }

        return (
            <div style={{ marginTop: "24px", paddingBottom: "16px" }}>
                <Pivot
                    selectedKey={selectedGroupKey}
                    onLinkClick={this.handlePivotChange}
                >
                    {groups.map((group) => (
                        <PivotItem
                            key={group.groupName}
                            headerText={group.groupName}
                            itemKey={group.groupName}
                        >
                            <div style={{ padding: "4px 16px", boxSizing: "border-box" }}>
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        justifyContent: "space-between",
                                        gap: "12px",
                                        width: "100%",
                                        maxWidth: "100%",
                                        maxHeight: "calc(100vh - 322px)",
                                        overflowY: "auto",
                                        overflowX: "hidden",
                                        boxSizing: "border-box",
                                    }}
                                >
                                    {group.feeds.map((feed, index) => {
                                        const isSubscribed = subscribedUrls.has(feed.url)
                                        const isSubscribingFeed = isSubscribing[feed.url] || false
                                        const iconUrl = this.state.feedIcons[feed.url]
                                        return (
                                            <RecommendedFeedCard
                                                key={`${feed.url}-${index}`}
                                                feed={feed}
                                                isSubscribed={isSubscribed}
                                                onSubscribe={onSubscribe}
                                                isSubscribing={isSubscribingFeed}
                                                iconUrl={iconUrl}
                                            />
                                        )
                                    })}
                                </div>
                            </div>
                        </PivotItem>
                    ))}
                    <PivotItem
                        key="more"
                        headerText="More"
                        itemKey="more"
                    >
                        <div style={{ padding: "4px 16px", boxSizing: "border-box" }}>
                            {this.state.moreSections.length === 0 ? (
                                <div style={{ color: "var(--neutralSecondary)", fontSize: "14px" }}>
                                    Loading...
                                </div>
                            ) : (
                                this.state.moreSections.map((section) => {
                                    const isExpanded = this.state.expandedSections.has(section.id)
                                    const title = intl.get(section.titleKey) || section.titleKey
                                    return (
                                        <div
                                            key={section.id}
                                            style={{
                                                marginBottom: "16px",
                                                border: "1px solid var(--neutralLight)",
                                                borderRadius: "8px",
                                                backgroundColor: "var(--white)",
                                                transition: "box-shadow 0.2s ease",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)"
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = "none"
                                            }}
                                        >
                                            <div
                                                onClick={() => this.toggleSection(section.id)}
                                                style={{
                                                    padding: "12px 16px",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "space-between",
                                                    backgroundColor: "var(--white)",
                                                    userSelect: "none",
                                                    transition: "background-color 0.2s ease",
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = "var(--white)"
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = "var(--white)"
                                                }}
                                            >
                                                <span style={{ fontWeight: 500, fontSize: "14px", color: "var(--neutralPrimary)" }}>
                                                    {title}
                                                </span>
                                                <Icon
                                                    iconName={isExpanded ? "ChevronDown" : "ChevronRight"}
                                                    style={{ fontSize: "12px", color: "var(--neutralSecondary)" }}
                                                />
                                            </div>
                                            {isExpanded && (
                                                <div
                                                    style={{
                                                        padding: "16px",
                                                        borderTop: "1px solid var(--neutralLight)",
                                                        backgroundColor: "var(--white)",
                                                    }}
                                                >
                                                    {section.content ? (
                                                        <div
                                                            ref={(() => {
                                                                if (!this.markdownContentRefs[section.id]) {
                                                                    this.markdownContentRefs[section.id] = React.createRef<HTMLDivElement>()
                                                                }
                                                                return this.markdownContentRefs[section.id]
                                                            })()}
                                                            style={{
                                                                color: "var(--neutralPrimary)",
                                                                fontSize: "14px",
                                                                lineHeight: "1.8",
                                                            }}
                                                            className="markdown-content"
                                                            dangerouslySetInnerHTML={{ __html: section.content }}
                                                        />
                                                    ) : (
                                                        <div style={{ color: "var(--neutralSecondary)", fontSize: "14px" }}>
                                                            Content coming soon...
                                                        </div>
                                                    )}
                                                    <style>{`
                                                        .markdown-content h1 {
                                                            font-size: 20px;
                                                            font-weight: 600;
                                                            margin: 16px 0 12px 0;
                                                            color: var(--neutralPrimary);
                                                        }
                                                        .markdown-content h2 {
                                                            font-size: 18px;
                                                            font-weight: 600;
                                                            margin: 14px 0 10px 0;
                                                            color: var(--neutralPrimary);
                                                        }
                                                        .markdown-content h3 {
                                                            font-size: 16px;
                                                            font-weight: 600;
                                                            margin: 12px 0 8px 0;
                                                            color: var(--neutralPrimary);
                                                        }
                                                        .markdown-content p {
                                                            margin: 8px 0;
                                                            color: var(--neutralPrimary);
                                                        }
                                                        .markdown-content ul, .markdown-content ol {
                                                            margin: 8px 0;
                                                            padding-left: 24px;
                                                        }
                                                        .markdown-content li {
                                                            margin: 4px 0;
                                                            color: var(--neutralPrimary);
                                                        }
                                                        .markdown-content code {
                                                            background-color: var(--neutralLighter);
                                                            padding: 2px 6px;
                                                            border-radius: 3px;
                                                            font-family: 'Courier New', monospace;
                                                            font-size: 13px;
                                                        }
                                                        .markdown-content pre {
                                                            background-color: var(--neutralLighter);
                                                            padding: 12px;
                                                            border-radius: 4px;
                                                            overflow-x: auto;
                                                            margin: 12px 0;
                                                        }
                                                        .markdown-content pre code {
                                                            background-color: transparent;
                                                            padding: 0;
                                                        }
                                                        .markdown-content a {
                                                            color: var(--themePrimary);
                                                            text-decoration: none;
                                                        }
                                                        .markdown-content a:hover {
                                                            text-decoration: underline;
                                                        }
                                                        .markdown-content strong {
                                                            font-weight: 600;
                                                        }
                                                        .markdown-content em {
                                                            font-style: italic;
                                                        }
                                                        .markdown-content img {
                                                            max-width: 100%;
                                                            height: auto;
                                                            margin: 12px 0;
                                                            border-radius: 4px;
                                                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                                                        }
                                                    `}</style>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </PivotItem>
                </Pivot>
            </div>
        )
    }
}

export default RecommendedFeeds

