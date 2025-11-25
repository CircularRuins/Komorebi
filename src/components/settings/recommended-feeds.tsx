import * as React from "react"
import intl from "react-intl-universal"
import {
    Pivot,
    PivotItem,
} from "@fluentui/react"
import {
    RecommendedFeedGroup,
    RecommendedFeed,
} from "../../scripts/utils/recommended-feeds"
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
}

class RecommendedFeeds extends React.Component<RecommendedFeedsProps, RecommendedFeedsState> {
    constructor(props: RecommendedFeedsProps) {
        super(props)
        // 默认选中第一个分组
        this.state = {
            selectedGroupKey: props.groups.length > 0 ? props.groups[0].groupName : "",
            feedIcons: {},
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
    }

    componentDidUpdate = async (prevProps: RecommendedFeedsProps) => {
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
    }

    handlePivotChange = (item?: PivotItem, ev?: React.MouseEvent<HTMLElement>) => {
        if (item && item.props.itemKey) {
            this.setState({ selectedGroupKey: item.props.itemKey })
        }
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
                        headerText={intl.get("more")}
                        itemKey="more"
                    >
                        <div style={{ padding: "4px 16px", boxSizing: "border-box" }}>
                            {/* More tab content - to be implemented */}
                        </div>
                    </PivotItem>
                </Pivot>
            </div>
        )
    }
}

export default RecommendedFeeds

