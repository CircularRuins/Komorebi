import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    DefaultButton,
    TextField,
    Stack,
    PrimaryButton,
    DetailsList,
    IColumn,
    SelectionMode,
    Selection,
    IDropdownOption,
    Dropdown,
    MessageBar,
    MessageBarType,
    Icon,
} from "@fluentui/react"
import {
    SourceState,
    RSSSource,
} from "../../scripts/models/source"
import { urlTest } from "../../scripts/utils"
import DangerButton from "../utils/danger-button"

type SourcesTabProps = {
    sources: SourceState
    serviceOn: boolean
    sids: number[]
    acknowledgeSIDs: () => void
    addSource: (url: string) => Promise<number>
    updateSourceName: (source: RSSSource, name: string) => void
    updateSourceIcon: (source: RSSSource, iconUrl: string) => Promise<void>
    clearSourceIcon: (source: RSSSource) => void
    deleteSource: (source: RSSSource) => void
    deleteSources: (sources: RSSSource[]) => void
    importOPML: () => void
    exportOPML: () => void
}

type SourcesTabState = {
    [formName: string]: string | RSSSource | RSSSource[] | boolean | null
} & {
    selectedSource: RSSSource
    selectedSources: RSSSource[]
    showSuccessMessage: boolean
    newUrl: string
    newSourceName: string
    newSourceIcon?: string
    sourceEditOption?: string
}

const enum EditDropdownKeys {
    Name = "n",
    Icon = "i",
    Url = "u",
}

class SourcesTab extends React.Component<SourcesTabProps, SourcesTabState> {
    selection: Selection

    constructor(props) {
        super(props)
        this.state = {
            newUrl: "",
            newSourceName: "",
            selectedSource: null,
            selectedSources: null,
            showSuccessMessage: false,
        }
        this.selection = new Selection({
            getKey: s => (s as RSSSource).sid,
            onSelectionChanged: () => {
                let count = this.selection.getSelectedCount()
                let sources = count
                    ? (this.selection.getSelection() as RSSSource[])
                    : null
                this.setState({
                    selectedSource: count === 1 ? sources[0] : null,
                    selectedSources: count > 1 ? sources : null,
                    newSourceName: count === 1 ? sources[0].name : "",
                    newSourceIcon: count === 1 ? sources[0].iconurl || "" : "",
                    sourceEditOption: EditDropdownKeys.Name,
                })
            },
        })
    }

    componentDidMount = () => {
        if (this.props.sids.length > 0) {
            for (let sid of this.props.sids) {
                this.selection.setKeySelected(String(sid), true, false)
            }
            this.props.acknowledgeSIDs()
        }
    }


    columns = (): IColumn[] => [
        {
            key: "favicon",
            name: intl.get("icon"),
            fieldName: "name",
            isIconOnly: true,
            iconName: "ImagePixel",
            minWidth: 16,
            maxWidth: 16,
            onRender: (s: RSSSource) =>
                s.iconurl && (
                    <img
                        src={s.iconurl}
                        className="favicon"
                        onError={() => {
                            // 图标加载失败时，清除iconurl
                            this.props.clearSourceIcon(s)
                        }}
                    />
                ),
        },
        {
            key: "name",
            name: intl.get("name"),
            fieldName: "name",
            minWidth: 200,
            data: "string",
            isRowHeader: true,
        },
        {
            key: "url",
            name: "URL",
            fieldName: "url",
            minWidth: 280,
            data: "string",
        },
    ]

    sourceEditOptions = (): IDropdownOption[] => [
        { key: EditDropdownKeys.Name, text: intl.get("name") },
        { key: EditDropdownKeys.Icon, text: intl.get("icon") },
        { key: EditDropdownKeys.Url, text: "URL" },
    ]

    onSourceEditOptionChange = (_, option: IDropdownOption) => {
        this.setState({ sourceEditOption: option.key as string })
    }



    updateSourceName = () => {
        let newName = this.state.newSourceName.trim()
        this.props.updateSourceName(this.state.selectedSource, newName)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                name: newName,
            } as RSSSource,
        })
    }

    updateSourceIcon = () => {
        let newIcon = this.state.newSourceIcon.trim()
        this.props.updateSourceIcon(this.state.selectedSource, newIcon)
        this.setState({
            selectedSource: { ...this.state.selectedSource, iconurl: newIcon },
        })
    }

    handleInputChange = event => {
        const name: string = event.target.name
        this.setState({ [name]: event.target.value })
    }

    addSource = async (event: React.FormEvent) => {
        event.preventDefault()
        let trimmed = this.state.newUrl.trim()
        if (urlTest(trimmed)) {
            try {
                await this.props.addSource(trimmed)
                // 添加成功，显示提示并清空输入框
                this.setState({
                    newUrl: "",
                    showSuccessMessage: true,
                })
            } catch (e) {
                // 错误已经在 addSource 中处理了，这里不需要额外处理
            }
        }
    }



    render = () => (
        <div className="tab-body">
            {this.props.serviceOn && (
                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("sources.serviceWarning")}
                </MessageBar>
            )}
            {/* 成功提示弹窗 */}
            {this.state.showSuccessMessage && (
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
                    onClick={() => this.setState({ showSuccessMessage: false })}>
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
                    {/* 弹窗内容 */}
                    <div
                        style={{
                            position: 'relative',
                            backgroundColor: 'var(--white)',
                            borderRadius: '8px',
                            padding: '24px 28px',
                            minWidth: '280px',
                            maxWidth: '90%',
                            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '16px',
                            border: '1px solid var(--neutralLight)',
                            animation: 'fadeInScale 0.3s ease-out',
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        {/* 成功图标 */}
                        <div
                            style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '50%',
                                backgroundColor: '#e8f5e9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
                            }}>
                            <Icon
                                iconName="CheckMark"
                                styles={{
                                    root: {
                                        fontSize: '32px',
                                        color: '#2e7d32',
                                        fontWeight: 600,
                                    },
                                }}
                            />
                        </div>
                        {/* 提示文字 */}
                        <div
                            style={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: 'var(--neutralPrimary)',
                                textAlign: 'center',
                                lineHeight: '1.4',
                            }}>
                            {intl.get("sources.successAdd")}
                        </div>
                        {/* 确认按钮 */}
                        <PrimaryButton
                            text={intl.get("confirm")}
                            onClick={() => this.setState({ showSuccessMessage: false })}
                            styles={{
                                root: {
                                    minWidth: '100px',
                                    height: '32px',
                                    borderRadius: '4px',
                                },
                            }}
                        />
                    </div>
                </div>
            )}
            <Label>{intl.get("sources.opmlFile")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <PrimaryButton
                        onClick={this.props.importOPML}
                        text={intl.get("sources.import")}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.props.exportOPML}
                        text={intl.get("sources.export")}
                    />
                </Stack.Item>
            </Stack>

            <form onSubmit={this.addSource}>
                <Label htmlFor="newUrl">{intl.get("sources.add")}</Label>
                <Stack horizontal>
                    <Stack.Item grow>
                        <TextField
                            onGetErrorMessage={v => {
                                const trimmed = v.trim()
                                // 空字符串不显示错误（允许清空）
                                if (trimmed === "") return ""
                                return urlTest(trimmed)
                                    ? ""
                                    : intl.get("sources.badUrl")
                            }}
                            validateOnLoad={false}
                            placeholder={intl.get("sources.inputUrl")}
                            value={this.state.newUrl}
                            id="newUrl"
                            name="newUrl"
                            onChange={this.handleInputChange}
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            disabled={!urlTest(this.state.newUrl.trim())}
                            type="submit"
                            text={intl.get("add")}
                        />
                    </Stack.Item>
                </Stack>
            </form>

            <DetailsList
                compact={Object.keys(this.props.sources).length >= 10}
                items={Object.values(this.props.sources)}
                columns={this.columns()}
                getKey={s => s.sid}
                setKey="selected"
                selection={this.selection}
                selectionMode={SelectionMode.multiple}
            />

            {this.state.selectedSource && (
                <>
                    {this.state.selectedSource.serviceRef && (
                        <MessageBar messageBarType={MessageBarType.info}>
                            {intl.get("sources.serviceManaged")}
                        </MessageBar>
                    )}
                    <Label>{intl.get("sources.selected")}</Label>
                    <Stack horizontal>
                        <Stack.Item>
                            <Dropdown
                                options={this.sourceEditOptions()}
                                selectedKey={this.state.sourceEditOption}
                                onChange={this.onSourceEditOptionChange}
                                style={{ width: 120 }}
                            />
                        </Stack.Item>
                        {this.state.sourceEditOption ===
                            EditDropdownKeys.Name && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        onGetErrorMessage={v =>
                                            v.trim().length == 0
                                                ? intl.get("emptyName")
                                                : ""
                                        }
                                        validateOnLoad={false}
                                        placeholder={intl.get("sources.name")}
                                        value={this.state.newSourceName}
                                        name="newSourceName"
                                        onChange={this.handleInputChange}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        disabled={
                                            this.state.newSourceName.trim()
                                                .length == 0
                                        }
                                        onClick={this.updateSourceName}
                                        text={intl.get("sources.editName")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                        {this.state.sourceEditOption ===
                            EditDropdownKeys.Icon && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        onGetErrorMessage={v =>
                                            urlTest(v.trim())
                                                ? ""
                                                : intl.get("sources.badUrl")
                                        }
                                        validateOnLoad={false}
                                        placeholder={intl.get(
                                            "sources.inputUrl"
                                        )}
                                        value={this.state.newSourceIcon}
                                        name="newSourceIcon"
                                        onChange={this.handleInputChange}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        disabled={
                                            !urlTest(
                                                this.state.newSourceIcon.trim()
                                            )
                                        }
                                        onClick={this.updateSourceIcon}
                                        text={intl.get("edit")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                        {this.state.sourceEditOption ===
                            EditDropdownKeys.Url && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        disabled
                                        value={this.state.selectedSource.url}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        onClick={() =>
                                            window.utils.writeClipboard(
                                                this.state.selectedSource.url
                                            )
                                        }
                                        text={intl.get("context.copy")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                    </Stack>
                    {!this.state.selectedSource.serviceRef && (
                        <Stack horizontal>
                            <Stack.Item>
                                <DangerButton
                                    onClick={() =>
                                        this.props.deleteSource(
                                            this.state.selectedSource
                                        )
                                    }
                                    key={this.state.selectedSource.sid}
                                    text={intl.get("sources.delete")}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <span className="settings-hint">
                                    {intl.get("sources.deleteWarning")}
                                </span>
                            </Stack.Item>
                        </Stack>
                    )}
                </>
            )}
            {this.state.selectedSources &&
                (this.state.selectedSources.filter(s => s.serviceRef).length ===
                0 ? (
                    <>
                        <Label>{intl.get("sources.selectedMulti")}</Label>
                        <Stack horizontal>
                            <Stack.Item>
                                <DangerButton
                                    onClick={() =>
                                        this.props.deleteSources(
                                            this.state.selectedSources
                                        )
                                    }
                                    text={intl.get("sources.delete")}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <span className="settings-hint">
                                    {intl.get("sources.deleteWarning")}
                                </span>
                            </Stack.Item>
                        </Stack>
                    </>
                ) : (
                    <MessageBar messageBarType={MessageBarType.info}>
                        {intl.get("sources.serviceManaged")}
                    </MessageBar>
                ))}
        </div>
    )
}

export default SourcesTab
