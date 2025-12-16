import * as React from "react"
import ReactDOM from "react-dom"
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
    TextField,
} from "@fluentui/react"
import {
    RSSSource,
    SourceOpenTarget,
    SourceTextDirection,
} from "../scripts/models/source"
import { shareSubmenu } from "./context-menu"
import { platformCtrl, decodeFetchResponse, extractVideoId } from "../scripts/utils"
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
    selectedTranslationLanguage: string | null
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
                selectedTranslationLanguage: null,
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
            selectedTranslationLanguage: null,
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

    handleClickOutside = (e: MouseEvent) => {
        if (this.translationMenuOpen && 
            this.translationMenuRef.current && 
            !this.translationMenuRef.current.contains(e.target as Node) &&
            this.translationChevronRef.current &&
            !this.translationChevronRef.current.contains(e.target as Node)) {
            this.handleTranslationMenuClose()
        }
    }

    componentDidMount = () => {
        // 原有的componentDidMount逻辑
        let webview = document.getElementById("article") as Electron.WebviewTag
        if (webview != this.webview) {
            this.webview = webview
            if (webview) {
                webview.focus()
                this.setState({ loaded: false, error: false })
                webview.addEventListener("did-stop-loading", this.webviewLoaded)
                
                // Listen to console messages from webview
                webview.addEventListener("console-message", (e: any) => {
                    const message = e.message
                    const level = e.level
                    console.log(`[Webview ${level}]`, message)
                })
                
                let card = document.querySelector(
                    `#refocus div[data-iid="${this.props.item._id}"]`
                ) as HTMLElement
                // @ts-ignore
                if (card) card.scrollIntoViewIfNeeded()
            }
        }

        // 添加点击外部关闭菜单的监听
        document.addEventListener('mousedown', this.handleClickOutside)
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
                selectedTranslationLanguage: null,
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
        document.removeEventListener('mousedown', this.handleClickOutside)
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

    handleTranslate = async (targetLanguage?: string) => {
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

        // 如果已经有翻译内容且没有指定新语言，直接切换显示
        if (this.state.translatedContent && !targetLanguage) {
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

    translationLanguageOptions = () => [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'zh-CN', name: 'Simplified Chinese', nativeName: '简体中文' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
    ]

    handleLanguageSelect = (languageCode: string) => {
        // 如果选择的是当前已选的语言，则取消选择
        const newLanguage = this.state.selectedTranslationLanguage === languageCode 
            ? null 
            : languageCode
        this.setState({ selectedTranslationLanguage: newLanguage })
        
        // 如果选择了语言，关闭菜单并触发翻译
        if (newLanguage) {
            this.handleTranslationMenuClose()
            this.handleTranslate(newLanguage)
        } else {
            // 如果取消选择，关闭菜单
            this.handleTranslationMenuClose()
        }
    }

    translationMenuRef = React.createRef<HTMLDivElement>()
    translationChevronRef = React.createRef<HTMLDivElement>()
    translationMenuOpen = false
    translationLanguageSearch = ""

    handleTranslationMenuToggle = () => {
        this.translationMenuOpen = !this.translationMenuOpen
        this.forceUpdate()
    }

    handleTranslationMenuClose = () => {
        this.translationMenuOpen = false
        this.translationLanguageSearch = ""
        this.forceUpdate()
    }

    handleTranslationLanguageSearch = (value: string) => {
        this.translationLanguageSearch = value
        this.forceUpdate()
    }

    isYouTubeArticle = (): boolean => {
        // 检查文章链接是否包含 YouTube 视频 ID
        if (this.props.item?.link && extractVideoId(this.props.item.link) !== null) {
            return true
        }
        // 检查 source URL 是否来自 YouTube
        if (this.props.source?.url && /youtube\.com/.test(this.props.source.url)) {
            return true
        }
        return false
    }

    renderTranslationMenu = () => {
        if (!this.translationMenuOpen || !this.translationChevronRef.current) return null

        const rect = this.translationChevronRef.current.getBoundingClientRect()
        const filteredLanguages = this.translationLanguageOptions()

        const menuStyle: React.CSSProperties = {
            position: 'fixed',
            zIndex: 50,
            width: '260px',
            borderRadius: '16px',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            backgroundColor: '#ffffff',
            padding: 0,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            top: `${rect.bottom + 4}px`,
            left: `${rect.left - 200}px`,
            outline: 'none',
        }

        return ReactDOM.createPortal(
            <div
                ref={this.translationMenuRef}
                style={menuStyle}
                onMouseEnter={() => {
                    // Keep menu open
                }}
                onMouseLeave={() => {
                    setTimeout(() => {
                        this.handleTranslationMenuClose()
                    }, 100)
                }}
            >
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {/* 显示原文选项 */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            transition: 'background-color 0.15s, color 0.15s',
                            borderRadius: '4px',
                            margin: '0 4px',
                            userSelect: 'none',
                            outline: 'none',
                            borderBottom: '1px solid #f0f0f0',
                            marginBottom: '4px',
                            paddingBottom: '10px',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f5f5f5'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                        onClick={(e) => {
                            this.setState({
                                showTranslated: false,
                                selectedTranslationLanguage: null,
                            })
                            this.handleTranslationMenuClose()
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 500, fontSize: '12px', color: '#000', lineHeight: '16px' }}>
                                {intl.get("article.showOriginal") || "显示原文"}
                            </div>
                        </div>
                        {!this.state.showTranslated && !this.state.selectedTranslationLanguage ? (
                            <Icon
                                iconName="Accept"
                                style={{
                                    fontSize: '16px',
                                    color: '#000',
                                }}
                            />
                        ) : (
                            <Icon
                                iconName="CircleRing"
                                style={{
                                    fontSize: '16px',
                                    color: '#ccc',
                                }}
                            />
                        )}
                    </div>
                    {filteredLanguages.map((lang) => {
                        const isTargetLanguage = lang.code === this.state.selectedTranslationLanguage

                        return (
                            <div
                                key={lang.code}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    transition: 'background-color 0.15s, color 0.15s',
                                    borderRadius: '4px',
                                    margin: '0 4px',
                                    userSelect: 'none',
                                    outline: 'none',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f5f5f5'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                onClick={(e) => {
                                    this.handleLanguageSelect(lang.code)
                                    this.handleTranslationMenuClose()
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '12px', color: '#000', lineHeight: '16px' }}>
                                        {lang.nativeName}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#666', lineHeight: '14px', marginTop: '2px' }}>
                                        {lang.name}
                                    </div>
                                </div>
                                {isTargetLanguage ? (
                                    <Icon
                                        iconName="Accept"
                                        style={{
                                            fontSize: '16px',
                                            color: '#000',
                                        }}
                                    />
                                ) : (
                                    <Icon
                                        iconName="CircleRing"
                                        style={{
                                            fontSize: '16px',
                                            color: '#ccc',
                                        }}
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>,
            document.body
        )
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
        // Prepare i18n texts for transcript (with safe fallback)
        const getI18n = (key: string, fallback: string): string => {
            try {
                const value = intl.get(key)
                return value && value !== key ? value : fallback
            } catch (e) {
                return fallback
            }
        }
        
        const i18nTexts = {
            transcript: {
                tab: {
                    transcript: getI18n("transcript.tab.transcript", "Transcript"),
                    aiSummary: getI18n("transcript.tab.aiSummary", "AI Summary"),
                    quotes: getI18n("transcript.tab.quotes", "Quotes"),
                    chat: getI18n("transcript.tab.chat", "Chat"),
                },
                loading: getI18n("transcript.loading", "Loading transcript..."),
                notAvailable: getI18n("transcript.notAvailable", "Transcript not available for this video."),
                reload: getI18n("transcript.reload", "Reload"),
                showOriginal: getI18n("transcript.showOriginal", "Show original transcript"),
                translating: getI18n("transcript.translating", "Translating transcript..."),
                translationFailed: getI18n("transcript.translationFailed", "Translation failed: {error}"),
                translationConfigIncomplete: getI18n("transcript.translationConfigIncomplete", "AI Model Not Configured"),
                translationConfigIncompleteMessage: getI18n("transcript.translationConfigIncompleteMessage", "Please configure AI model first."),
                openConfig: getI18n("transcript.openConfig", "Open Config"),
                cancel: getI18n("transcript.cancel", "Cancel"),
                noQuotesAvailable: getI18n("transcript.noQuotesAvailable", "No quotes available."),
                extractQuotes: getI18n("transcript.extractQuotes", "Extract Quotes"),
                interpretation: getI18n("transcript.interpretation", "Interpretation: "),
                generateSummary: getI18n("transcript.generateSummary", "Generate Summary"),
                generating: getI18n("transcript.generating", "Generating..."),
                generatingSummary: getI18n("transcript.generatingSummary", "Generating summary..."),
                failedToGenerateSummary: getI18n("transcript.failedToGenerateSummary", "Failed to generate summary: {error}"),
                retry: getI18n("transcript.retry", "Retry"),
                extracting: getI18n("transcript.extracting", "Extracting..."),
                extractingQuotes: getI18n("transcript.extractingQuotes", "Extracting quotes..."),
                failedToExtractQuotes: getI18n("transcript.failedToExtractQuotes", "Failed to extract quotes: {error}"),
                chat: {
                    placeholder: getI18n("transcript.chat.placeholder", "Ask about the video..."),
                    send: getI18n("transcript.chat.send", "Send"),
                    loading: getI18n("transcript.chat.loading", "Thinking..."),
                    error: getI18n("transcript.chat.error", "Failed to get response"),
                    configIncomplete: getI18n("transcript.chat.configIncomplete", "AI Model Not Configured"),
                    configIncompleteMessage: getI18n("transcript.chat.configIncompleteMessage", "Please configure Chat API settings first."),
                    apiNotAvailable: getI18n("transcript.chat.apiNotAvailable", "Chat API not available"),
                    transcriptNotAvailable: getI18n("transcript.chat.transcriptNotAvailable", "Transcript not available"),
                }
            }
        }
        let i18nParam = ""
        try {
            i18nParam = encodeURIComponent(JSON.stringify(i18nTexts))
        } catch (e) {
            console.error('Failed to stringify i18n texts:', e)
            // Use empty string if JSON.stringify fails
            i18nParam = ""
        }
        
        const baseUrl = `article/article.html?a=${a}&h=${h}&f=${encodeURIComponent(
            this.state.fontFamily
        )}&s=${this.state.fontSize}&d=${this.props.source.textDir}&u=${
            this.props.item.link
        }&m=${this.state.loadFull ? 1 : 0}&l=${encodeURIComponent(this.props.locale)}`
        
        // Only add i18n parameter if it's not empty
        return i18nParam ? `${baseUrl}&i18n=${i18nParam}` : baseUrl
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
                    {!this.isYouTubeArticle() && (
                        <>
                            <div style={{ position: 'relative' }} ref={this.translationChevronRef}>
                                <TooltipHost
                                    content={
                                        this.state.isTranslating
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
                                        onClick={this.handleTranslationMenuToggle}
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
                            </div>
                            {this.renderTranslationMenu()}
                        </>
                    )}
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
