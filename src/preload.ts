import { contextBridge, ipcRenderer } from "electron"
import settingsBridge from "./bridges/settings"
import utilsBridge from "./bridges/utils"

contextBridge.exposeInMainWorld("settings", settingsBridge)
contextBridge.exposeInMainWorld("utils", utilsBridge)

// Listen for API call recording requests from main process and forward to renderer
ipcRenderer.on("record-api-call-request", async (_: any, model: string, apiType: string, callContext: string, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }) => {
    // Send message to renderer process to record the API call
    // The renderer process will handle this through a custom event
    window.postMessage({
        type: "record-api-call-request",
        model,
        apiType,
        callContext,
        usage
    }, "*")
})
