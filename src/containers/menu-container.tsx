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
    selectSources,
} from "../scripts/models/page"
import { ViewType } from "../schema-types"
import { initFeeds } from "../scripts/models/feed"
import { RSSSource, updateSource } from "../scripts/models/source"

const getApp = (state: RootState) => state.app
const getSources = (state: RootState) => state.sources
const getGroups = (state: RootState) => state.groups
const getItemOn = (state: RootState) =>
    state.page.itemId !== null && state.page.viewType !== ViewType.List
const getIsAIMode = (state: RootState) => state.page.feedId === "ai-mode"

const mapStateToProps = createSelector(
    [getApp, getSources, getGroups, getItemOn, getIsAIMode],
    (app, sources, groups, itemOn, isAIMode) => ({
        status: app.sourceInit && !app.settings.display,
        display: app.menu,
        selected: app.menuKey,
        sources: sources,
        groups: groups.map((g, i) => ({ ...g, index: i })),
        itemOn: itemOn,
        isAIMode: isAIMode,
    })
)

const mapDispatchToProps = dispatch => ({
    allArticles: (init = false) => {
        dispatch(selectAllArticles(init)), dispatch(initFeeds())
    },
    allArticlesTotal: (init = false) => {
        dispatch(selectAllArticlesTotal(init)), dispatch(initFeeds())
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
    openSourcesSettings: () => dispatch(openSettingsTab("sources")),
    openGroupingSettings: () => dispatch(openSettingsTab("grouping")),
    addSourceToGroup: (groupIndex: number, sid: number) => dispatch(addSourceToGroup(groupIndex, sid)),
    removeSourceFromGroup: (groupIndex: number, sids: number[]) => dispatch(removeSourceFromGroup(groupIndex, sids)),
    updateSourceGroup: (group: SourceGroup) => dispatch(updateSourceGroup(group)),
    reorderSourceGroups: (groups: SourceGroup[]) => dispatch(reorderSourceGroups(groups)),
    clearSourceIcon: (source: RSSSource) => {
        dispatch(updateSource({ ...source, iconurl: "" }))
    },
})

const MenuContainer = connect(mapStateToProps, mapDispatchToProps)(Menu)
export default MenuContainer
