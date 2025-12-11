import * as React from "react"
import intl from "react-intl-universal"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { SmartSearchContext } from "./smart-search"

// 独立的菜单内容组件，使用 Context 订阅状态
export const SmartSearchMenuContent: React.FC = () => {
    const context = React.useContext(SmartSearchContext)
    
    if (!context) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neutralSecondary)' }}>
                {intl.get("settings.aiMode.menu.loading")}
            </div>
        )
    }

    const {
        topic,
        topicInput,
        isLoading,
        isClustering,
        filteredArticles,
        queryProgress,
        handleGenerateSummary,
        handleClearSummary
    } = context

    return (
        <>
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', marginTop: '8px', marginBottom: '8px' }}>
                {(() => {
                    // 检查流程是否结束：有 queryProgress 且所有可见步骤都完成
                    const isCompleted = queryProgress && (() => {
                        const visibleSteps = queryProgress.steps.filter(step => step.visible !== false)
                        const hasInProgress = visibleSteps.some(step => step.status === 'in_progress')
                        const allVisibleCompleted = visibleSteps.length > 0 && visibleSteps.every(step => step.status === 'completed' || step.status === 'error')
                        return !hasInProgress && allVisibleCompleted
                    })()
                    
                    return (
                        <>
                            {/* 流程未结束或正在加载/聚类时，显示整理汇总按钮；流程结束后（无论是否有结果）且不在加载中时，隐藏它 */}
                            {(!isCompleted || isLoading || isClustering) && (
                                <PrimaryButton
                                    iconProps={{ iconName: 'Search' }}
                                    text={intl.get("settings.aiMode.menu.generate")}
                                    onClick={handleGenerateSummary}
                                    disabled={isLoading || isClustering || !topic.trim() && !topicInput.trim()}
                                    styles={{ root: { width: '100%' } }}
                                />
                            )}
                            
                            {/* 只要流程结束（有 queryProgress 且所有步骤完成），无论是否有结果，都显示清空按钮 */}
                            {(isCompleted || (filteredArticles && filteredArticles.length > 0)) && !isLoading && !isClustering && (
                                <DefaultButton
                                    iconProps={{ iconName: 'Clear' }}
                                    text={intl.get("settings.aiMode.menu.clear")}
                                    onClick={handleClearSummary}
                                    disabled={isLoading || isClustering}
                                    styles={{ root: { width: '100%' } }}
                                />
                            )}
                        </>
                    )
                })()}
            </div>
        </>
    )
}

