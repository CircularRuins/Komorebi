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
} from "../scripts/models/source"

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

const makeMapStateToProps = () => {
    return createSelector(
        [getItem, getSource, getLocale],
        (item, source, locale) => {
            // 调试日志
            if (!item || !source) {
                console.warn('ArticleContainer mapStateToProps: 缺少数据', {
                    hasItem: !!item,
                    hasSource: !!source,
                    itemId: item?._id,
                    sourceId: source?.sid
                })
            }
            return {
                item: item,
                source: source,
                locale: locale,
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
    }
}

const ArticleContainer = connect(
    makeMapStateToProps,
    mapDispatchToProps
)(Article)
export default ArticleContainer
