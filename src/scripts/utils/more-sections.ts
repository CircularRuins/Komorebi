// 直接导入JSON配置文件
import moreSectionsConfig from "../../more-sections.json"

// 导入Markdown文件
import wechatGuideMd from "../../more-sections/wechat-guide.md"
import twitterGuideMd from "../../more-sections/twitter-guide.md"
import newslettersGuideMd from "../../more-sections/newsletters-guide.md"
import youtubeGuideMd from "../../more-sections/youtube-guide.md"
import arxivGuideMd from "../../more-sections/arxiv-guide.md"

// Markdown文件映射
// 支持多种路径格式以匹配不同的引用方式
const markdownFiles: { [key: string]: string } = {
    "more-sections/wechat-guide.md": wechatGuideMd,
    "../../more-sections/wechat-guide.md": wechatGuideMd,
    "wechat-guide.md": wechatGuideMd,
    "more-sections/twitter-guide.md": twitterGuideMd,
    "../../more-sections/twitter-guide.md": twitterGuideMd,
    "twitter-guide.md": twitterGuideMd,
    "more-sections/newsletters-guide.md": newslettersGuideMd,
    "../../more-sections/newsletters-guide.md": newslettersGuideMd,
    "newsletters-guide.md": newslettersGuideMd,
    "more-sections/youtube-guide.md": youtubeGuideMd,
    "../../more-sections/youtube-guide.md": youtubeGuideMd,
    "youtube-guide.md": youtubeGuideMd,
    "more-sections/arxiv-guide.md": arxivGuideMd,
    "../../more-sections/arxiv-guide.md": arxivGuideMd,
    "arxiv-guide.md": arxivGuideMd,
}


export interface MoreSection {
    id: string
    titleKey: string
    content: string
    markdownFile?: string
}

/**
 * 简单的Markdown到HTML转换函数
 * 支持基本的markdown语法：标题、段落、列表、链接、代码块等
 */
function markdownToHtml(markdown: string): string {
    if (!markdown || !markdown.trim()) {
        return ''
    }
    
    let html = markdown
    
    // 代码块（先处理，避免被其他规则影响）
    const codeBlocks: string[] = []
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
        codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`)
        return placeholder
    })
    
    // 行内代码（在代码块之后处理）
    const inlineCodes: string[] = []
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodes.length}__`
        inlineCodes.push(`<code>${escapeHtml(code)}</code>`)
        return placeholder
    })
    
    // 标题
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // 粗体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
    
    // 斜体（在粗体之后处理，避免冲突）
    // 只处理没有被**包围的单个*
    html = html.replace(/\b\*([^*\s][^*]*?[^*\s])\*\b/g, '<em>$1</em>')
    html = html.replace(/\b_([^_\s][^_]*?[^_\s])_\b/g, '<em>$1</em>')
    
    // 图片（在链接之前处理，因为语法类似）
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
        // 如果图片路径是相对路径，确保它指向正确的目录
        let imagePath = src.trim()
        if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('data:') && !imagePath.startsWith('/')) {
            // 相对路径处理
            if (imagePath.startsWith('./')) {
                // 移除 ./ 前缀
                imagePath = imagePath.substring(2)
            }
            // 如果路径以 images/ 开头，添加 more-sections/ 前缀
            if (imagePath.startsWith('images/')) {
                imagePath = `more-sections/${imagePath}`
            } else if (!imagePath.startsWith('more-sections/')) {
                // 其他相对路径也添加 more-sections/ 前缀
                imagePath = `more-sections/${imagePath}`
            }
        }
        return `<img src="${escapeHtml(imagePath)}" alt="${escapeHtml(alt || '')}" style="max-width: 100%; height: auto; margin: 12px 0;" />`
    })
    
    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // 处理列表
    const lines = html.split('\n')
    const processedLines: string[] = []
    let inList = false
    let listItems: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        
        // 检查是否是列表项
        const unorderedMatch = trimmed.match(/^[\*\-] (.+)$/)
        const orderedMatch = trimmed.match(/^\d+\. (.+)$/)
        
        if (unorderedMatch || orderedMatch) {
            if (!inList) {
                inList = true
                listItems = []
            }
            const content = unorderedMatch ? unorderedMatch[1] : orderedMatch![1]
            listItems.push(`<li>${content}</li>`)
        } else {
            // 结束当前列表
            if (inList) {
                processedLines.push(`<ul>${listItems.join('')}</ul>`)
                inList = false
                listItems = []
            }
            
            // 处理其他内容
            if (!trimmed) {
                processedLines.push('')
            } else if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
                processedLines.push(trimmed)
            } else if (trimmed.startsWith('__CODE_BLOCK_') || trimmed.startsWith('__INLINE_CODE_')) {
                processedLines.push(trimmed)
            } else {
                processedLines.push(`<p>${trimmed}</p>`)
            }
        }
    }
    
    // 处理最后的列表
    if (inList && listItems.length > 0) {
        processedLines.push(`<ul>${listItems.join('')}</ul>`)
    }
    
    html = processedLines.join('\n')
    
    // 恢复代码块和行内代码
    codeBlocks.forEach((code, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, code)
    })
    inlineCodes.forEach((code, index) => {
        html = html.replace(`__INLINE_CODE_${index}__`, code)
    })
    
    return html
}

/**
 * HTML转义函数
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

/**
 * 加载Markdown文件内容
 * 优先从构建时导入的文件中获取，如果不存在则尝试fetch
 */
async function loadMarkdownFile(filePath: string): Promise<string> {
    try {
        // 首先尝试从构建时导入的文件中获取
        if (markdownFiles[filePath]) {
            return markdownFiles[filePath]
        }
        
        // 如果构建时导入不存在，尝试fetch（用于开发环境）
        const response = await fetch(filePath)
        if (!response.ok) {
            throw new Error(`Failed to load markdown file: ${response.statusText}`)
        }
        const content = await response.text()
        return content
    } catch (error) {
        return ''
    }
}

/**
 * 从项目中的JSON配置文件加载 More sections 数据
 * 如果section有markdownFile字段，会加载对应的markdown文件并转换为HTML
 */
export async function loadMoreSections(): Promise<MoreSection[]> {
    try {
        // 确保 moreSectionsConfig 存在且是数组
        if (!moreSectionsConfig) {
            return []
        }
        
        if (!Array.isArray(moreSectionsConfig)) {
            return []
        }
        
        const sections = moreSectionsConfig as MoreSection[]
        
        if (sections.length === 0) {
            return []
        }
        
        // 加载所有markdown文件
        const sectionsWithContent = await Promise.all(
            sections.map(async (section) => {
                if (section.markdownFile) {
                    try {
                        const markdownContent = await loadMarkdownFile(section.markdownFile)
                        if (markdownContent && markdownContent.trim()) {
                            const htmlContent = markdownToHtml(markdownContent)
                            return {
                                ...section,
                                content: htmlContent,
                            }
                        }
                    } catch (error) {
                        // 静默处理错误
                    }
                }
                // 即使 markdown 加载失败，也返回 section（可能没有 content）
                return section
            })
        )
        
        // Promise.all 保证返回相同数量的元素，所以直接返回 sectionsWithContent
        return sectionsWithContent
    } catch (error) {
        // 如果配置加载失败，返回空数组
        return []
    }
}

