import * as React from "react"

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  style?: React.CSSProperties
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ style, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        style={{
          width: '100%',
          minHeight: 'auto',
          padding: '4px 8px',
          fontSize: '11px',
          lineHeight: '1.4',
          borderRadius: '4px',
          border: '1px solid var(--neutralLight)',
          backgroundColor: 'transparent',
          color: '#ffffff',
          fontFamily: '"Segoe UI", "Source Han Sans Regular", sans-serif',
          resize: 'none',
          outline: 'none',
          boxSizing: 'border-box',
          ...style,
        }}
        {...props}
      />
    )
  }
)

Textarea.displayName = "Textarea"

export { Textarea }

