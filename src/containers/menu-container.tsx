import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import { Menu } from "../components/menu"
import { toggleMenu, openGroupMenu, openSettingsTab } from "../scripts/models/app"
import { 
    toggleGroupExpansion, 
    addSourceToGroup, 
    removeSourceFromGroup, 
    updateSourceGroup,
    reorderSourceGroups 
} from "../scripts/models/group"
import { SourceGroup } from "../schema-types"
import {
    selectAllArticles,
    selectAllArticlesTotal,
    selectTodayArticles,
    selectAlphaXiv,
    selectSources,
    selectAIMode,
    toggleSourcesPage,
} from "../scripts/models/page"
import { ViewType } from "../schema-types"
import { initFeeds, ALL_TODAY } from "../scripts/models/feed"
import { RSSSource, updateSource } from "../scripts/models/source"

const getApp = (state: RootState) => state.app
const getSources = (state: RootState) => state.sources
const getGroups = (state: RootState) => state.groups
const getItemOn = (state: RootState) =>
    state.page.itemId !== null && state.page.viewType !== ViewType.List
const getIsAIMode = (state: RootState) => state.page.feedId === "ai-mode"
const getItems = (state: RootState) => state.items
const getFeeds = (state: RootState) => state.feeds

// 计算今日文章的未读数量
const getTodayUnreadCount = createSelector(
    [getItems, getFeeds, getSources],
    (items, feeds, sources) => {
        const todayFeed = feeds[ALL_TODAY]
        if (!todayFeed) return 0
        
        // 获取24小时以内的时间范围
        const currentTime = new Date()
        const cutoffTime = new Date()
        cutoffTime.setTime(currentTime.getTime() - 24 * 60 * 60 * 1000)
        
        // 获取所有可见的源ID
        const visibleSids = Object.values(sources)
            .filter(s => !s.hidden)
            .map(s => s.sid)
        
        // 如果 feed 已加载，使用 iids 计算（更高效）
        if (todayFeed.loaded && todayFeed.iids && todayFeed.iids.length > 0) {
            return todayFeed.iids.filter(iid => {
                const item = items[iid]
                if (!item || item.hasRead) return false
                // 检查是否是24小时以内的文章
                const itemDate = item.date.getTime()
                return itemDate >= cutoffTime.getTime() && itemDate <= currentTime.getTime()
            }).length
        }
        
        // 如果 feed 未加载，遍历所有 items 计算
        let count = 0
        for (const item of Object.values(items)) {
            if (
                visibleSids.includes(item.source) &&
                !item.hasRead
            ) {
                // 检查是否是24小时以内的文章
                const itemDate = item.date.getTime()
                if (itemDate >= cutoffTime.getTime() && itemDate <= currentTime.getTime()) {
                    count++
                }
            }
        }
        return count
    }
)

const mapStateToProps = createSelector(
    [getApp, getSources, getGroups, getItemOn, getIsAIMode, getTodayUnreadCount],
    (app, sources, groups, itemOn, isAIMode, todayUnreadCount) => ({
        status: app.sourceInit && !app.settings.display,
        display: app.menu,
        selected: app.menuKey,
        sources: sources,
        groups: groups.map((g, i) => ({ ...g, index: i })),
        itemOn: itemOn,
        isAIMode: isAIMode,
        todayUnreadCount: todayUnreadCount,
    })
)

const mapDispatchToProps = dispatch => ({
    allArticles: (init = false) => {
        dispatch(selectAllArticles(init)), dispatch(initFeeds())
    },
    allArticlesTotal: (init = false) => {
        dispatch(selectAllArticlesTotal(init)), dispatch(initFeeds())
    },
    todayArticles: (init = false) => {
        dispatch(selectTodayArticles(init)), dispatch(initFeeds())
    },
    selectAlphaxiv: (init = false) => {
        dispatch(selectAlphaXiv(init))
    },
    selectSourceGroup: (group: SourceGroup, menuKey: string) => {
        dispatch(selectSources(group.sids, menuKey, ""))
        dispatch(initFeeds())
    },
    selectSource: (source: RSSSource) => {
        dispatch(selectSources([source.sid], "s-" + source.sid, ""))
        dispatch(initFeeds())
    },
    groupContextMenu: (sids: number[], event: React.MouseEvent) => {
        dispatch(openGroupMenu(sids, event))
    },
    updateGroupExpansion: (
        event: React.MouseEvent<HTMLElement>,
        key: string,
        selected: string
    ) => {
        if ((event.target as HTMLElement).tagName === "I" || key === selected) {
            let [type, index] = key.split("-")
            if (type === "g") dispatch(toggleGroupExpansion(parseInt(index)))
        }
    },
    openSourcesSettings: () => dispatch(toggleSourcesPage(true)),
    openGroupingSettings: () => dispatch(openSettingsTab("grouping")),
    addSourceToGroup: (groupIndex: number, sid: number) => dispatch(addSourceToGroup(groupIndex, sid)),
    removeSourceFromGroup: (groupIndex: number, sids: number[]) => dispatch(removeSourceFromGroup(groupIndex, sids)),
    updateSourceGroup: (group: SourceGroup) => dispatch(updateSourceGroup(group)),
    reorderSourceGroups: (groups: SourceGroup[]) => dispatch(reorderSourceGroups(groups)),
    clearSourceIcon: (source: RSSSource) => {
        dispatch(updateSource({ ...source, iconurl: "" }))
    },
    toggleAIMode: (enabled: boolean) => {
        if (enabled) {
            dispatch(selectAIMode())
        } else {
            dispatch(selectAllArticles())
        }
    },
})

const MenuContainer = connect(mapStateToProps, mapDispatchToProps)(Menu)
export default MenuContainer
