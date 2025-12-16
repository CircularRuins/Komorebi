import intl from "react-intl-universal"
import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import { fetchItems } from "../scripts/models/item"
import {
    toggleLogMenu,
    openSettingsTab,
} from "../scripts/models/app"
import { selectSmartSearch, selectAllArticles, selectAppPreferences, selectAIConfig, selectTokenUsage } from "../scripts/models/page"
import { ViewType } from "../schema-types"
import Nav from "../components/nav"

const getState = (state: RootState) => state.app
const getItemShown = (state: RootState) =>
    state.page.itemId && state.page.viewType !== ViewType.List
const getIsAIModeEnabled = (state: RootState) => 
    state.page.feedId === "smart-search"
const getSettingsDisplay = (state: RootState) => 
    state.app.settings.display
const getAIConfigDisplay = (state: RootState) => 
    state.aiMode.showConfigPanel
const getIsRefreshing = (state: RootState) => 
    state.app.syncing || state.app.fetchingItems

const mapStateToProps = createSelector(
    [getState, getItemShown, getIsAIModeEnabled, getSettingsDisplay, getAIConfigDisplay, getIsRefreshing],
    (state, itemShown, isAIModeEnabled, settingsDisplay, aiConfigDisplay, isRefreshing) => ({
        state: state,
        itemShown: itemShown,
        isAIModeEnabled: isAIModeEnabled,
        settingsDisplay: settingsDisplay,
        aiConfigDisplay: aiConfigDisplay,
        isRefreshing: isRefreshing,
    })
)

const mapDispatchToProps = dispatch => ({
    fetch: () => dispatch(fetchItems()),
    logs: () => dispatch(toggleLogMenu()),
    openSourcesSettings: () => dispatch(openSettingsTab("sources")),
    openGroupingSettings: () => dispatch(openSettingsTab("grouping")),
    openAppSettings: () => dispatch(selectAppPreferences()),
    toggleAIMode: (enabled: boolean) => {
        if (enabled) {
            dispatch(selectSmartSearch())
        } else {
            dispatch(selectAllArticles())
        }
    },
    openAIConfig: () => dispatch(selectAIConfig()),
    openTokenUsage: () => dispatch(selectTokenUsage()),
})

const NavContainer = connect(mapStateToProps, mapDispatchToProps)(Nav)
export default NavContainer
