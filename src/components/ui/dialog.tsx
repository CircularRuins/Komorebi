import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

// 添加 Dialog 样式到全局 CSS
const dialogStyles = `
@keyframes dialog-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dialog-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes dialog-zoom-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes dialog-zoom-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
}

[data-slot="dialog-overlay"][data-state="open"] {
  animation: dialog-fade-in 0.2s ease-out;
}

[data-slot="dialog-overlay"][data-state="closed"] {
  animation: dialog-fade-out 0.2s ease-out;
}

[data-slot="dialog-content"][data-state="open"] {
  animation: dialog-zoom-in 0.2s ease-out;
}

[data-slot="dialog-content"][data-state="closed"] {
  animation: dialog-zoom-out 0.2s ease-out;
}

/* 确保遮罩不会影响导航栏 */
#root > nav {
  position: relative !important;
  z-index: 1000 !important;
}
`

// 注入样式
if (typeof document !== 'undefined') {
  const styleId = 'radix-dialog-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = dialogStyles
    document.head.appendChild(style)
  }
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  // 使用 React.useMemo 来获取导航栏高度，避免每次渲染都计算
  const navHeight = React.useMemo(() => {
    if (typeof window === 'undefined') return '32px'
    const height = getComputedStyle(document.documentElement).getPropertyValue('--navHeight') || '32px'
    return height
  }, [])
  
  // 将 navHeight 转换为数字（去掉 px）
  const navHeightNum = React.useMemo(() => {
    return parseInt(navHeight) || 32
  }, [navHeight])
  
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      style={{
        position: 'fixed',
        top: `${navHeightNum}px`, // 从导航栏下方开始，确保不覆盖导航栏
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40, // 远低于导航栏的 z-index: 1000
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        pointerEvents: 'auto',
        ...style,
      }}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  // 计算内容区域的中心位置
  const [topPosition, setTopPosition] = React.useState('50%')
  
  React.useEffect(() => {
    const calculatePosition = () => {
      if (typeof window === 'undefined') return
      
      const navHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--navHeight') || '32px'
      ) || 32
      
      const viewportHeight = window.innerHeight
      const contentAreaHeight = viewportHeight - navHeight
      const contentAreaCenter = navHeight + contentAreaHeight / 2
      
      setTopPosition(`${contentAreaCenter}px`)
    }
    
    calculatePosition()
    window.addEventListener('resize', calculatePosition)
    return () => window.removeEventListener('resize', calculatePosition)
  }, [])
  
  return (
    <DialogPortal data-slot="dialog-portal">
      {/* 移除背景遮罩，避免影响导航栏 */}
      {/* <DialogOverlay /> */}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        style={{
          position: 'fixed',
          top: topPosition,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10001, // 确保弹窗在最上层，但不会影响导航栏（导航栏是 1000）
          display: 'grid',
          width: '100%',
          maxWidth: 'calc(100% - 2rem)',
          gap: '1rem',
          borderRadius: '24px',
          border: '1px solid var(--neutralLighter)',
          backgroundColor: 'var(--neutralLighterAlt)',
          padding: '24px',
          boxShadow: '0px 8px 32px 0px rgba(0,0,0,0.04), 0px 2px 8px 0px rgba(0,0,0,0.02)',
          ...style,
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              borderRadius: '4px',
              opacity: 0.7,
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7'
            }}
          >
            <XIcon size={16} />
            <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', borderWidth: 0 }}>
              Close
            </span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        textAlign: 'left',
        ...style,
      }}
      {...props}
    />
  )
}

function DialogFooter({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      style={{
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '8px',
        ...style,
      }}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      style={{
        fontSize: '18px',
        lineHeight: '1',
        fontWeight: 600,
        color: 'var(--neutralPrimary)',
        margin: 0,
        ...style,
      }}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      style={{
        fontSize: '14px',
        color: 'var(--neutralSecondary)',
        margin: 0,
        ...style,
      }}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
