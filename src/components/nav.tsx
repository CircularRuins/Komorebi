import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react/lib/Icon"
import { AppState } from "../scripts/models/app"
import { ProgressIndicator, IObjectWithKey } from "@fluentui/react"
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
        this.setState({
            showSettingsMenu: false,
            settingsMenuTarget: undefined
        })
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
                iconProps: { iconName: "Settings" },
                onClick: this.handleAppPreferences
            },
            {
                key: "aiConfig",
                text: intl.get("settings.ai"),
                iconProps: { iconName: "Cloud" },
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
                <div 
                    className={`ai-mode-switch ${this.props.isAIModeEnabled ? 'ai-mode-enabled' : ''}`}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.props.toggleAIMode(!this.props.isAIModeEnabled);
                    }}
                    title={intl.get("nav.aiMode")}
                >
                    <Icon iconName="AIMode" className="ai-mode-icon" />
                </div>
                )}
                <div className="btn-group" style={{ float: "right" }}>
                    <a
                        className={"btn" + this.fetching()}
                        onClick={this.fetch}
                        title={intl.get("nav.refresh")}>
                        <Icon iconName="Refresh" />
                    </a>
                    <a
                        className="btn"
                        title={intl.get("settings.app")}
                        onClick={this.openSettingsMenu}>
                        <Icon iconName="Settings" />
                    </a>
                    <a
                        className="btn system"
                        title={intl.get("nav.minimize")}
                        onClick={this.minimize}>
                        <Icon iconName="Remove" />
                    </a>
                    <a
                        className="btn system"
                        title={intl.get("nav.maximize")}
                        onClick={this.maximize}>
                        {this.state.maximized ? (
                            <Icon iconName="ChromeRestore" />
                        ) : (
                            <Icon iconName="Checkbox" />
                        )}
                    </a>
                    <a
                        className="btn system close"
                        title={intl.get("close")}
                        onClick={this.close}>
                        <Icon iconName="Cancel" />
                    </a>
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
                    />
                )}
            </nav>
        )
    }
}

export default Nav
