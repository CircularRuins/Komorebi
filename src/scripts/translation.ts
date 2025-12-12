import OpenAI from "openai"
import { getCurrentLocale } from "./settings"
import {
    TranslationConfig,
    TextChunk,
    estimateTokenCount,
    splitTextsIntoChunks,
    normalizeApiEndpoint,
    createOpenAIClient,
    parseTranslatedText,
    translateTextChunk as translateTextChunkUtil
} from "./translation-utils"

// 重新导出TranslationConfig类型
export type { TranslationConfig } from "./translation-utils"

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
 * 翻译单个文本块（用于文章翻译，包含标题）
 */
async function translateChunkWithTitle(
    chunk: TextChunk,
    title: string | null,
    targetLanguage: string,
    config: TranslationConfig,
    isFirstChunk: boolean
): Promise<ChunkTranslationResult> {
    const { apiEndpoint, apiKey, model } = config

    // 构建要翻译的文本
    const titleContentSeparator = '---TITLE_CONTENT_SEPARATOR---'
    let textToTranslate: string
    
    if (title && isFirstChunk) {
        // 第一个chunk包含标题
        textToTranslate = `${title}\n\n${titleContentSeparator}\n\n${chunk.texts.join('\n\n---SEPARATOR---\n\n')}`
    } else {
        textToTranslate = chunk.texts.join('\n\n---SEPARATOR---\n\n')
    }

    // 构建翻译提示词
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each paragraph separated by "---SEPARATOR---".

${textToTranslate}`

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

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        const translatedText = completion.choices[0].message.content || ''
        if (!translatedText) {
            throw new Error('翻译结果为空')
        }

        // 如果包含标题分隔符，需要提取标题和正文部分
        let translatedTitle: string | undefined
        let translatedContentText = translatedText
        if (title && isFirstChunk && translatedText.includes(titleContentSeparator)) {
            const parts = translatedText.split(titleContentSeparator)
            if (parts.length >= 2) {
                translatedTitle = parts[0].trim()
                translatedContentText = parts.slice(1).join(titleContentSeparator).trim()
            }
        }

        // 使用共享的解析函数
        const translatedTexts = parseTranslatedText(translatedContentText, chunk.texts.length)

        const result: ChunkTranslationResult = { texts: translatedTexts }
        if (translatedTitle) {
            result.title = translatedTitle
        }
        return result
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
}

/**
 * 翻译单个文本块（用于文章翻译，包含标题）
 */
async function translateChunk(
    chunk: TextChunk,
    title: string | null,
    targetLanguage: string,
    config: TranslationConfig,
    isFirstChunk: boolean
): Promise<ChunkTranslationResult> {
    const { apiEndpoint, apiKey, model } = config

    // 构建要翻译的文本
    const titleContentSeparator = '---TITLE_CONTENT_SEPARATOR---'
    let textToTranslate: string
    
    if (title && isFirstChunk) {
        // 第一个chunk包含标题
        textToTranslate = `${title}\n\n${titleContentSeparator}\n\n${chunk.texts.join('\n\n---SEPARATOR---\n\n')}`
    } else {
        textToTranslate = chunk.texts.join('\n\n---SEPARATOR---\n\n')
    }

    // 构建翻译提示词
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each paragraph separated by "---SEPARATOR---".

${textToTranslate}`

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

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
        const translatedText = completion.choices[0].message.content || ''
        if (!translatedText) {
            throw new Error('翻译结果为空')
        }

        // 如果包含标题分隔符，需要提取标题和正文部分
        let translatedTitle: string | undefined
        let translatedContentText = translatedText
        if (title && isFirstChunk && translatedText.includes(titleContentSeparator)) {
            const parts = translatedText.split(titleContentSeparator)
            if (parts.length >= 2) {
                translatedTitle = parts[0].trim()
                translatedContentText = parts.slice(1).join(titleContentSeparator).trim()
            }
        }

        // 使用共享的解析函数
        const translatedTexts = parseTranslatedText(translatedContentText, chunk.texts.length)

        const result: ChunkTranslationResult = { texts: translatedTexts }
        if (translatedTitle) {
            result.title = translatedTitle
        }
        return result
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
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
        throw new Error("翻译配置不完整，请先设置Chat API配置")
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

    // 计算总token数（包括提示词和标题）
    const titleContentSeparator = '---TITLE_CONTENT_SEPARATOR---'
    const textToTranslate = `${title}\n\n${titleContentSeparator}\n\n${texts.join('\n\n---SEPARATOR---\n\n')}`
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each paragraph separated by "---SEPARATOR---".

${textToTranslate}`
    
    const totalTokens = estimateTokenCount(prompt, model)
    const MAX_INPUT_TOKENS = 3000

    try {
        // 如果token数超过限制，进行分段处理
        if (totalTokens > MAX_INPUT_TOKENS) {
            // 分段
            const chunks = splitTextsIntoChunks(texts, title, model, MAX_INPUT_TOKENS)
            
            // 并行翻译所有分段，使用Promise.allSettled以处理部分失败的情况
            const translationPromises = chunks.map((chunk, index) => 
                translateChunkWithTitle(chunk, title, targetLanguage, config, index === 0)
                    .catch((error) => {
                        // 如果某个分段翻译失败，返回错误信息，但继续处理其他分段
                        console.error(`分段 ${index} 翻译失败:`, error)
                        return {
                            texts: chunk.texts, // 使用原文作为后备
                            error: error instanceof Error ? error.message : String(error)
                        } as ChunkTranslationResult & { error?: string }
                    })
            )
            
            const translationResults = await Promise.all(translationPromises)
            const translatedChunks = translationResults.map((result, index) => {
                if ('error' in result) {
                    // 如果翻译失败，使用原文
                    console.warn(`分段 ${index} 翻译失败，使用原文`)
                    return { texts: chunks[index].texts }
                }
                return result
            })
            
            // 合并所有翻译结果
            const allTranslatedTexts: string[] = []
            let translatedTitle = title
            
            for (let i = 0; i < translatedChunks.length; i++) {
                const chunk = chunks[i]
                const translatedChunk = translatedChunks[i]
                
                // 第一个chunk可能包含标题
                if (i === 0 && translatedChunk.title) {
                    translatedTitle = translatedChunk.title
                }
                
                // 确保每个chunk的翻译结果数量与原文匹配
                const expectedCount = chunk.endIndex - chunk.startIndex + 1
                if (translatedChunk.texts.length === expectedCount) {
                    allTranslatedTexts.push(...translatedChunk.texts)
                } else {
                    // 如果数量不匹配，尝试按比例分配或使用原始文本
                    const minLength = Math.min(translatedChunk.texts.length, expectedCount)
                    for (let j = 0; j < minLength; j++) {
                        allTranslatedTexts.push(translatedChunk.texts[j])
                    }
                    // 如果还有缺失的，使用原文
                    for (let j = minLength; j < expectedCount; j++) {
                        allTranslatedTexts.push(texts[chunk.startIndex + j])
                    }
                }
            }
            
            // 将翻译后的文本替换回节点
            const minLength = Math.min(textNodes.length, allTranslatedTexts.length)
            for (let i = 0; i < minLength; i++) {
                textNodes[i].textContent = allTranslatedTexts[i].trim()
            }
            
            // 返回翻译后的标题和HTML内容
            // 注意：由于分段翻译，标题可能没有被翻译，这里保持原标题
            // 如果需要翻译标题，可以在第一个chunk中单独处理
            return {
                title: translatedTitle,
                content: doc.body?.innerHTML || doc.documentElement.innerHTML
            }
        } else {
            // 如果token数未超过限制，使用原有逻辑
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

            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                const translatedText = completion.choices[0].message.content || ''
                if (!translatedText) {
                    throw new Error('翻译结果为空')
                }
                
                // 按分隔符分割标题和正文
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
                    const firstSeparatorIndex = translatedText.indexOf('---SEPARATOR---')
                    if (firstSeparatorIndex > 0 && firstSeparatorIndex < 200) {
                        translatedTitle = translatedText.substring(0, firstSeparatorIndex).trim()
                        translatedContentText = translatedText.substring(firstSeparatorIndex).trim()
                    }
                }
                
                // 使用共享的解析函数
                const translatedTexts = parseTranslatedText(translatedContentText, texts.length)
                
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
        throw new Error("翻译配置不完整，请先设置Chat API配置")
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

    // 计算总token数
    const textToTranslate = texts.join('\n\n---SEPARATOR---\n\n')
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each paragraph separated by "---SEPARATOR---".

${textToTranslate}`
    
    const totalTokens = estimateTokenCount(prompt, model)
    const MAX_INPUT_TOKENS = 3000

    try {
        // 如果token数超过限制，进行分段处理
        if (totalTokens > MAX_INPUT_TOKENS) {
            // 分段（不包含标题）
            const chunks = splitTextsIntoChunks(texts, null, model, MAX_INPUT_TOKENS)
            
            // 并行翻译所有分段，使用Promise.allSettled以处理部分失败的情况
            const translationPromises = chunks.map((chunk, index) => 
                translateChunk(chunk, null, targetLanguage, config, false)
                    .catch((error) => {
                        // 如果某个分段翻译失败，返回错误信息，但继续处理其他分段
                        console.error(`分段 ${index} 翻译失败:`, error)
                        return {
                            texts: chunk.texts, // 使用原文作为后备
                            error: error instanceof Error ? error.message : String(error)
                        } as ChunkTranslationResult & { error?: string }
                    })
            )
            
            const translationResults = await Promise.all(translationPromises)
            const translatedChunks = translationResults.map((result, index) => {
                if ('error' in result) {
                    // 如果翻译失败，使用原文
                    console.warn(`分段 ${index} 翻译失败，使用原文`)
                    return { texts: chunks[index].texts }
                }
                return result
            })
            
            // 合并所有翻译结果
            const allTranslatedTexts: string[] = []
            
            for (let i = 0; i < translatedChunks.length; i++) {
                const chunk = chunks[i]
                const translatedChunk = translatedChunks[i]
                
                // 确保每个chunk的翻译结果数量与原文匹配
                const expectedCount = chunk.endIndex - chunk.startIndex + 1
                if (translatedChunk.texts.length === expectedCount) {
                    allTranslatedTexts.push(...translatedChunk.texts)
                } else {
                    // 如果数量不匹配，尝试按比例分配或使用原始文本
                    const minLength = Math.min(translatedChunk.texts.length, expectedCount)
                    for (let j = 0; j < minLength; j++) {
                        allTranslatedTexts.push(translatedChunk.texts[j])
                    }
                    // 如果还有缺失的，使用原文
                    for (let j = minLength; j < expectedCount; j++) {
                        allTranslatedTexts.push(texts[chunk.startIndex + j])
                    }
                }
            }
            
            // 将翻译后的文本替换回节点
            const minLength = Math.min(textNodes.length, allTranslatedTexts.length)
            for (let i = 0; i < minLength; i++) {
                textNodes[i].textContent = allTranslatedTexts[i].trim()
            }
            
            // 返回修改后的HTML
            return (doc.body?.innerHTML || doc.documentElement.innerHTML)
        } else {
            // 如果token数未超过限制，使用原有逻辑
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

            if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
                const translatedText = completion.choices[0].message.content || ''
                if (!translatedText) {
                    throw new Error('翻译结果为空')
                }
                
                // 使用共享的解析函数
                const translatedTexts = parseTranslatedText(translatedText, texts.length)
                
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

