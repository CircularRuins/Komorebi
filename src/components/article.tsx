import * as React from "react"
import intl from "react-intl-universal"
import { renderToString } from "react-dom/server"
import { RSSItem } from "../scripts/models/item"
import {
    Stack,
    CommandBarButton,
    IContextualMenuProps,
    FocusZone,
    ContextualMenuItemType,
    Spinner,
    Icon,
    Link,
    TooltipHost,
    TooltipDelay,
} from "@fluentui/react"
import {
    RSSSource,
    SourceOpenTarget,
    SourceTextDirection,
} from "../scripts/models/source"
import { shareSubmenu } from "./context-menu"
import { platformCtrl, decodeFetchResponse } from "../scripts/utils"
import { translateArticle, translateArticleWithTitle, TranslationConfig } from "../scripts/translation"
import { selectAIConfig } from "../scripts/models/page"

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 17, 18, 19, 20]

type ArticleProps = {
    item: RSSItem
    source: RSSSource
    locale: string
    shortcuts: (item: RSSItem, e: KeyboardEvent) => void
    dismiss: () => void
    offsetItem: (offset: number) => void
    toggleHasRead: (item: RSSItem) => void
    toggleStarred: (item: RSSItem) => void
    textMenu: (position: [number, number], text: string, url: string) => void
    imageMenu: (position: [number, number]) => void
    dismissContextMenu: () => void
    updateSourceTextDirection: (
        source: RSSSource,
        direction: SourceTextDirection
    ) => void
    clearSourceIcon: (source: RSSSource) => void
    translationConfig: TranslationConfig
    openTranslationConfig: () => void
}

type ArticleState = {
    fontFamily: string
    fontSize: number
    loadWebpage: boolean
    loadFull: boolean
    fullContent: string
    loaded: boolean
    error: boolean
    errorDescription: string
    translatedContent: string | null
    translatedTitle: string | null
    isTranslating: boolean
    translationError: string | null
    showTranslated: boolean
    preloadPath: string
}

class Article extends React.Component<ArticleProps, ArticleState> {
    webview: Electron.WebviewTag

    constructor(props: ArticleProps) {
        super(props)
        // 调试日志
        if (!props.item || !props.source) {
            console.error('Article组件接收到无效的props:', {
                hasItem: !!props.item,
                hasSource: !!props.source,
                itemId: props.item?._id,
                sourceId: props.item?.source
            })
            // 如果 props 无效，设置默认值避免崩溃
            this.state = {
                fontFamily: window.settings.getFont(),
                fontSize: window.settings.getFontSize(),
                loadWebpage: false,
                loadFull: false,
                fullContent: "",
                loaded: false,
                error: false,
                errorDescription: "",
                translatedContent: null,
                translatedTitle: null,
                isTranslating: false,
                translationError: null,
                showTranslated: false,
                preloadPath: window.utils?.getPreloadPath?.() || "../preload.js",
            }
            return
        }
        this.state = {
            fontFamily: window.settings.getFont(),
            fontSize: window.settings.getFontSize(),
            loadWebpage: props.source.openTarget === SourceOpenTarget.Webpage,
            loadFull: props.source.openTarget === SourceOpenTarget.FullContent,
            fullContent: "",
            loaded: false,
            error: false,
            errorDescription: "",
            translatedContent: null,
            translatedTitle: null,
            isTranslating: false,
            translationError: null,
            showTranslated: false,
            preloadPath: window.utils?.getPreloadPath?.() || "../preload.js",
        }
        window.utils.addWebviewContextListener(this.contextMenuHandler)
        window.utils.addWebviewKeydownListener(this.keyDownHandler)
        window.utils.addWebviewErrorListener(this.webviewError)
        if (props.source.openTarget === SourceOpenTarget.FullContent)
            this.loadFull()
    }

    setFontSize = (size: number) => {
        window.settings.setFontSize(size)
        this.setState({ fontSize: size })
    }
    setFont = (font: string) => {
        window.settings.setFont(font)
        this.setState({ fontFamily: font })
    }

    fontSizeMenuProps = (): IContextualMenuProps => ({
        items: FONT_SIZE_OPTIONS.map(size => ({
            key: String(size),
            text: String(size),
            canCheck: true,
            checked: size === this.state.fontSize,
            onClick: () => this.setFontSize(size),
        })),
    })

    fontFamilyMenuProps = (): IContextualMenuProps => ({
        items: window.fontList.map((font, idx) => ({
            key: String(idx),
            text: font === "" ? intl.get("default") : font,
            canCheck: true,
            checked: this.state.fontFamily === font,
            onClick: () => this.setFont(font),
        })),
    })

    updateTextDirection = (direction: SourceTextDirection) => {
        this.props.updateSourceTextDirection(this.props.source, direction)
    }

    directionMenuProps = (): IContextualMenuProps => ({
        items: [
            {
                key: "LTR",
                text: intl.get("article.LTR"),
                iconProps: { iconName: "Forward" },
                canCheck: true,
                checked: this.props.source.textDir === SourceTextDirection.LTR,
                onClick: () =>
                    this.updateTextDirection(SourceTextDirection.LTR),
            },
            {
                key: "RTL",
                text: intl.get("article.RTL"),
                iconProps: { iconName: "Back" },
                canCheck: true,
                checked: this.props.source.textDir === SourceTextDirection.RTL,
                onClick: () =>
                    this.updateTextDirection(SourceTextDirection.RTL),
            },
            {
                key: "Vertical",
                text: intl.get("article.Vertical"),
                iconProps: { iconName: "Down" },
                canCheck: true,
                checked:
                    this.props.source.textDir === SourceTextDirection.Vertical,
                onClick: () =>
                    this.updateTextDirection(SourceTextDirection.Vertical),
            },
        ],
    })

    moreMenuProps = (): IContextualMenuProps => ({
        items: [
            {
                key: "fontMenu",
                text: intl.get("article.font"),
                iconProps: { iconName: "Font" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.fontFamilyMenuProps(),
            },
            {
                key: "fontSizeMenu",
                text: intl.get("article.fontSize"),
                iconProps: { iconName: "FontSize" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.fontSizeMenuProps(),
            },
            {
                key: "directionMenu",
                text: intl.get("article.textDir"),
                iconProps: { iconName: "ChangeEntitlements" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.directionMenuProps(),
            },
            {
                key: "divider_1",
                itemType: ContextualMenuItemType.Divider,
            },
            ...shareSubmenu(this.props.item),
        ],
    })

    contextMenuHandler = (pos: [number, number], text: string, url: string) => {
        if (pos) {
            if (text || url) this.props.textMenu(pos, text, url)
            else this.props.imageMenu(pos)
        } else {
            this.props.dismissContextMenu()
        }
    }

    keyDownHandler = (input: Electron.Input) => {
        if (input.type === "keyDown") {
            switch (input.key) {
                case "Escape":
                    this.props.dismiss()
                    break
                case "ArrowLeft":
                case "ArrowRight":
                    this.props.offsetItem(input.key === "ArrowLeft" ? -1 : 1)
                    break
                case "l":
                case "L":
                    this.toggleWebpage()
                    break
                case "w":
                case "W":
                    this.toggleFull()
                    break
                default:
                    const keyboardEvent = new KeyboardEvent("keydown", {
                        code: input.code,
                        key: input.key,
                        shiftKey: input.shift,
                        altKey: input.alt,
                        ctrlKey: input.control,
                        metaKey: input.meta,
                        repeat: input.isAutoRepeat,
                        bubbles: true,
                    })
                    this.props.shortcuts(this.props.item, keyboardEvent)
                    document.dispatchEvent(keyboardEvent)
                    break
            }
        }
    }

    webviewLoaded = () => {
        this.setState({ loaded: true })
    }
    webviewError = (reason: string) => {
        this.setState({ error: true, errorDescription: reason })
    }
    webviewReload = () => {
        if (this.webview) {
            this.setState({ loaded: false, error: false })
            this.webview.reload()
        } else if (this.state.loadFull) {
            this.loadFull()
        }
    }

    componentDidMount = () => {
        let webview = document.getElementById("article") as Electron.WebviewTag
        if (webview != this.webview) {
            this.webview = webview
            if (webview) {
                webview.focus()
                this.setState({ loaded: false, error: false })
                webview.addEventListener("did-stop-loading", this.webviewLoaded)
                let card = document.querySelector(
                    `#refocus div[data-iid="${this.props.item._id}"]`
                ) as HTMLElement
                // @ts-ignore
                if (card) card.scrollIntoViewIfNeeded()
            }
        }
    }
    componentDidUpdate = (prevProps: ArticleProps) => {
        if (prevProps.item._id != this.props.item._id) {
            this.setState({
                loadWebpage:
                    this.props.source.openTarget === SourceOpenTarget.Webpage,
                loadFull:
                    this.props.source.openTarget ===
                    SourceOpenTarget.FullContent,
                translatedContent: null,
                translatedTitle: null,
                showTranslated: false,
                translationError: null,
            })
            if (this.props.source.openTarget === SourceOpenTarget.FullContent)
                this.loadFull()
        }
        this.componentDidMount()
    }

    componentWillUnmount = () => {
        let refocus = document.querySelector(
            `#refocus div[data-iid="${this.props.item._id}"]`
        ) as HTMLElement
        if (refocus) refocus.focus()
    }

    toggleWebpage = () => {
        if (this.state.loadWebpage) {
            this.setState({ loadWebpage: false })
        } else if (
            this.props.item.link.startsWith("https://") ||
            this.props.item.link.startsWith("http://")
        ) {
            this.setState({ loadWebpage: true, loadFull: false })
        }
    }

    toggleFull = () => {
        if (this.state.loadFull) {
            this.setState({ loadFull: false })
        } else if (
            this.props.item.link.startsWith("https://") ||
            this.props.item.link.startsWith("http://")
        ) {
            this.setState({ loadFull: true, loadWebpage: false })
            this.loadFull()
        }
    }
    loadFull = async () => {
        this.setState({ fullContent: "", loaded: false, error: false })
        const link = this.props.item.link
        try {
            const result = await fetch(link)
            if (!result || !result.ok) throw new Error()
            const html = await decodeFetchResponse(result, true)
            if (link === this.props.item.link) {
                this.setState({ fullContent: html })
            }
        } catch {
            if (link === this.props.item.link) {
                this.setState({
                    loaded: true,
                    error: true,
                    errorDescription: "MERCURY_PARSER_FAILURE",
                })
            }
        }
    }

    handleTranslate = async () => {
        // 检查配置是否完整
        if (!this.props.translationConfig.apiEndpoint || 
            !this.props.translationConfig.apiKey || 
            !this.props.translationConfig.model) {
            this.setState({
                translationError: intl.get("translation.error.configIncomplete"),
            })
            // 显示错误提示并提供打开配置的选项
            if (window.utils && window.utils.showMessageBox) {
                const openConfig = await window.utils.showMessageBox(
                    intl.get("translation.error.configNotSet"),
                    intl.get("translation.error.configIncomplete"),
                    intl.get("translation.error.openConfig"),
                    intl.get("cancel"),
                    false,
                    "warning"
                )
                if (openConfig) {
                    this.props.openTranslationConfig()
                }
            }
            return
        }

        // 如果已经有翻译内容，直接切换显示
        if (this.state.translatedContent) {
            this.setState({ showTranslated: !this.state.showTranslated })
            return
        }

        // 提取文章内容
        const content = this.state.loadFull ? this.state.fullContent : this.props.item.content
        
        if (!content || content.trim().length === 0) {
            this.setState({
                translationError: intl.get("translation.error.emptyContent"),
            })
            return
        }

        this.setState({ 
            isTranslating: true, 
            translationError: null 
        })

        try {
            const result = await translateArticleWithTitle(
                this.props.item.title,
                content,
                this.props.translationConfig
            )
            this.setState({
                translatedContent: result.content,
                translatedTitle: result.title,
                isTranslating: false,
                showTranslated: true,
                translationError: null,
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.setState({
                isTranslating: false,
                translationError: errorMessage,
            })
            // 显示错误提示
            if (window.utils && window.utils.showErrorBox) {
                window.utils.showErrorBox(
                    intl.get("translation.error.translationFailed"),
                    errorMessage
                )
            }
        }
    }

    toggleTranslation = () => {
        this.setState({ showTranslated: !this.state.showTranslated })
    }

    articleView = () => {
        // 根据showTranslated状态决定使用原文还是译文
        let contentToShow: string
        if (this.state.showTranslated && this.state.translatedContent) {
            contentToShow = this.state.translatedContent
        } else {
            contentToShow = this.state.loadFull
                ? this.state.fullContent
                : this.props.item.content
        }
        
        const a = encodeURIComponent(contentToShow)
        // 根据showTranslated状态决定使用原文还是翻译后的标题
        const titleToShow = this.state.showTranslated && this.state.translatedTitle
            ? this.state.translatedTitle
            : this.props.item.title
        const h = encodeURIComponent(
            renderToString(
                <>
                    <p className="title">{titleToShow}</p>
                    <p className="date">
                        {this.props.item.date.toLocaleString(
                            this.props.locale,
                            { hour12: !this.props.locale.startsWith("zh") }
                        )}
                    </p>
                    <article></article>
                </>
            )
        )
        return `article/article.html?a=${a}&h=${h}&f=${encodeURIComponent(
            this.state.fontFamily
        )}&s=${this.state.fontSize}&d=${this.props.source.textDir}&u=${
            this.props.item.link
        }&m=${this.state.loadFull ? 1 : 0}`
    }

    render = () => {
        // 如果 item 或 source 不存在，返回空内容
        if (!this.props.item || !this.props.source) {
            console.error('Article组件渲染失败: item或source不存在', {
                hasItem: !!this.props.item,
                hasSource: !!this.props.source
            })
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p>无法加载文章内容</p>
                </div>
            )
        }
        
        return (
        <FocusZone className="article">
            <Stack horizontal style={{ height: 48, paddingTop: 12 }}>
                <span style={{ width: 96 }}></span>
                <Stack
                    className="actions"
                    grow
                    horizontal
                    tokens={{ childrenGap: 12 }}>
                    <Stack.Item grow>
                        <span className="source-name">
                            {this.state.loaded ? (
                                this.props.source.iconurl && (
                                    <img
                                        className="favicon"
                                        src={this.props.source.iconurl}
                                        onError={() => {
                                            // 图标加载失败时，清除iconurl
                                            this.props.clearSourceIcon(this.props.source)
                                        }}
                                    />
                                )
                            ) : (
                                <Spinner size={1} />
                            )}
                            {this.props.source.name}
                            {this.props.item.creator && (
                                <span className="creator">
                                    {this.props.item.creator}
                                </span>
                            )}
                        </span>
                    </Stack.Item>
                    <TooltipHost
                        content={
                            this.props.item.starred
                                ? intl.get("article.unstar")
                                : intl.get("article.star")
                        }
                        delay={TooltipDelay.zero}>
                        <CommandBarButton
                            iconProps={{
                                iconName: this.props.item.starred
                                    ? "FavoriteStarFill"
                                    : "FavoriteStar",
                                style: { fontSize: 16 },
                            }}
                            onClick={() =>
                                this.props.toggleStarred(this.props.item)
                            }
                            styles={{
                                root: {
                                    minWidth: 40,
                                    height: 32,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                },
                                icon: {
                                    fontSize: 16,
                                },
                            }}
                        />
                    </TooltipHost>
                    <TooltipHost
                        content={intl.get("openExternal")}
                        delay={TooltipDelay.zero}>
                        <CommandBarButton
                            iconProps={{
                                iconName: "NavigateExternalInline",
                                style: { fontSize: 16, lineHeight: 1 },
                            }}
                            onClick={e => {
                                window.utils.openExternal(
                                    this.props.item.link,
                                    platformCtrl(e.nativeEvent)
                                )
                            }}
                            styles={{
                                root: {
                                    minWidth: 40,
                                    height: 32,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                },
                                icon: {
                                    fontSize: 16,
                                    lineHeight: 1,
                                    marginTop: "-3px",
                                },
                            }}
                        />
                    </TooltipHost>
                    <TooltipHost
                        content={
                            this.state.showTranslated
                                ? intl.get("article.showOriginal")
                                : this.state.isTranslating
                                ? intl.get("article.translating")
                                : intl.get("article.translate")
                        }
                        delay={TooltipDelay.zero}>
                        <CommandBarButton
                            iconProps={{
                                iconName: this.state.isTranslating ? "Sync" : "Translate",
                                style: { 
                                    fontSize: 16,
                                },
                            }}
                            onClick={this.handleTranslate}
                            disabled={this.state.isTranslating || this.state.loadWebpage}
                            styles={{
                                root: {
                                    minWidth: 40,
                                    height: 32,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                },
                                icon: {
                                    fontSize: 16,
                                    animation: this.state.isTranslating ? "rotating 1.5s linear infinite" : "none",
                                },
                            }}
                        />
                    </TooltipHost>
                    <TooltipHost
                        content={intl.get("close")}
                        delay={TooltipDelay.zero}>
                        <CommandBarButton
                            iconProps={{
                                iconName: "Cancel",
                                style: { fontSize: 16 },
                            }}
                            onClick={this.props.dismiss}
                            styles={{
                                root: {
                                    minWidth: 40,
                                    height: 32,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                },
                                icon: {
                                    fontSize: 16,
                                },
                            }}
                        />
                    </TooltipHost>
                </Stack>
                <Stack horizontal horizontalAlign="end" style={{ width: 112 }}>
                    <CommandBarButton
                        title={intl.get("close")}
                        iconProps={{
                            iconName: "BackToWindow",
                            style: { fontSize: 16 },
                        }}
                        onClick={this.props.dismiss}
                        styles={{
                            root: {
                                minWidth: 40,
                                height: 32,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                visibility: "hidden",
                                pointerEvents: "none",
                            },
                            icon: {
                                fontSize: 16,
                            },
                        }}
                    />
                </Stack>
            </Stack>
            {(!this.state.loadFull || this.state.fullContent) && (
                <webview
                    id="article"
                    className={this.state.error ? "error" : ""}
                    key={
                        this.props.item._id +
                        (this.state.loadWebpage ? "_" : "") +
                        (this.state.loadFull ? "__" : "")
                    }
                    src={
                        this.state.loadWebpage
                            ? this.props.item.link
                            : this.articleView()
                    }
                    allowpopups={"true" as unknown as boolean}
                    webpreferences="contextIsolation,disableDialogs,autoplayPolicy=document-user-activation-required"
                    partition={this.state.loadWebpage ? "sandbox" : undefined}
                    preload={this.state.loadWebpage ? undefined : this.state.preloadPath}
                />
            )}
            {this.state.error && (
                <Stack
                    className="error-prompt"
                    verticalAlign="center"
                    horizontalAlign="center"
                    tokens={{ childrenGap: 12 }}>
                    <Icon iconName="HeartBroken" style={{ fontSize: 32 }} />
                    <Stack
                        horizontal
                        horizontalAlign="center"
                        tokens={{ childrenGap: 7 }}>
                        <small>{intl.get("article.error")}</small>
                        <small>
                            <Link onClick={this.webviewReload}>
                                {intl.get("article.reload")}
                            </Link>
                        </small>
                    </Stack>
                    <span style={{ fontSize: 11 }}>
                        {this.state.errorDescription}
                    </span>
                </Stack>
            )}
        </FocusZone>
        )
    }
}

export default Article
