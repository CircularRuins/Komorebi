import OpenAI from "openai"
import { getCurrentLocale } from "./settings"
import {
    TranslationConfig,
    TextChunk,
    estimateTokenCount,
    splitTextsIntoChunks,
    normalizeApiEndpoint,
    createOpenAIClient
} from "./translation-utils"

// 重新导出TranslationConfig类型
export type { TranslationConfig } from "./translation-utils"

// 语言名称映射（参考字幕翻译的实现）
const localeToLanguageName: { [key: string]: string } = {
    "en": "English",
    "en-US": "English",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    "ja": "日本語",
    "fr-FR": "Français",
    "de": "Deutsch",
    "es": "Español",
    "it": "Italiano",
    "pt-BR": "Português do Brasil",
    "pt-PT": "Português de Portugal",
    "ru": "Русский",
    "ko": "한국어",
    "nl": "Nederlands",
    "sv": "Svenska",
    "tr": "Türkçe",
    "uk": "Українська",
    "cs": "Čeština",
    "fi-FI": "Suomi",
}

/**
 * 从HTML内容中提取纯文本
 */
function extractTextFromHTML(html: string): string {
    // 创建临时DOM元素来解析HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    
    // 移除script和style标签
    const scripts = doc.querySelectorAll("script, style")
    scripts.forEach(el => el.remove())
    
    // 获取body的文本内容
    return doc.body?.textContent || doc.body?.innerText || ""
}

/**
 * 获取目标语言名称
 */
function getTargetLanguageName(locale: string): string {
    // 先尝试完整locale
    if (localeToLanguageName[locale]) {
        return localeToLanguageName[locale]
    }
    
    // 尝试只使用语言代码
    const langCode = locale.split("-")[0]
    if (localeToLanguageName[langCode]) {
        return localeToLanguageName[langCode]
    }
    
    // 默认返回English
    return "English"
}

// 重新导出共享类型和函数
export type { TextChunk } from "./translation-utils"
export { estimateTokenCount, splitTextsIntoChunks } from "./translation-utils"

/**
 * 翻译结果类型
 */
export type TranslationResult = {
    title: string
    content: string
}

/**
 * 翻译单个文本块的结果
 */
export type ChunkTranslationResult = {
    texts: string[]
    title?: string
}

/**
 * 翻译单个文本段落
 * @param text 要翻译的文本
 * @param targetLanguage 目标语言名称
 * @param config 翻译配置
 * @returns 翻译后的文本
 */
async function translateSingleText(
    text: string,
    targetLanguage: string,
    config: TranslationConfig
): Promise<string> {
    const { model } = config

    // 构建简单的翻译提示词
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is.

${text}`

    const openai = createOpenAIClient(config)

    const completion = await openai.chat.completions.create({
        model: model,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: 0.3,
        max_tokens: 8000,
    })

    // 记录API调用（动态导入，避免在主进程中打包）
    if (completion.usage) {
        import("./api-call-recorder").then(({ recordApiCall }) => {
            recordApiCall(model, 'chat', 'article-translation-paragraph', completion.usage).catch(err => {
                console.error('记录API调用失败:', err)
            })
        }).catch(() => {
            // 忽略导入失败（可能是在主进程中）
        })
    }

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        const translatedText = completion.choices[0].message.content || ''
        if (!translatedText) {
            throw new Error('翻译结果为空')
        }
        return translatedText.trim()
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
}

/**
 * 翻译文章内容（包括标题和正文）
 * @param title 文章标题
 * @param content HTML格式的文章内容
 * @param config 翻译配置
 * @param targetLanguageCode 可选的目标语言代码（如 'en', 'zh-CN', 'ja', 'es'），如果不提供则使用应用设置的语言
 * @returns 翻译后的标题和HTML内容
 */
export async function translateArticleWithTitle(
    title: string,
    content: string,
    config: TranslationConfig,
    targetLanguageCode?: string
): Promise<TranslationResult> {
    const { apiEndpoint, apiKey, model } = config

    if (!apiEndpoint || !apiKey || !model) {
        throw new Error("AI模型未配置，请先配置AI模型")
    }

    // 获取目标语言：如果提供了 targetLanguageCode，使用它；否则使用应用设置的语言
    const targetLanguage = targetLanguageCode 
        ? getTargetLanguageName(targetLanguageCode)
        : getTargetLanguageName(getCurrentLocale())

    // 解析HTML并提取文本节点（保存doc和nodes供后续使用）
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, "text/html")
    const scripts = doc.querySelectorAll("script, style")
    scripts.forEach(el => el.remove())
    
    const texts: string[] = []
    const textNodes: Text[] = []
    
    const walker = doc.createTreeWalker(
        doc.body || doc.documentElement,
        NodeFilter.SHOW_TEXT,
        null
    )
    
    let node: Node | null
    while ((node = walker.nextNode())) {
        const textNode = node as Text
        const text = textNode.textContent?.trim()
        if (text && text.length > 0) {
            texts.push(text)
            textNodes.push(textNode)
        }
    }
    
    if (!texts || texts.length === 0) {
        throw new Error("文章内容为空，无法翻译")
    }

    try {
        // 并行翻译标题和所有段落
        const translationPromises = [
            translateSingleText(title, targetLanguage, config).catch((error) => {
                console.error('标题翻译失败:', error)
                return title // 翻译失败时使用原文
            }),
            ...texts.map((text, index) => 
                translateSingleText(text, targetLanguage, config).catch((error) => {
                    console.error(`段落 ${index} 翻译失败:`, error)
                    return text // 翻译失败时使用原文
                })
            )
        ]
        
        const translationResults = await Promise.all(translationPromises)
        
        // 第一个结果是标题，其余是段落
        const translatedTitle = translationResults[0]
        const translatedTexts = translationResults.slice(1)
        
        // 将翻译后的文本替换回节点
        const minLength = Math.min(textNodes.length, translatedTexts.length)
        for (let i = 0; i < minLength; i++) {
            textNodes[i].textContent = translatedTexts[i].trim()
        }
        
        // 返回翻译后的标题和HTML内容
        return {
            title: translatedTitle,
            content: doc.body?.innerHTML || doc.documentElement.innerHTML
        }
    } catch (error: any) {
        if (error instanceof OpenAI.APIError) {
            let errorMessage = error.message
            if (error.status === 404) {
                errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查:\n1. Translation API Endpoint是否正确（完整的URL路径）\n2. 是否需要包含特定的路径（如 /v1/chat/completions）\n3. API服务是否正常运行`
            } else if (error.status === 401) {
                errorMessage = `401错误: API密钥无效\n${error.message}\n\n请检查Translation API Key是否正确`
            } else if (error.status === 429) {
                errorMessage = `429错误: 请求频率过高\n${error.message}\n\n请稍后再试`
            }
            throw new Error(errorMessage)
        } else if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`翻译失败: ${String(error)}`)
        }
    }
}

/**
 * 翻译文章内容（保持向后兼容）
 * @param content HTML格式的文章内容
 * @param config 翻译配置
 * @returns 翻译后的HTML内容
 */
export async function translateArticle(
    content: string,
    config: TranslationConfig
): Promise<string> {
    const { apiEndpoint, apiKey, model } = config

    if (!apiEndpoint || !apiKey || !model) {
        throw new Error("AI模型未配置，请先配置AI模型")
    }

    // 获取目标语言
    const locale = getCurrentLocale()
    const targetLanguage = getTargetLanguageName(locale)

    // 解析HTML并提取文本节点（保存doc和nodes供后续使用）
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, "text/html")
    const scripts = doc.querySelectorAll("script, style")
    scripts.forEach(el => el.remove())
    
    const texts: string[] = []
    const textNodes: Text[] = []
    
    const walker = doc.createTreeWalker(
        doc.body || doc.documentElement,
        NodeFilter.SHOW_TEXT,
        null
    )
    
    let node: Node | null
    while ((node = walker.nextNode())) {
        const textNode = node as Text
        const text = textNode.textContent?.trim()
        if (text && text.length > 0) {
            texts.push(text)
            textNodes.push(textNode)
        }
    }
    
    if (!texts || texts.length === 0) {
        throw new Error("文章内容为空，无法翻译")
    }

    try {
        // 并行翻译所有段落
        const translationPromises = texts.map((text, index) => 
            translateSingleText(text, targetLanguage, config).catch((error) => {
                console.error(`段落 ${index} 翻译失败:`, error)
                return text // 翻译失败时使用原文
            })
        )
        
        const translatedTexts = await Promise.all(translationPromises)
        
        // 将翻译后的文本替换回节点
        const minLength = Math.min(textNodes.length, translatedTexts.length)
        for (let i = 0; i < minLength; i++) {
            textNodes[i].textContent = translatedTexts[i].trim()
        }
        
        // 返回修改后的HTML
        return (doc.body?.innerHTML || doc.documentElement.innerHTML)
    } catch (error: any) {
        if (error instanceof OpenAI.APIError) {
            let errorMessage = error.message
            if (error.status === 404) {
                errorMessage = `404错误: 请求的URL不存在\n${error.message}\n\n请检查:\n1. Translation API Endpoint是否正确（完整的URL路径）\n2. 是否需要包含特定的路径（如 /v1/chat/completions）\n3. API服务是否正常运行`
            } else if (error.status === 401) {
                errorMessage = `401错误: API密钥无效\n${error.message}\n\n请检查Translation API Key是否正确`
            } else if (error.status === 429) {
                errorMessage = `429错误: 请求频率过高\n${error.message}\n\n请稍后再试`
            }
            throw new Error(errorMessage)
        } else if (error instanceof Error) {
            throw error
        } else {
            throw new Error(`翻译失败: ${String(error)}`)
        }
    }
}

