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
import { toggleSearch } from "../scripts/models/page"
import { ViewType } from "../schema-types"
import Nav from "../components/nav"

const getState = (state: RootState) => state.app
const getItemShown = (state: RootState) =>
    state.page.itemId && state.page.viewType !== ViewType.List

const mapStateToProps = createSelector(
    [getState, getItemShown],
    (state, itemShown) => ({
        state: state,
        itemShown: itemShown,
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
})

const NavContainer = connect(mapStateToProps, mapDispatchToProps)(Nav)
export default NavContainer
