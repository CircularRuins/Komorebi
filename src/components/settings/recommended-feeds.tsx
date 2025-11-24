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
import { fetchFavicon, parseRSS, validateFavicon, getCachedFeedIcon, setCachedFeedIcon } from "../../scripts/utils"

type RecommendedFeedsProps = {
    groups: RecommendedFeedGroup[]
    subscribedUrls: Set<string>
    onSubscribe: (feed: RecommendedFeed) => Promise<void>
    isSubscribing: { [url: string]: boolean }
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

    getIconFromFeed = async (url: string): Promise<string | null> => {
        try {
            // 检测是否是 YouTube feed，统一使用本地 YouTube 图标
            if (/youtube\.com/.test(url)) {
                return "icons/youtube-favicon-32x32.png"
            }
            
            const feed = await parseRSS(url)
            let iconUrl: string | null = null
            
            // RSS 2.0: <image><url>
            if (feed.image?.url) {
                iconUrl = feed.image.url
            }
            // Atom: <logo> 或 <icon>
            else if (feed.logo) {
                iconUrl = feed.logo
            }
            else if (feed.icon) {
                iconUrl = feed.icon
            }
            // iTunes播客: <itunes:image>
            else if (feed.itunesImage?.href) {
                iconUrl = feed.itunesImage.href
            }
            else if (typeof feed.itunesImage === "string") {
                iconUrl = feed.itunesImage
            }
            
            // 验证图标URL是否有效（对于从 feed XML 中直接获取的图标）
            if (iconUrl && await validateFavicon(iconUrl)) {
                return iconUrl
            }
            return null
        } catch {
            return null
        }
    }

    componentDidMount = async () => {
        // 为所有推荐源获取图标
        const allFeeds = this.props.groups.flatMap(group => group.feeds)
        
        // 先从缓存加载图标
        const cachedIcons: { [url: string]: string } = {}
        allFeeds.forEach(feed => {
            // YouTube feed 使用本地图标，不需要缓存
            if (/youtube\.com/.test(feed.url)) {
                cachedIcons[feed.url] = "icons/youtube-favicon-32x32.png"
            } else {
                const cachedIcon = getCachedFeedIcon(feed.url)
                if (cachedIcon) {
                    cachedIcons[feed.url] = cachedIcon
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
        const iconPromises = feedsNeedingFetch.map(async (feed) => {
            try {
                // 检测是否是 YouTube feed，统一使用本地 YouTube 图标
                if (/youtube\.com/.test(feed.url)) {
                    const iconUrl = "icons/youtube-favicon-32x32.png"
                    this.setState(prevState => ({
                        feedIcons: {
                            ...prevState.feedIcons,
                            [feed.url]: iconUrl,
                        },
                    }))
                    return
                }
                
                // 1. 先尝试从 feed XML 中获取图标
                let iconUrl = await this.getIconFromFeed(feed.url)
                
                // 2. 如果 feed XML 中没有，再尝试从网站 HTML 获取
                if (!iconUrl) {
                    iconUrl = await fetchFavicon(feed.url)
                    // 验证从网站 HTML 获取的图标是否有效
                    if (iconUrl && !(await validateFavicon(iconUrl))) {
                        iconUrl = null
                    }
                }
                
                if (iconUrl) {
                    // 存入缓存
                    setCachedFeedIcon(feed.url, iconUrl)
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
        
        // 并行获取所有图标
        await Promise.all(iconPromises)
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

