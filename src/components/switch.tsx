import * as React from "react"

type SwitchProps = {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    size?: "small" | "medium" | "large"
    className?: string
}

class Switch extends React.Component<SwitchProps> {
    handleClick = () => {
        if (!this.props.disabled) {
            this.props.onChange(!this.props.checked)
        }
    }

    render() {
        const { checked, disabled, size = "medium", className = "" } = this.props
        
        const sizeClasses = {
            small: "switch-small",
            medium: "switch-medium", 
            large: "switch-large"
        }

        return (
            <div 
                className={`switch ${sizeClasses[size]} ${checked ? 'switch-checked' : ''} ${disabled ? 'switch-disabled' : ''} ${className}`}
                onClick={this.handleClick}
            >
                <div className="switch-track">
                    <div className="switch-thumb"></div>
                </div>
            </div>
        )
    }
}

export default Switch
