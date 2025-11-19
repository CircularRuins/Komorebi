import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Pivot,
    PivotItem,
} from "@fluentui/react"
import {
    RecommendedFeedGroup,
    RecommendedFeed,
} from "../../scripts/utils/recommended-feeds"
import RecommendedFeedCard from "./recommended-feed-card"
import { fetchFavicon, parseRSS, validateFavicon } from "../../scripts/utils"

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
        const iconPromises = allFeeds.map(async (feed) => {
            try {
                // 1. 先尝试从 feed XML 中获取图标
                let iconUrl = await this.getIconFromFeed(feed.url)
                
                // 2. 如果 feed XML 中没有，再尝试从网站 HTML 获取
                if (!iconUrl) {
                    iconUrl = await fetchFavicon(feed.url)
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
                <Label styles={{ root: { fontSize: '14px', fontWeight: 600 } }}>
                    {intl.get("sources.recommendedFeeds")}
                </Label>

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
                                        gap: "12px",
                                        width: "100%",
                                        maxWidth: "100%",
                                        maxHeight: "400px",
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
                </Pivot>
            </div>
        )
    }
}

export default RecommendedFeeds

