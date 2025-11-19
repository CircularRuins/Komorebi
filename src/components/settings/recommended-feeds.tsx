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
import { fetchFavicon } from "../../scripts/utils"

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

    componentDidMount = async () => {
        // 为所有推荐源获取图标
        const allFeeds = this.props.groups.flatMap(group => group.feeds)
        const iconPromises = allFeeds.map(async (feed) => {
            try {
                const iconUrl = await fetchFavicon(feed.url)
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

