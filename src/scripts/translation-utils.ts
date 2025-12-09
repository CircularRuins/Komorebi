import OpenAI from "openai"

// 尝试导入tiktoken，如果失败则使用fallback
// 使用require来避免TypeScript编译时的模块解析问题
let encoding_for_model: ((model: string) => any) | null = null
try {
    // @ts-ignore - tiktoken可能没有类型定义，使用require动态加载
    const tiktoken = require("tiktoken")
    encoding_for_model = tiktoken.encoding_for_model
} catch (error) {
    // tiktoken不可用，将使用fallback方法
    console.warn("tiktoken not available, using fallback token estimation")
}

/**
 * 翻译配置类型
 */
export type TranslationConfig = {
    apiEndpoint: string
    apiKey: string
    model: string
}

/**
 * 文本分段类型
 */
export type TextChunk = {
    texts: string[]
    startIndex: number
    endIndex: number
}

/**
 * 根据模型名称获取对应的编码器
 * 默认使用cl100k_base，适用于GPT-3.5/GPT-4
 */
export function getModelEncoding(model: string) {
    if (!encoding_for_model) {
        return null
    }
    try {
        return encoding_for_model(model as any)
    } catch (error) {
        // 如果模型名称无法识别，使用默认的cl100k_base编码器
        try {
            return encoding_for_model("gpt-3.5-turbo")
        } catch (e) {
            return null
        }
    }
}

/**
 * 估算文本的token数量
 */
export function estimateTokenCount(text: string, model: string): number {
    try {
        const encoding = getModelEncoding(model)
        if (encoding) {
            const tokens = encoding.encode(text)
            encoding.free()
            return tokens.length
        }
    } catch (error) {
        // 如果tiktoken失败，继续使用fallback
    }
    // 如果tiktoken不可用或失败，使用简单的估算方法：字符数 / 4
    // 这是一个粗略的估算，但对于大多数语言来说比较准确
    return Math.ceil(text.length / 4)
}

/**
 * 将文本数组分段，确保每个chunk不超过token限制
 * @param texts 文本数组
 * @param title 标题（可选，用于计算token）
 * @param model 模型名称
 * @param maxTokens 最大token数（默认3000）
 * @returns 分段后的文本块数组
 */
export function splitTextsIntoChunks(
    texts: string[],
    title: string | null,
    model: string,
    maxTokens: number = 3000
): TextChunk[] {
    const chunks: TextChunk[] = []
    let currentChunk: string[] = []
    let currentStartIndex = 0
    let currentTokenCount = 0

    // 估算提示词的token数（大约200 tokens）
    const promptBaseTokens = 200
    const separatorTokens = estimateTokenCount('\n\n---SEPARATOR---\n\n', model)
    const titleSeparatorTokens = title 
        ? estimateTokenCount(`\n\n---TITLE_CONTENT_SEPARATOR---\n\n`, model)
        : 0

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i]
        const textTokens = estimateTokenCount(text, model)
        
        // 计算如果添加这个文本后的总token数
        const titleTokens = title && currentChunk.length === 0 
            ? estimateTokenCount(title, model) + titleSeparatorTokens 
            : 0
        const separatorsTokens = currentChunk.length > 0 ? separatorTokens : 0
        const totalTokens = promptBaseTokens + currentTokenCount + textTokens + 
                           titleTokens + separatorsTokens

        // 如果添加这个文本会超过限制，且当前chunk不为空，则开始新的chunk
        if (totalTokens > maxTokens && currentChunk.length > 0) {
            // 保存当前chunk
            chunks.push({
                texts: [...currentChunk],
                startIndex: currentStartIndex,
                endIndex: i - 1
            })
            
            // 开始新chunk
            currentChunk = [text]
            currentStartIndex = i
            currentTokenCount = textTokens
        } else {
            // 添加到当前chunk
            currentChunk.push(text)
            currentTokenCount += textTokens + (currentChunk.length > 1 ? separatorTokens : 0)
        }
    }

    // 添加最后一个chunk
    if (currentChunk.length > 0) {
        chunks.push({
            texts: currentChunk,
            startIndex: currentStartIndex,
            endIndex: texts.length - 1
        })
    }

    return chunks
}

/**
 * 规范化API端点
 */
export function normalizeApiEndpoint(apiEndpoint: string): string {
    let normalizedEndpoint = apiEndpoint.trim()
    if (!normalizedEndpoint.startsWith("http://") && !normalizedEndpoint.startsWith("https://")) {
        normalizedEndpoint = "https://" + normalizedEndpoint
    }
    if (!normalizedEndpoint.includes("/v1/chat/completions")) {
        normalizedEndpoint = normalizedEndpoint.replace(/\/$/, "") + "/v1/chat/completions"
    }
    return normalizedEndpoint
}

/**
 * 创建OpenAI客户端
 */
export function createOpenAIClient(config: TranslationConfig): OpenAI {
    const normalizedEndpoint = normalizeApiEndpoint(config.apiEndpoint)
    return new OpenAI({
        apiKey: config.apiKey,
        baseURL: normalizedEndpoint.replace("/v1/chat/completions", ""),
        dangerouslyAllowBrowser: true
    })
}

/**
 * 解析翻译结果，处理不同的分隔符格式
 */
export function parseTranslatedText(
    translatedText: string,
    expectedCount: number
): string[] {
    let translatedTexts = translatedText.split('\n\n---SEPARATOR---\n\n')
    
    // 如果分割后的数量不匹配，尝试其他分隔方式
    if (translatedTexts.length !== expectedCount) {
        const altSplit = translatedText.split('---SEPARATOR---')
        if (altSplit.length === expectedCount) {
            translatedTexts = altSplit.map(t => t.trim())
        } else if (translatedTexts.length === 1 && expectedCount === 1) {
            translatedTexts = [translatedText.trim()]
        } else {
            const cleaned = translatedText.replace(/\n\n---SEPARATOR---\n\n/g, '---SEPARATOR---')
            const cleanedSplit = cleaned.split('---SEPARATOR---')
            if (cleanedSplit.length === expectedCount) {
                translatedTexts = cleanedSplit.map(t => t.trim())
            }
        }
    }
    
    return translatedTexts
}

/**
 * 翻译单个文本块（用于字幕翻译，不包含标题）
 */
export async function translateTextChunk(
    chunk: TextChunk,
    targetLanguage: string,
    config: TranslationConfig
): Promise<string[]> {
    // 构建要翻译的文本
    const textToTranslate = chunk.texts.join('\n\n---SEPARATOR---\n\n')

    // 构建翻译提示词
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each segment separated by "---SEPARATOR---".

${textToTranslate}`

    const openai = createOpenAIClient(config)

    const completion = await openai.chat.completions.create({
        model: config.model,
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

        return parseTranslatedText(translatedText, chunk.texts.length)
    } else {
        throw new Error('API返回格式不正确，未找到choices数组或message内容')
    }
}

/**
 * 翻译文本数组（支持分段和并行翻译）
 * @param texts 要翻译的文本数组
 * @param targetLanguage 目标语言
 * @param config 翻译配置
 * @param maxTokens 最大token数（默认3000）
 * @returns 翻译后的文本数组
 */
export async function translateTexts(
    texts: string[],
    targetLanguage: string,
    config: TranslationConfig,
    maxTokens: number = 3000
): Promise<string[]> {
    // 计算总token数
    const textToTranslate = texts.join('\n\n---SEPARATOR---\n\n')
    const prompt = `Please translate the following text into ${targetLanguage}. If the text is already in ${targetLanguage}, return it as is. Maintain the order and structure of the text, with each segment separated by "---SEPARATOR---".

${textToTranslate}`
    
    const totalTokens = estimateTokenCount(prompt, config.model)

    // 如果token数超过限制，进行分段处理
    if (totalTokens > maxTokens) {
        const chunks = splitTextsIntoChunks(texts, null, config.model, maxTokens)
        
        // 并行翻译所有分段
        const translationPromises = chunks.map((chunk, index) => 
            translateTextChunk(chunk, targetLanguage, config)
                .catch((error) => {
                    console.error(`分段 ${index} 翻译失败:`, error)
                    return chunk.texts // 使用原文作为后备
                })
        )
        
        const translatedChunks = await Promise.all(translationPromises)
        
        // 合并所有翻译结果
        const allTranslatedTexts: string[] = []
        for (let i = 0; i < translatedChunks.length; i++) {
            const chunk = chunks[i]
            const translatedChunk = translatedChunks[i]
            
            const expectedCount = chunk.endIndex - chunk.startIndex + 1
            if (translatedChunk.length === expectedCount) {
                allTranslatedTexts.push(...translatedChunk)
            } else {
                // 如果数量不匹配，尝试按比例分配或使用原始文本
                const minLength = Math.min(translatedChunk.length, expectedCount)
                for (let j = 0; j < minLength; j++) {
                    allTranslatedTexts.push(translatedChunk[j])
                }
                // 如果还有缺失的，使用原文
                for (let j = minLength; j < expectedCount; j++) {
                    allTranslatedTexts.push(texts[chunk.startIndex + j])
                }
            }
        }
        
        return allTranslatedTexts
    } else {
        // 如果token数未超过限制，直接翻译
        const openai = createOpenAIClient(config)
        
        const completion = await openai.chat.completions.create({
            model: config.model,
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

            const translatedTexts = parseTranslatedText(translatedText, texts.length)
            
            // 确保返回的数组长度与输入一致
            const result: string[] = []
            for (let i = 0; i < texts.length; i++) {
                if (i < translatedTexts.length) {
                    result.push(translatedTexts[i].trim())
                } else {
                    result.push(texts[i]) // 如果翻译结果较短，使用原文
                }
            }
            
            return result
        } else {
            throw new Error('API返回格式不正确，未找到choices数组或message内容')
        }
    }
}

