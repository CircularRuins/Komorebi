import * as React from "react"
import { connect } from "react-redux"
import { closeContextMenu } from "../scripts/models/app"
import PageContainer from "../containers/page-container"
import MenuContainer from "../containers/menu-container"
import NavContainer from "../containers/nav-container"
import SettingsContainer from "../containers/settings-container"
import { RootState } from "../scripts/reducer"
import { ContextMenu } from "./context-menu"
import ResizableLayout from "./resizable-layout"
// import LogMenu from "./log-menu"

const Root = ({ locale, dispatch }) =>
    locale && (
        <div
            id="root"
            key={locale}
            onMouseDown={(e) => {
                // 检查点击是否在菜单内部
                const target = e.target as Element
                const isMenuClick = target.closest('.ms-ContextualMenu')
                
                // 只有在点击菜单外部时才关闭菜单
                if (!isMenuClick) {
                    dispatch(closeContextMenu())
                }
            }}>
            <NavContainer />
            <ResizableLayout
                defaultLeftWidth={240}
                minLeftWidth={200}
                maxLeftWidth={0.5}
                leftPanel={<MenuContainer />}
                mainContent={<PageContainer />}
            />
            {/* <LogMenu /> */}
            <SettingsContainer />
            <ContextMenu />
        </div>
    )

const getLocale = (state: RootState) => ({ locale: state.app.locale })
export default connect(getLocale)(Root)
