import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "react-redux"
import { initializeIcons } from "@fluentui/react/lib/Icons"
import { registerIcons } from "@fluentui/react"
import Root from "./components/root"
import { applyThemeSettings } from "./scripts/settings"
import { initApp, openTextMenu } from "./scripts/models/app"
import { rootStore } from "./scripts/reducer"

window.settings.setProxy()

applyThemeSettings()
// 初始化图标，使用 icons/ 路径
// 注意：如果某些字体文件缺失（如 fabric-icons-3），Fluent UI 会尝试从 CDN 加载或使用已存在的字体文件
// 这通常不会影响功能，只是会在控制台显示警告
try {
    initializeIcons("icons/")
} catch (error) {
    // 如果初始化失败，尝试使用默认路径
    console.warn('使用 icons/ 路径初始化图标失败，尝试默认路径:', error)
    try {
        initializeIcons()
    } catch (e) {
        console.error('初始化图标失败:', e)
    }
}

// 注册自定义 AI 图标
registerIcons({
    icons: {
        'AIMode': (
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style={{ width: '1em', height: '1em', fill: 'currentColor' }}>
                <path d="M780.1 256l32.2-55.7c10.9-18.8 4.4-42.9-14.4-53.8-18.9-10.9-42.9-4.4-53.8 14.4l-39.4 68.2c-4.3 7.5-5.2 15.7-4.4 23.7H323.7c0.8-8 0-16.2-4.4-23.7L280 160.8c-10.9-18.8-35-25.3-53.8-14.4-18.8 10.9-25.3 35-14.4 53.8l32.2 55.7c-71.8 14.7-125.7 78.2-125.7 154.3v315.1c0 87 70.5 157.5 157.5 157.5h472.6c87 0 157.5-70.5 157.5-157.5v-315c-0.1-76.1-54-139.6-125.8-154.3z m47 469.3c0 43.4-35.3 78.8-78.8 78.8H275.7c-43.4 0-78.8-35.3-78.8-78.8v-315c0-43.4 35.3-78.8 78.8-78.8h472.6c43.4 0 78.8 35.3 78.8 78.8v315zM39.4 449.6C17.6 449.6 0 467.3 0 489v157.5c0 21.8 17.6 39.4 39.4 39.4s39.4-17.6 39.4-39.4V489c0-21.7-17.7-39.4-39.4-39.4zM984.6 449.6c-21.8 0-39.4 17.6-39.4 39.4v157.5c0 21.8 17.6 39.4 39.4 39.4s39.4-17.6 39.4-39.4V489c0-21.7-17.6-39.4-39.4-39.4z" fill="currentColor"/>
                <path d="M382.4 552.4m-59.1 0a59.1 59.1 0 1 0 118.2 0 59.1 59.1 0 1 0-118.2 0Z" fill="currentColor"/>
                <path d="M641.6 555.9m-59.1 0a59.1 59.1 0 1 0 118.2 0 59.1 59.1 0 1 0-118.2 0Z" fill="currentColor"/>
            </svg>
        ),
    },
})

rootStore.dispatch(initApp())

window.utils.addMainContextListener((pos, text) => {
    rootStore.dispatch(openTextMenu(pos, text))
})

// Listen for API call recording requests from main process
// This is sent via postMessage from preload script
window.addEventListener("message", async (event) => {
    if (event.data && event.data.type === "record-api-call-request") {
        try {
            const { recordApiCall } = await import("./scripts/api-call-recorder")
            await recordApiCall(
                event.data.model,
                event.data.apiType,
                event.data.callContext,
                event.data.usage
            )
        } catch (error) {
            console.error('记录API调用失败:', error)
        }
    }
})

window.fontList = [""]
window.utils.initFontList().then(fonts => {
    window.fontList.push(...fonts)
})

ReactDOM.render(
    <Provider store={rootStore}>
        <Root />
    </Provider>,
    document.getElementById("app")
)
