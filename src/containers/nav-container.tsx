import intl from "react-intl-universal"
import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import { fetchItems } from "../scripts/models/item"
import {
    toggleLogMenu,
    openViewMenu,
    openSettingsTab,
} from "../scripts/models/app"
import { toggleSearch, selectAIMode, selectAllArticles } from "../scripts/models/page"
import { ViewType } from "../schema-types"
import Nav from "../components/nav"

const getState = (state: RootState) => state.app
const getItemShown = (state: RootState) =>
    state.page.itemId && state.page.viewType !== ViewType.List
const getIsAIModeEnabled = (state: RootState) => 
    state.page.feedId === "ai-mode"
const getSettingsDisplay = (state: RootState) => 
    state.app.settings.display

const mapStateToProps = createSelector(
    [getState, getItemShown, getIsAIModeEnabled, getSettingsDisplay],
    (state, itemShown, isAIModeEnabled, settingsDisplay) => ({
        state: state,
        itemShown: itemShown,
        isAIModeEnabled: isAIModeEnabled,
        settingsDisplay: settingsDisplay,
    })
)

const mapDispatchToProps = dispatch => ({
    fetch: () => dispatch(fetchItems()),
    logs: () => dispatch(toggleLogMenu()),
    views: () => dispatch(openViewMenu()),
    openSourcesSettings: () => dispatch(openSettingsTab("sources")),
    openGroupingSettings: () => dispatch(openSettingsTab("grouping")),
    openAppSettings: () => dispatch(openSettingsTab("app")),
    search: () => dispatch(toggleSearch()),
    toggleAIMode: (enabled: boolean) => {
        if (enabled) {
            dispatch(selectAIMode())
        } else {
            dispatch(selectAllArticles())
        }
    },
})

const NavContainer = connect(mapStateToProps, mapDispatchToProps)(Nav)
export default NavContainer
