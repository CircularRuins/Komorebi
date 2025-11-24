import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../../scripts/reducer"
import {
    initIntl,
    saveSettings,
    setupAutoFetch,
} from "../../scripts/models/app"
import * as db from "../../scripts/db"
import AppTab from "../../components/settings/app"
import { importAll } from "../../scripts/settings"
import { updateUnreadCounts } from "../../scripts/models/source"
import { importOPML, exportOPML } from "../../scripts/models/group"
import { AppDispatch } from "../../scripts/utils"

const getFetchingItems = (state: RootState) => state.app.fetchingItems
const getFetchingTotal = (state: RootState) => state.app.fetchingTotal
const getFetchingProgress = (state: RootState) => state.app.fetchingProgress
const getIsOPMLImport = (state: RootState) => state.app.isOPMLImport

const mapStateToProps = createSelector(
    [getFetchingItems, getFetchingTotal, getFetchingProgress, getIsOPMLImport],
    (fetchingItems, fetchingTotal, fetchingProgress, isOPMLImport) => ({
        fetchingItems: fetchingItems,
        fetchingTotal: fetchingTotal,
        fetchingProgress: fetchingProgress,
        isOPMLImport: isOPMLImport,
    })
)

const mapDispatchToProps = (dispatch: AppDispatch) => ({
    setLanguage: (option: string) => {
        window.settings.setLocaleSettings(option)
        dispatch(initIntl())
    },
    setFetchInterval: (interval: number) => {
        window.settings.setFetchInterval(interval)
        dispatch(setupAutoFetch())
    },
    deleteArticles: async (days: number) => {
        dispatch(saveSettings())
        let date = new Date()
        date.setTime(date.getTime() - days * 86400000)
        await db.itemsDB
            .delete()
            .from(db.items)
            .where(db.items.date.lt(date))
            .exec()
        await dispatch(updateUnreadCounts())
        dispatch(saveSettings())
    },
    importAll: async () => {
        dispatch(saveSettings())
        let cancelled = await importAll()
        if (cancelled) dispatch(saveSettings())
    },
    importOPML: (onError?: (title: string, content: string) => void) => 
        dispatch(importOPML(onError)),
    exportOPML: () => dispatch(exportOPML()),
})

const AppTabContainer = connect(mapStateToProps, mapDispatchToProps)(AppTab)
export default AppTabContainer
