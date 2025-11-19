import * as React from "react"
import intl from "react-intl-universal"
import {
    Stack,
    PrimaryButton,
    DefaultButton,
    Icon,
} from "@fluentui/react"
import { RecommendedFeed } from "../../scripts/utils/recommended-feeds"
import { fetchFavicon } from "../../scripts/utils"

type RecommendedFeedCardProps = {
    feed: RecommendedFeed
    isSubscribed: boolean
    onSubscribe: (feed: RecommendedFeed) => Promise<void>
    isSubscribing?: boolean
    iconUrl?: string
}

const RecommendedFeedCard: React.FunctionComponent<RecommendedFeedCardProps> = ({
    feed,
    isSubscribed,
    onSubscribe,
    isSubscribing = false,
    iconUrl,
}) => {
    const handleSubscribe = async () => {
        if (!isSubscribed && !isSubscribing) {
            await onSubscribe(feed)
        }
    }

    return (
        <div
            style={{
                padding: "8px",
                border: "1px solid var(--neutralLight)",
                borderRadius: "4px",
                backgroundColor: "var(--white)",
                transition: "box-shadow 0.2s ease",
                cursor: "default",
                width: "200px",
                boxSizing: "border-box",
                position: "relative",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)"
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", paddingRight: "32px" }}>
                {/* 图标 */}
                <div
                    style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "4px",
                        backgroundColor: "var(--neutralLighter)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        overflow: "hidden",
                    }}
                >
                    {iconUrl ? (
                        <img
                            src={iconUrl}
                            alt=""
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                            onError={(e) => {
                                // 如果图片加载失败，隐藏img显示占位图标
                                e.currentTarget.style.display = "none"
                                const parent = e.currentTarget.parentElement
                                if (parent) {
                                    const icon = document.createElement("i")
                                    icon.className = "ms-Icon ms-Icon--Link"
                                    icon.style.fontSize = "16px"
                                    icon.style.color = "var(--neutralSecondary)"
                                    parent.appendChild(icon)
                                }
                            }}
                        />
                    ) : (
                        <Icon
                            iconName="Link"
                            styles={{
                                root: {
                                    fontSize: "16px",
                                    color: "var(--neutralSecondary)",
                                },
                            }}
                        />
                    )}
                </div>

                {/* 内容区域 */}
                <div
                    style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        height: "28px",
                    }}
                >
                    <div
                        style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--neutralPrimary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%",
                            lineHeight: "1.2",
                        }}
                    >
                        {feed.name}
                    </div>
                </div>

            </div>
            {/* 订阅按钮 - 绝对定位，相对于卡片垂直居中 */}
            <div
                style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                }}
            >
                {isSubscribed ? (
                    <DefaultButton
                        disabled
                        iconProps={{ iconName: "CheckMark" }}
                        title={intl.get("sources.subscribed")}
                        styles={{
                            root: {
                                height: "18px",
                                width: "18px",
                                minWidth: "18px",
                                padding: "0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            },
                            icon: {
                                fontSize: "9px",
                            },
                        }}
                    />
                ) : (
                    <PrimaryButton
                        disabled={isSubscribing}
                        iconProps={{ iconName: "Add" }}
                        title={intl.get("sources.subscribe")}
                        onClick={handleSubscribe}
                        styles={{
                            root: {
                                height: "18px",
                                width: "18px",
                                minWidth: "18px",
                                padding: "0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            },
                            icon: {
                                fontSize: "9px",
                            },
                        }}
                    />
                )}
            </div>
        </div>
    )
}

export default RecommendedFeedCard

