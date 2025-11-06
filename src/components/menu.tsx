import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react/lib/Icon"
import { Nav, INavLink, INavLinkGroup } from "office-ui-fabric-react/lib/Nav"
import { SourceGroup } from "../schema-types"
import { SourceState, RSSSource } from "../scripts/models/source"
import { ALL } from "../scripts/models/feed"
import { AnimationClassNames, Stack, FocusZone, DefaultButton } from "@fluentui/react"
import { AIModeMenuContent } from "./ai-mode-menu-content"

export type MenuProps = {
    status: boolean
    display: boolean
    selected: string
    sources: SourceState
    groups: SourceGroup[]
    itemOn: boolean
    isAIMode: boolean
    allArticles: (init?: boolean) => void
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
}

type MenuState = {
    // 分组和拖拽功能已移除，状态保留为空对象以保持兼容性
}

export class Menu extends React.Component<MenuProps, MenuState> {
    constructor(props: MenuProps) {
        super(props)
        this.state = {}
    }
    
    componentDidUpdate() {
        // 分组功能已移除，无需处理
    }

    countOverflow = (count: number) => (count >= 1000 ? " 999+" : ` ${count}`)

    getLinkGroups = (): INavLinkGroup[] => [
        {
            links: [
                {
                    name: intl.get("allArticles"),
                    ariaLabel:
                        intl.get("allArticles") +
                        this.countOverflow(
                            Object.values(this.props.sources)
                                .filter(s => !s.hidden)
                                .map(s => s.unreadCount)
                                .reduce((a, b) => a + b, 0)
                        ),
                    key: ALL,
                    icon: "TextDocument",
                    onClick: () =>
                        this.props.allArticles(this.props.selected !== ALL),
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

    getSource = (s: RSSSource): INavLink => ({
        name: s.name,
        ariaLabel: s.name + this.countOverflow(s.unreadCount),
        key: "s-" + s.sid,
        onClick: () => this.props.selectSource(s),
        iconProps: s.iconurl ? this.getIconStyle(s.iconurl) : null,
        url: null,
    })

    getIconStyle = (url: string) => ({
        style: { width: 16 },
        imageProps: {
            style: { width: "100%" },
            src: url,
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
        let count = link.ariaLabel.split(" ").pop()

        return (
            <Stack
                className="link-stack"
                horizontal
                grow
                onContextMenu={event => this.onContext(link, event)}>
                <div className="link-text">{link.name}</div>
                {count && count !== "0" && (
                    <div className="unread-count">{count}</div>
                )}
            </Stack>
        )
    }

    _onRenderGroupHeader = (group: INavLinkGroup): JSX.Element => {
        return (
            <p className={"subs-header " + AnimationClassNames.slideDownIn10}>
                {group.name}
            </p>
        )
    }

    render() {
        // 如果是AI模式，渲染AI模式的菜单（通过全局状态访问）
        if (this.props.isAIMode) {
            return (
                this.props.status && (
                    <div className="menu-container show">
                        <div className={"menu" + (this.props.itemOn ? " item-on" : "")}>
                            <AIModeMenu />
                        </div>
                    </div>
                )
            )
        }

        // 普通模式的菜单
        return (
            this.props.status && (
                <div className="menu-container show">
                    <div
                        className={
                            "menu" + (this.props.itemOn ? " item-on" : "")
                        }>
                        {/* 添加订阅源和分组的按钮 */}
                        <div style={{ 
                            padding: '8px 12px', 
                            borderBottom: '1px solid var(--neutralLight)',
                            display: 'flex',
                            gap: '8px'
                        }}>
                            <DefaultButton
                                text="添加源"
                                iconProps={{ iconName: "Add" }}
                                onClick={this.props.openSourcesSettings}
                                styles={{
                                    root: {
                                        flex: 1,
                                        minWidth: 0,
                                        height: '28px',
                                        padding: '0 8px'
                                    },
                                    label: {
                                        fontSize: '12px',
                                        fontWeight: 400
                                    },
                                    icon: {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </div>
                        <FocusZone
                            as="div"
                            disabled={false}
                            className="nav-wrapper">
                            <Nav
                                onRenderGroupHeader={this._onRenderGroupHeader}
                                onRenderLink={this._onRenderLink}
                                groups={this.getLinkGroups()}
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
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
                <AIModeMenuContent />
            </div>
        )
    }
}
