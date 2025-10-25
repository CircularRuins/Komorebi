import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react/lib/Icon"
import { AppState } from "../scripts/models/app"
import { ProgressIndicator, IObjectWithKey } from "@fluentui/react"
import { getWindowBreakpoint } from "../scripts/utils"
import { WindowStateListenerType } from "../schema-types"
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
    views: () => void
    openSourcesSettings: () => void
    openGroupingSettings: () => void
    openAppSettings: () => void
    toggleAIMode: (enabled: boolean) => void
    isAIModeEnabled: boolean
    settingsDisplay: boolean
}

type NavState = {
    maximized: boolean
}

class Nav extends React.Component<NavProps, NavState> {
    constructor(props) {
        super(props)
        this.setBodyFocusState(window.utils.isFocused())
        this.setBodyFullscreenState(window.utils.isFullscreen())
        window.utils.addWindowStateListener(this.windowStateListener)
        this.state = {
            maximized: window.utils.isMaximized(),
        }
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
                case "F8":
                    if (!this.props.itemShown) this.props.views()
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
        if (this.props.state.settings.display) classNames.push("hide-btns")
        classNames.push("menu-on")
        if (this.props.itemShown) classNames.push("item-on")
        if (this.props.isAIModeEnabled) classNames.push("ai-mode-on")
        return classNames.join(" ")
    }

    fetch = () => {
        if (this.canFetch()) this.props.fetch()
    }

    views = () => {
        if (this.props.state.contextMenu.event !== "#view-toggle") {
            this.props.views()
        }
    }

    getProgress = () => {
        return this.props.state.fetchingTotal > 0
            ? this.props.state.fetchingProgress / this.props.state.fetchingTotal
            : null
    }

    render() {
        return (
            <nav className={this.getClassNames()}>
                <span className="title" style={{ pointerEvents: 'none' }}>{this.props.state.title}</span>
                {/* AI模式开关 - 使用fixed定位避免被覆盖，设置页面显示或文章显示时隐藏 */}
                {!this.props.settingsDisplay && !this.props.itemShown && (
                <div 
                    className="ai-mode-switch-center" 
                    style={{
                        position: 'fixed',
                        left: '50%',
                        top: '0',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 8px',
                        borderRadius: '4px',
                        zIndex: 99999,
                        cursor: 'pointer',
                        WebkitAppRegion: 'none',
                        height: 'var(--navHeight)',
                        lineHeight: 'var(--navHeight)'
                    } as any}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.props.toggleAIMode(!this.props.isAIModeEnabled);
                    }}
                >
                    <span style={{ 
                        marginRight: -2, 
                        fontSize: 12, 
                        color: 'var(--neutralPrimary)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        fontFamily: 'var(--fontFamily)',
                        fontWeight: 'normal',
                        lineHeight: '32px'
                    }}>
                        AI模式
                    </span>
                    <Icon iconName="Robot" style={{ marginRight: -2, fontSize: 14, pointerEvents: 'none' }} />
                    <div
                        style={{
                            width: '32px',
                            height: '18px',
                            background: this.props.isAIModeEnabled ? '#10b981' : '#d1d5db',
                            borderRadius: '9px',
                            position: 'relative',
                            border: '1px solid #9ca3af',
                            transition: 'background-color 0.2s',
                            pointerEvents: 'none'
                        }}
                    >
                        <div style={{
                            width: '14px',
                            height: '14px',
                            background: 'white',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '1px',
                            left: this.props.isAIModeEnabled ? '15px' : '1px',
                            transition: 'left 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                            pointerEvents: 'none'
                        }}></div>
                    </div>
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
                        id="view-toggle"
                        title={intl.get("nav.view")}
                        onClick={this.props.views}
                        onMouseDown={e => {
                            if (
                                this.props.state.contextMenu.event ===
                                "#view-toggle"
                            )
                                e.stopPropagation()
                        }}>
                        <Icon iconName="View" />
                    </a>
                    <a
                        className="btn"
                        title={intl.get("settings.sources")}
                        onClick={this.props.openSourcesSettings}>
                        <Icon iconName="Source" />
                    </a>
                    <a
                        className="btn"
                        title={intl.get("settings.grouping")}
                        onClick={this.props.openGroupingSettings}>
                        <Icon iconName="GroupList" />
                    </a>
                    <a
                        className="btn"
                        title={intl.get("settings.app")}
                        onClick={this.props.openAppSettings}>
                        <Icon iconName="Settings" />
                    </a>
                    <a
                        className="btn system"
                        title={intl.get("nav.minimize")}
                        onClick={this.minimize}
                        style={{ fontSize: 12 }}>
                        <Icon iconName="Remove" />
                    </a>
                    <a
                        className="btn system"
                        title={intl.get("nav.maximize")}
                        onClick={this.maximize}>
                        {this.state.maximized ? (
                            <Icon
                                iconName="ChromeRestore"
                                style={{ fontSize: 11 }}
                            />
                        ) : (
                            <Icon
                                iconName="Checkbox"
                                style={{ fontSize: 10 }}
                            />
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
            </nav>
        )
    }
}

export default Nav
