import * as React from "react"
import { TextField } from "@fluentui/react/lib/TextField"
import { PrimaryButton } from "@fluentui/react/lib/Button"

type AIModeProps = {
    // 可以添加需要的props
}

type AIModeState = {
    inputValue: string
}

class AIMode extends React.Component<AIModeProps, AIModeState> {
    constructor(props: AIModeProps) {
        super(props)
        this.state = {
            inputValue: ''
        }
    }

    handleInputChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        this.setState({ inputValue: newValue || '' })
    }

    handleSendMessage = () => {
        const { inputValue } = this.state
        if (!inputValue.trim()) return

        console.log('发送消息:', inputValue.trim())
        // 这里可以添加发送逻辑
        this.setState({ inputValue: '' })
    }

    handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            this.handleSendMessage()
        }
    }

    render() {
        const { inputValue } = this.state

        return (
            <div className="ai-simple-container">
                <div className="ai-input-wrapper">
                    <TextField
                        multiline
                        rows={6}
                        value={inputValue}
                        onChange={this.handleInputChange}
                        onKeyDown={this.handleKeyPress}
                        placeholder="请输入你的问题..."
                        className="ai-simple-input"
                        styles={{
                            fieldGroup: {
                                border: '1px solid var(--neutralLight)',
                                borderRadius: '12px',
                                backgroundColor: 'var(--white)',
                                '&:hover': {
                                    borderColor: 'var(--neutralSecondary)'
                                },
                                '&:focus-within': {
                                    borderColor: 'var(--themePrimary)',
                                    boxShadow: '0 0 0 2px rgba(0, 120, 212, 0.2)'
                                }
                            },
                            field: {
                                padding: '16px 20px 50px 20px',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                resize: 'none'
                            }
                        }}
                    />
                    <div className="ai-send-button">
                        <PrimaryButton
                            iconProps={{ iconName: 'Send' }}
                            onClick={this.handleSendMessage}
                            disabled={!inputValue.trim()}
                            className="send-btn"
                            title="发送消息"
                        />
                    </div>
                </div>
            </div>
        )
    }
}

export default AIMode
