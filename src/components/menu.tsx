import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react/lib/Icon"
import { Nav, INavLink, INavLinkGroup } from "office-ui-fabric-react/lib/Nav"
import { SourceGroup } from "../schema-types"
import { SourceState, RSSSource } from "../scripts/models/source"
import { ALL, ALL_TOTAL, ALL_TODAY } from "../scripts/models/feed"
import { AnimationClassNames, Stack, FocusZone } from "@fluentui/react"
import { IconButton } from "@fluentui/react/lib/Button"
import { AIModeMenuContent } from "./ai-mode-menu-content"

export type MenuProps = {
    status: boolean
    display: boolean
    selected: string
    sources: SourceState
    groups: SourceGroup[]
    itemOn: boolean
    isAIMode: boolean
    todayUnreadCount: number
    allArticles: (init?: boolean) => void
    allArticlesTotal: (init?: boolean) => void
    todayArticles: (init?: boolean) => void
    selectSourceGroup: (group: SourceGroup, menuKey: string) => void
    selectSource: (source: RSSSource) => void
    groupContextMenu: (sids: number[], event: React.MouseEvent) => void
    updateGroupExpansion: (
        event: React.MouseEvent<HTMLElement>,
        key: string,
        selected: string
    ) => void
    openSourcesSettings: () => void
    openGroupingSettings: () => void
    addSourceToGroup: (groupIndex: number, sid: number) => void
    removeSourceFromGroup: (groupIndex: number, sids: number[]) => void
    updateSourceGroup: (group: SourceGroup) => void
    reorderSourceGroups: (groups: SourceGroup[]) => void
    clearSourceIcon: (source: RSSSource) => void
}

type MenuState = {
}

export class Menu extends React.Component<MenuProps, MenuState> {
    constructor(props: MenuProps) {
        super(props)
        this.state = {}
    }

    countOverflow = (count: number) => (count >= 1000 ? " 999+" : ` ${count}`)

    getLinkGroups = (): INavLinkGroup[] => {
        const unreadCount = Object.values(this.props.sources)
            .filter(s => !s.hidden)
            .map(s => s.unreadCount)
            .reduce((a, b) => a + b, 0)
        
        return [
            {
                links: [
                    {
                        name: intl.get("todayArticles"),
                        ariaLabel:
                            intl.get("todayArticles") +
                            this.countOverflow(this.props.todayUnreadCount),
                        key: ALL_TODAY,
                        icon: "Calendar",
                        onClick: () =>
                            this.props.todayArticles(this.props.selected !== ALL_TODAY),
                        url: null,
                    },
                    {
                        name: intl.get("allArticles"),
                        ariaLabel:
                            intl.get("allArticles") +
                            this.countOverflow(unreadCount),
                        key: ALL,
                        icon: "TextDocument",
                        onClick: () =>
                            this.props.allArticles(this.props.selected !== ALL),
                        url: null,
                    },
                    {
                        name: intl.get("starred"),
                        ariaLabel: intl.get("starred"), // 已收藏不显示数量
                        key: ALL_TOTAL,
                        icon: "FavoriteStarFill",
                        onClick: () =>
                            this.props.allArticlesTotal(this.props.selected !== ALL_TOTAL),
                        url: null,
                    },
                ],
            },
            {
                name: intl.get("menu.subscriptions"),
                links: Object.values(this.props.sources)
                    .filter(s => !s.hidden)
                    .sort((a, b) => a.sid - b.sid)
                    .map(this.getSource),
            },
        ]
    }

    getSource = (s: RSSSource): INavLink => ({
        name: s.name,
        ariaLabel: s.name + this.countOverflow(s.unreadCount),
        key: "s-" + s.sid,
        onClick: () => this.props.selectSource(s),
        iconProps: s.iconurl ? this.getIconStyle(s.iconurl, s) : null,
        url: null,
    })

    getIconStyle = (url: string, source: RSSSource) => ({
        style: { width: 16 },
        imageProps: {
            style: { width: "100%" },
            src: url,
            onError: () => {
                // 图标加载失败时，清除iconurl
                this.props.clearSourceIcon(source)
            },
        },
    })

    onContext = (item: INavLink, event: React.MouseEvent) => {
        let [type, index] = item.key.split("-")
        if (type === "s") {
            const sids = [parseInt(index)]
            this.props.groupContextMenu(sids, event)
        }
    }

    handleDragStart = () => {
        // 拖拽功能已移除
    }

    handleDragOver = () => {
        // 拖拽功能已移除
    }

    handleDragLeave = () => {
        // 拖拽功能已移除
    }

    handleDrop = () => {
        // 拖拽功能已移除
    }

    handleDragEnd = () => {
        // 拖拽功能已移除
    }

    _onRenderLink = (link: INavLink): JSX.Element => {
        // 从 ariaLabel 中提取数字（格式：名称 + " 数字" 或 " 999+"）
        const parts = link.ariaLabel.split(" ")
        let count = parts.length > 1 ? parts[parts.length - 1] : null
        
        // 对于"全部文章"（ALL）和"今日文章"（ALL_TODAY），总是显示数字（包括0）
        // 对于"已收藏"（ALL_TOTAL），不显示数量
        // 对于其他项，只有当数字不为0时才显示
        const isAllArticles = link.key === ALL
        const isTodayArticles = link.key === ALL_TODAY
        const isStarred = link.key === ALL_TOTAL
        const shouldShowCount = !isStarred && count && (isAllArticles || isTodayArticles || count !== "0")

        return (
            <Stack
                className="link-stack"
                horizontal
                grow
                onContextMenu={event => this.onContext(link, event)}>
                <div className="link-text">{link.name}</div>
                {shouldShowCount && (
                    <div className="unread-count">{count}</div>
                )}
            </Stack>
        )
    }

    _onRenderGroupHeader = (group: INavLinkGroup): JSX.Element => {
        const isSubscriptionsGroup = group.name === intl.get("menu.subscriptions")
        
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-start',
                margin: '2px 8px',
                gap: '4px'
            }}>
                <p className={"subs-header " + AnimationClassNames.slideDownIn10} style={{ margin: 0 }}>
                    {group.name}
                </p>
                {isSubscriptionsGroup && (
                    <IconButton
                        iconProps={{ iconName: "Add" }}
                        onClick={this.props.openSourcesSettings}
                        title="添加源"
                        styles={{
                            root: {
                                width: '20px',
                                height: '20px',
                                padding: 0,
                                minWidth: '20px'
                            },
                            icon: {
                                fontSize: '12px'
                            }
                        }}
                    />
                )}
            </div>
        )
    }

    _renderSubscriptionsHeader = (): JSX.Element => {
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-start',
                margin: '2px 8px',
                gap: '4px',
                flexShrink: 0
            }}>
                <p className={"subs-header " + AnimationClassNames.slideDownIn10} style={{ margin: 0 }}>
                    {intl.get("menu.subscriptions")}
                </p>
                <IconButton
                    iconProps={{ iconName: "Add" }}
                    onClick={this.props.openSourcesSettings}
                    title="添加源"
                    styles={{
                        root: {
                            width: '20px',
                            height: '20px',
                            padding: 0,
                            minWidth: '20px'
                        },
                        icon: {
                            fontSize: '12px'
                        }
                    }}
                />
            </div>
        )
    }

    render() {
        // 如果是AI模式，渲染AI模式的菜单（通过全局状态访问）
        if (this.props.isAIMode) {
            return (
                this.props.status && (
                    <div className="menu-container show">
                        <div 
                            className={"menu" + (this.props.itemOn ? " item-on" : "")}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                overflow: 'hidden'
                            }}
                        >
                            <AIModeMenu />
                        </div>
                    </div>
                )
            )
        }

        // 普通模式的菜单
        const linkGroups = this.getLinkGroups()
        const fixedGroup = linkGroups[0]  // 今日文章等
        const subscriptionsGroup = linkGroups[1]  // 订阅源
        
        // 创建只包含链接的订阅源分组（不包含标题）
        const subscriptionsLinksOnly = {
            ...subscriptionsGroup,
            name: undefined  // 移除 name，标题单独渲染
        }
        
        return (
            this.props.status && (
                <div className="menu-container show">
                    <div
                        className={
                            "menu" + (this.props.itemOn ? " item-on" : "")
                        }
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%'
                        }}>
                        {/* 固定部分1：今日文章、全部文章、已收藏 */}
                        <FocusZone
                            as="div"
                            disabled={false}
                            className="nav-wrapper-fixed"
                            style={{
                                flexShrink: 0,
                                overflow: 'hidden'
                            }}>
                            <Nav
                                onRenderLink={this._onRenderLink}
                                groups={[fixedGroup]}
                                selectedKey={this.props.selected}
                            />
                        </FocusZone>
                        
                        {/* 固定部分2：订阅源标题和添加按钮 */}
                        {this._renderSubscriptionsHeader()}
                        
                        {/* 可滚动部分：订阅源列表 */}
                        <FocusZone
                            as="div"
                            disabled={false}
                            className="nav-wrapper-scrollable"
                            style={{
                                flex: 1,
                                minHeight: 0,
                                overflow: 'auto',
                                paddingTop: '0',
                                paddingBottom: '16px',
                                paddingRight: '0',
                                boxSizing: 'border-box'
                            }}>
                            <Nav
                                onRenderLink={this._onRenderLink}
                                groups={[subscriptionsLinksOnly]}
                                selectedKey={this.props.selected}
                                onLinkExpandClick={(event, item) =>
                                    this.props.updateGroupExpansion(
                                        event,
                                        item.key,
                                        this.props.selected
                                    )
                                }
                            />
                        </FocusZone>
                    </div>
                </div>
            )
        )
    }
}

// AI模式的菜单组件
class AIModeMenu extends React.Component {
    render() {
        return (
            <div 
                style={{ 
                    padding: '20px 20px 0 20px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    boxSizing: 'border-box',
                    WebkitOverflowScrolling: 'touch'
                }}
            >
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '16px',
                    paddingBottom: '40px',
                    flexShrink: 0
                }}>
                    <AIModeMenuContent />
                </div>
            </div>
        )
    }
}
