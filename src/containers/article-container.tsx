import * as React from "react"
import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import {
    RSSItem,
    markUnread,
    markRead,
    toggleStarred,
    itemShortcuts,
} from "../scripts/models/item"
import { AppDispatch } from "../scripts/utils"
import { dismissItem, showOffsetItem } from "../scripts/models/page"
import Article from "../components/article"
import {
    openTextMenu,
    closeContextMenu,
    openImageMenu,
} from "../scripts/models/app"
import {
    RSSSource,
    SourceTextDirection,
    updateSource,
    updateSourceDone,
} from "../scripts/models/source"
import { selectAIConfig } from "../scripts/models/page"
import * as db from "../scripts/db"

type ArticleContainerProps = {
    itemId: number
}

const getItem = (state: RootState, props: ArticleContainerProps) => {
    const item = state.items[props.itemId]
    if (!item && props.itemId) {
        console.warn('ArticleContainer: item not found in store, itemId:', props.itemId)
    }
    return item
}
const getSource = (state: RootState, props: ArticleContainerProps) => {
    const item = state.items[props.itemId]
    if (!item) return null
    const source = state.sources[item.source]
    if (!source && item) {
        console.warn('ArticleContainer: source not found in store, sourceId:', item.source)
    }
    return source
}
const getLocale = (state: RootState) => state.app.locale
const getAIMode = (state: RootState) => state.aiMode

const makeMapStateToProps = () => {
    return createSelector(
        [getItem, getSource, getLocale, getAIMode],
        (item, source, locale, aiMode) => {
            // 调试日志
            if (!item || !source) {
                console.warn('ArticleContainer mapStateToProps: 缺少数据', {
                    hasItem: !!item,
                    hasSource: !!source,
                    itemId: item?._id,
                    sourceId: source?.sid
                })
            }
            // 统一使用Chat API配置进行翻译
            const translationConfig = {
                apiEndpoint: aiMode.chatApiEndpoint,
                apiKey: aiMode.chatApiKey,
                model: aiMode.model,
            }
            return {
                item: item,
                source: source,
                locale: locale,
                translationConfig: translationConfig,
            }
        }
    )
}

const mapDispatchToProps = (dispatch: AppDispatch) => {
    return {
        shortcuts: (item: RSSItem, e: KeyboardEvent) =>
            dispatch(itemShortcuts(item, e)),
        dismiss: () => dispatch(dismissItem()),
        offsetItem: (offset: number) => dispatch(showOffsetItem(offset)),
        toggleHasRead: (item: RSSItem) =>
            dispatch(item.hasRead ? markUnread(item) : markRead(item)),
        toggleStarred: (item: RSSItem) => dispatch(toggleStarred(item)),
        textMenu: (position: [number, number], text: string, url: string) =>
            dispatch(openTextMenu(position, text, url)),
        imageMenu: (position: [number, number]) =>
            dispatch(openImageMenu(position)),
        dismissContextMenu: () => dispatch(closeContextMenu()),
        updateSourceTextDirection: (
            source: RSSSource,
            direction: SourceTextDirection
        ) => {
            dispatch(
                updateSource({ ...source, textDir: direction } as RSSSource)
            )
        },
        clearSourceIcon: (source: RSSSource) => {
            dispatch(
                updateSource({ ...source, iconurl: "" } as RSSSource)
            )
        },
        openTranslationConfig: () => dispatch(selectAIConfig()),
        loadSourceFromDB: async (sourceId: number) => {
            try {
                // 等待数据库初始化
                let retries = 0
                while ((!db.sourcesDB || !db.sources) && retries < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100))
                    retries++
                }
                
                if (db.sourcesDB && db.sources) {
                    const sources = await db.sourcesDB
                        .select()
                        .from(db.sources)
                        .where(db.sources.sid.eq(sourceId))
                        .exec() as RSSSource[]
                    
                    if (sources && sources.length > 0) {
                        const source = sources[0]
                        // 保留数据库中的unreadCount，不重置为0
                        dispatch(updateSourceDone(source))
                        console.log('ArticleContainer: Successfully loaded source from database:', sourceId)
                        return source
                    } else {
                        console.warn('ArticleContainer: Source not found in database:', sourceId)
                        return null
                    }
                } else {
                    console.warn('ArticleContainer: Database not initialized when trying to load source:', sourceId)
                    return null
                }
            } catch (error) {
                console.error('ArticleContainer: Error loading source from database:', error, {
                    sourceId: sourceId
                })
                return null
            }
        },
    }
}

// Wrapper component to handle source loading fallback
type ArticleContainerWrapperProps = {
    item: RSSItem | undefined
    source: RSSSource | null
    locale: string
    shortcuts: (item: RSSItem, e: KeyboardEvent) => void
    dismiss: () => void
    offsetItem: (offset: number) => void
    toggleHasRead: (item: RSSItem) => void
    toggleStarred: (item: RSSItem) => void
    textMenu: (position: [number, number], text: string, url: string) => void
    imageMenu: (position: [number, number]) => void
    dismissContextMenu: () => void
    updateSourceTextDirection: (source: RSSSource, direction: SourceTextDirection) => void
    clearSourceIcon: (source: RSSSource) => void
    loadSourceFromDB: (sourceId: number) => Promise<RSSSource | null>
    translationConfig: { apiEndpoint: string; apiKey: string; model: string }
    openTranslationConfig: () => void
}

class ArticleContainerWrapper extends React.Component<ArticleContainerWrapperProps, { sourceLoaded: boolean }> {
    constructor(props: ArticleContainerWrapperProps) {
        super(props)
        this.state = { sourceLoaded: false }
    }

    async componentDidMount() {
        // 如果item存在但source为null，尝试从数据库加载
        if (this.props.item && !this.props.source && !this.state.sourceLoaded) {
            console.log('ArticleContainer: Attempting to load source from database:', this.props.item.source)
            this.setState({ sourceLoaded: true })
            await this.props.loadSourceFromDB(this.props.item.source)
        }
    }

    async componentDidUpdate(prevProps: ArticleContainerWrapperProps) {
        // 如果item变化或source变为null，尝试重新加载
        if (
            this.props.item &&
            !this.props.source &&
            (prevProps.item?._id !== this.props.item._id || prevProps.source !== this.props.source)
        ) {
            if (!this.state.sourceLoaded || prevProps.item?._id !== this.props.item._id) {
                console.log('ArticleContainer: Attempting to load source from database:', this.props.item.source)
                this.setState({ sourceLoaded: true })
                await this.props.loadSourceFromDB(this.props.item.source)
            }
        }
    }

    render() {
        // 如果item或source仍然不存在，显示加载状态或错误
        if (!this.props.item) {
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p>Article not found</p>
                </div>
            )
        }

        if (!this.props.source) {
            return (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p>Loading source...</p>
                </div>
            )
        }

        return <Article {...this.props} />
    }
}

const ConnectedArticleContainer = connect(
    makeMapStateToProps,
    mapDispatchToProps
)(ArticleContainerWrapper) as React.ComponentType<ArticleContainerProps>

const ArticleContainer = (props: ArticleContainerProps) => {
    return <ConnectedArticleContainer itemId={props.itemId} />
}

export default ArticleContainer
