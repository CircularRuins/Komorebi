import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "react-redux"
import { initializeIcons } from "@fluentui/react/lib/Icons"
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

rootStore.dispatch(initApp())

window.utils.addMainContextListener((pos, text) => {
    rootStore.dispatch(openTextMenu(pos, text))
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
