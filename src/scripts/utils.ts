import intl from "react-intl-universal"
import { ThunkAction, ThunkDispatch } from "redux-thunk"
import { AnyAction } from "redux"
import { RootState } from "./reducer"
import Parser from "rss-parser"
import Url from "url"
import { SearchEngines } from "../schema-types"

export enum ActionStatus {
    Request,
    Success,
    Failure,
    Intermediate,
}

export type AppThunk<ReturnType = void> = ThunkAction<
    ReturnType,
    RootState,
    unknown,
    AnyAction
>

export type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>

const rssParser = new Parser({
    customFields: {
        feed: [
            ["itunes:image", "itunesImage"],
            ["logo", "logo"],
            ["icon", "icon"],
        ] as any,
        item: [
            "thumb",
            "image",
            ["content:encoded", "fullContent"],
            ["media:content", "mediaContent", { keepArray: true }],
            ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
            ["media:description", "mediaDescription"],
            ["media:group", "mediaGroup"],
        ],
    },
})
type extractGeneric<Type> = Type extends Parser<infer _, infer U> ? U : never
export type MyParserItem = extractGeneric<typeof rssParser> & Parser.Item

const CHARSET_RE = /charset=([^()<>@,;:\"/[\]?.=\s]*)/i
const XML_ENCODING_RE = /^<\?xml.+encoding="(.+?)".*?\?>/i
export async function decodeFetchResponse(response: Response, isHTML = false) {
    const buffer = await response.arrayBuffer()
    let ctype =
        response.headers.has("content-type") &&
        response.headers.get("content-type")
    let charset =
        ctype && CHARSET_RE.test(ctype) ? CHARSET_RE.exec(ctype)[1] : undefined
    let content = new TextDecoder(charset).decode(buffer)
    if (charset === undefined) {
        if (isHTML) {
            const dom = domParser.parseFromString(content, "text/html")
            charset = dom
                .querySelector("meta[charset]")
                ?.getAttribute("charset")
                ?.toLowerCase()
            if (!charset) {
                ctype = dom
                    .querySelector("meta[http-equiv='Content-Type']")
                    ?.getAttribute("content")
                charset =
                    ctype &&
                    CHARSET_RE.test(ctype) &&
                    CHARSET_RE.exec(ctype)[1].toLowerCase()
            }
        } else {
            charset =
                XML_ENCODING_RE.test(content) &&
                XML_ENCODING_RE.exec(content)[1].toLowerCase()
        }
        if (charset && charset !== "utf-8" && charset !== "utf8") {
            content = new TextDecoder(charset).decode(buffer)
        }
    }
    return content
}

export async function parseRSS(url: string) {
    let result: Response
    try {
        result = await fetch(url, { credentials: "omit" })
    } catch {
        throw new Error(intl.get("log.networkError"))
    }
    if (result && result.ok) {
        try {
            const xmlContent = await decodeFetchResponse(result)
            const parsed = await rssParser.parseString(xmlContent)
            
            // Manually extract media:thumbnail from media:group for YouTube feeds
            // rss-parser may not parse nested elements correctly
            try {
                const xmlDoc = domParser.parseFromString(xmlContent, "text/xml")
                // YouTube uses Atom feed format with <entry> elements, not <item>
                const items = xmlDoc.querySelectorAll("item, entry")
                
                // Media RSS namespace
                const mediaNS = "http://search.yahoo.com/mrss/"
                
                parsed.items.forEach((item, index) => {
                    if (index < items.length) {
                        const xmlItem = items[index]
                        // Look for media:group using namespace-aware method
                        let mediaGroup: Element | null = null
                        
                        // Try querySelector first (works if namespace prefix is preserved)
                        try {
                            mediaGroup = xmlItem.querySelector("media\\:group") || xmlItem.querySelector("group")
                        } catch (e) {
                            // querySelector failed, try getElementsByTagNameNS
                        }
                        
                        // If querySelector didn't work, use namespace-aware method
                        if (!mediaGroup) {
                            const groups = xmlItem.getElementsByTagNameNS(mediaNS, "group")
                            if (groups.length > 0) {
                                mediaGroup = groups[0]
                            }
                        }
                        
                        if (mediaGroup) {
                            // Look for media:thumbnail in media:group
                            let mediaThumbnail: Element | null = null
                            
                            try {
                                mediaThumbnail = mediaGroup.querySelector("media\\:thumbnail") || 
                                                mediaGroup.querySelector("thumbnail")
                            } catch (e) {
                                // querySelector failed
                            }
                            
                            if (!mediaThumbnail) {
                                const thumbnails = mediaGroup.getElementsByTagNameNS(mediaNS, "thumbnail")
                                if (thumbnails.length > 0) {
                                    mediaThumbnail = thumbnails[0]
                                }
                            }
                            
                            if (mediaThumbnail && mediaThumbnail.getAttribute("url")) {
                                const thumbnailUrl = mediaThumbnail.getAttribute("url")
                                // Add to parsed item if not already present
                                if (!item.mediaThumbnail) {
                                    item.mediaThumbnail = [{
                                        $: { url: thumbnailUrl }
                                    }]
                                }
                            }
                            
                            // Look for media:description in media:group
                            let mediaDescription: Element | null = null
                            
                            try {
                                mediaDescription = mediaGroup.querySelector("media\\:description") || 
                                                  mediaGroup.querySelector("description")
                            } catch (e) {
                                // querySelector failed
                            }
                            
                            if (!mediaDescription) {
                                const descriptions = mediaGroup.getElementsByTagNameNS(mediaNS, "description")
                                if (descriptions.length > 0) {
                                    mediaDescription = descriptions[0]
                                }
                            }
                            
                            if (mediaDescription && mediaDescription.textContent) {
                                const descriptionText = mediaDescription.textContent.trim()
                                // Add to parsed item if not already present
                                if (!item.mediaDescription) {
                                    item.mediaDescription = descriptionText
                                }
                            }
                            
                            // Look for media:content in media:group
                            let mediaContent: Element | null = null
                            
                            try {
                                mediaContent = mediaGroup.querySelector("media\\:content") || 
                                              mediaGroup.querySelector("content")
                            } catch (e) {
                                // querySelector failed
                            }
                            
                            if (!mediaContent) {
                                const contents = mediaGroup.getElementsByTagNameNS(mediaNS, "content")
                                if (contents.length > 0) {
                                    mediaContent = contents[0]
                                }
                            }
                            
                            if (mediaContent) {
                                // Extract content from media:content
                                // It might have textContent or be a self-closing tag with URL
                                const contentText = mediaContent.textContent?.trim() || ""
                                const contentUrl = mediaContent.getAttribute("url") || ""
                                
                                // For YouTube, media:content might contain video embed code or URL
                                // If there's text content, use it; otherwise construct embed from URL
                                if (contentText) {
                                    if (!item.content || item.content.trim() === "") {
                                        item.content = contentText
                                    }
                                } else if (contentUrl) {
                                    // If it's a YouTube video URL, create embed code
                                    const videoIdMatch = contentUrl.match(/[?&]v=([^&]+)/) || 
                                                        contentUrl.match(/youtu\.be\/([^?&]+)/) ||
                                                        contentUrl.match(/embed\/([^?&]+)/)
                                    if (videoIdMatch) {
                                        const videoId = videoIdMatch[1]
                                        const embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                                        if (!item.content || item.content.trim() === "") {
                                            item.content = embedHtml
                                        }
                                    } else if (!item.content || item.content.trim() === "") {
                                        // For other media content, use the URL as a link
                                        item.content = `<a href="${contentUrl}">${contentUrl}</a>`
                                    }
                                }
                            }
                        } else {
                            // Also check for media:thumbnail directly in item
                            let mediaThumbnail: Element | null = null
                            
                            try {
                                mediaThumbnail = xmlItem.querySelector("media\\:thumbnail") || 
                                                xmlItem.querySelector("thumbnail")
                            } catch (e) {
                                // querySelector failed
                            }
                            
                            if (!mediaThumbnail) {
                                const thumbnails = xmlItem.getElementsByTagNameNS(mediaNS, "thumbnail")
                                if (thumbnails.length > 0) {
                                    mediaThumbnail = thumbnails[0]
                                }
                            }
                            
                            if (mediaThumbnail && mediaThumbnail.getAttribute("url")) {
                                const thumbnailUrl = mediaThumbnail.getAttribute("url")
                                if (!item.mediaThumbnail) {
                                    item.mediaThumbnail = [{
                                        $: { url: thumbnailUrl }
                                    }]
                                }
                            }
                            
                            // Also check for media:description directly in item
                            let mediaDescription: Element | null = null
                            
                            try {
                                mediaDescription = xmlItem.querySelector("media\\:description") || 
                                                  xmlItem.querySelector("description")
                            } catch (e) {
                                // querySelector failed
                            }
                            
                            if (!mediaDescription) {
                                const descriptions = xmlItem.getElementsByTagNameNS(mediaNS, "description")
                                if (descriptions.length > 0) {
                                    mediaDescription = descriptions[0]
                                }
                            }
                            
                            if (mediaDescription && mediaDescription.textContent) {
                                const descriptionText = mediaDescription.textContent.trim()
                                if (!item.mediaDescription) {
                                    item.mediaDescription = descriptionText
                                }
                            }
                            
                            // Also check for media:content directly in item
                            let mediaContent: Element | null = null
                            
                            try {
                                mediaContent = xmlItem.querySelector("media\\:content") || 
                                              xmlItem.querySelector("content")
                            } catch (e) {
                                // querySelector failed
                            }
                            
                            if (!mediaContent) {
                                const contents = xmlItem.getElementsByTagNameNS(mediaNS, "content")
                                if (contents.length > 0) {
                                    mediaContent = contents[0]
                                }
                            }
                            
                            if (mediaContent) {
                                const contentText = mediaContent.textContent?.trim() || ""
                                const contentUrl = mediaContent.getAttribute("url") || ""
                                
                                if (contentText && (!item.content || item.content.trim() === "")) {
                                    item.content = contentText
                                } else if (contentUrl && (!item.content || item.content.trim() === "")) {
                                    const videoIdMatch = contentUrl.match(/[?&]v=([^&]+)/) || 
                                                        contentUrl.match(/youtu\.be\/([^?&]+)/) ||
                                                        contentUrl.match(/embed\/([^?&]+)/)
                                    if (videoIdMatch) {
                                        const videoId = videoIdMatch[1]
                                        const embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
                                        item.content = embedHtml
                                    } else {
                                        item.content = `<a href="${contentUrl}">${contentUrl}</a>`
                                    }
                                }
                            }
                        }
                    }
                })
            } catch (e) {
                // Ignore XML parsing errors, fall back to rss-parser results
                console.warn("Failed to manually extract media:thumbnail:", e)
            }
            
            return parsed
        } catch {
            throw new Error(intl.get("log.parseError"))
        }
    } else {
        throw new Error(result.status + " " + result.statusText)
    }
}

export const domParser = new DOMParser()

export async function fetchFavicon(url: string) {
    try {
        url = url.split("/").slice(0, 3).join("/")
        let result = await fetch(url, { credentials: "omit" })
        if (result.ok) {
            let html = await result.text()
            // Remove stylesheet links to prevent CSP violations when parsing HTML
            html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '')
            let dom = domParser.parseFromString(html, "text/html")
            let links = dom.getElementsByTagName("link")
            for (let link of links) {
                let rel = link.getAttribute("rel")
                if (
                    (rel === "icon" || rel === "shortcut icon") &&
                    link.hasAttribute("href")
                ) {
                    let href = link.getAttribute("href")
                    let parsedUrl = Url.parse(url)
                    if (href.startsWith("//")) return parsedUrl.protocol + href
                    else if (href.startsWith("/")) return url + href
                    else return href
                }
            }
        }
        url = url + "/favicon.ico"
        if (await validateFavicon(url)) {
            return url
        } else {
            return null
        }
    } catch {
        return null
    }
}

export async function validateFavicon(url: string) {
    let flag = false
    try {
        const result = await fetch(url, { credentials: "omit" })
        if (
            result.status == 200 &&
            result.headers.has("Content-Type") &&
            result.headers.get("Content-Type").startsWith("image")
        ) {
            flag = true
        }
    } finally {
        return flag
    }
}

// Feed 图标缓存工具函数
const FEED_ICON_CACHE_PREFIX = "feed-icon-"
const CACHE_EXPIRY_DAYS = 7 // 1周过期

interface CachedIcon {
    iconUrl: string
    timestamp: number
}

/**
 * 从缓存获取 feed 图标 URL
 * @param url feed URL
 * @returns 图标 URL，如果缓存不存在或已过期则返回 null
 */
export function getCachedFeedIcon(url: string): string | null {
    try {
        const cacheKey = FEED_ICON_CACHE_PREFIX + url
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
            const data: CachedIcon = JSON.parse(cached)
            const now = Date.now()
            const expiryTime = data.timestamp + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
            
            // 检查是否过期（超过1周）
            if (now < expiryTime) {
                return data.iconUrl
            } else {
                // 缓存已过期，删除
                localStorage.removeItem(cacheKey)
            }
        }
    } catch (error) {
        // 如果解析失败，忽略错误
    }
    return null
}

/**
 * 保存 feed 图标 URL 到缓存
 * @param url feed URL
 * @param iconUrl 图标 URL
 */
export function setCachedFeedIcon(url: string, iconUrl: string): void {
    try {
        const cacheKey = FEED_ICON_CACHE_PREFIX + url
        const data: CachedIcon = {
            iconUrl: iconUrl,
            timestamp: Date.now(),
        }
        localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (error) {
        // 如果存储失败（如 localStorage 已满），忽略错误
    }
}

export function htmlDecode(input: string) {
    var doc = domParser.parseFromString(input, "text/html")
    return doc.documentElement.textContent
}

export const urlTest = (s: string) =>
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,63}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi.test(
        s
    )

export const getWindowBreakpoint = () => window.outerWidth >= 1440

export const cutText = (s: string, length: number) => {
    return s.length <= length ? s : s.slice(0, length) + "…"
}

export function getSearchEngineName(engine: SearchEngines) {
    switch (engine) {
        case SearchEngines.Google:
            return intl.get("searchEngine.google")
        case SearchEngines.Bing:
            return intl.get("searchEngine.bing")
        case SearchEngines.Baidu:
            return intl.get("searchEngine.baidu")
        case SearchEngines.DuckDuckGo:
            return intl.get("searchEngine.duckduckgo")
    }
}
export function webSearch(text: string, engine = SearchEngines.Google) {
    switch (engine) {
        case SearchEngines.Google:
            return window.utils.openExternal(
                "https://www.google.com/search?q=" + encodeURIComponent(text)
            )
        case SearchEngines.Bing:
            return window.utils.openExternal(
                "https://www.bing.com/search?q=" + encodeURIComponent(text)
            )
        case SearchEngines.Baidu:
            return window.utils.openExternal(
                "https://www.baidu.com/s?wd=" + encodeURIComponent(text)
            )
        case SearchEngines.DuckDuckGo:
            return window.utils.openExternal(
                "https://duckduckgo.com/?q=" + encodeURIComponent(text)
            )
    }
}

export function mergeSortedArrays<T>(
    a: T[],
    b: T[],
    cmp: (x: T, y: T) => number
): T[] {
    let merged = new Array<T>()
    let i = 0
    let j = 0
    while (i < a.length && j < b.length) {
        if (cmp(a[i], b[j]) <= 0) {
            merged.push(a[i++])
        } else {
            merged.push(b[j++])
        }
    }
    while (i < a.length) merged.push(a[i++])
    while (j < b.length) merged.push(b[j++])
    return merged
}

export function byteToMB(B: number) {
    if (B === 0) return "0MB"
    // 如果小于1MB，显示KB
    if (B < 1048576) {
        const KB = Math.round(B / 1024)
        return KB > 0 ? KB + "KB" : "<1KB"
    }
    // 大于等于1MB时，保留1位小数
    const MB = (B / 1048576).toFixed(1)
    // 如果小数部分是0，只显示整数部分
    return MB.endsWith(".0") ? Math.round(B / 1048576) + "MB" : MB + "MB"
}

function byteLength(str: string) {
    var s = str.length
    for (var i = str.length - 1; i >= 0; i--) {
        var code = str.charCodeAt(i)
        if (code > 0x7f && code <= 0x7ff) s++
        else if (code > 0x7ff && code <= 0xffff) s += 2
        if (code >= 0xdc00 && code <= 0xdfff) i-- //trail surrogate
    }
    return s
}

export async function calculateItemSize(): Promise<number> {
    try {
        // 使用 Lovefield 查询所有文章
        const db = await import("./db")
        // 确保数据库已初始化
        if (!db.itemsDB || !db.items) {
            console.log("数据库未初始化，正在初始化...")
            await db.init()
        }
        
        if (!db.itemsDB || !db.items) {
            console.error("数据库初始化失败，itemsDB:", !!db.itemsDB, "items:", !!db.items)
            return 0
        }
        

        // 隐藏功能已移除，计算所有文章
        const allItems = (await db.itemsDB.select().from(db.items).exec()) as any[]
        
        if (allItems.length === 0) {
            console.log("数据库中没有文章")
            return 0
        }
        
        let result = 0
        for (let item of allItems) {
            try {
                const itemSize = byteLength(JSON.stringify(item))
                result += itemSize
            } catch (e) {
                console.warn("计算单篇文章大小失败:", e)
            }
        }
        
        
        return result
    } catch (error) {
        console.error("计算文章大小失败:", error)
        console.error("错误详情:", error instanceof Error ? error.stack : error)
        // 如果出错，返回0而不是抛出错误
        return 0
    }
}

export function validateRegex(regex: string, flags = ""): RegExp {
    try {
        return new RegExp(regex, flags)
    } catch {
        return null
    }
}

export function platformCtrl(
    e: React.MouseEvent | React.KeyboardEvent | MouseEvent | KeyboardEvent
) {
    return window.utils.platform === "darwin" ? e.metaKey : e.ctrlKey
}

export function initTouchBarWithTexts() {
    window.utils.initTouchBar({
        menu: intl.get("nav.menu"),
        search: intl.get("search"),
        refresh: intl.get("nav.refresh"),
        markAll: intl.get("nav.markAllRead"),
    })
}
