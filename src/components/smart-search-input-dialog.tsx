import * as React from "react"
import intl from "react-intl-universal"
import { Label } from "@fluentui/react/lib/Label"
import { PrimaryButton, DefaultButton } from "@fluentui/react/lib/Button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Textarea } from "./ui/textarea"

interface SmartSearchInputDialogProps {
    show: boolean
    timeRange: string | null
    topicInput: string
    recentTopics: string[]
    onClose: () => void
    onConfirm: (timeRange: string, topic: string, classificationStandard: string) => void
    onTimeRangeChange: (timeRange: string | null) => void
    onTopicInputChange: (topic: string) => void
    onRecentTopicClick: (topic: string) => void
}

export const SmartSearchInputDialog: React.FC<SmartSearchInputDialogProps> = (props) => {
    const {
        show,
        timeRange,
        topicInput,
        recentTopics,
        onClose,
        onConfirm,
        onTimeRangeChange,
        onTopicInputChange,
        onRecentTopicClick
    } = props

    const [localTimeRange, setLocalTimeRange] = React.useState<string | null>(timeRange)
    const [localTopicInput, setLocalTopicInput] = React.useState(topicInput)
    const topicInputRef = React.useRef<HTMLTextAreaElement>(null)

    // 当 props 变化时同步到本地 state
    React.useEffect(() => {
        setLocalTimeRange(timeRange)
        setLocalTopicInput(topicInput)
    }, [timeRange, topicInput])

    // 当弹窗显示时，聚焦到话题输入框
    React.useEffect(() => {
        if (show && topicInputRef.current) {
            setTimeout(() => {
                topicInputRef.current?.focus()
            }, 100)
        }
    }, [show])

    const getTimeRangeOptions = () => {
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
        onConfirm(localTimeRange, trimmedTopic, '')
    }

    const handleTimeRangeChange = (value: string) => {
        const newTimeRange = value || null
        setLocalTimeRange(newTimeRange)
        onTimeRangeChange(newTimeRange)
    }

    const handleTopicInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = event.target.value
        setLocalTopicInput(value)
        onTopicInputChange(value)
    }

    const handleRecentTopicClick = (topic: string) => {
        setLocalTopicInput(topic)
        onTopicInputChange(topic)
        onRecentTopicClick(topic)
    }

    return (
        <Dialog open={show} onOpenChange={(open) => {
            if (!open) {
                onClose()
            }
        }}>
            <DialogContent style={{ maxWidth: '300px', width: '45%', maxHeight: '90%', overflow: 'auto' }}>
                <DialogHeader>
                    <DialogTitle>
                        {intl.get("menu.aiFeature")}
                    </DialogTitle>
                </DialogHeader>

                <div style={{ marginBottom: '16px' }}>
                    <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                        {intl.get("settings.aiMode.menu.timeRange")}
                    </Label>
                    <div style={{ marginTop: '4px' }}>
                        <Select value={localTimeRange || undefined} onValueChange={handleTimeRangeChange}>
                            <SelectTrigger style={{ width: '100%' }}>
                                <SelectValue placeholder={intl.get("settings.aiMode.menu.timeRange")} />
                            </SelectTrigger>
                            <SelectContent>
                                {getTimeRangeOptions().map((option) => (
                                    <SelectItem key={option.key} value={option.key}>
                                        {option.text}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <Label style={{ fontSize: '13px', fontWeight: 600, fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif' }}>
                        {intl.get("settings.aiMode.menu.topic")}
                    </Label>
                    <div style={{ position: 'relative', marginTop: '4px' }}>
                        <Textarea
                            ref={topicInputRef}
                            value={localTopicInput}
                            onChange={handleTopicInputChange}
                            maxLength={300}
                            rows={2}
                            style={{
                                width: '100%',
                            }}
                            required
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

                <DialogFooter style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: '8px' }}>
                    <DefaultButton 
                        onClick={onClose} 
                        text={intl.get("cancel")} 
                    />
                    <PrimaryButton 
                        onClick={handleConfirm}
                        disabled={!localTimeRange || !localTopicInput.trim()}
                        text={intl.get("settings.aiMode.menu.generate")} 
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

