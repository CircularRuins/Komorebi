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
    MessageBar,
    MessageBarType,
    Icon,
} from "@fluentui/react"
import {
    SourceState,
    RSSSource,
} from "../../scripts/models/source"
import { urlTest } from "../../scripts/utils"

type SourcesTabProps = {
    sources: SourceState
    serviceOn: boolean
    addSource: (url: string) => Promise<number>
    clearSourceIcon: (source: RSSSource) => void
    importOPML: (onError?: (title: string, content: string) => void) => void
    exportOPML: () => void
}

type SourcesTabState = {
    [formName: string]: string | boolean | null
} & {
    showSuccessMessage: boolean
    showImportErrorDialog: boolean
    importErrorTitle: string
    importErrorContent: string
    newUrl: string
}

class SourcesTab extends React.Component<SourcesTabProps, SourcesTabState> {
    constructor(props) {
        super(props)
        this.state = {
            newUrl: "",
            showSuccessMessage: false,
            showImportErrorDialog: false,
            importErrorTitle: "",
            importErrorContent: "",
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


    handleInputChange = event => {
        const name: string = event.target.name
        this.setState({ [name]: event.target.value })
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
                        onClick={() => this.props.importOPML(this.handleImportError)}
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
            />
            {/* OPML导入错误对话框 */}
            {this.state.showImportErrorDialog && (
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
                    onClick={this.handleCloseImportErrorDialog}>
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
                            maxWidth: '600px',
                            width: '90%',
                            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1)',
                            maxHeight: '70vh',
                            display: 'flex',
                            flexDirection: 'column',
                            border: '1px solid var(--neutralLight)',
                            animation: 'fadeInScale 0.3s ease-out',
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        {/* 错误图标和标题 */}
                        <div style={{ 
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            marginBottom: '20px',
                            gap: '12px',
                        }}>
                            <div
                                style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '50%',
                                    backgroundColor: '#fef6f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                <Icon
                                    iconName="Error"
                                    styles={{
                                        root: {
                                            fontSize: '32px',
                                            color: '#d13438',
                                            fontWeight: 600,
                                        },
                                    }}
                                />
                            </div>
                            <h2 style={{ 
                                margin: 0, 
                                fontSize: '21px', 
                                fontWeight: 600, 
                                color: 'var(--white)',
                                textAlign: 'center',
                            }}>
                                {this.state.importErrorTitle}
                            </h2>
                        </div>
                        {/* 错误内容区域 - 可滚动 */}
                        <div style={{ 
                            marginBottom: '24px', 
                            color: 'var(--neutralPrimary)', 
                            fontSize: '14px', 
                            whiteSpace: 'pre-wrap',
                            overflowY: 'auto',
                            maxHeight: '400px',
                            padding: '16px',
                            backgroundColor: 'var(--neutralLighter)',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            lineHeight: '1.5',
                            border: '1px solid var(--neutralQuaternaryAlt)',
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
                            <PrimaryButton 
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

export default SourcesTab
