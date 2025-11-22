import intl from "react-intl-universal"
import * as db from "../db"
import lf from "lovefield"
import {
    fetchFavicon,
    validateFavicon,
    ActionStatus,
    AppThunk,
    parseRSS,
    MyParserItem,
    getCachedFeedIcon,
    setCachedFeedIcon,
} from "../utils"
import {
    RSSItem,
    insertItems,
    ItemActionTypes,
    FETCH_ITEMS,
    MARK_READ,
    MARK_UNREAD,
    MARK_ALL_READ,
} from "./item"
import { saveSettings } from "./app"
import { SourceRule } from "./rule"
import { fixBrokenGroups } from "./group"

export const enum SourceOpenTarget {
    Local,
    Webpage,
    External,
    FullContent,
}

export const enum SourceTextDirection {
    LTR,
    RTL,
    Vertical,
}

export class RSSSource {
    sid: number
    url: string
    iconurl?: string
    name: string
    openTarget: SourceOpenTarget
    unreadCount: number
    lastFetched: Date
    serviceRef?: string
    rules?: SourceRule[]
    textDir: SourceTextDirection
    hidden: boolean

    constructor(url: string, name: string = null) {
        this.url = url
        this.name = name
        this.openTarget = SourceOpenTarget.Local
        this.lastFetched = new Date()
        this.textDir = SourceTextDirection.LTR
        this.hidden = false
    }

    static async fetchMetaData(source: RSSSource) {
        let feed = await parseRSS(source.url)
        if (!source.name) {
            if (feed.title) source.name = feed.title.trim()
            source.name = source.name || intl.get("sources.untitled")
        }
        // 从RSS feed XML中提取图标
        if (!source.iconurl) {
            // 检测是否是 YouTube feed，统一使用本地 YouTube 图标
            if (/youtube\.com/.test(source.url)) {
                source.iconurl = "icons/youtube-favicon-32x32.png"
            } else {
                let iconUrl: string | null = null
                // RSS 2.0: <image><url>
                if (feed.image?.url) {
                    iconUrl = feed.image.url
                }
                // Atom: <logo> 或 <icon>
                else if (feed.logo) {
                    iconUrl = feed.logo
                }
                else if (feed.icon) {
                    iconUrl = feed.icon
                }
                // iTunes播客: <itunes:image>
                else if (feed.itunesImage?.href) {
                    iconUrl = feed.itunesImage.href
                }
                else if (typeof feed.itunesImage === "string") {
                    iconUrl = feed.itunesImage
                }
                // 验证图标URL是否有效
                if (iconUrl) {
                    if (await validateFavicon(iconUrl)) {
                        source.iconurl = iconUrl
                    } else {
                        // 验证失败时设置为undefined，这样addSource会触发updateFavicon从网站HTML获取
                        source.iconurl = undefined
                    }
                }
            }
        }
        return feed
    }

    private static async checkItem(
        source: RSSSource,
        item: MyParserItem
    ): Promise<RSSItem> {
        let i = new RSSItem(item, source)
        const items = (await db.itemsDB
            .select()
            .from(db.items)
            .where(
                lf.op.and(
                    db.items.source.eq(i.source),
                    db.items.title.eq(i.title),
                    db.items.date.eq(i.date)
                )
            )
            .limit(1)
            .exec()) as RSSItem[]
        if (items.length === 0) {
            RSSItem.parseContent(i, item)
            if (source.rules) SourceRule.applyAll(source.rules, i)
            return i
        } else {
            return null
        }
    }

    static checkItems(
        source: RSSSource,
        items: MyParserItem[]
    ): Promise<RSSItem[]> {
        return new Promise<RSSItem[]>((resolve, reject) => {
            let p = new Array<Promise<RSSItem>>()
            for (let item of items) {
                p.push(this.checkItem(source, item))
            }
            Promise.all(p)
                .then(values => {
                    resolve(values.filter(v => v != null))
                })
                .catch(e => {
                    reject(e)
                })
        })
    }

    static async fetchItems(source: RSSSource) {
        let feed = await parseRSS(source.url)
        return await this.checkItems(source, feed.items)
    }
}

export type SourceState = {
    [sid: number]: RSSSource
}

export const INIT_SOURCES = "INIT_SOURCES"
export const ADD_SOURCE = "ADD_SOURCE"
export const UPDATE_SOURCE = "UPDATE_SOURCE"
export const UPDATE_UNREAD_COUNTS = "UPDATE_UNREAD_COUNTS"
export const DELETE_SOURCE = "DELETE_SOURCE"
export const HIDE_SOURCE = "HIDE_SOURCE"
export const UNHIDE_SOURCE = "UNHIDE_SOURCE"

interface InitSourcesAction {
    type: typeof INIT_SOURCES
    status: ActionStatus
    sources?: SourceState
    err?
}

interface AddSourceAction {
    type: typeof ADD_SOURCE
    status: ActionStatus
    batch: boolean
    source?: RSSSource
    err?
}

interface UpdateSourceAction {
    type: typeof UPDATE_SOURCE
    source: RSSSource
}

interface UpdateUnreadCountsAction {
    type: typeof UPDATE_UNREAD_COUNTS
    sources: SourceState
}

interface DeleteSourceAction {
    type: typeof DELETE_SOURCE
    source: RSSSource
}

interface ToggleSourceHiddenAction {
    type: typeof HIDE_SOURCE | typeof UNHIDE_SOURCE
    status: ActionStatus
    source: RSSSource
}

export type SourceActionTypes =
    | InitSourcesAction
    | AddSourceAction
    | UpdateSourceAction
    | UpdateUnreadCountsAction
    | DeleteSourceAction
    | ToggleSourceHiddenAction

export function initSourcesRequest(): SourceActionTypes {
    return {
        type: INIT_SOURCES,
        status: ActionStatus.Request,
    }
}

export function initSourcesSuccess(sources: SourceState): SourceActionTypes {
    return {
        type: INIT_SOURCES,
        status: ActionStatus.Success,
        sources: sources,
    }
}

export function initSourcesFailure(err): SourceActionTypes {
    return {
        type: INIT_SOURCES,
        status: ActionStatus.Failure,
        err: err,
    }
}

async function unreadCount(sources: SourceState): Promise<SourceState> {
    const rows = await db.itemsDB
        .select(db.items.source, lf.fn.count(db.items._id))
        .from(db.items)
        .where(db.items.hasRead.eq(false))
        .groupBy(db.items.source)
        .exec()
    for (let row of rows) {
        sources[row["source"]].unreadCount = row["COUNT(_id)"]
    }
    return sources
}

export async function getStarredCount(sids: number[]): Promise<number> {
    if (sids.length === 0) return 0
    // 完全模仿 unreadCount 的实现，查询已收藏（starred）的文章
    const rows = await db.itemsDB
        .select(db.items.source, lf.fn.count(db.items._id))
        .from(db.items)
        .where(db.items.starred.eq(true))
        .groupBy(db.items.source)
        .exec()
    let total = 0
    for (let row of rows) {
        if (sids.includes(row["source"])) {
            total += row["COUNT(_id)"] || 0
        }
    }
    return total
}

export function updateUnreadCounts(): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const sources: SourceState = {}
        for (let source of Object.values(getState().sources)) {
            sources[source.sid] = {
                ...source,
                unreadCount: 0,
            }
        }
        dispatch({
            type: UPDATE_UNREAD_COUNTS,
            sources: await unreadCount(sources),
        })
    }
}

export function initSources(): AppThunk<Promise<void>> {
    return async dispatch => {
        dispatch(initSourcesRequest())
        await db.init()
        const sources = (await db.sourcesDB
            .select()
            .from(db.sources)
            .exec()) as RSSSource[]
        const state: SourceState = {}
        for (let source of sources) {
            source.unreadCount = 0
            state[source.sid] = source
        }
        await unreadCount(state)
        dispatch(fixBrokenGroups(state))
        dispatch(initSourcesSuccess(state))
    }
}

export function addSourceRequest(batch: boolean): SourceActionTypes {
    return {
        type: ADD_SOURCE,
        batch: batch,
        status: ActionStatus.Request,
    }
}

export function addSourceSuccess(
    source: RSSSource,
    batch: boolean
): SourceActionTypes {
    return {
        type: ADD_SOURCE,
        batch: batch,
        status: ActionStatus.Success,
        source: source,
    }
}

export function addSourceFailure(err, batch: boolean): SourceActionTypes {
    return {
        type: ADD_SOURCE,
        batch: batch,
        status: ActionStatus.Failure,
        err: err,
    }
}

let insertPromises = Promise.resolve()
export function insertSource(source: RSSSource): AppThunk<Promise<RSSSource>> {
    return (_, getState) => {
        return new Promise((resolve, reject) => {
            insertPromises = insertPromises.then(async () => {
                let sids = Object.values(getState().sources).map(s => s.sid)
                source.sid = Math.max(...sids, -1) + 1
                const row = db.sources.createRow(source)
                try {
                    const inserted = (await db.sourcesDB
                        .insert()
                        .into(db.sources)
                        .values([row])
                        .exec()) as RSSSource[]
                    resolve(inserted[0])
                } catch (err) {
                    if (err.code === 201) reject(intl.get("sources.exist"))
                    else reject(err)
                }
            })
        })
    }
}

export function addSource(
    url: string,
    name: string = null,
    batch = false
): AppThunk<Promise<number>> {
    return async (dispatch, getState) => {
        const app = getState().app
        if (app.sourceInit) {
            dispatch(addSourceRequest(batch))
            const source = new RSSSource(url, name)
            try {
                const feed = await RSSSource.fetchMetaData(source)
                const inserted = await dispatch(insertSource(source))
                inserted.unreadCount = feed.items.length
                // 如果feed中没有图标或图标为空字符串，再从网站HTML中获取
                if (!inserted.iconurl || inserted.iconurl === "") {
                    dispatch(updateFavicon([inserted.sid]))
                } else {
                    // 如果从XML中获取到了图标，需要更新数据库
                    await dispatch(updateSource(inserted))
                }
                dispatch(addSourceSuccess(inserted, batch))
                window.settings.saveGroups(getState().groups)
                const items = await RSSSource.checkItems(inserted, feed.items)
                await insertItems(items)
                return inserted.sid
            } catch (e) {
                dispatch(addSourceFailure(e, batch))
                if (!batch) {
                    window.utils.showErrorBox(
                        intl.get("sources.errorAdd"),
                        String(e),
                        intl.get("context.copy")
                    )
                }
                throw e
            }
        }
        throw new Error("Sources not initialized.")
    }
}

export function updateSourceDone(source: RSSSource): SourceActionTypes {
    return {
        type: UPDATE_SOURCE,
        source: source,
    }
}

export function updateSource(source: RSSSource): AppThunk<Promise<void>> {
    return async dispatch => {
        let sourceCopy = { ...source }
        delete sourceCopy.unreadCount
        const row = db.sources.createRow(sourceCopy)
        await db.sourcesDB
            .insertOrReplace()
            .into(db.sources)
            .values([row])
            .exec()
        dispatch(updateSourceDone(source))
    }
}

export function deleteSourceDone(source: RSSSource): SourceActionTypes {
    return {
        type: DELETE_SOURCE,
        source: source,
    }
}

export function deleteSource(
    source: RSSSource,
    batch = false
): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        if (!batch) dispatch(saveSettings())
        try {
            await db.itemsDB
                .delete()
                .from(db.items)
                .where(db.items.source.eq(source.sid))
                .exec()
            await db.sourcesDB
                .delete()
                .from(db.sources)
                .where(db.sources.sid.eq(source.sid))
                .exec()
            dispatch(deleteSourceDone(source))
            window.settings.saveGroups(getState().groups)
        } catch (err) {
            console.log(err)
        } finally {
            if (!batch) dispatch(saveSettings())
        }
    }
}

export function deleteSources(sources: RSSSource[]): AppThunk<Promise<void>> {
    return async dispatch => {
        dispatch(saveSettings())
        for (let source of sources) {
            await dispatch(deleteSource(source, true))
        }
        dispatch(saveSettings())
    }
}

export function toggleSourceHidden(source: RSSSource): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const sourceCopy: RSSSource = { ...getState().sources[source.sid] }
        sourceCopy.hidden = !sourceCopy.hidden
        dispatch({
            type: sourceCopy.hidden ? HIDE_SOURCE : UNHIDE_SOURCE,
            status: ActionStatus.Success,
            source: sourceCopy,
        })
        await dispatch(updateSource(sourceCopy))
    }
}

export function updateFavicon(
    sids?: number[],
    force = false
): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const initSources = getState().sources
        if (!sids) {
            sids = Object.values(initSources)
                .filter(s => s.iconurl === undefined)
                .map(s => s.sid)
        } else {
            sids = sids.filter(sid => sid in initSources)
        }
        const promises = sids.map(async sid => {
            const url = initSources[sid].url
            const source = getState().sources[sid]
            if (
                source &&
                source.url === url &&
                (force || source.iconurl === undefined)
            ) {
                let favicon: string | null = null
                // 检测是否是 YouTube feed，统一使用本地 YouTube 图标
                if (/youtube\.com/.test(url)) {
                    favicon = "icons/youtube-favicon-32x32.png"
                } else {
                    // 如果不是强制更新，先检查缓存
                    if (!force) {
                        favicon = getCachedFeedIcon(url)
                    }
                    // 如果缓存中没有，则从网络获取
                    if (!favicon) {
                        favicon = await fetchFavicon(url)
                        // 如果获取成功，存入缓存
                        if (favicon) {
                            setCachedFeedIcon(url, favicon)
                        }
                    }
                }
                // 如果获取失败，设置为空字符串而不是undefined
                source.iconurl = favicon || ""
                await dispatch(updateSource(source))
            }
        })
        await Promise.all(promises)
    }
}

export function sourceReducer(
    state: SourceState = {},
    action: SourceActionTypes | ItemActionTypes
): SourceState {
    switch (action.type) {
        case INIT_SOURCES:
            switch (action.status) {
                case ActionStatus.Success:
                    return action.sources
                default:
                    return state
            }
        case UPDATE_UNREAD_COUNTS:
            return action.sources
        case ADD_SOURCE:
            switch (action.status) {
                case ActionStatus.Success:
                    return {
                        ...state,
                        [action.source.sid]: action.source,
                    }
                default:
                    return state
            }
        case UPDATE_SOURCE:
            return {
                ...state,
                [action.source.sid]: action.source,
            }
        case DELETE_SOURCE: {
            delete state[action.source.sid]
            return { ...state }
        }
        case FETCH_ITEMS: {
            switch (action.status) {
                case ActionStatus.Success: {
                    let updateMap = new Map<number, number>()
                    for (let item of action.items) {
                        if (!item.hasRead) {
                            updateMap.set(
                                item.source,
                                updateMap.has(item.source)
                                    ? updateMap.get(item.source) + 1
                                    : 1
                            )
                        }
                    }
                    let nextState = {} as SourceState
                    for (let [s, source] of Object.entries(state)) {
                        let sid = parseInt(s)
                        if (updateMap.has(sid)) {
                            nextState[sid] = {
                                ...source,
                                unreadCount:
                                    source.unreadCount + updateMap.get(sid),
                            } as RSSSource
                        } else {
                            nextState[sid] = source
                        }
                    }
                    return nextState
                }
                default:
                    return state
            }
        }
        case MARK_UNREAD:
        case MARK_READ:
            return {
                ...state,
                [action.item.source]: {
                    ...state[action.item.source],
                    unreadCount:
                        state[action.item.source].unreadCount +
                        (action.type === MARK_UNREAD ? 1 : -1),
                } as RSSSource,
            }
        case MARK_ALL_READ: {
            let nextState = { ...state }
            action.sids.forEach(sid => {
                nextState[sid] = {
                    ...state[sid],
                    unreadCount: action.time ? state[sid].unreadCount : 0,
                }
            })
            return nextState
        }
        default:
            return state
    }
}
