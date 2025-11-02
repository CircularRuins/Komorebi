import * as React from "react"

interface ResizableLayoutProps {
    leftPanel: React.ReactNode
    rightPanel?: React.ReactNode
    mainContent: React.ReactNode
    defaultLeftWidth?: number
    defaultRightWidth?: number
    minLeftWidth?: number
    minRightWidth?: number
    maxLeftWidth?: number
    maxRightWidth?: number
}

interface ResizableLayoutState {
    leftWidth: number
    rightWidth: number
    isDragging: boolean
    dragType: 'left' | 'right' | null
}

export class ResizableLayout extends React.Component<ResizableLayoutProps, ResizableLayoutState> {
    private containerRef = React.createRef<HTMLDivElement>()
    private leftResizerRef = React.createRef<HTMLDivElement>()
    private rightResizerRef = React.createRef<HTMLDivElement>()

    constructor(props: ResizableLayoutProps) {
        super(props)
        
        const initialLeftWidth = props.defaultLeftWidth || 240
        this.state = {
            leftWidth: initialLeftWidth,
            rightWidth: props.defaultRightWidth || 300,
            isDragging: false,
            dragType: null
        }
        // 立即设置 CSS 变量，确保在组件渲染前就设置好
        if (typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--left-panel-width', `${initialLeftWidth}px`)
        }
    }

    componentDidMount() {
        document.addEventListener('mousemove', this.handleMouseMove)
        document.addEventListener('mouseup', this.handleMouseUp)
        // 设置初始左侧面板宽度的 CSS 变量
        document.documentElement.style.setProperty('--left-panel-width', `${this.state.leftWidth}px`)
    }

    componentWillUnmount() {
        document.removeEventListener('mousemove', this.handleMouseMove)
        document.removeEventListener('mouseup', this.handleMouseUp)
    }

    componentDidUpdate(prevProps: ResizableLayoutProps, prevState: ResizableLayoutState) {
        // 当左侧面板宽度变化时，更新 CSS 变量
        if (prevState.leftWidth !== this.state.leftWidth) {
            document.documentElement.style.setProperty('--left-panel-width', `${this.state.leftWidth}px`)
        }
    }

    handleMouseDown = (type: 'left' | 'right') => (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        // Prevent text selection during drag
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'col-resize'
        
        this.setState({
            isDragging: true,
            dragType: type
        })
    }

    handleMouseMove = (e: MouseEvent) => {
        if (!this.state.isDragging || !this.containerRef.current) return

        const containerRect = this.containerRef.current.getBoundingClientRect()
        const containerWidth = containerRect.width
        const mouseX = e.clientX - containerRect.left

        if (this.state.dragType === 'left') {
            const maxLeftWidth = typeof this.props.maxLeftWidth === 'number' 
                ? this.props.maxLeftWidth <= 1 ? containerWidth * this.props.maxLeftWidth : this.props.maxLeftWidth
                : containerWidth * 0.5
            
            const newLeftWidth = Math.max(
                this.props.minLeftWidth || 200,
                Math.min(maxLeftWidth, mouseX)
            )
            this.setState({ leftWidth: newLeftWidth })
            // 实时更新 CSS 变量，确保文章容器能够实时响应左侧面板宽度变化
            document.documentElement.style.setProperty('--left-panel-width', `${newLeftWidth}px`)
        } else if (this.state.dragType === 'right') {
            const maxRightWidth = typeof this.props.maxRightWidth === 'number' 
                ? this.props.maxRightWidth <= 1 ? containerWidth * this.props.maxRightWidth : this.props.maxRightWidth
                : containerWidth * 0.5
            
            const newRightWidth = Math.max(
                this.props.minRightWidth || 200,
                Math.min(maxRightWidth, containerWidth - mouseX)
            )
            this.setState({ rightWidth: newRightWidth })
        }
    }

    handleMouseUp = () => {
        // Restore text selection and cursor
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        
        this.setState({
            isDragging: false,
            dragType: null
        })
    }

    render() {
        const { leftPanel, rightPanel, mainContent } = this.props
        const { leftWidth, rightWidth, isDragging } = this.state

        return (
            <div 
                ref={this.containerRef}
                className="resizable-layout"
                style={{
                    display: 'flex',
                    height: '100%',
                    width: '100%'
                }}
            >
                {/* Left Panel */}
                <div 
                    className="resizable-panel left-panel"
                    style={{
                        width: `${leftWidth}px`,
                        minWidth: `${this.props.minLeftWidth || 200}px`,
                        maxWidth: `${this.props.maxLeftWidth || '50%'}`,
                        flexShrink: 0,
                        overflow: 'hidden'
                    }}
                >
                    {leftPanel}
                </div>

                {/* Left Resizer */}
                <div
                    ref={this.leftResizerRef}
                    className={`resizer left-resizer ${isDragging && this.state.dragType === 'left' ? 'dragging' : ''}`}
                    onMouseDown={this.handleMouseDown('left')}
                    style={{
                        width: '4px',
                        backgroundColor: isDragging && this.state.dragType === 'left' ? '#0078d4' : 'transparent',
                        cursor: 'col-resize',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 10
                    }}
                />

                {/* Main Content */}
                <div 
                    className="resizable-panel main-panel"
                    style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden'
                    }}
                >
                    {mainContent}
                </div>

                {/* Right Panel and Resizer - only show if rightPanel is provided */}
                {rightPanel && (
                    <>
                        {/* Right Resizer */}
                        <div
                            ref={this.rightResizerRef}
                            className={`resizer right-resizer ${isDragging && this.state.dragType === 'right' ? 'dragging' : ''}`}
                            onMouseDown={this.handleMouseDown('right')}
                            style={{
                                width: '4px',
                                backgroundColor: isDragging && this.state.dragType === 'right' ? '#0078d4' : 'transparent',
                                cursor: 'col-resize',
                                flexShrink: 0,
                                position: 'relative',
                                zIndex: 10
                            }}
                        />

                        {/* Right Panel */}
                        <div 
                            className="resizable-panel right-panel"
                            style={{
                                width: `${rightWidth}px`,
                                minWidth: `${this.props.minRightWidth || 200}px`,
                                maxWidth: `${this.props.maxRightWidth || '50%'}`,
                                flexShrink: 0,
                                overflow: 'hidden'
                            }}
                        >
                            {rightPanel}
                        </div>
                    </>
                )}
            </div>
        )
    }
}

export default ResizableLayout
