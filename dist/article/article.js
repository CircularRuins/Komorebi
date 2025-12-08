function get(name) {
    if (name = (new RegExp('[?&]' + encodeURIComponent(name) + '=([^&]*)')).exec(location.search))
        return decodeURIComponent(name[1]);
}
let dir = get("d")
if (dir === "1") {
    document.body.classList.add("rtl")
} else if (dir === "2") {
    document.body.classList.add("vertical")
    document.body.addEventListener("wheel", (evt) => {
        document.scrollingElement.scrollLeft -= evt.deltaY;
    });
}
/**
 * Extract YouTube video ID from URL
 * Supports multiple YouTube URL formats
 */
function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Convert YouTube links to embed divs for YouTube iframe API
 * Uses YouTube iframe API to avoid error 153
 */
let youtubePlayerCounter = 0
const youtubePlayers = new Map()

function convertYouTubeLinks(html) {
    if (!html || typeof html !== 'string') return html || ''
    
    // Match <a href="...youtube...">...</a> patterns (more flexible regex)
    const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["'][^>]*>.*?<\/a>/gi
    return html.replace(linkRegex, (match) => {
        // Extract href from the match
        const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i)
        if (!hrefMatch || !hrefMatch[1]) return match
        
        const href = hrefMatch[1]
        const videoId = extractVideoId(href)
        if (videoId) {
            const playerId = `youtube-player-${youtubePlayerCounter++}`
            const transcriptId = `youtube-transcript-${youtubePlayerCounter - 1}`
            youtubePlayers.set(playerId, videoId)
            return `<div id="${playerId}" style="position: relative; width: 100%; max-width: 700px; aspect-ratio: 16 / 9; overflow: hidden; background-color: #000; margin: 16px auto; display: block;">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
            </div>
            <div id="${transcriptId}" class="youtube-transcript-container"></div>`
        }
        return match
    })
}

/**
 * Initialize YouTube players using iframe API
 */
function initializeYouTubePlayers() {
    if (youtubePlayers.size === 0) return
    
    // Check if YouTube API is already loaded
    if (window.YT && window.YT.Player) {
        createYouTubePlayers()
    } else {
        // Load YouTube iframe API if not already loaded
        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            const tag = document.createElement('script')
            tag.src = 'https://www.youtube.com/iframe_api'
            document.body.appendChild(tag)
        }
        
        // Set up callback
        const existingCallback = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => {
            if (existingCallback) existingCallback()
            createYouTubePlayers()
        }
    }
}

/**
 * Format time in seconds to MM:SS format
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Fetch transcript from YouTube using Electron API
 */
async function fetchYouTubeTranscript(videoId) {
    try {
        // Check if we're in Electron environment
        if (typeof window !== 'undefined' && window.utils && window.utils.getYouTubeTranscript) {
            const result = await window.utils.getYouTubeTranscript(videoId)
            
            // Check if result has error
            if (result && result.error) {
                return null
            }
            
            // Check if result is an array (successful transcript)
            if (Array.isArray(result)) {
                return result
            }
            
            return null
        } else {
            return null
        }
    } catch (error) {
        return null
    }
}

/**
 * Render transcript component
 */
async function renderTranscript(containerId, videoId) {
    const container = document.getElementById(containerId)
    if (!container) return
    
    // Show loading state
    container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-header"><h3 class="youtube-transcript-title">Transcript</h3></div><div class="youtube-transcript-content"><div class="youtube-transcript-loading">Loading transcript...</div></div></div>'
    
    // Fetch transcript from YouTube
    const transcript = await fetchYouTubeTranscript(videoId)
    
    // If transcript fetch failed, show error message
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-header"><h3 class="youtube-transcript-title">Transcript</h3></div><div class="youtube-transcript-content"><div class="youtube-transcript-error">Transcript not available for this video.</div></div></div>'
        return
    }
    
    // Create transcript HTML
    let transcriptHTML = '<div class="youtube-transcript">'
    transcriptHTML += '<div class="youtube-transcript-header">'
    transcriptHTML += '<h3 class="youtube-transcript-title">Transcript</h3>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-content">'
    
    transcript.forEach((segment, index) => {
        const timeStr = formatTime(segment.start)
        transcriptHTML += `<div class="youtube-transcript-segment" data-start="${segment.start}" data-video-id="${videoId}">`
        transcriptHTML += `<span class="youtube-transcript-timestamp" data-start="${segment.start}">${timeStr}</span>`
        transcriptHTML += `<span class="youtube-transcript-text">${segment.text}</span>`
        transcriptHTML += '</div>'
    })
    
    transcriptHTML += '</div>'
    transcriptHTML += '</div>'
    
    container.innerHTML = transcriptHTML
    
    // Add click handlers for timestamps
    const timestampElements = container.querySelectorAll('.youtube-transcript-timestamp')
    timestampElements.forEach(timestamp => {
        timestamp.style.cursor = 'pointer'
        timestamp.addEventListener('click', (e) => {
            e.preventDefault()
            const startTime = parseFloat(timestamp.getAttribute('data-start'))
            const segment = timestamp.closest('.youtube-transcript-segment')
            const videoId = segment ? segment.getAttribute('data-video-id') : null
            
            if (!videoId) return
            
            // Find the corresponding YouTube player
            youtubePlayers.forEach((playerVideoId, playerId) => {
                if (playerVideoId === videoId) {
                    const playerContainer = document.getElementById(playerId)
                    if (playerContainer) {
                        const playerDiv = playerContainer.querySelector('div')
                        if (playerDiv) {
                            // Try to get player instance
                            let playerInstance = null
                            try {
                                // Try to get from stored reference first
                                if (playerDiv.player) {
                                    playerInstance = playerDiv.player
                                } else if (playerDiv.id && window.YT && window.YT.get) {
                                    // Try to get from YT API using the div ID
                                    playerInstance = window.YT.get(playerDiv.id)
                                }
                                
                                if (playerInstance && typeof playerInstance.seekTo === 'function') {
                                    playerInstance.seekTo(startTime, true)
                                    if (typeof playerInstance.playVideo === 'function') {
                                        playerInstance.playVideo()
                                    }
                                } else {
                                    console.log('Player instance not available for seeking')
                                }
                            } catch (err) {
                                console.log('Could not seek to time:', startTime, err)
                            }
                        }
                    }
                }
            })
            
            // Log for debugging
            console.log('Seek to:', startTime, 'for video:', videoId)
        })
    })
}

/**
 * Create YouTube player instances
 */
function createYouTubePlayers() {
    // Get the article URL to use as origin
    const articleUrl = get("u") || ""
    let origin = ""
    try {
        if (articleUrl && (articleUrl.startsWith("http://") || articleUrl.startsWith("https://"))) {
            const urlObj = new URL(articleUrl)
            origin = urlObj.origin
        }
    } catch (e) {
        // If URL parsing fails, try to extract origin from articleUrl string
        const match = articleUrl.match(/^(https?:\/\/[^\/]+)/)
        if (match) {
            origin = match[1]
        }
    }
    
    youtubePlayers.forEach((videoId, playerId) => {
        const container = document.getElementById(playerId)
        if (!container) return
        
        const playerDiv = container.querySelector('div')
        if (!playerDiv) return
        
        // Set an ID for the player div so we can access it via YT.get()
        const playerDivId = `${playerId}-inner`
        playerDiv.id = playerDivId
        
        try {
            const playerConfig = {
                videoId: videoId,
                playerVars: {
                    autoplay: 0,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                },
                events: {
                    onReady: (event) => {
                        // Set referrer policy and modify iframe src to include origin
                        const iframe = playerDiv.querySelector('iframe')
                        if (iframe) {
                            iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
                            
                            // Modify iframe src to include origin parameter if available
                            if (origin) {
                                try {
                                    const currentSrc = iframe.src
                                    const url = new URL(currentSrc)
                                    url.searchParams.set('origin', origin)
                                    iframe.src = url.toString()
                                } catch (e) {
                                    console.error('Error modifying iframe src:', e)
                                }
                            }
                        }
                        
                        // Store player reference for transcript seeking
                        // event.target is the player instance
                        playerDiv.player = event.target
                        
                        // Render transcript after player is ready
                        const playerIndex = playerId.replace('youtube-player-', '')
                        const transcriptId = `youtube-transcript-${playerIndex}`
                        setTimeout(() => {
                            renderTranscript(transcriptId, videoId).catch(err => {
                                console.error('Error rendering transcript:', err)
                            })
                        }, 500)
                    },
                },
            }
            
            // Add origin parameter if available (for Electron webview compatibility)
            if (origin) {
                playerConfig.origin = origin
            }
            
            // Create player instance
            const player = new window.YT.Player(playerDiv, playerConfig)
        } catch (e) {
            console.error('Error creating YouTube player:', e)
        }
    })
}

async function getArticle(url) {
    let article = get("a")
    if (get("m") === "1") {
        return (await Mercury.parse(url, {html: article})).content || ""
    } else {
        return article
    }
}
document.documentElement.style.fontSize = get("s") + "px"
let font = get("f")
if (font) document.body.style.fontFamily = `"${font}"`

let url = get("u")
getArticle(url).then(article => {
    // Reset YouTube player counter for new article
    youtubePlayerCounter = 0
    youtubePlayers.clear()
    
    // Convert YouTube links to embeds before inserting
    if (article) {
        article = convertYouTubeLinks(article)
    }
    
    let domParser = new DOMParser()
    let dom = domParser.parseFromString(get("h"), "text/html")
    dom.getElementsByTagName("article")[0].innerHTML = article
    let baseEl = dom.createElement('base')
    baseEl.setAttribute('href', url.split("/").slice(0, 3).join("/"))
    dom.head.append(baseEl)
    for (let s of dom.getElementsByTagName("script")) {
        s.parentNode.removeChild(s)
    }
    for (let e of dom.querySelectorAll("*[src]")) {
        e.src = e.src
    }
    for (let e of dom.querySelectorAll("*[href]")) {
        e.href = e.href
    }
    let main = document.getElementById("main")
    main.innerHTML = dom.body.innerHTML
    main.classList.add("show")
    
    // Initialize YouTube players after DOM is updated
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
        initializeYouTubePlayers()
    }, 0)
})
