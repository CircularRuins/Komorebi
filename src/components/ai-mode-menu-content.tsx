import * as React from "react"
import { TextField } from "@fluentui/react/lib/TextField"
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown"
import { Label } from "@fluentui/react/lib/Label"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Icon } from "@fluentui/react/lib/Icon"
import { AIModeContext } from "./ai-mode"

// 独立的菜单内容组件，使用 Context 订阅状态
export const AIModeMenuContent: React.FC = () => {
    const context = React.useContext(AIModeContext)
    
    if (!context) {
        return (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neutralSecondary)' }}>
                AI模式菜单加载中...
            </div>
        )
    }

    const {
        timeRange,
        topic,
        topicInput,
        recentTopics,
        isLoading,
        filteredArticles,
        handleTimeRangeChange,
        handleTopicInputChange,
        handleTopicInputKeyDown,
        handleTopicInputCompositionStart,
        handleTopicInputCompositionEnd,
        handleGenerateSummary,
        handleClearSummary,
        handleRecentTopicClick,
        topicInputRef,
        isComposing
    } = context

    const getTimeRangeOptions = (): IDropdownOption[] => {
        return [
            { key: '1', text: '1日内' },
            { key: '3', text: '3日内' },
            { key: '7', text: '1周内' },
            { key: '30', text: '1月内' }
        ]
    }

    return (
        <>
            <div style={{ marginBottom: '8px' }}>
                <Label style={{ fontSize: '14px', fontWeight: 600 }}>文章发布时间（必选）</Label>
                <Dropdown
                    placeholder="选择时间范围"
                    selectedKey={timeRange}
                    options={getTimeRangeOptions()}
                    onChange={handleTimeRangeChange}
                    styles={{ root: { width: '100%', marginTop: '4px' } }}
                    disabled={isLoading}
                    required={true}
                />
                <Label styles={{ root: { fontSize: '11px', color: 'var(--neutralSecondary)', marginTop: '4px', fontWeight: 'normal' } }}>
                    根据文章发布时间筛选。必须选择一个时间范围。
                </Label>
            </div>

            <div style={{ marginBottom: '8px' }}>
                <Label style={{ fontSize: '14px', fontWeight: 600 }}>话题</Label>
                <TextField
                    componentRef={topicInputRef}
                    value={topicInput}
                    onChange={handleTopicInputChange}
                    onKeyDown={handleTopicInputKeyDown}
                    onCompositionStart={handleTopicInputCompositionStart}
                    onCompositionEnd={handleTopicInputCompositionEnd}
                    placeholder="输入话题关键词..."
                    styles={{
                        root: { width: '100%', marginTop: '4px' },
                        fieldGroup: { 
                            borderRadius: '4px',
                            border: '1px solid var(--neutralLight)'
                        },
                        field: { 
                            fontSize: '12px',
                            padding: '4px 8px'
                        }
                    }}
                    disabled={isLoading}
                />
                <Label styles={{ root: { fontSize: '11px', color: 'var(--neutralSecondary)', marginTop: '4px', fontWeight: 'normal' } }}>
                    输入话题关键词，按Enter确认。将搜索文章标题和内容中的匹配文本。
                </Label>
                
                {/* 常选话题 */}
                {recentTopics && recentTopics.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                        <Label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--neutralSecondary)', marginBottom: '4px' }}>
                            常选话题
                        </Label>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginTop: '4px'
                        }}>
                            {recentTopics.map((recentTopic, index) => (
                                <div
                                    key={index}
                                    onClick={() => !isLoading && handleRecentTopicClick(recentTopic)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        backgroundColor: 'var(--neutralLighter)',
                                        color: 'var(--neutralPrimary)',
                                        borderRadius: '4px',
                                        padding: '4px 10px',
                                        fontSize: '12px',
                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                        border: '1px solid var(--neutralLight)',
                                        transition: 'all 0.2s ease',
                                        opacity: isLoading ? 0.6 : 1
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isLoading) {
                                            e.currentTarget.style.backgroundColor = 'var(--neutralLight)'
                                            e.currentTarget.style.borderColor = 'var(--neutralTertiary)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isLoading) {
                                            e.currentTarget.style.backgroundColor = 'var(--neutralLighter)'
                                            e.currentTarget.style.borderColor = 'var(--neutralLight)'
                                        }
                                    }}
                                >
                                    <span>{recentTopic}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', marginTop: '8px' }}>
                <PrimaryButton
                    iconProps={{ iconName: 'Search' }}
                    text="查询文章"
                    onClick={handleGenerateSummary}
                    disabled={isLoading || !timeRange}
                    styles={{ root: { width: '100%' } }}
                />
                {filteredArticles && filteredArticles.length > 0 && (
                    <DefaultButton
                        iconProps={{ iconName: 'Clear' }}
                        text="清空结果"
                        onClick={handleClearSummary}
                        disabled={isLoading}
                        styles={{ root: { width: '100%' } }}
                    />
                )}
            </div>
        </>
    )
}

