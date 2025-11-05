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
import AIMode from "./ai-mode"
import { AIModeContext, AIModeComponent } from "./ai-mode"
// import LogMenu from "./log-menu"

class RootWithProvider extends React.Component<{ locale: string; dispatch: any }, { contextValue: any }> {
    private aiModeRef = React.createRef<AIModeComponent>()
    private lastContextValue: any = null
    state = { contextValue: null }

    updateContextValue = () => {
        if (this.aiModeRef.current) {
            const newValue = (this.aiModeRef.current as any).getContextValue()
            // 总是更新 Context，确保状态同步
            this.lastContextValue = newValue
            this.setState({ contextValue: newValue })
        }
    }

    shouldUpdateContext = (newValue: any): boolean => {
        if (!this.lastContextValue) return true
        
        // 比较关键字段
        const significantChanged = (
            this.lastContextValue.timeRange !== newValue.timeRange ||
            this.lastContextValue.topics.length !== newValue.topics.length ||
            this.lastContextValue.summary !== newValue.summary ||
            this.lastContextValue.isLoading !== newValue.isLoading ||
            this.lastContextValue.showConfigPanel !== newValue.showConfigPanel ||
            this.lastContextValue.apiEndpoint !== newValue.apiEndpoint ||
            this.lastContextValue.apiKey !== newValue.apiKey ||
            this.lastContextValue.model !== newValue.model ||
            this.lastContextValue.articleCount !== newValue.articleCount ||
            this.lastContextValue.error !== newValue.error ||
            this.lastContextValue.topicInput !== newValue.topicInput ||
            this.lastContextValue.isComposing !== newValue.isComposing
        )
        
        return significantChanged
    }

    componentDidMount() {
        // 监听AIMode挂载和更新事件
        window.addEventListener('aiModeMounted', this.updateContextValue)
        window.addEventListener('aiModeUpdated', this.updateContextValue)
        // 监听输入变化事件（用于更新按钮状态，但不打断输入法）
        window.addEventListener('aiModeInputChanged', this.updateContextValue)
        // 延迟获取Context值，确保AIMode已挂载
        setTimeout(this.updateContextValue, 0)
    }

    componentWillUnmount() {
        window.removeEventListener('aiModeMounted', this.updateContextValue)
        window.removeEventListener('aiModeUpdated', this.updateContextValue)
        window.removeEventListener('aiModeInputChanged', this.updateContextValue)
    }

    render() {
        const { locale, dispatch } = this.props
        
        if (!locale) return null

        return (
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
                {/* 始终渲染AIMode以提供Context，但隐藏它 */}
                <div style={{ display: 'none' }}>
                    <AIMode ref={this.aiModeRef} />
                </div>
                <AIModeContext.Provider value={this.state.contextValue}>
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
                </AIModeContext.Provider>
            </div>
        )
    }
}

const Root = ({ locale, dispatch }) =>
    locale && (
        <RootWithProvider locale={locale} dispatch={dispatch} />
    )

const getLocale = (state: RootState) => ({ locale: state.app.locale })
export default connect(getLocale)(Root)
