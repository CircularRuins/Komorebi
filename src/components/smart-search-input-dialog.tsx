import * as React from "react"
import intl from "react-intl-universal"
import { TextField, ITextField } from "@fluentui/react/lib/TextField"
import { Dropdown, IDropdownOption } from "@fluentui/react/lib/Dropdown"
import { Label } from "@fluentui/react/lib/Label"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import ReactDOM from "react-dom"

interface SmartSearchInputDialogProps {
    show: boolean
    timeRange: string | null
    topicInput: string
    classificationStandardInput: string
    recentTopics: string[]
    recentClassificationStandards: string[]
    onClose: () => void
    onConfirm: (timeRange: string, topic: string, classificationStandard: string) => void
    onTimeRangeChange: (timeRange: string | null) => void
    onTopicInputChange: (topic: string) => void
    onClassificationStandardInputChange: (classificationStandard: string) => void
    onRecentTopicClick: (topic: string) => void
    onRecentClassificationStandardClick: (standard: string) => void
}

export const SmartSearchInputDialog: React.FC<SmartSearchInputDialogProps> = (props) => {
    const {
        show,
        timeRange,
        topicInput,
        classificationStandardInput,
        recentTopics,
        recentClassificationStandards,
        onClose,
        onConfirm,
        onTimeRangeChange,
        onTopicInputChange,
        onClassificationStandardInputChange,
        onRecentTopicClick,
        onRecentClassificationStandardClick
    } = props

    const [localTimeRange, setLocalTimeRange] = React.useState<string | null>(timeRange)
    const [localTopicInput, setLocalTopicInput] = React.useState(topicInput)
    const [localClassificationStandardInput, setLocalClassificationStandardInput] = React.useState(classificationStandardInput)
    const topicInputRef = React.useRef<ITextField>(null)
    const classificationStandardInputRef = React.useRef<ITextField>(null)

    // 当 props 变化时同步到本地 state
    React.useEffect(() => {
        setLocalTimeRange(timeRange)
        setLocalTopicInput(topicInput)
        setLocalClassificationStandardInput(classificationStandardInput)
    }, [timeRange, topicInput, classificationStandardInput])

    // 当弹窗显示时，聚焦到话题输入框
    React.useEffect(() => {
        if (show && topicInputRef.current) {
            setTimeout(() => {
                topicInputRef.current?.focus()
            }, 100)
        }
    }, [show])

    const getTimeRangeOptions = (): IDropdownOption[] => {
        return [
            { key: '1', text: intl.get("settings.aiMode.menu.timeRangeOptions.1") },
            { key: '3', text: intl.get("settings.aiMode.menu.timeRangeOptions.3") },
            { key: '7', text: intl.get("settings.aiMode.menu.timeRangeOptions.7") },
            { key: '14', text: intl.get("settings.aiMode.menu.timeRangeOptions.14") }
        ]
    }

    const handleConfirm = () => {
        const trimmedTopic = localTopicInput.trim()
        if (!localTimeRange) {
            // 可以在这里显示错误提示
            return
        }
        if (!trimmedTopic) {
            // 可以在这里显示错误提示
            return
        }
        onConfirm(localTimeRange, trimmedTopic, localClassificationStandardInput.trim())
    }

    const handleTimeRangeChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => {
        const newTimeRange = option?.key as string | null
        setLocalTimeRange(newTimeRange)
        onTimeRangeChange(newTimeRange)
    }

    const handleTopicInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        setLocalTopicInput(value)
        onTopicInputChange(value)
    }

    const handleClassificationStandardInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        const value = newValue || ''
        setLocalClassificationStandardInput(value)
        onClassificationStandardInputChange(value)
    }

    const handleRecentTopicClick = (topic: string) => {
        setLocalTopicInput(topic)
        onTopicInputChange(topic)
        onRecentTopicClick(topic)
    }

    const handleRecentClassificationStandardClick = (standard: string) => {
        setLocalClassificationStandardInput(standard)
        onClassificationStandardInputChange(standard)
        onRecentClassificationStandardClick(standard)
    }

    if (!show) return null

    const dialog = (
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
            onClick={onClose}>
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
                    borderRadius: '4px',
                    padding: '24px',
                    maxWidth: '600px',
                    width: '90%',
                    maxHeight: '90%',
                    overflow: 'auto',
                    boxShadow: '0 6.4px 14.4px rgba(0, 0, 0, 0.132), 0 1.2px 3.6px rgba(0, 0, 0, 0.108)',
                    zIndex: 10001,
                }}
                onClick={(e) => e.stopPropagation()}>
                <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 600, color: 'var(--neutralPrimary)' }}>
                        {intl.get("menu.aiFeature")}
                    </h2>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                        {intl.get("settings.aiMode.menu.timeRange")}
                    </Label>
                    <Dropdown
                        selectedKey={localTimeRange}
                        options={getTimeRangeOptions()}
                        onChange={handleTimeRangeChange}
                        styles={{ 
                            root: { width: '100%', marginTop: '4px' },
                            title: { fontSize: '12px' }
                        }}
                        required={true}
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                        {intl.get("settings.aiMode.menu.topic")}
                    </Label>
                    <div style={{ position: 'relative', marginTop: '4px' }}>
                        <TextField
                            componentRef={topicInputRef}
                            value={localTopicInput}
                            onChange={handleTopicInputChange}
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
                            required={true}
                        />
                        <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '2px', fontSize: '11px', color: localTopicInput.length >= 300 ? '#d13438' : 'var(--neutralSecondary)', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                            {localTopicInput.length}/300
                        </div>
                    </div>
                    
                    {/* 常选主题 */}
                    {recentTopics && recentTopics.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <Label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--neutralSecondary)', marginBottom: '4px', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                                {intl.get("settings.aiMode.menu.recentTopics")}
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
                                        onClick={() => handleRecentTopicClick(recentTopic)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            backgroundColor: 'var(--neutralLighter)',
                                            color: 'var(--neutralPrimary)',
                                            borderRadius: '4px',
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            border: '1px solid var(--neutralLight)',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--neutralLight)'
                                            e.currentTarget.style.borderColor = 'var(--neutralTertiary)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--neutralLighter)'
                                            e.currentTarget.style.borderColor = 'var(--neutralLight)'
                                        }}
                                    >
                                        <span>{recentTopic}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                        {intl.get("settings.aiMode.menu.classificationStandard")}
                    </Label>
                    <div style={{ position: 'relative', marginTop: '4px' }}>
                        <TextField
                            componentRef={classificationStandardInputRef}
                            value={localClassificationStandardInput}
                            onChange={handleClassificationStandardInputChange}
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
                        />
                        <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '2px', fontSize: '11px', color: localClassificationStandardInput.length >= 300 ? '#d13438' : 'var(--neutralSecondary)', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                            {localClassificationStandardInput.length}/300
                        </div>
                    </div>
                    
                    {/* 常用分类标准 */}
                    {recentClassificationStandards && recentClassificationStandards.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <Label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--neutralSecondary)', marginBottom: '4px', fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                                {intl.get("settings.aiMode.menu.recentStandards")}
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
                                        onClick={() => handleRecentClassificationStandardClick(recentStandard)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            backgroundColor: 'var(--neutralLighter)',
                                            color: 'var(--neutralPrimary)',
                                            borderRadius: '4px',
                                            padding: '4px 10px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            border: '1px solid var(--neutralLight)',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--neutralLight)'
                                            e.currentTarget.style.borderColor = 'var(--neutralTertiary)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--neutralLighter)'
                                            e.currentTarget.style.borderColor = 'var(--neutralLight)'
                                        }}
                                    >
                                        <span>{recentStandard}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <DefaultButton 
                        onClick={onClose} 
                        text={intl.get("cancel")} 
                    />
                    <PrimaryButton 
                        onClick={handleConfirm}
                        disabled={!localTimeRange || !localTopicInput.trim()}
                        text={intl.get("settings.aiMode.menu.generate")} 
                    />
                </div>
            </div>
        </div>
    )

    return ReactDOM.createPortal(dialog, document.body)
}

