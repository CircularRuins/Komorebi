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
    // 使用本地state管理输入，避免频繁的全局状态更新打断输入
    const [localTopicInput, setLocalTopicInput] = React.useState('')
    const [localClassificationStandardInput, setLocalClassificationStandardInput] = React.useState('')
    
    // 当Context中的topicInput变化时（如从外部设置、点击常选主题等），同步到本地state
    React.useEffect(() => {
        if (context && context.topicInput !== localTopicInput) {
            setLocalTopicInput(context.topicInput || '')
        }
    }, [context?.topicInput])
    
    // 当Context中的classificationStandardInput变化时，同步到本地state
    React.useEffect(() => {
        if (context && context.classificationStandardInput !== localClassificationStandardInput) {
            setLocalClassificationStandardInput(context.classificationStandardInput || '')
        }
    }, [context?.classificationStandardInput])
    
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
        topicInput: contextTopicInput,
        recentTopics,
        classificationStandard,
        classificationStandardInput: contextClassificationStandardInput,
        recentClassificationStandards,
        isLoading,
        isClustering,
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
        isComposing,
        handleClassificationStandardInputChange,
        handleClassificationStandardInputKeyDown,
        handleClassificationStandardInputCompositionStart,
        handleClassificationStandardInputCompositionEnd,
        handleRecentClassificationStandardClick,
        classificationStandardInputRef
    } = context

    // 本地输入处理函数
    const handleLocalTopicInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        setLocalTopicInput(value)
        // 同步到Redux，但不触发Context更新事件（避免打断输入）
        handleTopicInputChange(event, value)
    }

    // 本地分类标准输入处理函数
    const handleLocalClassificationStandardInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        setLocalClassificationStandardInput(value)
        // 同步到Redux，但不触发Context更新事件（避免打断输入）
        handleClassificationStandardInputChange(event, value)
    }

    const getTimeRangeOptions = (): IDropdownOption[] => {
        return [
            { key: '1', text: '1天内' },
            { key: '3', text: '3天内' },
            { key: '7', text: '7天内' },
            { key: '14', text: '14天内' }
        ]
    }

    return (
        <>
            <div style={{ marginBottom: '8px' }}>
                <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>时间范围（必选）</Label>
                <Dropdown
                    selectedKey={timeRange}
                    options={getTimeRangeOptions()}
                    onChange={handleTimeRangeChange}
                    styles={{ 
                        root: { width: '100%', marginTop: '4px' },
                        title: { fontSize: '12px' }
                    }}
                    disabled={isLoading}
                    required={true}
                />
                <Label styles={{ root: { fontSize: '11px', color: 'var(--neutralSecondary)', marginTop: '4px', fontWeight: 'normal', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' } }}>
                    根据文章发布时间筛选。
                </Label>
            </div>

            <div style={{ marginBottom: '8px' }}>
                <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>主题（必填）</Label>
                <div style={{ position: 'relative', marginTop: '4px' }}>
                    <TextField
                        componentRef={topicInputRef}
                        value={localTopicInput}
                        onChange={handleLocalTopicInputChange}
                        onKeyDown={handleTopicInputKeyDown}
                        onCompositionStart={handleTopicInputCompositionStart}
                        onCompositionEnd={handleTopicInputCompositionEnd}
                        maxLength={300}
                        multiline
                        rows={2}
                        resizable={false}
                        styles={{
                            root: { width: '100%' },
                            fieldGroup: { 
                                borderRadius: '4px',
                                border: '1px solid var(--neutralLight)'
                            },
                            field: { 
                                fontSize: '11px',
                                padding: '4px 8px',
                                minHeight: 'auto',
                                lineHeight: '1.4'
                            }
                        }}
                        disabled={isLoading}
                        required={true}
                    />
                    <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '2px', fontSize: '11px', color: localTopicInput.length >= 300 ? '#d13438' : 'var(--neutralSecondary)', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                        {localTopicInput.length}/300
                    </div>
                </div>
                <Label styles={{ root: { fontSize: '11px', color: 'var(--neutralSecondary)', marginTop: '18px', fontWeight: 'normal', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif', display: 'block' } }}>
                    灵活输入您关注的主题，如：AI编程领域的进展、建材行业的最新动态等。
                </Label>
                
                {/* 常选主题 */}
                {recentTopics && recentTopics.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                        <Label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--neutralSecondary)', marginBottom: '4px', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                            常选主题
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

            <div style={{ marginBottom: '8px' }}>
                <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>分类标准（可选）</Label>
                <div style={{ position: 'relative', marginTop: '4px' }}>
                    <TextField
                        componentRef={classificationStandardInputRef}
                        value={localClassificationStandardInput}
                        onChange={handleLocalClassificationStandardInputChange}
                        onKeyDown={handleClassificationStandardInputKeyDown}
                        onCompositionStart={handleClassificationStandardInputCompositionStart}
                        onCompositionEnd={handleClassificationStandardInputCompositionEnd}
                        maxLength={300}
                        multiline
                        rows={2}
                        resizable={false}
                        styles={{
                            root: { width: '100%' },
                            fieldGroup: { 
                                borderRadius: '4px',
                                border: '1px solid var(--neutralLight)'
                            },
                            field: { 
                                fontSize: '11px',
                                padding: '4px 8px',
                                minHeight: 'auto',
                                lineHeight: '1.4'
                            }
                        }}
                        disabled={isLoading}
                    />
                    <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '2px', fontSize: '11px', color: localClassificationStandardInput.length >= 300 ? '#d13438' : 'var(--neutralSecondary)', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                        {localClassificationStandardInput.length}/300
                    </div>
                </div>
                <Label styles={{ root: { fontSize: '11px', color: 'var(--neutralSecondary)', marginTop: '18px', fontWeight: 'normal', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif', display: 'block' } }}>
                    可选：输入分类标准，指导AI如何对文章进行分组，如：按行业分类、按事件类型分类等。
                </Label>
                
                {/* 常用分类标准 */}
                {recentClassificationStandards && recentClassificationStandards.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                        <Label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--neutralSecondary)', marginBottom: '4px', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                            常用分类标准
                        </Label>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginTop: '4px'
                        }}>
                            {recentClassificationStandards.map((recentStandard, index) => (
                                <div
                                    key={index}
                                    onClick={() => !isLoading && handleRecentClassificationStandardClick(recentStandard)}
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
                                    <span>{recentStandard}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', marginTop: '8px', marginBottom: '8px' }}>
                <PrimaryButton
                    iconProps={{ iconName: 'Search' }}
                    text="整理汇总"
                    onClick={handleGenerateSummary}
                    disabled={isLoading || isClustering || !timeRange || (!localTopicInput.trim() && !topic)}
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

