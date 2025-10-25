import * as React from "react"
import { Icon } from "@fluentui/react/lib/Icon"

type AIModeProps = {
    // 可以添加需要的props
}

class AIMode extends React.Component<AIModeProps> {
    render() {
        return (
            <div className="ai-mode-container">
                <div className="ai-mode-header">
                    <Icon iconName="Robot" style={{ fontSize: 24, marginRight: 8 }} />
                    <h2>AI模式</h2>
                </div>
                <div className="ai-mode-content">
                    <div className="ai-mode-placeholder">
                        <Icon iconName="Robot" style={{ fontSize: 64, color: "#666" }} />
                        <p>AI功能即将推出</p>
                        <p className="ai-mode-description">
                            这里将提供智能文章推荐、内容摘要、关键词提取等AI功能
                        </p>
                    </div>
                </div>
            </div>
        )
    }
}

export default AIMode
