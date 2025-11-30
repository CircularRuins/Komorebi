import * as React from "react"
import intl from "react-intl-universal"
import {
    urlTest,
    byteToMB,
    calculateItemSize,
} from "../../scripts/utils"
import {
    exportAll,
} from "../../scripts/settings"
import {
    Stack,
    Label,
    Toggle,
    TextField,
    DefaultButton,
    Dropdown,
    IDropdownOption,
    PrimaryButton,
    ProgressIndicator,
} from "@fluentui/react"
import DangerButton from "../utils/danger-button"

type AppTabProps = {
    setLanguage: (option: string) => void
    setFetchInterval: (interval: number) => void
    deleteArticles: (days: number) => Promise<void>
    importAll: () => Promise<void>
    importOPML: (onError?: (title: string, content: string) => void) => void
    exportOPML: () => void
    isOPMLImport: boolean
    fetchingItems: boolean
    fetchingTotal: number
    fetchingProgress: number
}

type AppTabState = {
    pacStatus: boolean
    pacUrl: string
    itemSize: string
    cacheSize: string
    deleteIndex: string
    showImportErrorDialog: boolean
    importErrorTitle: string
    importErrorContent: string
}

class AppTab extends React.Component<AppTabProps, AppTabState> {
    constructor(props) {
        super(props)
        this.state = {
            pacStatus: window.settings.getProxyStatus(),
            pacUrl: window.settings.getProxy(),
            itemSize: null,
            cacheSize: null,
            deleteIndex: null,
            showImportErrorDialog: false,
            importErrorTitle: "",
            importErrorContent: "",
        }
        this.getItemSize()
        this.getCacheSize()
    }

    getCacheSize = () => {
        window.utils.getCacheSize().then(size => {
            this.setState({ cacheSize: byteToMB(size) })
        })
    }
    getItemSize = async () => {
        // 如果数据库还没初始化，等待一下再重试
        const db = await import("../../scripts/db")
        if (!db.itemsDB || !db.items) {
            console.log("等待数据库初始化...")
            // 等待最多5秒
            for (let i = 0; i < 50; i++) {
                await new Promise(resolve => setTimeout(resolve, 100))
                if (db.itemsDB && db.items) {
                    break
                }
            }
        }
        
        calculateItemSize()
            .then(size => {
                this.setState({ itemSize: byteToMB(size) })
            })
            .catch(error => {
                console.error("获取文章大小失败:", error)
                this.setState({ itemSize: "0MB" })
            })
    }

    clearCache = () => {
        window.utils.clearCache().then(() => {
            this.getCacheSize()
        })
    }

    fetchIntervalOptions = (): IDropdownOption[] => [
        { key: 0, text: intl.get("app.never") },
        { key: 10, text: intl.get("time.minute", { m: 10 }) },
        { key: 15, text: intl.get("time.minute", { m: 15 }) },
        { key: 20, text: intl.get("time.minute", { m: 20 }) },
        { key: 30, text: intl.get("time.minute", { m: 30 }) },
        { key: 45, text: intl.get("time.minute", { m: 45 }) },
        { key: 60, text: intl.get("time.hour", { h: 1 }) },
    ]
    onFetchIntervalChanged = (item: IDropdownOption) => {
        this.props.setFetchInterval(item.key as number)
    }

    deleteOptions = (): IDropdownOption[] => [
        { key: "7", text: intl.get("app.daysAgo", { days: 7 }) },
        { key: "14", text: intl.get("app.daysAgo", { days: 14 }) },
        { key: "21", text: intl.get("app.daysAgo", { days: 21 }) },
        { key: "28", text: intl.get("app.daysAgo", { days: 28 }) },
        { key: "0", text: intl.get("app.deleteAll") },
    ]

    deleteChange = (_, item: IDropdownOption) => {
        this.setState({ deleteIndex: item ? String(item.key) : null })
    }

    confirmDelete = () => {
        this.setState({ itemSize: null })
        this.props
            .deleteArticles(parseInt(this.state.deleteIndex))
            .then(() => this.getItemSize())
    }

    languageOptions = (): IDropdownOption[] => [
        { key: "default", text: intl.get("followSystem") },
        { key: "de", text: "Deutsch" },
        { key: "en-US", text: "English" },
        { key: "es", text: "Español" },
        { key: "cs", text: "Čeština" },
        { key: "fr-FR", text: "Français" },
        { key: "it", text: "Italiano" },
        { key: "nl", text: "Nederlands" },
        { key: "pt-BR", text: "Português do Brasil" },
        { key: "pt-PT", text: "Português de Portugal" },
        { key: "fi-FI", text: "Suomi" },
        { key: "sv", text: "Svenska" },
        { key: "tr", text: "Türkçe" },
        { key: "uk", text: "Українська" },
        { key: "ru", text: "Русский" },
        { key: "ko", text: "한글" },
        { key: "ja", text: "日本語" },
        { key: "zh-CN", text: "中文（简体）" },
        { key: "zh-TW", text: "中文（繁體）" },
    ]

    toggleStatus = () => {
        window.settings.toggleProxyStatus()
        this.setState({
            pacStatus: window.settings.getProxyStatus(),
            pacUrl: window.settings.getProxy(),
        })
    }

    handleInputChange = event => {
        const name: string = event.target.name
        // @ts-ignore
        this.setState({ [name]: event.target.value.trim() })
    }

    setUrl = (event: React.FormEvent) => {
        event.preventDefault()
        if (urlTest(this.state.pacUrl))
            window.settings.setProxy(this.state.pacUrl)
    }

    handleImportError = (title: string, content: string) => {
        this.setState({
            showImportErrorDialog: true,
            importErrorTitle: title,
            importErrorContent: content,
        })
    }

    handleCloseImportErrorDialog = () => {
        this.setState({
            showImportErrorDialog: false,
            importErrorTitle: "",
            importErrorContent: "",
        })
    }

    handleCopyImportError = () => {
        const text = `${this.state.importErrorTitle}: ${this.state.importErrorContent}`
        window.utils.writeClipboard(text)
    }

    render = () => (
        <div className="tab-body" style={{ position: 'relative' }}>
            <Label>{intl.get("app.language")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <Dropdown
                        defaultSelectedKey={window.settings.getLocaleSettings()}
                        options={this.languageOptions()}
                        onChanged={option =>
                            this.props.setLanguage(String(option.key))
                        }
                        style={{ width: 200 }}
                    />
                </Stack.Item>
            </Stack>

            <Label>{intl.get("app.fetchInterval")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <Dropdown
                        defaultSelectedKey={window.settings.getFetchInterval()}
                        options={this.fetchIntervalOptions()}
                        onChanged={this.onFetchIntervalChanged}
                        style={{ width: 200 }}
                    />
                </Stack.Item>
            </Stack>

            <Stack horizontal verticalAlign="baseline">
                <Stack.Item grow>
                    <Label>{intl.get("app.enableProxy")}</Label>
                </Stack.Item>
                <Stack.Item>
                    <Toggle
                        checked={this.state.pacStatus}
                        onChange={this.toggleStatus}
                    />
                </Stack.Item>
            </Stack>
            {this.state.pacStatus && (
                <form onSubmit={this.setUrl}>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                required
                                onGetErrorMessage={v =>
                                    urlTest(v.trim())
                                        ? ""
                                        : intl.get("app.badUrl")
                                }
                                placeholder={intl.get("app.pac")}
                                name="pacUrl"
                                onChange={this.handleInputChange}
                                value={this.state.pacUrl}
                            />
                        </Stack.Item>
                        <Stack.Item>
                            <DefaultButton
                                disabled={!urlTest(this.state.pacUrl)}
                                type="sumbit"
                                text={intl.get("app.setPac")}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up">
                        {intl.get("app.pacHint")}
                    </span>
                </form>
            )}

            <Label>{intl.get("app.cleanup")}</Label>
            <Stack horizontal>
                <Stack.Item grow>
                    <Dropdown
                        placeholder={intl.get("app.deleteChoices")}
                        options={this.deleteOptions()}
                        selectedKey={this.state.deleteIndex}
                        onChange={this.deleteChange}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DangerButton
                        disabled={
                            this.state.itemSize === null ||
                            this.state.deleteIndex === null
                        }
                        text={intl.get("app.confirmDelete")}
                        onClick={this.confirmDelete}
                    />
                </Stack.Item>
            </Stack>
            <span className="settings-hint up">
                {this.state.itemSize
                    ? intl.get("app.itemSize", { size: this.state.itemSize })
                    : intl.get("app.calculatingSize")}
            </span>
            <Stack horizontal>
                <Stack.Item>
                    <DefaultButton
                        text={intl.get("app.cache")}
                        disabled={
                            this.state.cacheSize === null ||
                            this.state.cacheSize === "0MB"
                        }
                        onClick={this.clearCache}
                    />
                </Stack.Item>
            </Stack>
            <span className="settings-hint up">
                {this.state.cacheSize
                    ? intl.get("app.cacheSize", { size: this.state.cacheSize })
                    : intl.get("app.calculatingSize")}
            </span>

            <Label>{intl.get("app.data")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <PrimaryButton
                        onClick={exportAll}
                        text={intl.get("app.backup")}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.props.importAll}
                        text={intl.get("app.restore")}
                    />
                </Stack.Item>
            </Stack>

            <Label styles={{ root: { fontSize: '14px', fontWeight: 600, marginTop: '32px' } }}>{intl.get("sources.opmlFile")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <PrimaryButton
                        onClick={() => this.props.importOPML(this.handleImportError)}
                        text={intl.get("sources.import")}
                        styles={{
                            root: {
                                height: '28px',
                                minWidth: '80px',
                                fontSize: '13px',
                            },
                        }}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.props.exportOPML}
                        text={intl.get("sources.export")}
                        styles={{
                            root: {
                                height: '28px',
                                minWidth: '80px',
                                fontSize: '13px',
                            },
                        }}
                    />
                </Stack.Item>
            </Stack>
            {this.props.isOPMLImport && this.props.fetchingItems && this.props.fetchingTotal > 0 && (
                <div style={{ marginTop: '12px' }}>
                    <ProgressIndicator
                        percentComplete={this.props.fetchingProgress / this.props.fetchingTotal}
                    />
                </div>
            )}

            {/* OPML导入错误对话框 */}
            {this.state.showImportErrorDialog && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                    }}
                    onClick={this.handleCloseImportErrorDialog}>
                    {/* 对话框内容 */}
                    <div
                        style={{
                            position: 'relative',
                            backgroundColor: 'var(--white)',
                            borderRadius: '4px',
                            padding: '20px',
                            maxWidth: '400px',
                            width: '85%',
                            boxShadow: '0 6.4px 14.4px rgba(0, 0, 0, 0.132), 0 1.2px 3.6px rgba(0, 0, 0, 0.108)',
                            maxHeight: '80%',
                            overflow: 'auto',
                            pointerEvents: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        {/* 标题 */}
                        <div style={{ marginBottom: '12px' }}>
                            <h2 style={{ 
                                margin: 0, 
                                fontSize: '18px', 
                                fontWeight: 600, 
                                color: 'var(--neutralPrimary)' 
                            }}>
                                {this.state.importErrorTitle}
                            </h2>
                        </div>
                        {/* 错误内容区域 */}
                        <div style={{ 
                            marginBottom: '16px', 
                            color: 'var(--neutralPrimary)', 
                            fontSize: '13px', 
                            whiteSpace: 'pre-wrap',
                            lineHeight: '1.5',
                        }}>
                            {this.state.importErrorContent}
                        </div>
                        {/* 按钮区域 */}
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'flex-end',
                            gap: '8px',
                        }}>
                            <DefaultButton 
                                onClick={this.handleCopyImportError} 
                                text={intl.get("context.copy")} 
                            />
                            <DefaultButton 
                                onClick={this.handleCloseImportErrorDialog} 
                                text={intl.get("confirm")} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AppTab
