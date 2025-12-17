import { ipcMain, shell, dialog, app, session, clipboard } from "electron"
import { WindowManager } from "./window"
import fs = require("fs")
import path = require("path")
import { spawn } from "child_process"
import { ImageCallbackTypes, TouchBarTexts } from "../schema-types"
import { initMainTouchBar } from "./touchbar"
import fontList = require("font-list")
import { mergeSegmentsIntoSentences, TranscriptSegment } from "./youtube-transcript"
import OpenAI from "openai"
import { store } from "./settings"
import { translateTexts, TranslationConfig } from "../scripts/translation-utils"
import { generateTranscriptSummary, generateJuiciestQuotes, generateChatResponse, ChatApiConfig } from "../scripts/chat-api-utils"

// 语言名称映射（用于生成摘要）
const localeToLanguageName: { [key: string]: string } = {
    "en-US": "English",
    "en": "English",
    "zh-CN": "简体中文",
    "zh": "简体中文", // 默认中文使用简体
    "ja": "日本語",
    "es": "Español",
}

/**
 * 获取目标语言名称
 */
function getTargetLanguageName(locale: string): string {
    // 先尝试完整locale
    if (localeToLanguageName[locale]) {
        return localeToLanguageName[locale]
    }
    // 尝试只使用语言代码
    const langCode = locale.split("-")[0]
    if (localeToLanguageName[langCode]) {
        return localeToLanguageName[langCode]
    }
    // 默认返回English
    return "English"
}

export function setUtilsListeners(manager: WindowManager) {
    async function openExternal(url: string, background = false) {
        if (url.startsWith("https://") || url.startsWith("http://")) {
            if (background && process.platform === "darwin") {
                shell.openExternal(url, { activate: false })
            } else if (background && manager.hasWindow()) {
                manager.mainWindow.setAlwaysOnTop(true)
                await shell.openExternal(url)
                setTimeout(() => manager.mainWindow.setAlwaysOnTop(false), 1000)
            } else {
                shell.openExternal(url)
            }
        }
    }

    app.on("web-contents-created", (_, contents) => {
        contents.setWindowOpenHandler(details => {
            if (contents.getType() === "webview")
                openExternal(
                    details.url,
                    details.disposition === "background-tab"
                )
            return {
                action: manager.hasWindow() ? "deny" : "allow",
            }
        })
        contents.on("will-navigate", (event, url) => {
            event.preventDefault()
            if (contents.getType() === "webview") openExternal(url)
        })
    })

    ipcMain.on("get-version", event => {
        event.returnValue = app.getVersion()
    })

    ipcMain.handle("open-external", (_, url: string, background: boolean) => {
        openExternal(url, background)
    })

    ipcMain.handle(
        "show-error-box",
        async (_, title, content, copy?: string) => {
            if (manager.hasWindow() && copy != null) {
                const response = await dialog.showMessageBox(
                    manager.mainWindow,
                    {
                        type: "error",
                        title: title,
                        message: title,
                        detail: content,
                        buttons: ["OK", copy],
                        cancelId: 0,
                        defaultId: 0,
                    }
                )
                if (response.response === 1) {
                    clipboard.writeText(`${title}: ${content}`)
                }
            } else {
                dialog.showErrorBox(title, content)
            }
        }
    )

    ipcMain.handle(
        "show-message-box",
        async (_, title, message, confirm, cancel, defaultCancel, type) => {
            if (manager.hasWindow()) {
                // 如果cancel为空字符串，只显示一个按钮
                const buttons = cancel === "" 
                    ? [confirm]
                    : (process.platform === "win32"
                        ? ["Yes", "No"]
                        : [confirm, cancel])
                
                let response = await dialog.showMessageBox(manager.mainWindow, {
                    type: type,
                    title: title,
                    message: title,
                    detail: message,
                    buttons: buttons,
                    cancelId: cancel === "" ? 0 : 1,
                    defaultId: defaultCancel ? (cancel === "" ? 0 : 1) : 0,
                })
                return response.response === 0
            } else {
                return false
            }
        }
    )

    ipcMain.handle(
        "show-save-dialog",
        async (_, filters: Electron.FileFilter[], path: string) => {
            ipcMain.removeAllListeners("write-save-result")
            if (manager.hasWindow()) {
                let response = await dialog.showSaveDialog(manager.mainWindow, {
                    defaultPath: path,
                    filters: filters,
                })
                if (!response.canceled) {
                    ipcMain.handleOnce(
                        "write-save-result",
                        (_, result, errmsg) => {
                            fs.writeFile(response.filePath, result, err => {
                                if (err)
                                    dialog.showErrorBox(errmsg, String(err))
                            })
                        }
                    )
                    return true
                }
            }
            return false
        }
    )

    ipcMain.handle(
        "show-open-dialog",
        async (_, filters: Electron.FileFilter[]) => {
            if (manager.hasWindow()) {
                let response = await dialog.showOpenDialog(manager.mainWindow, {
                    filters: filters,
                    properties: ["openFile"],
                })
                if (!response.canceled) {
                    try {
                        return await fs.promises.readFile(
                            response.filePaths[0],
                            "utf-8"
                        )
                    } catch (err) {
                        console.log(err)
                    }
                }
            }
            return null
        }
    )

    ipcMain.handle("get-cache", async () => {
        return await session.defaultSession.getCacheSize()
    })

    ipcMain.handle("clear-cache", async () => {
        await session.defaultSession.clearCache()
    })

    app.on("web-contents-created", (_, contents) => {
        if (contents.getType() === "webview") {
            // Set up request interceptor to add Referer header for YouTube requests
            try {
                const ses = contents.session
                if (!ses) return
                
                ses.webRequest.onBeforeSendHeaders(
                    {
                        urls: ["https://www.youtube.com/*", "https://*.youtube.com/*"],
                    },
                    (details, callback) => {
                        // Check if contents is still valid before accessing
                        if (contents.isDestroyed()) {
                            callback({ requestHeaders: details.requestHeaders })
                            return
                        }
                        
                        // Try to get the article URL from the webview's URL
                        let webviewUrl = ""
                        try {
                            webviewUrl = contents.getURL()
                        } catch (e) {
                            // Contents may have been destroyed
                            callback({ requestHeaders: details.requestHeaders })
                            return
                        }
                        
                        let referer = ""
                        
                        // Extract article URL from webview URL if it's article.html
                        if (webviewUrl && webviewUrl.includes("article.html")) {
                            try {
                                // Handle both file:// and http:// URLs
                                if (webviewUrl.startsWith("file://")) {
                                    // For file:// URLs, manually parse the query string
                                    const queryMatch = webviewUrl.match(/[?&]u=([^&]*)/)
                                    if (queryMatch && queryMatch[1]) {
                                        referer = decodeURIComponent(queryMatch[1])
                                    }
                                } else {
                                    const url = new URL(webviewUrl)
                                    const articleUrl = url.searchParams.get("u")
                                    if (articleUrl) {
                                        referer = articleUrl
                                    }
                                }
                                
                                // Validate that referer is a valid HTTP/HTTPS URL
                                if (referer && !referer.startsWith("http://") && !referer.startsWith("https://")) {
                                    referer = ""
                                }
                            } catch (e) {
                                // Ignore parsing errors
                                referer = ""
                            }
                        }
                        
                        // Add Referer header - use a fixed domain like TLDW uses its own domain
                        // YouTube doesn't accept its own domain as referer, so use a fixed allowed domain
                        details.requestHeaders["Referer"] = "https://komorebi.app"
                        
                        callback({ requestHeaders: details.requestHeaders })
                    }
                )
            } catch (e) {
                // Ignore errors if session or contents is destroyed
                console.error("Error setting up YouTube referer interceptor:", e)
            }
            
            contents.on(
                "did-fail-load",
                (event, code, desc, validated, isMainFrame) => {
                    if (isMainFrame && manager.hasWindow()) {
                        manager.mainWindow.webContents.send(
                            "webview-error",
                            desc
                        )
                    }
                }
            )
            contents.on("context-menu", (_, params) => {
                if (
                    (params.hasImageContents ||
                        params.selectionText ||
                        params.linkURL) &&
                    manager.hasWindow()
                ) {
                    if (params.hasImageContents) {
                        ipcMain.removeHandler("image-callback")
                        ipcMain.handleOnce(
                            "image-callback",
                            (_, type: ImageCallbackTypes) => {
                                switch (type) {
                                    case ImageCallbackTypes.OpenExternal:
                                    case ImageCallbackTypes.OpenExternalBg:
                                        openExternal(
                                            params.srcURL,
                                            type ===
                                                ImageCallbackTypes.OpenExternalBg
                                        )
                                        break
                                    case ImageCallbackTypes.SaveAs:
                                        contents.session.downloadURL(
                                            params.srcURL
                                        )
                                        break
                                    case ImageCallbackTypes.Copy:
                                        contents.copyImageAt(params.x, params.y)
                                        break
                                    case ImageCallbackTypes.CopyLink:
                                        clipboard.writeText(params.srcURL)
                                        break
                                }
                            }
                        )
                        manager.mainWindow.webContents.send(
                            "webview-context-menu",
                            [params.x, params.y]
                        )
                    } else {
                        manager.mainWindow.webContents.send(
                            "webview-context-menu",
                            [params.x, params.y],
                            params.selectionText,
                            params.linkURL
                        )
                    }
                    contents
                        .executeJavaScript(
                            `new Promise(resolve => {
                        const dismiss = () => {
                            document.removeEventListener("mousedown", dismiss)
                            document.removeEventListener("scroll", dismiss)                            
                            resolve()
                        }
                        document.addEventListener("mousedown", dismiss)
                        document.addEventListener("scroll", dismiss)
                    })`
                        )
                        .then(() => {
                            if (manager.hasWindow()) {
                                manager.mainWindow.webContents.send(
                                    "webview-context-menu"
                                )
                            }
                        })
                }
            })
            contents.on("before-input-event", (_, input) => {
                if (manager.hasWindow()) {
                    let contents = manager.mainWindow.webContents
                    contents.send("webview-keydown", input)
                }
            })
        }
    })

    ipcMain.handle("write-clipboard", (_, text) => {
        clipboard.writeText(text)
    })

    ipcMain.handle("close-window", () => {
        if (manager.hasWindow()) manager.mainWindow.close()
    })

    ipcMain.handle("minimize-window", () => {
        if (manager.hasWindow()) manager.mainWindow.minimize()
    })

    ipcMain.handle("maximize-window", () => {
        manager.zoom()
    })

    ipcMain.on("is-maximized", event => {
        event.returnValue =
            Boolean(manager.mainWindow) && manager.mainWindow.isMaximized()
    })

    ipcMain.on("is-focused", event => {
        event.returnValue =
            manager.hasWindow() && manager.mainWindow.isFocused()
    })

    ipcMain.on("is-fullscreen", event => {
        event.returnValue =
            manager.hasWindow() && manager.mainWindow.isFullScreen()
    })

    ipcMain.handle("request-focus", () => {
        if (manager.hasWindow()) {
            const win = manager.mainWindow
            if (win.isMinimized()) win.restore()
            if (process.platform === "win32") {
                win.setAlwaysOnTop(true)
                win.setAlwaysOnTop(false)
            }
            win.focus()
        }
    })

    ipcMain.handle("request-attention", () => {
        if (manager.hasWindow() && !manager.mainWindow.isFocused()) {
            if (process.platform === "win32") {
                manager.mainWindow.flashFrame(true)
                manager.mainWindow.once("focus", () => {
                    manager.mainWindow.flashFrame(false)
                })
            } else if (process.platform === "darwin") {
                app.dock.bounce()
            }
        }
    })

    ipcMain.handle("touchbar-init", (_, texts: TouchBarTexts) => {
        if (manager.hasWindow()) initMainTouchBar(texts, manager.mainWindow)
    })
    ipcMain.handle("touchbar-destroy", () => {
        if (manager.hasWindow()) manager.mainWindow.setTouchBar(null)
    })

    ipcMain.handle("init-font-list", () => {
        return fontList.getFonts({
            disableQuoting: true,
        })
    })

    ipcMain.handle("get-youtube-transcript", async (_, videoId: string, languages?: string[]) => {
        try {
            // Determine the path to the Python executable
            const isPackaged = app.isPackaged
            let pythonExecPath: string

            if (isPackaged) {
                // In packaged app, Python executable is in resources
                // On macOS, process.resourcesPath points to app.asar, but extraResources are outside
                // We need to get the actual Resources directory path
                let resourcesPath: string
                const platform = process.platform
                const arch = process.arch
                
                if (platform === "darwin") {
                    // macOS: Resources are at app.asar/../Resources
                    // process.resourcesPath is usually the app.asar path
                    const appPath = app.getAppPath()
                    if (appPath.includes(".asar")) {
                        // If app is in asar, go up to Resources directory
                        resourcesPath = path.resolve(appPath, "..", "..", "Resources")
                    } else {
                        // Fallback: try process.resourcesPath or construct from app path
                        resourcesPath = process.resourcesPath || path.resolve(appPath, "..", "Resources")
                    }
                } else {
                    // Windows/Linux: resources are in process.resourcesPath
                    resourcesPath = process.resourcesPath || app.getAppPath()
                }

                if (platform === "win32") {
                    pythonExecPath = path.join(
                        resourcesPath,
                        "python-scripts",
                        "get_youtube_transcript.exe"
                    )
                } else if (platform === "darwin") {
                    // macOS - check architecture
                    if (arch === "arm64") {
                        pythonExecPath = path.join(
                            resourcesPath,
                            "python-scripts",
                            "get_youtube_transcript_macos_arm64"
                        )
                    } else {
                        pythonExecPath = path.join(
                            resourcesPath,
                            "python-scripts",
                            "get_youtube_transcript_macos_x64"
                        )
                    }
                } else {
                    // Linux
                    pythonExecPath = path.join(
                        resourcesPath,
                        "python-scripts",
                        "get_youtube_transcript_linux"
                    )
                }
                
            } else {
                // In development, use the dist directory
                // __dirname is dist/ in development (webpack output), so go up one level to project root
                const projectRoot = path.resolve(__dirname, "..")
                const pythonDistPath = path.join(projectRoot, "python-scripts", "dist")
                const platform = process.platform
                const arch = process.arch


                if (platform === "win32") {
                    pythonExecPath = path.join(pythonDistPath, "get_youtube_transcript.exe")
                } else if (platform === "darwin") {
                    if (arch === "arm64") {
                        pythonExecPath = path.join(pythonDistPath, "get_youtube_transcript_macos_arm64")
                    } else {
                        pythonExecPath = path.join(pythonDistPath, "get_youtube_transcript_macos_x64")
                    }
                } else {
                    pythonExecPath = path.join(pythonDistPath, "get_youtube_transcript_linux")
                }
            }

            // Check if executable exists
            if (!fs.existsSync(pythonExecPath)) {
                const errorMsg = isPackaged
                    ? `Python executable not found at ${pythonExecPath}. Please ensure the application was packaged correctly.`
                    : `Python executable not found at ${pythonExecPath}. Please run 'npm run build-python' first to build the Python executable.`
                console.error(errorMsg)
                
                // In packaged app, also check alternative locations
                if (isPackaged) {
                    const altPath = path.join(app.getAppPath(), "python-scripts", path.basename(pythonExecPath))
                    if (fs.existsSync(altPath)) {
                        pythonExecPath = altPath
                    } else {
                        throw new Error(errorMsg)
                    }
                } else {
                    throw new Error(errorMsg)
                }
            }
            
            // Check file permissions (important for macOS/Linux)
            try {
                const stat = fs.statSync(pythonExecPath)
                const isExecutable = (stat.mode & 0o111) !== 0
                
                if (!isExecutable && (process.platform === "darwin" || process.platform === "linux")) {
                    try {
                        fs.chmodSync(pythonExecPath, 0o755)
                    } catch (chmodError) {
                        throw new Error(`Python executable at ${pythonExecPath} does not have execute permissions and could not be fixed: ${chmodError.message}`)
                    }
                }
            } catch (statError) {
                // Ignore permission check errors, try to execute anyway
            }

            // Ensure we use absolute path
            pythonExecPath = path.resolve(pythonExecPath)

            // Prepare arguments
            const args = [videoId]
            if (languages && languages.length > 0) {
                args.push("--languages", ...languages)
            }

            // Execute Python script
            return new Promise((resolve, reject) => {
                const pythonProcess = spawn(pythonExecPath, args, {
                    timeout: 30000, // 30 second timeout
                    // On macOS, ensure we're in the right directory
                    cwd: path.dirname(pythonExecPath),
                })

                let stdout = ""
                let stderr = ""

                pythonProcess.stdout.on("data", (data) => {
                    stdout += data.toString()
                })

                pythonProcess.stderr.on("data", (data) => {
                    stderr += data.toString()
                })

                pythonProcess.on("close", (code) => {
                    if (code === 0) {
                        try {
                            const result = JSON.parse(stdout)
                            
                            // Check if result is an array of transcript segments
                            if (Array.isArray(result) && result.length > 0) {
                                // Merge segments into complete sentences
                                const mergedSegments = mergeSegmentsIntoSentences(result as TranscriptSegment[])
                                resolve(mergedSegments)
                            } else {
                                // If result is not an array or is empty, return as-is (might be an error object)
                                resolve(result)
                            }
                        } catch (e) {
                            reject(new Error(`Failed to parse transcript: ${e}`))
                        }
                    } else {
                        reject(
                            new Error(
                                `Python script failed with code ${code}: ${stderr || stdout}`
                            )
                        )
                    }
                })

                pythonProcess.on("error", (error) => {
                    reject(
                        new Error(`Failed to spawn Python process: ${error.message}`)
                    )
                })
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error("Error getting YouTube transcript:", errorMessage)
            console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
            
            // Return error object instead of throwing, so renderer can handle it
            return { error: errorMessage }
        }
    })

    ipcMain.on("get-preload-path", event => {
        const isPackaged = app.isPackaged
        let appPath = app.getAppPath()
        // In development, if appPath ends with 'dist', we're already in dist, otherwise we need to add dist
        // In packaged app, appPath is the app.asar path, and preload.js is in app.asar/dist/preload.js
        let preloadPath: string
        if (isPackaged) {
            // In packaged app, appPath is like "/path/to/app.asar", preload.js is in "app.asar/dist/preload.js"
            // Check if appPath contains "app.asar"
            if (appPath.includes("app.asar")) {
                preloadPath = path.join(appPath, "dist", "preload.js")
            } else {
                // Fallback: try without dist
                preloadPath = path.join(appPath, "preload.js")
            }
        } else {
            // Check if appPath already ends with dist
            if (appPath.endsWith("dist")) {
                preloadPath = path.join(appPath, "preload.js")
            } else {
                preloadPath = path.join(appPath, "dist", "preload.js")
            }
        }
        // Verify the path exists
        if (!fs.existsSync(preloadPath)) {
            // Try alternative paths
            const alternatives = [
                path.join(appPath, "dist", "preload.js"),
                path.join(appPath, "preload.js"),
                path.resolve(appPath, "..", "dist", "preload.js"),
            ]
            for (const altPath of alternatives) {
                if (fs.existsSync(altPath)) {
                    preloadPath = altPath
                    break
                }
            }
        }
        
        event.returnValue = preloadPath
    })

    // Language code to language name mapping
    const languageCodeToName: { [key: string]: string } = {
        "en": "English",
        "en-US": "English",
        "zh-CN": "简体中文",
        "ja": "日本語",
        "es": "Español",
    }

    function getTargetLanguageName(languageCode: string): string {
        if (languageCodeToName[languageCode]) {
            return languageCodeToName[languageCode]
        }
        // Try with just the base language code
        const baseCode = languageCode.split("-")[0]
        if (languageCodeToName[baseCode]) {
            return languageCodeToName[baseCode]
        }
        return "English"
    }

    ipcMain.handle("translate-transcript", async (_, texts: string[], targetLanguageCode: string) => {
        try {
            // Get Chat API config from store (统一使用Chat API配置)
            const apiEndpoint = store.get("aiChatApiEndpoint", "") as string
            const apiKey = store.get("aiChatApiKey", "") as string
            const model = store.get("aiModel", "") as string

            if (!apiEndpoint || !apiKey || !model) {
                throw new Error("AI模型未配置，请先配置AI模型")
            }

            if (!texts || texts.length === 0) {
                throw new Error("字幕文本为空，无法翻译")
            }

            const targetLanguage = getTargetLanguageName(targetLanguageCode)

            // 使用共享的翻译函数
            const config: TranslationConfig = {
                apiEndpoint,
                apiKey,
                model
            }

            // 在主进程中调用 translateTexts，提供记录函数来通过 IPC 记录 API 调用
            const onApiCall = (model: string, apiType: string, callContext: string, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }) => {
                if (manager.hasWindow()) {
                    manager.mainWindow.webContents.send("record-api-call-request", model, apiType, callContext, usage)
                }
            }
            const result = await translateTexts(texts, targetLanguage, config, 3000, onApiCall)
            
            return result
        } catch (error: any) {
            if (error instanceof OpenAI.APIError) {
                let errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查Chat API Endpoint是否正确`
                } else if (error.status === 401) {
                    errorMessage = `401错误: API密钥无效\n${error.message}\n\n请检查Chat API Key是否正确`
                } else if (error.status === 429) {
                    errorMessage = `429错误: 请求频率过高\n${error.message}\n\n请稍后再试`
                }
                throw new Error(errorMessage)
            } else if (error instanceof Error) {
                throw error
            } else {
                throw new Error(`翻译失败: ${String(error)}`)
            }
        }
    })

    // Handle request to generate transcript summary
    ipcMain.handle("generate-transcript-summary", async (_, segments: Array<{text: string, start: number, duration: number}>, snippet?: string) => {
        try {
            // Get Chat API config from store
            const apiEndpoint = store.get("aiChatApiEndpoint", "") as string
            const apiKey = store.get("aiChatApiKey", "") as string
            const model = store.get("aiModel", "") as string

            if (!apiEndpoint || !apiKey || !model) {
                throw new Error("Chat API配置不完整，请先设置Chat API配置")
            }

            if (!segments || !Array.isArray(segments) || segments.length === 0) {
                throw new Error("转录片段为空，无法生成摘要")
            }

            // Get current locale and convert to language name
            const localeSetting = store.get("locale", "default") as string
            // Handle "default" locale (use system locale)
            const actualLocale = localeSetting === "default" ? app.getLocale() : localeSetting
            const targetLanguage = getTargetLanguageName(actualLocale)
            
            // Debug: log locale and target language
            console.log(`[Summary] Locale Setting: ${localeSetting}, Actual Locale: ${actualLocale}, Target Language: ${targetLanguage}`)

            const config: ChatApiConfig = {
                apiEndpoint,
                apiKey,
                model
            }

            // 提供记录函数来通过 IPC 记录 API 调用
            const onApiCall = (model: string, apiType: string, callContext: string, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }) => {
                if (manager.hasWindow()) {
                    manager.mainWindow.webContents.send("record-api-call-request", model, apiType, callContext, usage)
                }
            }

            return await generateTranscriptSummary(segments, config, targetLanguage, snippet, onApiCall)
        } catch (error: any) {
            if (error instanceof OpenAI.APIError) {
                let errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查Chat API Endpoint是否正确`
                } else if (error.status === 401) {
                    errorMessage = `401错误: API密钥无效\n${error.message}\n\n请检查Chat API Key是否正确`
                } else if (error.status === 429) {
                    errorMessage = `429错误: 请求频率过高\n${error.message}\n\n请稍后再试`
                }
                throw new Error(errorMessage)
            } else if (error instanceof Error) {
                throw error
            } else {
                throw new Error(`生成摘要失败: ${String(error)}`)
            }
        }
    })

    // Handle request to generate juiciest quotes
    ipcMain.handle("generate-juiciest-quotes", async (_, segments: Array<{text: string, start: number, duration: number}>, snippet?: string) => {
        try {
            // Get Chat API config from store
            const apiEndpoint = store.get("aiChatApiEndpoint", "") as string
            const apiKey = store.get("aiChatApiKey", "") as string
            const model = store.get("aiModel", "") as string

            if (!apiEndpoint || !apiKey || !model) {
                throw new Error("Chat API配置不完整，请先设置Chat API配置")
            }

            if (!segments || !Array.isArray(segments) || segments.length === 0) {
                throw new Error("转录片段为空，无法生成引用")
            }

            // Get current locale and convert to language name
            const locale = store.get("locale", "en-US") as string
            // Handle "default" locale (fallback to en-US)
            const actualLocale = locale === "default" ? "en-US" : locale
            const targetLanguage = getTargetLanguageName(actualLocale)
            
            // Debug: log locale and target language
            console.log(`[Quotes] Locale: ${locale}, Actual Locale: ${actualLocale}, Target Language: ${targetLanguage}`)

            const config: ChatApiConfig = {
                apiEndpoint,
                apiKey,
                model
            }

            // 提供记录函数来通过 IPC 记录 API 调用
            const onApiCall = (model: string, apiType: string, callContext: string, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }) => {
                if (manager.hasWindow()) {
                    manager.mainWindow.webContents.send("record-api-call-request", model, apiType, callContext, usage)
                }
            }

            return await generateJuiciestQuotes(segments, config, targetLanguage, snippet, onApiCall)
        } catch (error: any) {
            if (error instanceof OpenAI.APIError) {
                let errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查Chat API Endpoint是否正确`
                } else if (error.status === 401) {
                    errorMessage = `401错误: API密钥无效\n${error.message}\n\n请检查Chat API Key是否正确`
                } else if (error.status === 429) {
                    errorMessage = `429错误: 请求频率过高\n${error.message}\n\n请稍后再试`
                }
                throw new Error(errorMessage)
            } else if (error instanceof Error) {
                throw error
            } else {
                throw new Error(`生成引用失败: ${String(error)}`)
            }
        }
    })

    // Handle request to chat with transcript
    ipcMain.handle("chat-with-transcript", async (_, message: string, segments: Array<{text: string, start: number, duration: number}>, chatHistory?: Array<{role: 'user' | 'assistant', content: string}>) => {
        try {
            // Get Chat API config from store
            const apiEndpoint = store.get("aiChatApiEndpoint", "") as string
            const apiKey = store.get("aiChatApiKey", "") as string
            const model = store.get("aiModel", "") as string

            if (!apiEndpoint || !apiKey || !model) {
                throw new Error("Chat API配置不完整，请先设置Chat API配置")
            }

            if (!segments || !Array.isArray(segments) || segments.length === 0) {
                throw new Error("字幕片段为空，无法回答问题")
            }

            if (!message || !message.trim()) {
                throw new Error("用户问题为空")
            }

            // Get current locale and convert to language name
            const localeSetting = store.get("locale", "default") as string
            // Handle "default" locale (use system locale)
            const actualLocale = localeSetting === "default" ? app.getLocale() : localeSetting
            const targetLanguage = getTargetLanguageName(actualLocale)

            const config: ChatApiConfig = {
                apiEndpoint,
                apiKey,
                model
            }

            // 提供记录函数来通过 IPC 记录 API 调用
            const onApiCall = (model: string, apiType: string, callContext: string, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }) => {
                if (manager.hasWindow()) {
                    manager.mainWindow.webContents.send("record-api-call-request", model, apiType, callContext, usage)
                }
            }

            return await generateChatResponse(message, segments, config, chatHistory, targetLanguage, onApiCall)
        } catch (error: any) {
            if (error instanceof OpenAI.APIError) {
                let errorMessage = error.message
                if (error.status === 404) {
                    errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查Chat API Endpoint是否正确`
                } else if (error.status === 401) {
                    errorMessage = `401错误: API密钥无效\n${error.message}\n\n请检查Chat API Key是否正确`
                } else if (error.status === 429) {
                    errorMessage = `429错误: 请求频率过高\n${error.message}\n\n请稍后再试`
                }
                throw new Error(errorMessage)
            } else if (error instanceof Error) {
                throw error
            } else {
                throw new Error(`Chat请求失败: ${String(error)}`)
            }
        }
    })

    // Handle request to open AI config page from webview
    ipcMain.handle("open-ai-config", () => {
        if (manager.hasWindow()) {
            // Send message to main window to open AI config
            manager.mainWindow.webContents.send("open-ai-config-request")
        }
    })

    // Handle request to record API call from main process
    // This forwards the request to the renderer process where the database is available
    ipcMain.handle("record-api-call", async (_, model: string, apiType: string, callContext: string, usage: { prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }) => {
        if (manager.hasWindow()) {
            // Send message to renderer process to record the API call
            manager.mainWindow.webContents.send("record-api-call-request", model, apiType, callContext, usage)
        }
    })
}
