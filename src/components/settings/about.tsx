import * as React from "react"
import intl from "react-intl-universal"
import { Stack, Link } from "@fluentui/react"

class AboutTab extends React.Component {
    render = () => (
        <div className="tab-body">
            <Stack className="settings-about" horizontalAlign="center">
                <h3 style={{ fontWeight: 600 }}>Komorebi</h3>
                <small>
                    {intl.get("settings.version")} {window.utils.getVersion()}
                </small>
                <p className="settings-hint">
                    Copyright © 2025 Weifeng Wang<br />
                    Copyright © 2020 Haoyuan Liu<br />
                    All rights reserved.
                </p>
                <Stack
                    horizontal
                    horizontalAlign="center"
                    tokens={{ childrenGap: 12 }}>
                    <small>
                        <Link
                            onClick={() =>
                                window.utils.openExternal(
                                    "https://github.com/CircularRuins/Komorebi/wiki/Support#keyboard-shortcuts"
                                )
                            }>
                            {intl.get("settings.shortcuts")}
                        </Link>
                    </small>
                    <small>
                        <Link
                            onClick={() =>
                                window.utils.openExternal(
                                    "https://github.com/CircularRuins/Komorebi"
                                )
                            }>
                            {intl.get("settings.openSource")}
                        </Link>
                    </small>
                    <small>
                        <Link
                            onClick={() =>
                                window.utils.openExternal(
                                    "https://github.com/CircularRuins/Komorebi/issues"
                                )
                            }>
                            {intl.get("settings.feedback")}
                        </Link>
                    </small>
                </Stack>
            </Stack>
        </div>
    )
}

export default AboutTab
