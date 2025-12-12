import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  children,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        width: '100%',
        height: '32px',
        padding: '4px 8px',
        fontSize: '12px',
        borderRadius: '4px',
        border: '1px solid var(--neutralLight)',
        backgroundColor: 'transparent',
        color: '#ffffff',
        cursor: 'pointer',
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon 
          size={16} 
          style={{ 
            opacity: 0.5, 
            pointerEvents: 'none',
            flexShrink: 0
          }} 
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  children,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        style={{
          zIndex: 10002, // 确保在 Dialog 之上
          minWidth: 'var(--radix-select-trigger-width)',
          maxHeight: 'var(--radix-select-content-available-height)',
          overflow: 'hidden',
          borderRadius: '4px',
          border: '1px solid var(--neutralLight)',
          backgroundColor: 'var(--neutralLighterAlt)',
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
          ...style,
        }}
        position="popper"
        {...props}
      >
        <SelectPrimitive.ScrollUpButton
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '25px',
            cursor: 'default',
          }}
        >
          <ChevronUpIcon size={16} />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          style={{
            padding: '4px',
          }}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '25px',
            cursor: 'default',
          }}
        >
          <ChevronDownIcon size={16} />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  children,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        paddingRight: '32px',
        fontSize: '12px',
        borderRadius: '2px',
        color: '#ffffff',
        cursor: 'pointer',
        outline: 'none',
        userSelect: 'none',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--neutralLight)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--neutralLight)'
      }}
      onMouseLeave={(e) => {
        if (document.activeElement !== e.currentTarget) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span
        style={{
          position: 'absolute',
          right: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SelectPrimitive.ItemIndicator>
          <span style={{ fontSize: '12px' }}>✓</span>
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}

