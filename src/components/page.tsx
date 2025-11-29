import * as React from "react"
import intl from "react-intl-universal"
import { FeedContainer } from "../containers/feed-container"
import { AnimationClassNames, Icon, FocusTrapZone, TooltipHost, TooltipDelay } from "@fluentui/react"
import ArticleContainer from "../containers/article-container"
import ArticleSearch from "./utils/article-search"
import AIMode from "./ai-mode"
import AlphaXiv from "./alphaxiv"
import { ViewType } from "../schema-types"
import SourcesTabContainer from "../containers/settings/sources-container"
import AppTabContainer from "../containers/settings/app-container"
import AIConfigContainer from "../containers/ai-config-container"
import { connect } from "react-redux"
import { RootState } from "../scripts/reducer"
import AIConfig from "./ai-config"
import { clearArticleEmbeddings } from "../scripts/consolidate"
import {
    updateAIModeTempChatApiEndpoint,
    updateAIModeTempChatApiKey,
    updateAIModeTempEmbeddingApiEndpoint,
    updateAIModeTempEmbeddingApiKey,
    updateAIModeTempModel,
    updateAIModeTempEmbeddingModel,
    updateAIModeTempEmbeddingQPS,
    updateAIModeTempTopk,
    updateAIModeChatApiEndpoint,
    updateAIModeChatApiKey,
    updateAIModeEmbeddingApiEndpoint,
    updateAIModeEmbeddingApiKey,
    updateAIModeModel,
    updateAIModeEmbeddingModel,
    updateAIModeEmbeddingQPS,
    updateAIModeTopk,
    setAIModeShowErrorDialog,
    setAIModeErrorDialogMessage,
} from "../scripts/models/ai-mode"
import { selectAllArticles } from "../scripts/models/page"
import { AppDispatch } from "../scripts/utils"

type PageProps = {
    menuOn: boolean
    contextOn: boolean
    settingsOn: boolean
    feeds: string[]
    itemId: number
    itemFromFeed: boolean
    viewType: ViewType
    showSourcesPage: boolean
    showAIFeaturesPage: boolean
    dismissItem: () => void
    offsetItem: (offset: number) => void
    toggleSourcesPage: (show: boolean) => void
    toggleAIFeaturesPage: (show: boolean) => void
    goBack: () => void
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
        const isAppPreferences = this.props.feeds.includes("app-preferences")
        const isAIConfig = this.props.feeds.includes("ai-config")
        
        // 检查是否为订阅源设置页面（优先级最高，因为它是覆盖性的设置页面）
        if (this.props.showSourcesPage) {
            return (
                <>
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
                    {/* 如果 itemId 是 -1，显示 alphaxiv 弹窗 */}
                    {this.props.itemId === -1 && (
                        <FocusTrapZone
                            disabled={this.props.contextOn}
                            ignoreExternalFocusing={true}
                            isClickableOutsideFocusTrap={true}
                            className={"article-container" + (this.props.menuOn ? " menu-on" : "")}
                            onClick={this.props.dismissItem}>
                            <div
                                className="article-wrapper"
                                onClick={e => e.stopPropagation()}>
                                <AlphaXiv dismiss={this.props.dismissItem} />
                            </div>
                        </FocusTrapZone>
                    )}
                </>
            )
        }
        
        // 检查是否为AI功能卡片页面（覆盖性页面，优先级高于 feedId 控制的页面）
        if (this.props.showAIFeaturesPage) {
            return (
                <>
                    <div
                        className={
                            "ai-features-page" + (this.props.menuOn ? " menu-on" : "")
                        }
                        style={{
                            height: "100%",
                            overflow: "auto",
                            padding: "20px",
                        }}>
                        <div style={{ marginBottom: "20px" }}>
                            <a
                                className="btn"
                                onClick={() => this.props.toggleAIFeaturesPage(false)}
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
                        <div style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "flex-start",
                        }}>
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                                gap: "24px",
                                maxWidth: "800px",
                                width: "100%",
                            }}>
                            {/* 热点话题卡片 */}
                            <div
                                style={{
                                    backgroundColor: "var(--white)",
                                    borderRadius: "8px",
                                    padding: "24px",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    border: "1px solid var(--neutralLight)",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)"
                                    e.currentTarget.style.transform = "translateY(-2px)"
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)"
                                    e.currentTarget.style.transform = "translateY(0)"
                                }}
                                onClick={() => {
                                    alert(intl.get("menu.hotTopicsPlaceholder"))
                                }}
                            >
                                <h2 style={{
                                    fontSize: "18px",
                                    fontWeight: 600,
                                    margin: "0 0 8px 0",
                                    color: "var(--neutralPrimary)"
                                }}>
                                    {intl.get("menu.hotTopics")}
                                </h2>
                                <p style={{
                                    fontSize: "14px",
                                    color: "var(--neutralSecondary)",
                                    margin: 0,
                                    lineHeight: "1.5"
                                }}>
                                    {intl.get("menu.hotTopicsPlaceholder")}
                                </p>
                            </div>
                            
                            {/* 智能筛选卡片 */}
                            <div
                                style={{
                                    backgroundColor: "var(--white)",
                                    borderRadius: "8px",
                                    padding: "24px",
                                    cursor: "pointer",
                                    transition: "all 0.2s ease",
                                    border: "1px solid var(--neutralLight)",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.15)"
                                    e.currentTarget.style.transform = "translateY(-2px)"
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)"
                                    e.currentTarget.style.transform = "translateY(0)"
                                }}
                                onClick={() => {
                                    alert(intl.get("menu.smartFilterPlaceholder"))
                                }}
                            >
                                <h2 style={{
                                    fontSize: "18px",
                                    fontWeight: 600,
                                    margin: "0 0 8px 0",
                                    color: "var(--neutralPrimary)"
                                }}>
                                    {intl.get("menu.smartFilter")}
                                </h2>
                                <p style={{
                                    fontSize: "14px",
                                    color: "var(--neutralSecondary)",
                                    margin: 0,
                                    lineHeight: "1.5"
                                }}>
                                    {intl.get("menu.smartFilterPlaceholder")}
                                </p>
                            </div>
                        </div>
                        </div>
                    </div>
                    {/* 如果 itemId 是 -1，显示 alphaxiv 弹窗 */}
                    {this.props.itemId === -1 && (
                        <FocusTrapZone
                            disabled={this.props.contextOn}
                            ignoreExternalFocusing={true}
                            isClickableOutsideFocusTrap={true}
                            className={"article-container" + (this.props.menuOn ? " menu-on" : "")}
                            onClick={this.props.dismissItem}>
                            <div
                                className="article-wrapper"
                                onClick={e => e.stopPropagation()}>
                                <AlphaXiv dismiss={this.props.dismissItem} />
                            </div>
                        </FocusTrapZone>
                    )}
                </>
            )
        }
        
        // 检查是否为应用偏好页面
        if (isAppPreferences) {
            return (
                <div
                    className={
                        "app-preferences-page" + (this.props.menuOn ? " menu-on" : "")
                    }
                    style={{
                        height: "100%",
                        overflow: "auto",
                        padding: "20px",
                    }}>
                    <div style={{ marginBottom: "20px" }}>
                        <a
                            className="btn"
                            onClick={this.props.goBack}
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
                    <AppTabContainer />
                </div>
            )
        }
        
        // 检查是否为AI配置页面
        if (isAIConfig) {
            return (
                <div
                    className={
                        "ai-config-page" + (this.props.menuOn ? " menu-on" : "")
                    }
                    style={{
                        height: "100%",
                        overflow: "auto",
                        padding: "20px",
                    }}>
                    <div style={{ marginBottom: "20px" }}>
                        <a
                            className="btn"
                            onClick={this.props.goBack}
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
                    <AIConfigPageWrapper />
                </div>
            )
        }
        
        // 检查是否为AI功能
        if (isAIMode) {
            // AI功能：始终显示 AI 功能页面，如果有 itemId 则弹出文章窗口
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
                                <ArticleSearch />
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
                                <ArticleSearch />
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

// AI配置页面包装器组件，用于在页面模式下显示AI配置
const AIConfigPageWrapperComponent = (props: any) => {
    const aiMode = props.aiMode
    const dispatch = props.dispatch
    
    const handleConfirm = (tempChatApiEndpoint: string, tempChatApiKey: string, tempEmbeddingApiEndpoint: string, tempEmbeddingApiKey: string, tempModel: string, tempEmbeddingModel: string, tempEmbeddingQPS: string, tempTopk: string) => {
        // 验证topk
        const topk = parseInt(tempTopk, 10)
        if (isNaN(topk) || topk < 1 || !Number.isInteger(topk)) {
            dispatch(setAIModeShowErrorDialog(true))
            dispatch(setAIModeErrorDialogMessage(intl.get("settings.aiMode.errors.topkInvalid")))
            return
        }
        
        // 验证embeddingQPS
        const embeddingQPS = parseInt(tempEmbeddingQPS, 10)
        if (isNaN(embeddingQPS) || embeddingQPS < 1 || !Number.isInteger(embeddingQPS)) {
            dispatch(setAIModeShowErrorDialog(true))
            dispatch(setAIModeErrorDialogMessage(intl.get("settings.aiMode.errors.embeddingQPSInvalid")))
            return
        }
        
        // 保存到 Redux
        dispatch(updateAIModeChatApiEndpoint(tempChatApiEndpoint))
        dispatch(updateAIModeChatApiKey(tempChatApiKey))
        dispatch(updateAIModeEmbeddingApiEndpoint(tempEmbeddingApiEndpoint))
        dispatch(updateAIModeEmbeddingApiKey(tempEmbeddingApiKey))
        dispatch(updateAIModeModel(tempModel))
        dispatch(updateAIModeEmbeddingModel(tempEmbeddingModel))
        dispatch(updateAIModeEmbeddingQPS(embeddingQPS))
        dispatch(updateAIModeTopk(topk))
        // 导航回之前的页面
        dispatch(selectAllArticles())
    }
    
    const handleCancel = (chatApiEndpoint: string, chatApiKey: string, embeddingApiEndpoint: string, embeddingApiKey: string, model: string, embeddingModel: string, embeddingQPS: number, topk: number) => {
        // 恢复临时状态为已保存的值
        dispatch(updateAIModeTempChatApiEndpoint(chatApiEndpoint))
        dispatch(updateAIModeTempChatApiKey(chatApiKey))
        dispatch(updateAIModeTempEmbeddingApiEndpoint(embeddingApiEndpoint))
        dispatch(updateAIModeTempEmbeddingApiKey(embeddingApiKey))
        dispatch(updateAIModeTempModel(model))
        dispatch(updateAIModeTempEmbeddingModel(embeddingModel))
        dispatch(updateAIModeTempEmbeddingQPS(embeddingQPS.toString()))
        dispatch(updateAIModeTempTopk(topk.toString()))
        // 导航回之前的页面
        dispatch(selectAllArticles())
    }
    
    return (
        <AIConfig
            display={true}
            tempChatApiEndpoint={aiMode.tempChatApiEndpoint}
            tempChatApiKey={aiMode.tempChatApiKey}
            tempEmbeddingApiEndpoint={aiMode.tempEmbeddingApiEndpoint}
            tempEmbeddingApiKey={aiMode.tempEmbeddingApiKey}
            tempModel={aiMode.tempModel}
            tempEmbeddingModel={aiMode.tempEmbeddingModel}
            tempEmbeddingQPS={aiMode.tempEmbeddingQPS}
            tempTopk={aiMode.tempTopk}
            chatApiEndpoint={aiMode.chatApiEndpoint}
            chatApiKey={aiMode.chatApiKey}
            embeddingApiEndpoint={aiMode.embeddingApiEndpoint}
            embeddingApiKey={aiMode.embeddingApiKey}
            model={aiMode.model}
            embeddingModel={aiMode.embeddingModel}
            embeddingQPS={aiMode.embeddingQPS}
            topk={aiMode.topk}
            onChatApiEndpointChange={(event, newValue) => dispatch(updateAIModeTempChatApiEndpoint(newValue || ""))}
            onChatApiKeyChange={(event, newValue) => dispatch(updateAIModeTempChatApiKey(newValue || ""))}
            onEmbeddingApiEndpointChange={(event, newValue) => dispatch(updateAIModeTempEmbeddingApiEndpoint(newValue || ""))}
            onEmbeddingApiKeyChange={(event, newValue) => dispatch(updateAIModeTempEmbeddingApiKey(newValue || ""))}
            onModelChange={(event, newValue) => dispatch(updateAIModeTempModel(newValue || ""))}
            onEmbeddingModelChange={(event, newValue) => dispatch(updateAIModeTempEmbeddingModel(newValue || ""))}
            onEmbeddingQPSChange={(event, newValue) => dispatch(updateAIModeTempEmbeddingQPS(newValue || ""))}
            onTopkChange={(event, newValue) => dispatch(updateAIModeTempTopk(newValue || ""))}
            onClearEmbeddings={async () => {
                await clearArticleEmbeddings()
            }}
            onConfirm={handleConfirm}
            onCancel={() => handleCancel(aiMode.chatApiEndpoint, aiMode.chatApiKey, aiMode.embeddingApiEndpoint, aiMode.embeddingApiKey, aiMode.model, aiMode.embeddingModel, aiMode.embeddingQPS, aiMode.topk)}
        />
    )
}

const mapStateToPropsForAIConfig = (state: RootState) => ({
    aiMode: state.aiMode,
})

const mapDispatchToPropsForAIConfig = (dispatch: AppDispatch) => ({
    dispatch: dispatch,
})

const AIConfigPageWrapper = connect(mapStateToPropsForAIConfig, mapDispatchToPropsForAIConfig)(AIConfigPageWrapperComponent)

export default Page