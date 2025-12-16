import Store = require("electron-store")
import {
    SchemaTypes,
    SourceGroup,
    ViewType,
    ThemeSettings,
    SearchEngines,
    SyncService,
    ServiceConfigs,
    ViewConfigs,
} from "../schema-types"
import { ipcMain, session, nativeTheme, app } from "electron"
import { WindowManager } from "./window"

// 设置用户数据路径为 komorebi
const userDataPath = require('path').join(app.getPath('appData'), 'komorebi')
app.setPath('userData', userDataPath)

export const store = new Store<SchemaTypes>()

const GROUPS_STORE_KEY = "sourceGroups"
ipcMain.handle("set-groups", (_, groups: SourceGroup[]) => {
    store.set(GROUPS_STORE_KEY, groups)
})
ipcMain.on("get-groups", event => {
    event.returnValue = store.get(GROUPS_STORE_KEY, [])
})

const MENU_STORE_KEY = "menuOn"
ipcMain.on("get-menu", event => {
    event.returnValue = store.get(MENU_STORE_KEY, false)
})
ipcMain.handle("set-menu", (_, state: boolean) => {
    store.set(MENU_STORE_KEY, state)
})

const PAC_STORE_KEY = "pac"
const PAC_STATUS_KEY = "pacOn"
function getProxyStatus() {
    return store.get(PAC_STATUS_KEY, false)
}
function toggleProxyStatus() {
    store.set(PAC_STATUS_KEY, !getProxyStatus())
    setProxy()
}
function getProxy() {
    return store.get(PAC_STORE_KEY, "")
}
function setProxy(address = null) {
    if (!address) {
        address = getProxy()
    } else {
        store.set(PAC_STORE_KEY, address)
    }
    if (getProxyStatus()) {
        let rules = { pacScript: address }
        session.defaultSession.setProxy(rules)
        session.fromPartition("sandbox").setProxy(rules)
    }
}
ipcMain.on("get-proxy-status", event => {
    event.returnValue = getProxyStatus()
})
ipcMain.on("toggle-proxy-status", () => {
    toggleProxyStatus()
})
ipcMain.on("get-proxy", event => {
    event.returnValue = getProxy()
})
ipcMain.handle("set-proxy", (_, address = null) => {
    setProxy(address)
})

const VIEW_STORE_KEY = "view"
ipcMain.on("get-view", event => {
    event.returnValue = store.get(VIEW_STORE_KEY, ViewType.Cards)
})
ipcMain.handle("set-view", (_, viewType: ViewType) => {
    store.set(VIEW_STORE_KEY, viewType)
})

ipcMain.on("get-theme", event => {
    event.returnValue = ThemeSettings.Dark
})
ipcMain.handle("set-theme", () => {
    nativeTheme.themeSource = ThemeSettings.Dark
})
ipcMain.on("get-theme-dark-color", event => {
    event.returnValue = true
})
export function setThemeListener(manager: WindowManager) {
    nativeTheme.removeAllListeners()
    nativeTheme.on("updated", () => {
        if (manager.hasWindow()) {
            let contents = manager.mainWindow.webContents
            if (!contents.isDestroyed()) {
                contents.send("theme-updated", true)
            }
        }
    })
}

const LOCALE_STORE_KEY = "locale"
ipcMain.handle("set-locale", (_, option: string) => {
    store.set(LOCALE_STORE_KEY, option)
})
function getLocaleSettings() {
    return store.get(LOCALE_STORE_KEY, "default")
}
ipcMain.on("get-locale-settings", event => {
    event.returnValue = getLocaleSettings()
})
ipcMain.on("get-locale", event => {
    let setting = getLocaleSettings()
    let locale = setting === "default" ? app.getLocale() : setting
    event.returnValue = locale
})

const FONT_SIZE_STORE_KEY = "fontSize"
ipcMain.on("get-font-size", event => {
    event.returnValue = store.get(FONT_SIZE_STORE_KEY, 16)
})
ipcMain.handle("set-font-size", (_, size: number) => {
    store.set(FONT_SIZE_STORE_KEY, size)
})

const FONT_STORE_KEY = "fontFamily"
ipcMain.on("get-font", event => {
    event.returnValue = store.get(FONT_STORE_KEY, "")
})
ipcMain.handle("set-font", (_, font: string) => {
    store.set(FONT_STORE_KEY, font)
})

ipcMain.on("get-all-settings", event => {
    let output = {}
    for (let [key, value] of store) {
        output[key] = value
    }
    event.returnValue = output
})

const FETCH_INTEVAL_STORE_KEY = "fetchInterval"
ipcMain.on("get-fetch-interval", event => {
    event.returnValue = store.get(FETCH_INTEVAL_STORE_KEY, 0)
})
ipcMain.handle("set-fetch-interval", (_, interval: number) => {
    store.set(FETCH_INTEVAL_STORE_KEY, interval)
})

const SEARCH_ENGINE_STORE_KEY = "searchEngine"
ipcMain.on("get-search-engine", event => {
    event.returnValue = store.get(SEARCH_ENGINE_STORE_KEY, SearchEngines.Google)
})
ipcMain.handle("set-search-engine", (_, engine: SearchEngines) => {
    store.set(SEARCH_ENGINE_STORE_KEY, engine)
})

const SERVICE_CONFIGS_STORE_KEY = "serviceConfigs"
ipcMain.on("get-service-configs", event => {
    event.returnValue = store.get(SERVICE_CONFIGS_STORE_KEY, {
        type: SyncService.None,
    })
})
ipcMain.handle("set-service-configs", (_, configs: ServiceConfigs) => {
    store.set(SERVICE_CONFIGS_STORE_KEY, configs)
})

const FILTER_TYPE_STORE_KEY = "filterType"
ipcMain.on("get-filter-type", event => {
    event.returnValue = store.get(FILTER_TYPE_STORE_KEY, null)
})
ipcMain.handle("set-filter-type", (_, filterType: number) => {
    store.set(FILTER_TYPE_STORE_KEY, filterType)
})

const LIST_CONFIGS_STORE_KEY = "listViewConfigs"
ipcMain.on("get-view-configs", (event, view: ViewType) => {
    switch (view) {
        case ViewType.List:
            event.returnValue = store.get(
                LIST_CONFIGS_STORE_KEY,
                ViewConfigs.ShowCover
            )
            break
        default:
            event.returnValue = undefined
            break
    }
})
ipcMain.handle(
    "set-view-configs",
    (_, view: ViewType, configs: ViewConfigs) => {
        switch (view) {
            case ViewType.List:
                store.set(LIST_CONFIGS_STORE_KEY, configs)
                break
        }
    }
)

// AI 配置存储
const AI_CHAT_API_ENDPOINT_KEY = "aiChatApiEndpoint"
const AI_CHAT_API_KEY_KEY = "aiChatApiKey"
const AI_EMBEDDING_API_ENDPOINT_KEY = "aiEmbeddingApiEndpoint"
const AI_EMBEDDING_API_KEY_KEY = "aiEmbeddingApiKey"
const AI_MODEL_KEY = "aiModel"
const AI_EMBEDDING_MODEL_KEY = "aiEmbeddingModel"
const AI_EMBEDDING_QPS_KEY = "aiEmbeddingQPS"
const AI_TOPK_KEY = "aiTopk"
const AI_TRANSLATION_API_ENDPOINT_KEY = "aiTranslationApiEndpoint"
const AI_TRANSLATION_API_KEY_KEY = "aiTranslationApiKey"
const AI_TRANSLATION_MODEL_KEY = "aiTranslationModel"

ipcMain.on("get-ai-chat-api-endpoint", event => {
    event.returnValue = store.get(AI_CHAT_API_ENDPOINT_KEY, "")
})
ipcMain.handle("set-ai-chat-api-endpoint", (_, endpoint: string) => {
    store.set(AI_CHAT_API_ENDPOINT_KEY, endpoint)
    console.log('[Main] 保存 aiChatApiEndpoint 到 electron-store:', endpoint ? '已设置' : '空')
})

ipcMain.on("get-ai-chat-api-key", event => {
    event.returnValue = store.get(AI_CHAT_API_KEY_KEY, "")
})
ipcMain.handle("set-ai-chat-api-key", (_, key: string) => {
    store.set(AI_CHAT_API_KEY_KEY, key)
    console.log('[Main] 保存 aiChatApiKey 到 electron-store:', key ? '已设置' : '空')
})

ipcMain.on("get-ai-embedding-api-endpoint", event => {
    event.returnValue = store.get(AI_EMBEDDING_API_ENDPOINT_KEY, "")
})
ipcMain.handle("set-ai-embedding-api-endpoint", (_, endpoint: string) => {
    store.set(AI_EMBEDDING_API_ENDPOINT_KEY, endpoint)
})

ipcMain.on("get-ai-embedding-api-key", event => {
    event.returnValue = store.get(AI_EMBEDDING_API_KEY_KEY, "")
})
ipcMain.handle("set-ai-embedding-api-key", (_, key: string) => {
    store.set(AI_EMBEDDING_API_KEY_KEY, key)
})

ipcMain.on("get-ai-model", event => {
    event.returnValue = store.get(AI_MODEL_KEY, "")
})
ipcMain.handle("set-ai-model", (_, model: string) => {
    store.set(AI_MODEL_KEY, model)
})

ipcMain.on("get-ai-embedding-model", event => {
    event.returnValue = store.get(AI_EMBEDDING_MODEL_KEY, "")
})
ipcMain.handle("set-ai-embedding-model", (_, model: string) => {
    store.set(AI_EMBEDDING_MODEL_KEY, model)
})

ipcMain.on("get-ai-embedding-qps", event => {
    event.returnValue = store.get(AI_EMBEDDING_QPS_KEY, 30)
})
ipcMain.handle("set-ai-embedding-qps", (_, qps: number) => {
    store.set(AI_EMBEDDING_QPS_KEY, qps)
})

ipcMain.on("get-ai-topk", event => {
    event.returnValue = store.get(AI_TOPK_KEY, 100)
})
ipcMain.handle("set-ai-topk", (_, topk: number) => {
    store.set(AI_TOPK_KEY, topk)
})

ipcMain.on("get-ai-translation-api-endpoint", event => {
    event.returnValue = store.get(AI_TRANSLATION_API_ENDPOINT_KEY, "")
})
ipcMain.handle("set-ai-translation-api-endpoint", (_, endpoint: string) => {
    store.set(AI_TRANSLATION_API_ENDPOINT_KEY, endpoint)
})

ipcMain.on("get-ai-translation-api-key", event => {
    event.returnValue = store.get(AI_TRANSLATION_API_KEY_KEY, "")
})
ipcMain.handle("set-ai-translation-api-key", (_, key: string) => {
    store.set(AI_TRANSLATION_API_KEY_KEY, key)
})

ipcMain.on("get-ai-translation-model", event => {
    event.returnValue = store.get(AI_TRANSLATION_MODEL_KEY, "")
})
ipcMain.handle("set-ai-translation-model", (_, model: string) => {
    store.set(AI_TRANSLATION_MODEL_KEY, model)
})

// Token使用历史记录存储
const TOKEN_USAGE_HISTORY_KEY = "tokenUsageHistory"
ipcMain.on("get-token-usage-history", event => {
    event.returnValue = store.get(TOKEN_USAGE_HISTORY_KEY, [])
})
ipcMain.handle("set-token-usage-history", (_, history: any[]) => {
    store.set(TOKEN_USAGE_HISTORY_KEY, history)
})
