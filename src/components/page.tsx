import * as React from "react"
import intl from "react-intl-universal"
import { FeedContainer } from "../containers/feed-container"
import { AnimationClassNames, Icon, FocusTrapZone, TooltipHost, TooltipDelay } from "@fluentui/react"
import ArticleContainer from "../containers/article-container"
import AIMode from "./ai-mode"
import AlphaXiv from "./alphaxiv"
import { ViewType } from "../schema-types"
import SourcesTabContainer from "../containers/settings/sources-container"

type PageProps = {
    menuOn: boolean
    contextOn: boolean
    settingsOn: boolean
    feeds: string[]
    itemId: number
    itemFromFeed: boolean
    viewType: ViewType
    showSourcesPage: boolean
    dismissItem: () => void
    offsetItem: (offset: number) => void
    toggleSourcesPage: (show: boolean) => void
}

class Page extends React.Component<PageProps> {
    offsetItem = (event: React.MouseEvent, offset: number) => {
        event.stopPropagation()
        this.props.offsetItem(offset)
    }
    prevItem = (event: React.MouseEvent) => this.offsetItem(event, -1)
    nextItem = (event: React.MouseEvent) => this.offsetItem(event, 1)

    render = () => {
        const isAIMode = this.props.feeds.includes("ai-mode")
        const isAlphaXiv = this.props.feeds.includes("alphaxiv")
        
        // 检查是否为AI模式
        if (isAIMode) {
            // AI模式：始终显示 AI 模式页面，如果有 itemId 则弹出文章窗口
            return (
                <>
                    <div className="ai-mode-page">
                        <AIMode />
                    </div>
                    {this.props.itemId && (
                        <FocusTrapZone
                            disabled={this.props.contextOn}
                            ignoreExternalFocusing={true}
                            isClickableOutsideFocusTrap={true}
                            className={"article-container" + (this.props.menuOn ? " menu-on" : "")}
                            onClick={this.props.dismissItem}>
                            <div
                                className="article-wrapper"
                                onClick={e => e.stopPropagation()}>
                                <ArticleContainer itemId={this.props.itemId} />
                            </div>
                        </FocusTrapZone>
                    )}
                </>
            )
        }
        
        // 如果显示订阅源页面，则显示订阅源配置
        if (this.props.showSourcesPage) {
            return (
                <div
                    className={
                        "sources-page" + (this.props.menuOn ? " menu-on" : "")
                    }
                    style={{
                        height: "100%",
                        overflow: "auto",
                        padding: "20px",
                    }}>
                    <div style={{ marginBottom: "20px" }}>
                        <a
                            className="btn"
                            onClick={() => this.props.toggleSourcesPage(false)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: "pointer",
                                textDecoration: "none",
                                color: "white",
                                fontSize: "12px",
                            }}
                            title={intl.get("settings.exit") || "返回"}>
                            <Icon iconName="Back" />
                            <span>{intl.get("settings.exit") || "返回"}</span>
                        </a>
                    </div>
                    <SourcesTabContainer />
                </div>
            )
        }
        
        return (
            <>
                {/* 始终渲染AIMode组件以保持配置面板可用，但隐藏它 */}
                <div style={{ display: 'none' }}>
                    <AIMode />
                </div>
                {this.props.viewType !== ViewType.List ? (
                    <>
                        {this.props.settingsOn ? null : (
                            <div
                                key="card"
                                className={
                                    "main" + (this.props.menuOn ? " menu-on" : "")
                                }>
                                {this.props.feeds.map(fid => (
                                    <FeedContainer
                                        viewType={this.props.viewType}
                                        feedId={fid}
                                        key={fid + this.props.viewType}
                                    />
                                ))}
                            </div>
                        )}
                        {this.props.itemId && (
                            <FocusTrapZone
                                disabled={this.props.contextOn}
                                ignoreExternalFocusing={true}
                                isClickableOutsideFocusTrap={true}
                                className={"article-container" + (this.props.menuOn ? " menu-on" : "")}
                                onClick={this.props.dismissItem}>
                                <div
                                    className="article-wrapper"
                                    onClick={e => e.stopPropagation()}>
                                    {this.props.itemId === -1 ? (
                                        <AlphaXiv dismiss={this.props.dismissItem} />
                                    ) : (
                                        <ArticleContainer itemId={this.props.itemId} />
                                    )}
                                </div>
                                {this.props.itemFromFeed && this.props.itemId !== -1 && (
                                    <>
                                        <div className="btn-group prev">
                                            <TooltipHost
                                                content={intl.get("article.prevItem")}
                                                delay={TooltipDelay.zero}>
                                                <a className="btn" onClick={this.prevItem}>
                                                    <Icon iconName="Back" />
                                                </a>
                                            </TooltipHost>
                                        </div>
                                        <div className="btn-group next">
                                            <TooltipHost
                                                content={intl.get("article.nextItem")}
                                                delay={TooltipDelay.zero}>
                                                <a className="btn" onClick={this.nextItem}>
                                                    <Icon iconName="Forward" />
                                                </a>
                                            </TooltipHost>
                                        </div>
                                    </>
                                )}
                            </FocusTrapZone>
                        )}
                    </>
                ) : (
                    <>
                        {this.props.settingsOn ? null : (
                            <div
                                key="list"
                                className={
                                    "list-main" + (this.props.menuOn ? " menu-on" : "")
                                }>
                                <div className="list-feed-container">
                                    {this.props.feeds.map(fid => (
                                        <FeedContainer
                                            viewType={this.props.viewType}
                                            feedId={fid}
                                            key={fid}
                                        />
                                    ))}
                                </div>
                                {this.props.itemId ? (
                                    <div className="side-article-wrapper">
                                        {this.props.itemId === -1 ? (
                                            <AlphaXiv dismiss={this.props.dismissItem} />
                                        ) : (
                                            <ArticleContainer itemId={this.props.itemId} />
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </>
                )}
            </>
        )
    }
}

export default Page