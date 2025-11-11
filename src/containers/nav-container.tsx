import intl from "react-intl-universal"
import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import { fetchItems } from "../scripts/models/item"
import {
    toggleLogMenu,
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
const getAIConfigDisplay = (state: RootState) => 
    state.aiMode.showConfigPanel

const mapStateToProps = createSelector(
    [getState, getItemShown, getIsAIModeEnabled, getSettingsDisplay, getAIConfigDisplay],
    (state, itemShown, isAIModeEnabled, settingsDisplay, aiConfigDisplay) => ({
        state: state,
        itemShown: itemShown,
        isAIModeEnabled: isAIModeEnabled,
        settingsDisplay: settingsDisplay,
        aiConfigDisplay: aiConfigDisplay,
    })
)

const mapDispatchToProps = dispatch => ({
    fetch: () => dispatch(fetchItems()),
    logs: () => dispatch(toggleLogMenu()),
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
