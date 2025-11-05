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
        topics,
        topicInput,
        isLoading,
        filteredArticles,
        handleTimeRangeChange,
        handleTopicInputChange,
        handleTopicInputKeyDown,
        handleTopicInputCompositionStart,
        handleTopicInputCompositionEnd,
        addTopic,
        removeTopic,
        handleGenerateSummary,
        handleClearSummary,
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
                <Label style={{ fontSize: '14px', fontWeight: 600 }}>话题标签</Label>
                {/* 标签显示区域 */}
                {topics.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginTop: '4px',
                        marginBottom: '8px',
                        padding: '8px',
                        backgroundColor: 'var(--white)',
                        border: '1px solid var(--neutralLight)',
                        borderRadius: '4px',
                        minHeight: '32px'
                    }}>
                        {topics.map((topic, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    backgroundColor: '#0078d4',
                                    color: '#ffffff',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    gap: '6px',
                                    height: '24px',
                                    border: '1px solid #005a9e',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                                }}
                            >
                                <span style={{ fontWeight: 500 }}>{topic}</span>
                                <Icon
                                    iconName="Cancel"
                                    style={{
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        opacity: 0.9,
                                        color: '#ffffff'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (!isLoading) {
                                            removeTopic(index)
                                        }
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = '1'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = '0.9'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}
                {/* 输入框和添加按钮 */}
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center'
                }}>
                    <TextField
                        componentRef={topicInputRef}
                        value={topicInput}
                        onChange={handleTopicInputChange}
                        onKeyDown={handleTopicInputKeyDown}
                        onCompositionStart={handleTopicInputCompositionStart}
                        onCompositionEnd={handleTopicInputCompositionEnd}
                        placeholder={topics.length === 0 ? "输入话题标签..." : "继续添加标签..."}
                        styles={{
                            root: { flex: 1 },
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
                    <DefaultButton
                        iconProps={{ iconName: 'Add' }}
                        onClick={addTopic}
                        disabled={isLoading || !topicInput.trim()}
                        styles={{
                            root: {
                                minWidth: '32px',
                                width: '32px',
                                height: '32px',
                                padding: '0'
                            }
                        }}
                        title="添加标签"
                    />
                </div>
                <Label styles={{ root: { fontSize: '11px', color: 'var(--neutralSecondary)', marginTop: '4px', fontWeight: 'normal' } }}>
                    输入标签后点击加号或按Enter添加。（暂未实现筛选功能）
                </Label>
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

