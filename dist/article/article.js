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
            youtubePlayers.set(playerId, videoId)
            return `<div id="${playerId}" style="position: relative; width: 604.44px; height: 340px; max-width: 100%; overflow: hidden; background-color: #000; margin: 16px auto; display: block;">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
            </div>`
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
                    onReady: () => {
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
                    },
                },
            }
            
            // Add origin parameter if available (for Electron webview compatibility)
            if (origin) {
                playerConfig.origin = origin
            }
            
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
