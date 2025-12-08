import * as https from "https"
import * as http from "http"

export interface TranscriptSegment {
    text: string
    start: number
    duration: number
}

const WATCH_URL = "https://www.youtube.com/watch?v={video_id}"
const INNERTUBE_API_URL = "https://www.youtube.com/youtubei/v1/player?key={api_key}"
const INNERTUBE_CONTEXT = {
    client: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
    },
}

/**
 * Make HTTP GET request with timeout
 */
function httpGet(url: string, timeout: number = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: "GET",
            headers: {
                "Accept-Language": "en-US",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            timeout: timeout,
        }

        const client = urlObj.protocol === "https:" ? https : http
        const req = client.request(options, (res) => {
            let data = ""
            res.on("data", (chunk) => {
                data += chunk
            })
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data)
                } else {
                    reject(
                        new Error(
                            `HTTP ${res.statusCode}: ${res.statusMessage || "Unknown error"}`
                        )
                    )
                }
            })
        })

        req.on("error", (error) => {
            reject(new Error(`Network error: ${error.message}`))
        })

        req.on("timeout", () => {
            req.destroy()
            reject(new Error(`Request timeout after ${timeout}ms`))
        })

        req.setTimeout(timeout)
        req.end()
    })
}

/**
 * Make HTTP POST request with timeout
 */
function httpPost(url: string, data: any, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const postData = JSON.stringify(data)
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
                "Accept-Language": "en-US",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            timeout: timeout,
        }

        const client = urlObj.protocol === "https:" ? https : http
        const req = client.request(options, (res) => {
            let responseData = ""
            res.on("data", (chunk) => {
                responseData += chunk
            })
            res.on("end", () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(responseData))
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON response: ${e instanceof Error ? e.message : String(e)}`))
                    }
                } else {
                    reject(
                        new Error(
                            `HTTP ${res.statusCode}: ${res.statusMessage || "Unknown error"}`
                        )
                    )
                }
            })
        })

        req.on("error", (error) => {
            reject(new Error(`Network error: ${error.message}`))
        })

        req.on("timeout", () => {
            req.destroy()
            reject(new Error(`Request timeout after ${timeout}ms`))
        })

        req.setTimeout(timeout)
        req.write(postData)
        req.end()
    })
}

/**
 * Extract INNERTUBE_API_KEY from HTML
 */
function extractInnertubeApiKey(html: string): string {
    const pattern = /"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/
    const match = html.match(pattern)
    if (match && match[1]) {
        return match[1]
    }
    if (html.includes('class="g-recaptcha"')) {
        throw new Error("IP blocked by YouTube")
    }
    throw new Error("Failed to extract INNERTUBE_API_KEY from YouTube page")
}

/**
 * Assert playability status
 */
function assertPlayability(
    playabilityStatus: any,
    videoId: string
): void {
    if (!playabilityStatus) return

    const status = playabilityStatus.status
    if (status === "OK" || !status) return

    const reason = playabilityStatus.reason || ""
    if (status === "LOGIN_REQUIRED") {
        if (reason.includes("bot")) {
            throw new Error("Request blocked by YouTube")
        }
        if (reason.includes("inappropriate")) {
            throw new Error("Age restricted video")
        }
    }
    if (status === "ERROR" && reason.includes("unavailable")) {
        throw new Error(`Video unavailable: ${videoId}`)
    }
    throw new Error(`Video unplayable: ${reason}`)
}

/**
 * Extract captions JSON from InnerTube data
 */
function extractCaptionsJson(innertubeData: any, videoId: string): any {
    assertPlayability(innertubeData.playabilityStatus, videoId)

    const captionsJson =
        innertubeData.captions?.playerCaptionsTracklistRenderer
    if (!captionsJson || !captionsJson.captionTracks) {
        throw new Error("Transcripts disabled for this video")
    }

    return captionsJson
}

/**
 * Parse XML transcript
 * Simple XML parser for transcript data
 */
function parseTranscriptXml(xmlData: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = []
    
    // Match all <text> elements with their attributes
    // Handle both formats: <text start="..." dur="..."> and <text start='...' dur='...'>
    const textRegex = /<text[^>]*start=["']([^"']*)["'][^>]*dur=["']([^"']*)["'][^>]*>(.*?)<\/text>/gs
    let match

    while ((match = textRegex.exec(xmlData)) !== null) {
        const start = parseFloat(match[1]) || 0
        const duration = parseFloat(match[2]) || 0
        let text = match[3] || ""

        // Remove HTML tags but preserve text content
        text = text.replace(/<[^>]*>/g, "").trim()
        
        // Decode HTML entities
        text = text
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))

        if (text) {
            segments.push({
                text: text,
                start: start,
                duration: duration,
            })
        }
    }

    if (segments.length === 0) {
        console.warn("No transcript segments found in XML. XML length:", xmlData.length)
        // Try alternative parsing if the regex didn't match
        // Some transcripts might have different format
    }

    return segments
}

/**
 * Count tokens (words) in text
 * Splits text by whitespace and punctuation to count tokens
 */
function countTokens(text: string): number {
    if (!text || text.trim().length === 0) {
        return 0
    }
    // Match all non-whitespace sequences as tokens
    // This handles both English words and Chinese characters
    const tokens = text.match(/\S+/g)
    return tokens ? tokens.length : 0
}

/**
 * Check if a character is a sentence-ending punctuation
 */
function isSentenceEndPunctuation(char: string): boolean {
    return /[.!?。！？]/.test(char)
}

/**
 * Split a segment into sentences if it contains sentence boundaries
 * Returns an array of segments, each representing a sentence or part of a sentence
 */
function splitSegmentIntoSentences(segment: TranscriptSegment): TranscriptSegment[] {
    const text = segment.text
    const result: TranscriptSegment[] = []
    
    // Find all sentence boundaries in the text
    const sentenceEndRegex = /[.!?。！？]/g
    const boundaries: number[] = []
    let match
    
    while ((match = sentenceEndRegex.exec(text)) !== null) {
        boundaries.push(match.index + 1) // Position after the punctuation
    }
    
    // If no sentence boundaries found, return the segment as-is
    if (boundaries.length === 0) {
        return [segment]
    }
    
    // Split the segment into sentences
    let lastIndex = 0
    const segmentTokenCount = countTokens(text)
    
    for (const boundary of boundaries) {
        const sentenceText = text.substring(lastIndex, boundary).trim()
        if (sentenceText.length > 0) {
            const prefixText = text.substring(0, lastIndex)
            const prefixTokenCount = countTokens(prefixText)
            const sentenceTokenCount = countTokens(sentenceText)
            
            // Calculate start time: if sentence starts at beginning of segment, use segment start
            // Otherwise, estimate based on token ratio
            const sentenceStart = lastIndex === 0
                ? segment.start
                : segment.start + (prefixTokenCount / segmentTokenCount) * segment.duration
            
            // Calculate end time: estimate based on token ratio
            const sentenceEnd = segment.start + ((prefixTokenCount + sentenceTokenCount) / segmentTokenCount) * segment.duration
            const sentenceDuration = sentenceEnd - sentenceStart
            
            result.push({
                text: sentenceText,
                start: sentenceStart,
                duration: sentenceDuration,
            })
        }
        lastIndex = boundary
    }
    
    // Handle remaining text after last sentence boundary
    if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex).trim()
        if (remainingText.length > 0) {
            // This is a partial sentence, keep it for merging with next segment
            const prefixText = text.substring(0, lastIndex)
            const prefixTokenCount = countTokens(prefixText)
            const sentenceTokenCount = countTokens(remainingText)
            
            const sentenceStart = lastIndex === 0
                ? segment.start
                : segment.start + (prefixTokenCount / segmentTokenCount) * segment.duration
            
            const sentenceEnd = segment.start + segment.duration
            const sentenceDuration = sentenceEnd - sentenceStart
            
            result.push({
                text: remainingText,
                start: sentenceStart,
                duration: sentenceDuration,
            })
        }
    }
    
    return result.length > 0 ? result : [segment]
}

/**
 * Merge transcript segments into complete sentences
 * Handles cases where sentences span multiple segments or where segments contain multiple sentences
 */
export function mergeSegmentsIntoSentences(segments: TranscriptSegment[]): TranscriptSegment[] {
    if (segments.length === 0) {
        return []
    }
    
    const result: TranscriptSegment[] = []
    const expandedSegments: TranscriptSegment[] = []
    
    // First pass: split segments that contain multiple sentences
    for (const segment of segments) {
        if (!segment.text || segment.text.trim().length === 0) {
            continue // Skip empty segments
        }
        
        const splitSegments = splitSegmentIntoSentences(segment)
        expandedSegments.push(...splitSegments)
    }
    
    if (expandedSegments.length === 0) {
        return []
    }
    
    // Second pass: merge segments that belong to the same sentence
    let currentSentence: TranscriptSegment | null = null
    
    for (let i = 0; i < expandedSegments.length; i++) {
        const segment = expandedSegments[i]
        const text = segment.text.trim()
        
        if (text.length === 0) {
            continue
        }
        
        // Check if this segment ends with a sentence-ending punctuation
        const endsWithPunctuation = isSentenceEndPunctuation(text[text.length - 1])
        const isLastSegment = i === expandedSegments.length - 1
        
        if (currentSentence === null) {
            // Start a new sentence
            currentSentence = { ...segment }
        } else {
            // Merge with current sentence
            // Add space if needed
            const needsSpace = !currentSentence.text.endsWith(' ') && !text.startsWith(' ')
            currentSentence.text += (needsSpace ? ' ' : '') + text
            
            // Update duration: use the end time of the current segment
            // The duration should be from the start of the first segment to the end of the current segment
            const segmentEnd = segment.start + segment.duration
            currentSentence.duration = segmentEnd - currentSentence.start
        }
        
        // If this segment ends with punctuation or it's the last segment, finalize the sentence
        if (endsWithPunctuation || isLastSegment) {
            if (currentSentence) {
                // The duration is already calculated correctly in the merge step above
                // because expandedSegments from splitSegmentIntoSentences already have
                // precise time calculations based on token ratios
                result.push(currentSentence)
                currentSentence = null
            }
        }
    }
    
    // If there's a remaining sentence without punctuation, add it
    if (currentSentence !== null) {
        result.push(currentSentence)
    }
    
    return result
}

/**
 * Find transcript by language priority
 */
function findTranscript(
    captionsJson: any,
    languages: string[]
): { baseUrl: string; languageCode: string } | null {
    const captionTracks = captionsJson.captionTracks || []

    // First try manually created transcripts
    for (const lang of languages) {
        const track = captionTracks.find(
            (t: any) =>
                t.languageCode === lang && t.kind !== "asr"
        )
        if (track) {
            return {
                baseUrl: track.baseUrl.replace("&fmt=srv3", ""),
                languageCode: track.languageCode,
            }
        }
    }

    // Then try generated transcripts
    for (const lang of languages) {
        const track = captionTracks.find(
            (t: any) => t.languageCode === lang && t.kind === "asr"
        )
        if (track) {
            return {
                baseUrl: track.baseUrl.replace("&fmt=srv3", ""),
                languageCode: track.languageCode,
            }
        }
    }

    // If no match, return first available transcript
    if (captionTracks.length > 0) {
        const track = captionTracks[0]
        return {
            baseUrl: track.baseUrl.replace("&fmt=srv3", ""),
            languageCode: track.languageCode,
        }
    }

    return null
}

/**
 * Fetch YouTube transcript for a video
 */
export async function fetchYouTubeTranscript(
    videoId: string,
    languages: string[] = ["en"]
): Promise<TranscriptSegment[]> {
    try {
        // Step 1: Fetch video HTML
        const watchUrl = WATCH_URL.replace("{video_id}", videoId)
        const html = await httpGet(watchUrl)

        // Step 2: Extract INNERTUBE_API_KEY
        const apiKey = extractInnertubeApiKey(html)

        // Step 3: Fetch InnerTube data
        const innertubeUrl = INNERTUBE_API_URL.replace("{api_key}", apiKey)
        const innertubeData = await httpPost(innertubeUrl, {
            context: INNERTUBE_CONTEXT,
            videoId: videoId,
        })

        // Step 4: Extract captions JSON
        const captionsJson = extractCaptionsJson(innertubeData, videoId)

        // Step 5: Find transcript by language priority
        const transcript = findTranscript(captionsJson, languages)
        if (!transcript) {
            throw new Error("No transcript found for this video")
        }

        // Step 6: Fetch actual transcript XML
        const transcriptXml = await httpGet(transcript.baseUrl)

        // Step 7: Parse XML and return segments
        const segments = parseTranscriptXml(transcriptXml)
        
        // Step 8: Merge segments into complete sentences
        const mergedSegments = mergeSegmentsIntoSentences(segments)
        
        return mergedSegments
    } catch (error) {
        console.error(`[YouTube Transcript] Error:`, error)
        throw error
    }
}
