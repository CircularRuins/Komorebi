import * as React from "react"
import intl from "react-intl-universal"
import {
    Stack,
    CommandBarButton,
    FocusZone,
    TooltipHost,
    TooltipDelay,
    Icon,
} from "@fluentui/react"
import { platformCtrl } from "../scripts/utils"

type AlphaXivProps = {
    dismiss: () => void
}

type AlphaXivState = {
    error: boolean
    errorDescription: string
    showCopySuccess: boolean
}

class AlphaXiv extends React.Component<AlphaXivProps, AlphaXivState> {
    webview: Electron.WebviewTag

    constructor(props: AlphaXivProps) {
        super(props)
        this.state = {
            error: false,
            errorDescription: "",
            showCopySuccess: false,
        }
        window.utils.addWebviewErrorListener(this.webviewError)
    }

    webviewError = (desc: string) => {
        this.setState({
            error: true,
            errorDescription: desc,
        })
    }

    componentDidMount = () => {
        let webview = document.getElementById("alphaxiv") as Electron.WebviewTag
        if (webview != this.webview) {
            this.webview = webview
            if (webview) {
                webview.focus()
                this.setState({ error: false })
            }
        }
    }

    webviewReload = () => {
        if (this.webview) {
            this.webview.reload()
            this.setState({
                error: false,
                errorDescription: "",
            })
        }
    }

    render() {
        const ALPHAXIV_URL = "https://www.alphaxiv.org/"
        
        return (
            <FocusZone className="article">
                <Stack horizontal style={{ height: 48, paddingTop: 12 }}>
                    <span style={{ width: 96 }}></span>
                    <Stack
                        className="actions"
                        grow
                        horizontal
                        tokens={{ childrenGap: 12 }}>
                        <Stack.Item grow>
                            <span className="source-name">
                                alphaXiv
                            </span>
                        </Stack.Item>
                        <TooltipHost
                            content={intl.get("openExternal")}
                            delay={TooltipDelay.zero}>
                            <CommandBarButton
                                iconProps={{
                                    iconName: "NavigateExternalInline",
                                    style: { fontSize: 16, lineHeight: 1 },
                                }}
                                onClick={e => {
                                    window.utils.openExternal(
                                        ALPHAXIV_URL,
                                        platformCtrl(e.nativeEvent)
                                    )
                                }}
                                styles={{
                                    root: {
                                        minWidth: 40,
                                        height: 32,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    },
                                    icon: {
                                        fontSize: 16,
                                        lineHeight: 1,
                                        marginTop: "-3px",
                                    },
                                }}
                            />
                        </TooltipHost>
                        <TooltipHost
                            content={intl.get("context.copyURL")}
                            delay={TooltipDelay.zero}>
                            <CommandBarButton
                                iconProps={{
                                    iconName: "Link",
                                    style: { fontSize: 16 },
                                }}
                                onClick={() => {
                                    window.utils.writeClipboard(ALPHAXIV_URL)
                                    this.setState({ showCopySuccess: true })
                                    setTimeout(() => {
                                        this.setState({ showCopySuccess: false })
                                    }, 1200)
                                }}
                                styles={{
                                    root: {
                                        minWidth: 40,
                                        height: 32,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    },
                                    icon: {
                                        fontSize: 16,
                                    },
                                }}
                            />
                        </TooltipHost>
                        <TooltipHost
                            content={intl.get("close")}
                            delay={TooltipDelay.zero}>
                            <CommandBarButton
                                iconProps={{
                                    iconName: "Cancel",
                                    style: { fontSize: 16 },
                                }}
                                onClick={this.props.dismiss}
                                styles={{
                                    root: {
                                        minWidth: 40,
                                        height: 32,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    },
                                    icon: {
                                        fontSize: 16,
                                    },
                                }}
                            />
                        </TooltipHost>
                    </Stack>
                    <Stack horizontal horizontalAlign="end" style={{ width: 112 }}>
                        <CommandBarButton
                            title={intl.get("close")}
                            iconProps={{
                                iconName: "BackToWindow",
                                style: { fontSize: 16 },
                            }}
                            onClick={this.props.dismiss}
                            styles={{
                                root: {
                                    minWidth: 40,
                                    height: 32,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    visibility: "hidden",
                                    pointerEvents: "none",
                                },
                                icon: {
                                    fontSize: 16,
                                },
                            }}
                        />
                    </Stack>
                </Stack>
                <div
                    style={{
                        width: "100%",
                        height: "calc(100% - 48px)",
                        position: "relative",
                    }}>
                    {!this.state.error && (
                        <webview
                            id="alphaxiv"
                            src={ALPHAXIV_URL}
                            allowpopups={"true" as unknown as boolean}
                            webpreferences="contextIsolation,disableDialogs,autoplayPolicy=document-user-activation-required"
                            partition="sandbox"
                            style={{
                                width: "100%",
                                height: "100%",
                            }}
                        />
                    )}
                    {this.state.error && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                gap: "12px",
                            }}>
                            <span>加载错误</span>
                            <button onClick={this.webviewReload}>重新加载</button>
                            <small>{this.state.errorDescription}</small>
                        </div>
                    )}
                </div>
                <Stack
                    style={{
                        position: "fixed",
                        top: "60px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 10000,
                        backgroundColor: "var(--neutralDark)",
                        color: "var(--white)",
                        padding: "8px 16px",
                        borderRadius: "4px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                        opacity: this.state.showCopySuccess ? 1 : 0,
                        pointerEvents: this.state.showCopySuccess ? "auto" : "none",
                        transition: "opacity 0.2s ease-out",
                    }}
                    horizontal
                    tokens={{ childrenGap: 8 }}
                    verticalAlign="center"
                    horizontalAlign="center">
                    <Icon iconName="CheckMark" style={{ fontSize: 16 }} />
                    <span style={{ fontSize: 13 }}>
                        {intl.get("context.copyURL")} 已复制
                    </span>
                </Stack>
            </FocusZone>
        )
    }
}

export default AlphaXiv

