import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../../scripts/reducer"
import SourcesTab from "../../components/settings/sources"
import {
    addSource,
    RSSSource,
    updateSource,
} from "../../scripts/models/source"
import { importOPML, exportOPML } from "../../scripts/models/group"
import { AppDispatch } from "../../scripts/utils"
import { SyncService } from "../../schema-types"

const getSources = (state: RootState) => state.sources
const getServiceOn = (state: RootState) =>
    state.service.type !== SyncService.None

const mapStateToProps = createSelector(
    [getSources, getServiceOn],
    (sources, serviceOn) => ({
        sources: sources,
        serviceOn: serviceOn,
    })
)

const mapDispatchToProps = (dispatch: AppDispatch) => {
    return {
        addSource: (url: string) => dispatch(addSource(url)),
        clearSourceIcon: (source: RSSSource) => {
            dispatch(updateSource({ ...source, iconurl: "" }))
        },
        importOPML: (onError?: (title: string, content: string) => void) => 
            dispatch(importOPML(onError)),
        exportOPML: () => dispatch(exportOPML()),
    }
}

const SourcesTabContainer = connect(
    mapStateToProps,
    mapDispatchToProps
)(SourcesTab)
export default SourcesTabContainer
