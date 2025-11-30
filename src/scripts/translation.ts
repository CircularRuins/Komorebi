import OpenAI from "openai"
import { getCurrentLocale } from "./settings"

// 翻译配置类型
export type TranslationConfig = {
    apiEndpoint: string
    apiKey: string
    model: string
}

// 语言名称映射
const localeToLanguageName: { [key: string]: string } = {
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

/**
 * 翻译结果类型
 */
export type TranslationResult = {
    title: string
    content: string
}

/**
 * 翻译文章内容（包括标题和正文）
 * @param title 文章标题
 * @param content HTML格式的文章内容
 * @param config 翻译配置
 * @returns 翻译后的标题和HTML内容
 */
export async function translateArticleWithTitle(
    title: string,
    content: string,
    config: TranslationConfig
): Promise<TranslationResult> {
    const { apiEndpoint, apiKey, model } = config

    if (!apiEndpoint || !apiKey || !model) {
        throw new Error("翻译配置不完整，请先设置翻译API配置")
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

    // 将标题和正文合并，用特殊分隔符分开
    const titleContentSeparator = '---TITLE_CONTENT_SEPARATOR---'
    const textToTranslate = `${title}\n\n${titleContentSeparator}\n\n${texts.join('\n\n---SEPARATOR---\n\n')}`
    
    // 构建翻译提示词
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each paragraph separated by "---SEPARATOR---".

${textToTranslate}`

    try {
        // 规范化API端点
        let normalizedEndpoint = apiEndpoint.trim()
        if (!normalizedEndpoint.startsWith("http://") && !normalizedEndpoint.startsWith("https://")) {
            normalizedEndpoint = "https://" + normalizedEndpoint
        }
        // 确保端点包含完整路径
        if (!normalizedEndpoint.includes("/v1/chat/completions")) {
            normalizedEndpoint = normalizedEndpoint.replace(/\/$/, "") + "/v1/chat/completions"
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: normalizedEndpoint.replace("/v1/chat/completions", ""),
            dangerouslyAllowBrowser: true
        })

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

        if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
            const translatedText = completion.choices[0].message.content || ''
            if (!translatedText) {
                throw new Error('翻译结果为空')
            }
            
            // 按分隔符分割标题和正文
            const titleContentSeparator = '---TITLE_CONTENT_SEPARATOR---'
            let translatedTitle = title
            let translatedContentText = translatedText
            
            if (translatedText.includes(titleContentSeparator)) {
                const parts = translatedText.split(titleContentSeparator)
                if (parts.length >= 2) {
                    translatedTitle = parts[0].trim()
                    translatedContentText = parts.slice(1).join(titleContentSeparator).trim()
                }
            } else {
                // 如果没有找到分隔符，尝试其他方式
                // 尝试按第一个 ---SEPARATOR--- 分割（如果标题很短，可能在第一个分隔符之前）
                const firstSeparatorIndex = translatedText.indexOf('---SEPARATOR---')
                if (firstSeparatorIndex > 0 && firstSeparatorIndex < 200) {
                    // 如果第一个分隔符前的内容较短，可能是标题
                    translatedTitle = translatedText.substring(0, firstSeparatorIndex).trim()
                    translatedContentText = translatedText.substring(firstSeparatorIndex).trim()
                }
            }
            
            // 将翻译后的正文文本按分隔符分割
            let translatedTexts = translatedContentText.split('\n\n---SEPARATOR---\n\n')
            
            // 如果分割后的数量不匹配，尝试其他分隔方式
            if (translatedTexts.length !== texts.length) {
                // 尝试只使用 ---SEPARATOR--- 分割
                const altSplit = translatedContentText.split('---SEPARATOR---')
                if (altSplit.length === texts.length) {
                    translatedTexts = altSplit.map(t => t.trim())
                } else if (translatedTexts.length === 1 && texts.length === 1) {
                    // 只有一个文本块，直接使用
                    translatedTexts = [translatedContentText.trim()]
                } else {
                    // 如果还是不匹配，尝试清理分隔符后再分割
                    const cleaned = translatedContentText.replace(/\n\n---SEPARATOR---\n\n/g, '---SEPARATOR---')
                    const cleanedSplit = cleaned.split('---SEPARATOR---')
                    if (cleanedSplit.length === texts.length) {
                        translatedTexts = cleanedSplit.map(t => t.trim())
                    }
                }
            }
            
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
        } else {
            throw new Error('API返回格式不正确，未找到choices数组或message内容')
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
        throw new Error("翻译配置不完整，请先设置翻译API配置")
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

    // 将所有文本合并，用特殊标记分隔，以便翻译后能分割回原位置
    const textToTranslate = texts.join('\n\n---SEPARATOR---\n\n')
    
    // 构建翻译提示词
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each paragraph separated by "---SEPARATOR---".

${textToTranslate}`

    try {
        // 规范化API端点
        let normalizedEndpoint = apiEndpoint.trim()
        if (!normalizedEndpoint.startsWith("http://") && !normalizedEndpoint.startsWith("https://")) {
            normalizedEndpoint = "https://" + normalizedEndpoint
        }
        // 确保端点包含完整路径
        if (!normalizedEndpoint.includes("/v1/chat/completions")) {
            normalizedEndpoint = normalizedEndpoint.replace(/\/$/, "") + "/v1/chat/completions"
        }

        const openai = new OpenAI({
            apiKey: apiKey,
            baseURL: normalizedEndpoint.replace("/v1/chat/completions", ""),
            dangerouslyAllowBrowser: true
        })

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

        if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
            const translatedText = completion.choices[0].message.content || ''
            if (!translatedText) {
                throw new Error('翻译结果为空')
            }
            
            // 将翻译后的文本按分隔符分割
            let translatedTexts = translatedText.split('\n\n---SEPARATOR---\n\n')
            
            // 如果分割后的数量不匹配，尝试其他分隔方式
            if (translatedTexts.length !== texts.length) {
                // 尝试只使用 ---SEPARATOR--- 分割
                const altSplit = translatedText.split('---SEPARATOR---')
                if (altSplit.length === texts.length) {
                    translatedTexts = altSplit.map(t => t.trim())
                } else if (translatedTexts.length === 1 && texts.length === 1) {
                    // 只有一个文本块，直接使用
                    translatedTexts = [translatedText.trim()]
                } else {
                    // 如果还是不匹配，尝试清理分隔符后再分割
                    const cleaned = translatedText.replace(/\n\n---SEPARATOR---\n\n/g, '---SEPARATOR---')
                    const cleanedSplit = cleaned.split('---SEPARATOR---')
                    if (cleanedSplit.length === texts.length) {
                        translatedTexts = cleanedSplit.map(t => t.trim())
                    }
                }
            }
            
            // 将翻译后的文本替换回节点
            const minLength = Math.min(textNodes.length, translatedTexts.length)
            for (let i = 0; i < minLength; i++) {
                textNodes[i].textContent = translatedTexts[i].trim()
            }
            
            // 返回修改后的HTML
            return (doc.body?.innerHTML || doc.documentElement.innerHTML)
        } else {
            throw new Error('API返回格式不正确，未找到choices数组或message内容')
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

