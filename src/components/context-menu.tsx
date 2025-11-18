import * as React from "react"
import ReactDOM from "react-dom"
import intl from "react-intl-universal"
import QRCode from "qrcode.react"
import {
    cutText,
    webSearch,
    getSearchEngineName,
    platformCtrl,
} from "../scripts/utils"
import {
    ContextualMenu,
    IContextualMenuItem,
    ContextualMenuItemType,
    DirectionalHint,
} from "office-ui-fabric-react/lib/ContextualMenu"
import {
    TextField,
    PrimaryButton,
    DefaultButton,
} from "@fluentui/react"
import { closeContextMenu, ContextMenuType, toggleSettings, saveSettings } from "../scripts/models/app"
import {
    markAllRead,
    markRead,
    markUnread,
    RSSItem,
    toggleStarred,
} from "../scripts/models/item"
import { deleteSource, deleteSources, RSSSource, updateSource } from "../scripts/models/source"
import { ViewType, ImageCallbackTypes, ViewConfigs } from "../schema-types"
import { FilterType } from "../scripts/models/feed"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import {
    setViewConfigs,
    showItem,
    switchFilter,
    switchView,
    toggleFilter,
} from "../scripts/models/page"

export const shareSubmenu = (item: RSSItem): IContextualMenuItem[] => [
    { key: "qr", url: item.link, onRender: renderShareQR },
]

export const renderShareQR = (item: IContextualMenuItem) => (
    <div className="qr-container">
        <QRCode value={item.url} size={150} renderAs="svg" />
    </div>
)

function getSearchItem(text: string): IContextualMenuItem {
    const engine = window.settings.getSearchEngine()
    return {
        key: "searchText",
        text: intl.get("context.search", {
            text: cutText(text, 15),
            engine: getSearchEngineName(engine),
        }),
        iconProps: { iconName: "Search" },
        onClick: () => webSearch(text, engine),
    }
}

// 全局状态用于重命名对话框（避免组件卸载时状态丢失）
let globalRenameDialogState = {
    show: false,
    sourceId: null as number | null,
    initialName: "",
}

// 全局回调函数用于更新对话框状态
let globalRenameDialogUpdateCallback: ((state: typeof globalRenameDialogState) => void) | null = null

export function ContextMenu() {
    const { type } = useAppSelector(state => state.app.contextMenu)
    const [renameDialogState, setRenameDialogState] = React.useState(globalRenameDialogState)
    const [renameInputValue, setRenameInputValue] = React.useState("")

    // 注册更新回调
    React.useEffect(() => {
        globalRenameDialogUpdateCallback = (newState) => {
            setRenameDialogState({ ...newState })
            if (newState.show) {
                setRenameInputValue(newState.initialName)
            }
        }
        return () => {
            globalRenameDialogUpdateCallback = null
        }
    }, [])

    const dispatch = useAppDispatch()
    const sources = useAppSelector(state => state.sources)

    const handleRenameSource = async () => {
        const trimmedName = renameInputValue.trim()
        if (!trimmedName || !globalRenameDialogState.sourceId) {
            return
        }
        
        const source = sources[globalRenameDialogState.sourceId]
        if (source) {
            const updatedSource = { ...source, name: trimmedName } as RSSSource
            await dispatch(updateSource(updatedSource))
            // 不需要调用 saveSettings()，updateSource 已经直接更新了数据库
            // 调用 saveSettings() 会打开设置页面并显示"正在保存"
        }
        globalRenameDialogState = { show: false, sourceId: null, initialName: "" }
        setRenameDialogState({ ...globalRenameDialogState })
        setRenameInputValue("")
    }

    const handleCloseRenameDialog = () => {
        globalRenameDialogState = { show: false, sourceId: null, initialName: "" }
        setRenameDialogState({ ...globalRenameDialogState })
        setRenameInputValue("")
    }

    const renameDialog = renameDialogState.show ? (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            onClick={handleCloseRenameDialog}>
            {/* 背景遮罩 */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    animation: 'fadeIn 0.3s ease-out',
                }}
            />
            {/* 对话框内容 */}
            <div
                style={{
                    position: 'relative',
                    backgroundColor: 'var(--white)',
                    borderRadius: '8px',
                    padding: '24px 28px',
                    minWidth: '320px',
                    maxWidth: '90%',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    border: '1px solid var(--neutralLight)',
                    animation: 'fadeInScale 0.3s ease-out',
                }}
                onClick={(e) => e.stopPropagation()}>
                {/* 标题 */}
                <div
                    style={{
                        fontSize: '20px',
                        fontWeight: 600,
                        color: 'var(--neutralPrimary)',
                    }}>
                    {intl.get("sources.editName")}
                </div>
                {/* 输入框 */}
                <TextField
                    value={renameInputValue}
                    onChange={(_, newValue) => setRenameInputValue(newValue || "")}
                    placeholder={intl.get("sources.name")}
                    onGetErrorMessage={(value) => {
                        const trimmed = value.trim()
                        return trimmed.length === 0 ? intl.get("emptyName") : ""
                    }}
                    validateOnLoad={false}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && renameInputValue.trim().length > 0) {
                            handleRenameSource()
                        } else if (e.key === 'Escape') {
                            handleCloseRenameDialog()
                        }
                    }}
                />
                {/* 按钮区域 */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'flex-end',
                    gap: '8px',
                }}>
                    <DefaultButton 
                        onClick={handleCloseRenameDialog} 
                        text={intl.get("cancel")} 
                    />
                    <PrimaryButton 
                        onClick={handleRenameSource}
                        disabled={renameInputValue.trim().length === 0}
                        text={intl.get("confirm")} 
                    />
                </div>
            </div>
        </div>
    ) : null

    return (
        <>
            {type === ContextMenuType.Hidden ? null :
             type === ContextMenuType.Item ? <ItemContextMenu /> :
             type === ContextMenuType.Text ? <TextContextMenu /> :
             type === ContextMenuType.Image ? <ImageContextMenu /> :
             type === ContextMenuType.Group ? <GroupContextMenu /> :
             type === ContextMenuType.MarkRead ? <MarkReadContextMenu /> : null}
            {renameDialog && ReactDOM.createPortal(renameDialog, document.body)}
        </>
    )
}

function ItemContextMenu() {
    const dispatch = useAppDispatch()
    const viewConfigs = useAppSelector(state => state.page.viewConfigs)
    const target = useAppSelector(state => state.app.contextMenu.target)
    const item = target[0] as RSSItem
    const feedId = target[1] as string

    const menuItems: IContextualMenuItem[] = [
        {
            key: "showItem",
            text: intl.get("context.read"),
            iconProps: { iconName: "TextDocument" },
            onClick: () => {
                dispatch(markRead(item))
                dispatch(showItem(feedId, item))
            },
        },
        {
            key: "openInBrowser",
            text: intl.get("openExternal"),
            iconProps: { iconName: "NavigateExternalInline" },
            onClick: e => {
                dispatch(markRead(item))
                window.utils.openExternal(item.link, platformCtrl(e))
            },
        },
        {
            key: "markAsRead",
            text: item.hasRead
                ? intl.get("article.markUnread")
                : intl.get("article.markRead"),
            iconProps: item.hasRead
                ? {
                      iconName: "RadioBtnOn",
                      style: { fontSize: 14, textAlign: "center" },
                  }
                : { iconName: "StatusCircleRing" },
            onClick: () => {
                if (item.hasRead) {
                    dispatch(markUnread(item))
                } else {
                    dispatch(markRead(item))
                }
            },
            split: true,
            subMenuProps: {
                items: [
                    {
                        key: "markBelow",
                        text: intl.get("article.markBelow"),
                        iconProps: {
                            iconName: "Down",
                            style: { fontSize: 14 },
                        },
                        onClick: () => {
                            dispatch(markAllRead(null, item.date))
                        },
                    },
                    {
                        key: "markAbove",
                        text: intl.get("article.markAbove"),
                        iconProps: {
                            iconName: "Up",
                            style: { fontSize: 14 },
                        },
                        onClick: () => {
                            dispatch(markAllRead(null, item.date, false))
                        },
                    },
                ],
            },
        },
        {
            key: "toggleStarred",
            text: item.starred
                ? intl.get("article.unstar")
                : intl.get("article.star"),
            iconProps: {
                iconName: item.starred ? "FavoriteStar" : "FavoriteStarFill",
            },
            onClick: () => {
                dispatch(toggleStarred(item))
            },
        },
        {
            key: "divider_1",
            itemType: ContextualMenuItemType.Divider,
        },
        {
            key: "share",
            text: intl.get("context.share"),
            iconProps: { iconName: "Share" },
            subMenuProps: {
                items: shareSubmenu(item),
            },
        },
        {
            key: "copyTitle",
            text: intl.get("context.copyTitle"),
            onClick: () => {
                window.utils.writeClipboard(item.title)
            },
        },
        {
            key: "copyURL",
            text: intl.get("context.copyURL"),
            onClick: () => {
                window.utils.writeClipboard(item.link)
            },
        },
        ...(viewConfigs !== undefined
            ? [
                  {
                      key: "divider_2",
                      itemType: ContextualMenuItemType.Divider,
                  },
                  {
                      key: "view",
                      text: intl.get("context.view"),
                      subMenuProps: {
                          items: [
                              {
                                  key: "showCover",
                                  text: intl.get("context.showCover"),
                                  canCheck: true,
                                  checked: Boolean(
                                      viewConfigs & ViewConfigs.ShowCover
                                  ),
                                  onClick: () =>
                                      dispatch(
                                          setViewConfigs(
                                              viewConfigs ^
                                                  ViewConfigs.ShowCover
                                          )
                                      ),
                              },
                              {
                                  key: "showSnippet",
                                  text: intl.get("context.showSnippet"),
                                  canCheck: true,
                                  checked: Boolean(
                                      viewConfigs & ViewConfigs.ShowSnippet
                                  ),
                                  onClick: () =>
                                      dispatch(
                                          setViewConfigs(
                                              viewConfigs ^
                                                  ViewConfigs.ShowSnippet
                                          )
                                      ),
                              },
                              {
                                  key: "fadeRead",
                                  text: intl.get("context.fadeRead"),
                                  canCheck: true,
                                  checked: Boolean(
                                      viewConfigs & ViewConfigs.FadeRead
                                  ),
                                  onClick: () =>
                                      dispatch(
                                          setViewConfigs(
                                              viewConfigs ^ ViewConfigs.FadeRead
                                          )
                                      ),
                              },
                          ],
                      },
                  },
              ]
            : []),
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function TextContextMenu() {
    const target = useAppSelector(state => state.app.contextMenu.target) as [
        string,
        string
    ]
    const text = target[0]
    const url = target[1]
    const menuItems: IContextualMenuItem[] = text
        ? [
              {
                  key: "copyText",
                  text: intl.get("context.copy"),
                  iconProps: { iconName: "Copy" },
                  onClick: () => {
                      window.utils.writeClipboard(text)
                  },
              },
              getSearchItem(text),
          ]
        : []
    if (url) {
        menuItems.push({
            key: "urlSection",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                topDivider: menuItems.length > 0,
                items: [
                    {
                        key: "openInBrowser",
                        text: intl.get("openExternal"),
                        iconProps: {
                            iconName: "NavigateExternalInline",
                        },
                        onClick: e => {
                            window.utils.openExternal(url, platformCtrl(e))
                        },
                    },
                    {
                        key: "copyURL",
                        text: intl.get("context.copyURL"),
                        iconProps: { iconName: "Link" },
                        onClick: () => {
                            window.utils.writeClipboard(url)
                        },
                    },
                ],
            },
        })
    }
    return <ContextMenuBase menuItems={menuItems} />
}

function ImageContextMenu() {
    const menuItems: IContextualMenuItem[] = [
        {
            key: "openInBrowser",
            text: intl.get("openExternal"),
            iconProps: { iconName: "NavigateExternalInline" },
            onClick: e => {
                if (platformCtrl(e)) {
                    window.utils.imageCallback(
                        ImageCallbackTypes.OpenExternalBg
                    )
                } else {
                    window.utils.imageCallback(ImageCallbackTypes.OpenExternal)
                }
            },
        },
        {
            key: "saveImageAs",
            text: intl.get("context.saveImageAs"),
            iconProps: { iconName: "SaveTemplate" },
            onClick: () => {
                window.utils.imageCallback(ImageCallbackTypes.SaveAs)
            },
        },
        {
            key: "copyImage",
            text: intl.get("context.copyImage"),
            iconProps: { iconName: "FileImage" },
            onClick: () => {
                window.utils.imageCallback(ImageCallbackTypes.Copy)
            },
        },
        {
            key: "copyImageURL",
            text: intl.get("context.copyImageURL"),
            iconProps: { iconName: "Link" },
            onClick: () => {
                window.utils.imageCallback(ImageCallbackTypes.CopyLink)
            },
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}


function GroupContextMenu() {
    const dispatch = useAppDispatch()
    const sids = useAppSelector(
        state => state.app.contextMenu.target
    ) as number[]
    const sources = useAppSelector(state => state.sources)

    const handleDeleteSource = () => {
        const sourcesToDelete = sids
            .map(sid => sources[sid])
            .filter(source => source !== undefined) as RSSSource[]
        
        if (sourcesToDelete.length === 1) {
            dispatch(deleteSource(sourcesToDelete[0])).then(() => {
                // 删除后关闭设置页面
                dispatch(toggleSettings(false))
            })
        } else if (sourcesToDelete.length > 1) {
            dispatch(deleteSources(sourcesToDelete)).then(() => {
                // 删除后关闭设置页面
                dispatch(toggleSettings(false))
            })
        }
        dispatch(closeContextMenu())
    }

    const handleRenameClick = () => {
        if (sids.length === 1) {
            const source = sources[sids[0]]
            if (source) {
                const newState = {
                    show: true,
                    sourceId: source.sid,
                    initialName: source.name,
                }
                globalRenameDialogState = newState
                if (globalRenameDialogUpdateCallback) {
                    globalRenameDialogUpdateCallback(newState)
                }
            }
        }
        dispatch(closeContextMenu())
    }

    const menuItems: IContextualMenuItem[] = []
    
    // 只在单个源时显示重命名选项
    if (sids.length === 1) {
        menuItems.push({
            key: "rename",
            text: intl.get("sources.editName"),
            iconProps: { iconName: "Edit" },
            onClick: handleRenameClick,
        })
    }
    
    menuItems.push({
        key: "delete",
        text: intl.get("sources.delete"),
        iconProps: { iconName: "Delete" },
        onClick: handleDeleteSource,
    })

    return <ContextMenuBase menuItems={menuItems} />
}

function MarkReadContextMenu() {
    const dispatch = useAppDispatch()

    const menuItems: IContextualMenuItem[] = [
        {
            key: "section_1",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: intl.get("nav.markAllRead"),
                items: [
                    {
                        key: "all",
                        text: intl.get("allArticles"),
                        iconProps: { iconName: "ReceiptCheck" },
                        onClick: () => {
                            dispatch(markAllRead())
                        },
                    },
                    {
                        key: "1d",
                        text: intl.get("app.daysAgo", { days: 1 }),
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 86400000)
                            dispatch(markAllRead(null, date))
                        },
                    },
                    {
                        key: "3d",
                        text: intl.get("app.daysAgo", { days: 3 }),
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 3 * 86400000)
                            dispatch(markAllRead(null, date))
                        },
                    },
                    {
                        key: "7d",
                        text: intl.get("app.daysAgo", { days: 7 }),
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 7 * 86400000)
                            dispatch(markAllRead(null, date))
                        },
                    },
                ],
            },
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function ContextMenuBase({
    menuItems,
}: Readonly<{ menuItems: IContextualMenuItem[] }>) {
    const { event, position } = useAppSelector(state => state.app.contextMenu)
    const dispatch = useAppDispatch()


    return (
        <ContextualMenu
            directionalHint={DirectionalHint.bottomLeftEdge}
            items={menuItems}
            target={
                event ||
                (position && {
                    left: position[0],
                    top: position[1],
                })
            }
            onDismiss={() => dispatch(closeContextMenu())}
        />
    )
}
