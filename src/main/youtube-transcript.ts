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
        console.log(`[YouTube Transcript] Fetching transcript for video: ${videoId}`)
        
        // Step 1: Fetch video HTML
        const watchUrl = WATCH_URL.replace("{video_id}", videoId)
        console.log(`[YouTube Transcript] Fetching HTML from: ${watchUrl}`)
        const html = await httpGet(watchUrl)

        // Step 2: Extract INNERTUBE_API_KEY
        const apiKey = extractInnertubeApiKey(html)
        console.log(`[YouTube Transcript] Extracted API key: ${apiKey.substring(0, 10)}...`)

        // Step 3: Fetch InnerTube data
        const innertubeUrl = INNERTUBE_API_URL.replace("{api_key}", apiKey)
        console.log(`[YouTube Transcript] Fetching InnerTube data`)
        const innertubeData = await httpPost(innertubeUrl, {
            context: INNERTUBE_CONTEXT,
            videoId: videoId,
        })

        // Step 4: Extract captions JSON
        const captionsJson = extractCaptionsJson(innertubeData, videoId)
        console.log(`[YouTube Transcript] Found ${captionsJson.captionTracks?.length || 0} caption tracks`)

        // Step 5: Find transcript by language priority
        const transcript = findTranscript(captionsJson, languages)
        if (!transcript) {
            throw new Error("No transcript found for this video")
        }
        console.log(`[YouTube Transcript] Selected transcript: ${transcript.languageCode}`)

        // Step 6: Fetch actual transcript XML
        console.log(`[YouTube Transcript] Fetching transcript XML from: ${transcript.baseUrl.substring(0, 100)}...`)
        const transcriptXml = await httpGet(transcript.baseUrl)
        console.log(`[YouTube Transcript] Received XML, length: ${transcriptXml.length}`)

        // Step 7: Parse XML and return segments
        const segments = parseTranscriptXml(transcriptXml)
        console.log(`[YouTube Transcript] Parsed ${segments.length} segments`)
        return segments
    } catch (error) {
        console.error(`[YouTube Transcript] Error:`, error)
        throw error
    }
}
