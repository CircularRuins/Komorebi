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
const playerInstances = new Map() // Store player instances by videoId
const transcriptData = new Map() // Store transcript segments for each video
const transcriptIntervals = new Map() // Store interval IDs for time tracking
const userScrolling = new Map() // Track if user is manually scrolling for each transcript
const scrollResumeTimers = new Map() // Timers to resume auto-scroll after user stops scrolling

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
 * Setup tab switching functionality
 */
function setupTabSwitching(container) {
    const tabs = container.querySelectorAll('.youtube-transcript-tab')
    const tabContents = container.querySelectorAll('.youtube-transcript-tab-content')
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab')
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'))
            tab.classList.add('active')
            
            // Show/hide tab contents
            tabContents.forEach(content => {
                if (content.getAttribute('data-content') === targetTab) {
                    content.style.display = ''
                } else {
                    content.style.display = 'none'
                }
            })
        })
    })
}

/**
 * Update current transcript segment based on video time
 */
function updateTranscriptSegment(videoId, currentTime) {
    // Find the transcript container for this video
    let container = null
    youtubePlayers.forEach((playerVideoId, playerId) => {
        if (playerVideoId === videoId) {
            const playerIndex = playerId.replace('youtube-player-', '')
            const transcriptId = `youtube-transcript-${playerIndex}`
            container = document.getElementById(transcriptId)
        }
    })
    
    if (!container) {
        return
    }
    
    const transcriptContent = container.querySelector('.youtube-transcript-content')
    if (!transcriptContent) {
        return
    }
    
    const segments = transcriptContent.querySelectorAll('.youtube-transcript-segment')
    if (segments.length === 0) {
        return
    }
    
    // Find the current segment based on time
    let currentSegment = null
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        const startTime = parseFloat(segment.getAttribute('data-start'))
        const nextSegment = segments[i + 1]
        const nextStartTime = nextSegment ? parseFloat(nextSegment.getAttribute('data-start')) : Infinity
        
        if (currentTime >= startTime && currentTime < nextStartTime) {
            currentSegment = segment
            break
        }
    }
    
    // If we're past the last segment, use the last one
    if (!currentSegment && segments.length > 0) {
        const lastSegment = segments[segments.length - 1]
        const lastStartTime = parseFloat(lastSegment.getAttribute('data-start'))
        if (currentTime >= lastStartTime) {
            currentSegment = lastSegment
        }
    }
    
    // Remove current class from all segments
    segments.forEach(seg => seg.classList.remove('current'))
    
    // Add current class to the active segment and scroll
    if (currentSegment) {
        // Ensure current class is added
        currentSegment.classList.add('current')
        
        // Force a reflow to ensure styles are applied
        void currentSegment.offsetHeight
        
        // Check if user is manually scrolling - if so, don't auto-scroll
        const transcriptId = container.id
        if (userScrolling.get(transcriptId)) {
            return // User is scrolling, skip auto-scroll
        }
        
        // TLDW style: Use getBoundingClientRect for accurate position calculation
        const elementRect = currentSegment.getBoundingClientRect()
        const viewportRect = transcriptContent.getBoundingClientRect()
        
        // Check if element is outside the top 1/3 area (25% to 40% of viewport) - exactly like TLDW
        const topThreshold = viewportRect.top + viewportRect.height * 0.25
        const bottomThreshold = viewportRect.top + viewportRect.height * 0.40
        
        // Also check if element is completely out of view
        const isOutOfView = elementRect.bottom < viewportRect.top || elementRect.top > viewportRect.bottom
        
        // Scroll if element is out of view or outside the preferred area
        if (isOutOfView || elementRect.top < topThreshold || elementRect.bottom > bottomThreshold) {
            // Calculate the element's position relative to the viewport - exactly like TLDW
            const relativeTop = elementRect.top - viewportRect.top + transcriptContent.scrollTop
            
            // Position the element in the top 1/3 of the viewport - exactly like TLDW
            const scrollPosition = relativeTop - (viewportRect.height / 3)
            
            // Use requestAnimationFrame for smoother scrolling - exactly like TLDW
            requestAnimationFrame(() => {
                transcriptContent.scrollTo({
                    top: Math.max(0, scrollPosition),
                    behavior: 'smooth'
                })
            })
        }
    }
}

/**
 * Start tracking video time for transcript synchronization
 */
function startTranscriptTracking(videoId) {
    // Clear existing interval if any
    if (transcriptIntervals.has(videoId)) {
        clearInterval(transcriptIntervals.get(videoId))
    }
    
    // Update transcript every 100ms
    const intervalId = setInterval(() => {
        try {
            // Find the player instance each time (in case it changes)
            let playerInstance = null
            let playerDiv = null
            
            youtubePlayers.forEach((playerVideoId, playerId) => {
                if (playerVideoId === videoId) {
                    const playerContainer = document.getElementById(playerId)
                    if (playerContainer) {
                        playerDiv = playerContainer.querySelector('div')
                        if (playerDiv) {
                            // Try multiple ways to get player instance
                            // Method 1: Direct property
                            if (playerDiv.player) {
                                playerInstance = playerDiv.player
                            }
                            
                            // Method 2: From stored instances map
                            if (!playerInstance && window.youtubePlayerInstances) {
                                if (playerDiv.id) {
                                    playerInstance = window.youtubePlayerInstances.get(playerDiv.id) || null
                                }
                                if (!playerInstance) {
                                    playerInstance = window.youtubePlayerInstances.get(videoId) || null
                                }
                            }
                            
                            // Method 3: Use YT.get() with playerDiv ID
                            if (!playerInstance && playerDiv.id && window.YT && window.YT.get) {
                                try {
                                    playerInstance = window.YT.get(playerDiv.id)
                                } catch (e) {
                                    // YT.get might fail
                                }
                            }
                            
                            // Method 4: Try to get from iframe (YouTube creates iframe with its own ID)
                            if (!playerInstance) {
                                const iframe = playerDiv.querySelector('iframe')
                                if (iframe && iframe.id && window.YT && window.YT.get) {
                                    try {
                                        playerInstance = window.YT.get(iframe.id)
                                    } catch (e) {
                                        // YT.get might fail
                                    }
                                }
                            }
                            
                            // Method 5: Try all possible IDs from YT.get() - YouTube might use different IDs
                            if (!playerInstance && window.YT && window.YT.get) {
                                try {
                                    // Try common YouTube player ID patterns
                                    const possibleIds = [
                                        playerDiv.id,
                                        `${playerDiv.id}-player`,
                                        `youtube-player-${videoId}`,
                                        videoId
                                    ]
                                    for (const id of possibleIds) {
                                        try {
                                            const testInstance = window.YT.get(id)
                                            if (testInstance && typeof testInstance.getCurrentTime === 'function') {
                                                playerInstance = testInstance
                                                break
                                            }
                                        } catch (e) {
                                            // Continue trying other IDs
                                        }
                                    }
                                } catch (e) {
                                    // Ignore
                                }
                            }
                        }
                    }
                }
            })
            
            if (playerInstance && typeof playerInstance.getCurrentTime === 'function') {
                try {
                    const currentTime = playerInstance.getCurrentTime()
                    if (typeof currentTime === 'number' && currentTime >= 0 && !isNaN(currentTime)) {
                        updateTranscriptSegment(videoId, currentTime)
                    }
                } catch (e) {
                    // getCurrentTime might fail if player is not ready
                }
            }
        } catch (err) {
            // Player might be destroyed, clear interval
            console.error('[Transcript] Error in tracking:', err)
            clearInterval(intervalId)
            transcriptIntervals.delete(videoId)
        }
    }, 100)
    
    transcriptIntervals.set(videoId, intervalId)
}

/**
 * Stop tracking video time for transcript synchronization
 */
function stopTranscriptTracking(videoId) {
    if (transcriptIntervals.has(videoId)) {
        clearInterval(transcriptIntervals.get(videoId))
        transcriptIntervals.delete(videoId)
    }
}

/**
 * Render transcript component
 */
async function renderTranscript(containerId, videoId) {
    const container = document.getElementById(containerId)
    if (!container) return
    
    // Show loading state with tabs
    container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-tabs"><button class="youtube-transcript-tab active" data-tab="transcript">Transcript</button><button class="youtube-transcript-tab" data-tab="chat">Chat</button></div><div class="youtube-transcript-tab-content" data-content="transcript"><div class="youtube-transcript-content"><div class="youtube-transcript-loading">Loading transcript...</div></div></div><div class="youtube-transcript-tab-content" data-content="chat" style="display: none;"><div class="youtube-transcript-chat"><div class="youtube-transcript-chat-messages"></div><div class="youtube-transcript-chat-input-area"><input type="text" class="youtube-transcript-chat-input" placeholder="Type your message..."><button class="youtube-transcript-chat-send">Send</button></div></div></div></div>'
    
    // Fetch transcript from YouTube
    const transcript = await fetchYouTubeTranscript(videoId)
    
    // If transcript fetch failed, show error message
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-tabs"><button class="youtube-transcript-tab active" data-tab="transcript">Transcript</button><button class="youtube-transcript-tab" data-tab="chat">Chat</button></div><div class="youtube-transcript-tab-content" data-content="transcript"><div class="youtube-transcript-content"><div class="youtube-transcript-error">Transcript not available for this video.</div></div></div><div class="youtube-transcript-tab-content" data-content="chat" style="display: none;"><div class="youtube-transcript-chat"><div class="youtube-transcript-chat-messages"></div><div class="youtube-transcript-chat-input-area"><input type="text" class="youtube-transcript-chat-input" placeholder="Type your message..."><button class="youtube-transcript-chat-send">Send</button></div></div></div></div>'
        setupTabSwitching(container)
        return
    }
    
    // Store transcript data for this video
    transcriptData.set(videoId, transcript)
    
    // Create transcript HTML with tabs
    let transcriptHTML = '<div class="youtube-transcript">'
    transcriptHTML += '<div class="youtube-transcript-tabs">'
    transcriptHTML += '<button class="youtube-transcript-tab active" data-tab="transcript">Transcript</button>'
    transcriptHTML += '<button class="youtube-transcript-tab" data-tab="chat">Chat</button>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-tab-content" data-content="transcript">'
    transcriptHTML += '<div class="youtube-transcript-content">'
    
    transcript.forEach((segment, index) => {
        transcriptHTML += `<div class="youtube-transcript-segment" data-start="${segment.start}" data-video-id="${videoId}">`
        transcriptHTML += `<span class="youtube-transcript-text">${segment.text}</span>`
        transcriptHTML += '</div>'
    })
    
    transcriptHTML += '</div>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-tab-content" data-content="chat" style="display: none;">'
    transcriptHTML += '<div class="youtube-transcript-chat">'
    transcriptHTML += '<div class="youtube-transcript-chat-messages"></div>'
    transcriptHTML += '<div class="youtube-transcript-chat-input-area">'
    transcriptHTML += '<input type="text" class="youtube-transcript-chat-input" placeholder="Type your message...">'
    transcriptHTML += '<button class="youtube-transcript-chat-send">Send</button>'
    transcriptHTML += '</div>'
    transcriptHTML += '</div>'
    transcriptHTML += '</div>'
    transcriptHTML += '</div>'
    
    container.innerHTML = transcriptHTML
    
    // Setup tab switching
    setupTabSwitching(container)
    
    // Setup scroll detection for manual scrolling
    const transcriptContent = container.querySelector('.youtube-transcript-content')
    if (transcriptContent) {
        let scrollTimeout = null
        const transcriptId = containerId
        
        // Initialize userScrolling state
        userScrolling.set(transcriptId, false)
        
        // Detect when user starts scrolling
        transcriptContent.addEventListener('scroll', () => {
            // Mark that user is manually scrolling
            userScrolling.set(transcriptId, true)
            
            // Clear existing timeout
            if (scrollResumeTimers.has(transcriptId)) {
                clearTimeout(scrollResumeTimers.get(transcriptId))
            }
            
            // Set timeout to resume auto-scroll after user stops scrolling (2 seconds)
            const timer = setTimeout(() => {
                userScrolling.set(transcriptId, false)
                scrollResumeTimers.delete(transcriptId)
            }, 2000)
            
            scrollResumeTimers.set(transcriptId, timer)
        })
    }
    
    // Add click handlers for transcript segments (clicking on text will seek to that time)
    const segmentElements = container.querySelectorAll('.youtube-transcript-segment')
    segmentElements.forEach(segment => {
        segment.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            const startTime = parseFloat(segment.getAttribute('data-start'))
            const videoId = segment.getAttribute('data-video-id')
            
            if (!videoId || isNaN(startTime)) {
                return
            }
            
            // Try to get player instance from global Map first (most reliable)
            let playerInstance = playerInstances.get(videoId)
            if (!playerInstance) {
                // Fallback: Find the corresponding YouTube player
                youtubePlayers.forEach((playerVideoId, playerId) => {
                    if (playerVideoId === videoId && !playerInstance) {
                        const playerContainer = document.getElementById(playerId)
                        if (playerContainer) {
                            const playerDiv = playerContainer.querySelector('div')
                            if (playerDiv) {
                                // Method 1: Direct reference stored on div
                                if (playerDiv.player) {
                                    playerInstance = playerDiv.player
                                    // Store it for future use
                                    playerInstances.set(videoId, playerInstance)
                                }
                                
                                // Method 2: Try YT.get() with playerDiv.id
                                if (!playerInstance && playerDiv.id && window.YT && window.YT.get) {
                                    try {
                                        playerInstance = window.YT.get(playerDiv.id)
                                        if (playerInstance) {
                                            playerInstances.set(videoId, playerInstance)
                                        }
                                    } catch (err) {
                                        // Ignore
                                    }
                                }
                                
                                // Method 3: Try to get from iframe
                                if (!playerInstance) {
                                    const iframe = playerDiv.querySelector('iframe')
                                    if (iframe) {
                                        // YouTube API creates iframe with a specific ID pattern
                                        // Try to find it by checking all iframes or using YT.get
                                        if (window.YT && window.YT.get) {
                                            // Try common iframe ID patterns
                                            const iframeIdPatterns = [
                                                iframe.id,
                                                `youtube-player-${videoId}`,
                                                playerDiv.id
                                            ]
                                            for (const id of iframeIdPatterns) {
                                                if (!id) continue
                                                try {
                                                    const testInstance = window.YT.get(id)
                                                    if (testInstance && typeof testInstance.seekTo === 'function') {
                                                        playerInstance = testInstance
                                                        playerInstances.set(videoId, playerInstance)
                                                        break
                                                    }
                                                } catch (e) {
                                                    // Continue trying
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                })
            }
            
            // Execute seek if player instance found
            if (playerInstance) {
                try {
                    if (typeof playerInstance.seekTo === 'function') {
                        playerInstance.seekTo(startTime, true)
                        if (typeof playerInstance.playVideo === 'function') {
                            playerInstance.playVideo()
                        }
                    }
                } catch (err) {
                    console.error('Error seeking to time:', startTime, err)
                }
            }
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
                        
                        // Store player reference - TLDW style: store directly on the div
                        const playerInstance = event.target
                        playerDiv.player = playerInstance
                        // Also store in global Map for easy access
                        playerInstances.set(videoId, playerInstance)
                        
                        // Render transcript after player is ready
                        const playerIndex = playerId.replace('youtube-player-', '')
                        const transcriptId = `youtube-transcript-${playerIndex}`
                        
                        setTimeout(() => {
                            renderTranscript(transcriptId, videoId).catch(err => {
                                console.error('Error rendering transcript:', err)
                            })
                        }, 500)
                    },
                    onStateChange: (event) => {
                        // TLDW style: Start tracking when playing (state === 1)
                        const playing = event.data === 1
                        const playerInstance = playerDiv.player
                        
                        if (playing && playerInstance) {
                            // Clear existing interval
                            if (transcriptIntervals.has(videoId)) {
                                clearInterval(transcriptIntervals.get(videoId))
                            }
                            
                            // Start time update interval - exactly like TLDW
                            const intervalId = setInterval(() => {
                                try {
                                    if (playerInstance && typeof playerInstance.getCurrentTime === 'function') {
                                        const currentTime = playerInstance.getCurrentTime()
                                        if (typeof currentTime === 'number' && currentTime >= 0 && !isNaN(currentTime)) {
                                            updateTranscriptSegment(videoId, currentTime)
                                        }
                                    }
                                } catch (err) {
                                    clearInterval(intervalId)
                                    transcriptIntervals.delete(videoId)
                                }
                            }, 100)
                            
                            transcriptIntervals.set(videoId, intervalId)
                        }
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

// Clean up intervals when page unloads
window.addEventListener('beforeunload', () => {
    transcriptIntervals.forEach((intervalId) => {
        clearInterval(intervalId)
    })
    transcriptIntervals.clear()
    
    // Clean up scroll resume timers
    scrollResumeTimers.forEach((timer) => {
        clearTimeout(timer)
    })
    scrollResumeTimers.clear()
    userScrolling.clear()
    
    // Clean up player instances
    playerInstances.clear()
})
