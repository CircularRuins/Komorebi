import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react/lib/Icon"
import { AppState } from "../scripts/models/app"
import { ProgressIndicator, IObjectWithKey, TooltipHost, TooltipDelay } from "@fluentui/react"
import { getWindowBreakpoint } from "../scripts/utils"
import { WindowStateListenerType } from "../schema-types"
import {
    ContextualMenu,
    IContextualMenuItem,
    DirectionalHint,
} from "office-ui-fabric-react/lib/ContextualMenu"
// import Switch from "./switch"

// 内联Switch组件
type SwitchProps = {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    size?: "small" | "medium" | "large"
    className?: string
}

class Switch extends React.Component<SwitchProps> {
    handleClick = () => {
        if (!this.props.disabled) {
            this.props.onChange(!this.props.checked)
        }
    }

    render() {
        const { checked, disabled, size = "medium", className = "" } = this.props
        
        const sizeClasses = {
            small: "switch-small",
            medium: "switch-medium", 
            large: "switch-large"
        }

        return (
            <div 
                className={`switch ${sizeClasses[size]} ${checked ? 'switch-checked' : ''} ${disabled ? 'switch-disabled' : ''} ${className}`}
                onClick={this.handleClick}
            >
                <div className="switch-track">
                    <div className="switch-thumb"></div>
                </div>
            </div>
        )
    }
}

type NavProps = {
    state: AppState
    itemShown: boolean
    search: () => void
    fetch: () => void
    logs: () => void
    openSourcesSettings: () => void
    openGroupingSettings: () => void
    openAppSettings: () => void
    toggleAIMode: (enabled: boolean) => void
    isAIModeEnabled: boolean
    aiConfigDisplay: boolean
    settingsDisplay: boolean
}

type NavState = {
    maximized: boolean
    hasAIMessages: boolean
    showSettingsMenu: boolean
    settingsMenuTarget?: HTMLElement | MouseEvent
}

class Nav extends React.Component<NavProps, NavState> {
    private aiMessagesCheckInterval: NodeJS.Timeout | null = null
    private settingsMenuCloseTimer: NodeJS.Timeout | null = null

    constructor(props) {
        super(props)
        this.setBodyFocusState(window.utils.isFocused())
        this.setBodyFullscreenState(window.utils.isFullscreen())
        window.utils.addWindowStateListener(this.windowStateListener)
        this.state = {
            maximized: window.utils.isMaximized(),
            hasAIMessages: typeof window !== 'undefined' && (window as any).hasAIMessages === true,
            showSettingsMenu: false
        }
        // 设置定时器检查AI消息状态
        this.aiMessagesCheckInterval = setInterval(() => {
            const hasMessages = typeof window !== 'undefined' && (window as any).hasAIMessages === true
            if (hasMessages !== this.state.hasAIMessages) {
                this.setState({ hasAIMessages: hasMessages })
            }
        }, 100) // 每100ms检查一次
    }

    setBodyFocusState = (focused: boolean) => {
        if (focused) document.body.classList.remove("blur")
        else document.body.classList.add("blur")
    }

    setBodyFullscreenState = (fullscreen: boolean) => {
        if (fullscreen) document.body.classList.remove("not-fullscreen")
        else document.body.classList.add("not-fullscreen")
    }

    windowStateListener = (type: WindowStateListenerType, state: boolean) => {
        switch (type) {
            case WindowStateListenerType.Maximized:
                this.setState({ maximized: state })
                break
            case WindowStateListenerType.Fullscreen:
                this.setBodyFullscreenState(state)
                break
            case WindowStateListenerType.Focused:
                this.setBodyFocusState(state)
                break
        }
    }

    navShortcutsHandler = (e: KeyboardEvent | IObjectWithKey) => {
        if (!this.props.state.settings.display) {
            switch (e.key) {
                case "F2":
                    this.props.search()
                    break
                case "F5":
                    this.fetch()
                    break
                case "F9":
                    if (!this.props.itemShown) this.props.openAppSettings()
                    break
            }
        }
    }

    componentDidMount() {
        document.addEventListener("keydown", this.navShortcutsHandler)
        if (window.utils.platform === "darwin")
            window.utils.addTouchBarEventsListener(this.navShortcutsHandler)
    }
    componentWillUnmount() {
        document.removeEventListener("keydown", this.navShortcutsHandler)
        if (this.aiMessagesCheckInterval) {
            clearInterval(this.aiMessagesCheckInterval)
        }
        if (this.settingsMenuCloseTimer) {
            clearTimeout(this.settingsMenuCloseTimer)
        }
    }

    minimize = () => {
        window.utils.minimizeWindow()
    }
    maximize = () => {
        window.utils.maximizeWindow()
        this.setState({ maximized: !this.state.maximized })
    }
    close = () => {
        window.utils.closeWindow()
    }

    canFetch = () =>
        this.props.state.sourceInit &&
        this.props.state.feedInit &&
        !this.props.state.syncing &&
        !this.props.state.fetchingItems
    fetching = () => (!this.canFetch() ? " fetching" : "")
    getClassNames = () => {
        const classNames = new Array<string>()
        if (this.props.state.settings.display || this.props.aiConfigDisplay) classNames.push("hide-btns")
        classNames.push("menu-on")
        if (this.props.itemShown) classNames.push("item-on")
        if (this.props.isAIModeEnabled) classNames.push("ai-mode-on")
        return classNames.join(" ")
    }

    fetch = () => {
        if (this.canFetch()) this.props.fetch()
    }


    getProgress = () => {
        return this.props.state.fetchingTotal > 0
            ? this.props.state.fetchingProgress / this.props.state.fetchingTotal
            : null
    }

    openSettingsMenu = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault()
        event.stopPropagation()
        // 如果菜单已经打开，则关闭；否则打开
        if (this.state.showSettingsMenu) {
            this.closeSettingsMenu()
        } else {
            this.setState({
                showSettingsMenu: true,
                settingsMenuTarget: event.currentTarget
            })
        }
    }

    closeSettingsMenu = () => {
        if (this.settingsMenuCloseTimer) {
            clearTimeout(this.settingsMenuCloseTimer)
            this.settingsMenuCloseTimer = null
        }
        this.setState({
            showSettingsMenu: false,
            settingsMenuTarget: undefined
        })
    }

    handleSettingsMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
        // 清除任何待关闭的定时器
        if (this.settingsMenuCloseTimer) {
            clearTimeout(this.settingsMenuCloseTimer)
            this.settingsMenuCloseTimer = null
        }
        // 打开菜单
        this.setState({
            showSettingsMenu: true,
            settingsMenuTarget: event.currentTarget
        })
    }

    handleSettingsMouseLeave = () => {
        // 延迟关闭菜单，给用户时间移动到菜单上
        this.settingsMenuCloseTimer = setTimeout(() => {
            this.closeSettingsMenu()
        }, 200)
    }

    handleMenuMouseEnter = () => {
        // 鼠标进入菜单时，取消关闭定时器
        if (this.settingsMenuCloseTimer) {
            clearTimeout(this.settingsMenuCloseTimer)
            this.settingsMenuCloseTimer = null
        }
    }

    handleMenuMouseLeave = () => {
        // 鼠标离开菜单时，延迟关闭
        this.settingsMenuCloseTimer = setTimeout(() => {
            this.closeSettingsMenu()
        }, 200)
    }

    handleNavClick = (event: React.MouseEvent<HTMLElement>) => {
        // 检查点击目标
        const target = event.target as HTMLElement
        
        // 如果点击的是菜单本身，不关闭
        if (target.closest('.ms-ContextualMenu')) {
            return
        }
        
        // 如果点击的是按钮组中的任何按钮，不关闭菜单
        // （按钮有自己的点击处理，包括设置按钮的切换逻辑）
        if (target.closest('.btn-group .btn')) {
            return
        }
        
        // 如果点击的是AI模式开关，不关闭菜单
        if (target.closest('.ai-mode-switch')) {
            return
        }
        
        // 如果菜单是打开的，关闭它
        if (this.state.showSettingsMenu) {
            this.closeSettingsMenu()
        }
    }

    handleAppPreferences = () => {
        this.closeSettingsMenu()
        this.props.openAppSettings()
    }

    handleAIConfig = () => {
        this.closeSettingsMenu()
        if (typeof window !== 'undefined' && (window as any).openAIConfigPanel) {
            (window as any).openAIConfigPanel()
        }
    }

    getSettingsMenuItems = (): IContextualMenuItem[] => {
        return [
            {
                key: "appPreferences",
                text: intl.get("settings.appPreferences"),
                iconProps: { 
                    iconName: "Edit",
                    styles: {
                        root: {
                            fontSize: '11px',
                            width: '11px',
                            height: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }
                    }
                },
                styles: {
                    root: {
                        fontSize: '11px',
                        lineHeight: '20px',
                        display: 'flex',
                        alignItems: 'center'
                    },
                    icon: {
                        fontSize: '11px',
                        width: '11px',
                        height: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }
                },
                onClick: this.handleAppPreferences
            },
            {
                key: "aiConfig",
                text: intl.get("settings.ai"),
                iconProps: { 
                    iconName: "Cloud",
                    styles: {
                        root: {
                            fontSize: '11px',
                            width: '11px',
                            height: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }
                    }
                },
                styles: {
                    root: {
                        fontSize: '11px',
                        lineHeight: '20px',
                        display: 'flex',
                        alignItems: 'center'
                    },
                    icon: {
                        fontSize: '11px',
                        width: '11px',
                        height: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }
                },
                onClick: this.handleAIConfig
            }
        ]
    }

    render() {
        return (
            <nav className={this.getClassNames()} onClick={this.handleNavClick}>
                <span className="title" style={{ pointerEvents: 'none' }}>{this.props.state.title}</span>
                {/* AI模式开关 - 居中显示，只保留图标 */}
                {!this.props.settingsDisplay && !this.props.itemShown && (
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'inline-block' }}>
                    <TooltipHost 
                        content={intl.get("nav.aiMode")} 
                        delay={TooltipDelay.zero}
                        calloutProps={{
                            directionalHint: DirectionalHint.bottomCenter
                        }}>
                        <div 
                            className={`ai-mode-switch ${this.props.isAIModeEnabled ? 'ai-mode-enabled' : ''}`}
                            style={{ position: 'relative', left: 'auto', transform: 'none' }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                this.props.toggleAIMode(!this.props.isAIModeEnabled);
                            }}
                        >
                            <Icon iconName="AIMode" className="ai-mode-icon" />
                        </div>
                    </TooltipHost>
                </div>
                )}
                <div className="btn-group" style={{ float: "right" }}>
                    <TooltipHost content={intl.get("nav.refresh")} delay={TooltipDelay.zero}>
                        <a
                            className={"btn" + this.fetching()}
                            onClick={this.fetch}>
                            <Icon iconName="Refresh" />
                        </a>
                    </TooltipHost>
                    <a
                        className="btn"
                        onMouseEnter={this.handleSettingsMouseEnter}
                        onMouseLeave={this.handleSettingsMouseLeave}>
                        <Icon iconName="Settings" />
                    </a>
                    <TooltipHost content={intl.get("nav.minimize")} delay={TooltipDelay.zero}>
                        <a
                            className="btn system"
                            onClick={this.minimize}>
                            <Icon iconName="Remove" />
                        </a>
                    </TooltipHost>
                    <TooltipHost content={intl.get("nav.maximize")} delay={TooltipDelay.zero}>
                        <a
                            className="btn system"
                            onClick={this.maximize}>
                            {this.state.maximized ? (
                                <Icon iconName="ChromeRestore" />
                            ) : (
                                <Icon iconName="Checkbox" />
                            )}
                        </a>
                    </TooltipHost>
                    <TooltipHost content={intl.get("close")} delay={TooltipDelay.zero}>
                        <a
                            className="btn system close"
                            onClick={this.close}>
                            <Icon iconName="Cancel" />
                        </a>
                    </TooltipHost>
                </div>
                {!this.canFetch() && (
                    <ProgressIndicator
                        className="progress"
                        percentComplete={this.getProgress()}
                    />
                )}
                {this.state.showSettingsMenu && (
                    <ContextualMenu
                        directionalHint={DirectionalHint.bottomRightEdge}
                        items={this.getSettingsMenuItems()}
                        target={this.state.settingsMenuTarget}
                        onDismiss={this.closeSettingsMenu}
                        calloutProps={{
                            onMouseEnter: this.handleMenuMouseEnter,
                            onMouseLeave: this.handleMenuMouseLeave,
                            styles: {
                                root: {
                                    maxHeight: 'none',
                                    overflow: 'visible'
                                },
                                calloutMain: {
                                    maxHeight: 'none',
                                    overflow: 'visible'
                                }
                            }
                        }}
                        styles={{
                            root: {
                                maxHeight: 'none',
                                overflow: 'visible'
                            },
                            list: {
                                maxHeight: 'none',
                                overflow: 'visible'
                            },
                            container: {
                                maxHeight: 'none',
                                overflow: 'visible'
                            }
                        }}
                    />
                )}
            </nav>
        )
    }
}

export default Nav
