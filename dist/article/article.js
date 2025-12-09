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
const transcriptSelectedLanguages = new Map() // Store selected language for each video
const transcriptMenuOpen = new Map() // Store menu open state for each video
const transcriptTranslations = new Map() // Store translations: Map<videoId, Map<languageCode, string[]>>
const transcriptTranslating = new Map() // Store translating state for each video

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
 * Start loading transcripts for all videos immediately (doesn't need player)
 */
function startLoadingTranscripts() {
    youtubePlayers.forEach((videoId, playerId) => {
        const playerIndex = playerId.replace('youtube-player-', '')
        const transcriptId = `youtube-transcript-${playerIndex}`
        const container = document.getElementById(transcriptId)
        
        // Start loading transcript immediately if container exists
        if (container) {
            renderTranscript(transcriptId, videoId).catch(err => {
                console.error('Error rendering transcript:', err)
            })
        }
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
 * Language options for transcript translation (same as article translation)
 */
const transcriptLanguageOptions = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'zh-CN', name: 'Simplified Chinese', nativeName: '简体中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
]

/**
 * Translate transcript and render with translation
 */
async function translateAndRenderTranscript(containerId, videoId, targetLanguageCode) {
    const container = document.getElementById(containerId)
    if (!container) return
    
    const transcript = transcriptData.get(videoId)
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        return
    }
    
    // Check if translation config is available
    if (typeof window === 'undefined' || !window.settings) {
        console.error('Translation config not available')
        return
    }
    
    const apiEndpoint = window.settings.getAITranslationApiEndpoint()
    const apiKey = window.settings.getAITranslationApiKey()
    const model = window.settings.getAITranslationModel()
    
    if (!apiEndpoint || !apiKey || !model) {
        if (window.utils && window.utils.showMessageBox) {
            await window.utils.showMessageBox(
                'Translation Config Incomplete',
                'Please configure translation API settings first.',
                'OK',
                'Cancel',
                false,
                'warning'
            )
        }
        return
    }
    
    // Set translating state
    transcriptTranslating.set(videoId, true)
    
    // Show loading state
    const transcriptContent = container.querySelector('.youtube-transcript-content')
    if (transcriptContent) {
        const loadingDiv = document.createElement('div')
        loadingDiv.className = 'youtube-transcript-loading'
        loadingDiv.textContent = 'Translating transcript...'
        transcriptContent.innerHTML = ''
        transcriptContent.appendChild(loadingDiv)
    }
    
    try {
        // Extract text from transcript segments
        const texts = transcript.map(segment => segment.text)
        
        // Call translation API
        if (!window.utils || !window.utils.translateTranscript) {
            throw new Error('Translation API not available')
        }
        
        const translatedTexts = await window.utils.translateTranscript(texts, targetLanguageCode)
        
        // Store translation
        if (!transcriptTranslations.has(videoId)) {
            transcriptTranslations.set(videoId, new Map())
        }
        transcriptTranslations.get(videoId).set(targetLanguageCode, translatedTexts)
        
        // Render with translation
        renderTranscriptWithTranslation(containerId, videoId, targetLanguageCode)
    } catch (error) {
        console.error('Error translating transcript:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        
        // Show error
        const transcriptContent = container.querySelector('.youtube-transcript-content')
        if (transcriptContent) {
            const errorDiv = document.createElement('div')
            errorDiv.className = 'youtube-transcript-error'
            errorDiv.textContent = `Translation failed: ${errorMessage}`
            transcriptContent.innerHTML = ''
            transcriptContent.appendChild(errorDiv)
        }
        
        if (window.utils && window.utils.showErrorBox) {
            window.utils.showErrorBox('Translation Failed', errorMessage)
        }
    } finally {
        transcriptTranslating.set(videoId, false)
    }
}

/**
 * Render transcript with translation (bilingual display)
 */
function renderTranscriptWithTranslation(containerId, videoId, targetLanguageCode) {
    const container = document.getElementById(containerId)
    if (!container) return
    
    const transcript = transcriptData.get(videoId)
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        return
    }
    
    const transcriptContent = container.querySelector('.youtube-transcript-content')
    if (!transcriptContent) return
    
    // Get translations if available
    let translations = null
    if (targetLanguageCode && transcriptTranslations.has(videoId)) {
        const videoTranslations = transcriptTranslations.get(videoId)
        if (videoTranslations.has(targetLanguageCode)) {
            translations = videoTranslations.get(targetLanguageCode)
        }
    }
    
    // Clear content
    transcriptContent.innerHTML = ''
    
    // Render segments
    transcript.forEach((segment, index) => {
        const segmentDiv = document.createElement('div')
        segmentDiv.className = 'youtube-transcript-segment'
        segmentDiv.setAttribute('data-start', segment.start)
        segmentDiv.setAttribute('data-video-id', videoId)
        
        const textSpan = document.createElement('span')
        textSpan.className = 'youtube-transcript-text'
        
        // Original text
        const originalText = document.createElement('div')
        originalText.className = 'youtube-transcript-original'
        originalText.textContent = segment.text
        textSpan.appendChild(originalText)
        
        // Translated text (if available)
        if (translations && translations[index]) {
            const translatedText = document.createElement('div')
            translatedText.className = 'youtube-transcript-translated'
            translatedText.textContent = translations[index]
            textSpan.appendChild(translatedText)
        }
        
        segmentDiv.appendChild(textSpan)
        transcriptContent.appendChild(segmentDiv)
    })
    
    // Re-setup click handlers for seeking
    const segmentElements = transcriptContent.querySelectorAll('.youtube-transcript-segment')
    segmentElements.forEach(segment => {
        segment.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            const startTime = parseFloat(segment.getAttribute('data-start'))
            const videoId = segment.getAttribute('data-video-id')
            
            if (!videoId || isNaN(startTime)) {
                return
            }
            
            // Try to get player instance
            let playerInstance = playerInstances.get(videoId)
            if (!playerInstance) {
                youtubePlayers.forEach((playerVideoId, playerId) => {
                    if (playerVideoId === videoId && !playerInstance) {
                        const playerContainer = document.getElementById(playerId)
                        if (playerContainer) {
                            const playerDiv = playerContainer.querySelector('div')
                            if (playerDiv && playerDiv.player) {
                                playerInstance = playerDiv.player
                                playerInstances.set(videoId, playerInstance)
                            }
                        }
                    }
                })
            }
            
            if (playerInstance && typeof playerInstance.seekTo === 'function') {
                try {
                    playerInstance.seekTo(startTime, true)
                    if (typeof playerInstance.playVideo === 'function') {
                        playerInstance.playVideo()
                    }
                } catch (err) {
                    console.error('Error seeking to time:', startTime, err)
                }
            }
        })
    })
    
    // Re-setup scroll detection
    let scrollTimeout = null
    const transcriptId = containerId
    userScrolling.set(transcriptId, false)
    
    transcriptContent.addEventListener('scroll', () => {
        userScrolling.set(transcriptId, true)
        if (scrollResumeTimers.has(transcriptId)) {
            clearTimeout(scrollResumeTimers.get(transcriptId))
        }
        const timer = setTimeout(() => {
            userScrolling.set(transcriptId, false)
            scrollResumeTimers.delete(transcriptId)
        }, 2000)
        scrollResumeTimers.set(transcriptId, timer)
    })
}

/**
 * Render transcript language dropdown menu (reusing translation menu styles)
 */
function renderTranscriptLanguageMenu(containerId, videoId) {
    const container = document.getElementById(containerId)
    if (!container) return null
    
    const isOpen = transcriptMenuOpen.get(videoId) || false
    const existingMenu = document.querySelector(`.youtube-transcript-language-menu[data-video-id="${videoId}"]`)
    if (existingMenu) existingMenu.remove()
    
    if (!isOpen) return null
    
    const chevronButton = container.querySelector(`.youtube-transcript-language-chevron[data-video-id="${videoId}"]`)
    if (!chevronButton) return null
    
    const rect = chevronButton.getBoundingClientRect()
    const selectedLanguage = transcriptSelectedLanguages.get(videoId) || null
    
    // Create menu (reusing translation menu styles)
    const menu = document.createElement('div')
    menu.className = 'youtube-transcript-language-menu'
    menu.setAttribute('data-video-id', videoId)
    Object.assign(menu.style, {
        position: 'fixed',
        zIndex: 50,
        width: '260px',
        borderRadius: '16px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        backgroundColor: '#ffffff',
        padding: 0,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left - 200}px`,
        outline: 'none',
    })
    
    const menuContent = document.createElement('div')
    menuContent.style.cssText = 'max-height: 300px; overflow-y: auto;'
    
    // Helper to create menu item (reusing translation menu item styles)
    const createMenuItem = (text, subtext, isSelected, onClick) => {
        const item = document.createElement('div')
        Object.assign(item.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'background-color 0.15s, color 0.15s',
            borderRadius: '4px',
            margin: '0 4px',
            userSelect: 'none',
            outline: 'none',
        })
        item.onmouseenter = (e) => e.currentTarget.style.backgroundColor = '#f5f5f5'
        item.onmouseleave = (e) => e.currentTarget.style.backgroundColor = 'transparent'
        item.onclick = onClick
        
        const textDiv = document.createElement('div')
        const mainText = document.createElement('div')
        Object.assign(mainText.style, { fontWeight: 500, fontSize: '12px', color: '#000', lineHeight: '16px' })
        mainText.textContent = text
        textDiv.appendChild(mainText)
        
        if (subtext) {
            const subText = document.createElement('div')
            Object.assign(subText.style, { fontSize: '10px', color: '#666', lineHeight: '14px', marginTop: '2px' })
            subText.textContent = subtext
            textDiv.appendChild(subText)
        }
        
        item.appendChild(textDiv)
        
        const icon = document.createElement('div')
        icon.style.cssText = `font-size: 16px; color: ${isSelected ? '#000' : '#ccc'};`
        icon.innerHTML = isSelected ? '✓' : '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1" fill="none"/></svg>'
        item.appendChild(icon)
        
        return item
    }
    
    // "Show original" option
    const showOriginalItem = createMenuItem('Show original transcript', null, !selectedLanguage, () => {
        transcriptSelectedLanguages.set(videoId, null)
        transcriptMenuOpen.set(videoId, false)
        menu.remove()
        renderTranscriptWithTranslation(container.id, videoId, null)
    })
    Object.assign(showOriginalItem.style, {
        borderBottom: '1px solid #f0f0f0',
        marginBottom: '4px',
        paddingBottom: '10px',
    })
    menuContent.appendChild(showOriginalItem)
    
    // Language options
    transcriptLanguageOptions.forEach(lang => {
        const isSelected = lang.code === selectedLanguage
        const langItem = createMenuItem(lang.nativeName, lang.name, isSelected, () => {
            const newLanguage = isSelected ? null : lang.code
            transcriptSelectedLanguages.set(videoId, newLanguage)
            transcriptMenuOpen.set(videoId, false)
            menu.remove()
            if (newLanguage) {
                translateAndRenderTranscript(container.id, videoId, newLanguage)
            } else {
                renderTranscriptWithTranslation(container.id, videoId, null)
            }
        })
        menuContent.appendChild(langItem)
    })
    
    menu.appendChild(menuContent)
    document.body.appendChild(menu)
    
    // Close menu handlers (same as translation menu)
    const closeMenu = () => {
        transcriptMenuOpen.set(videoId, false)
        menu.remove()
        document.removeEventListener('click', closeHandler)
    }
    const closeHandler = (e) => {
        if (!menu.contains(e.target) && !chevronButton.contains(e.target)) closeMenu()
    }
    menu.onmouseleave = () => setTimeout(closeMenu, 100)
    setTimeout(() => document.addEventListener('click', closeHandler), 0)
    
    return menu
}

/**
 * Setup transcript language menu functionality
 */
function setupTranscriptLanguageMenu(container, videoId) {
    const chevronButton = container.querySelector(`.youtube-transcript-language-chevron[data-video-id="${videoId}"]`)
    if (!chevronButton) return
    
    chevronButton.onclick = (e) => {
        e.stopPropagation()
        const isOpen = transcriptMenuOpen.get(videoId) || false
        transcriptMenuOpen.set(videoId, !isOpen)
        renderTranscriptLanguageMenu(container.id, videoId)
    }
    
    // Initial render (will be null if menu is closed)
    renderTranscriptLanguageMenu(container.id, videoId)
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
        
        // Calculate position to keep current segment at the top
        const elementRect = currentSegment.getBoundingClientRect()
        const viewportRect = transcriptContent.getBoundingClientRect()
        
        // Calculate element's position relative to the scroll container's content
        const currentScrollTop = transcriptContent.scrollTop
        const elementTopInContent = elementRect.top - viewportRect.top + currentScrollTop
        
        // Check if current segment is not at the top (with small tolerance for smooth scrolling)
        const padding = 12 // padding of .youtube-transcript-content
        const targetScrollTop = elementTopInContent - padding
        const tolerance = 2
        const isNotAtTop = Math.abs(currentScrollTop - targetScrollTop) > tolerance
        
        // Always scroll to keep current segment at the top
        if (isNotAtTop) {
            // Use requestAnimationFrame for smoother scrolling
            requestAnimationFrame(() => {
                transcriptContent.scrollTo({
                    top: Math.max(0, targetScrollTop),
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
    container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-tabs"><button class="youtube-transcript-tab active" data-tab="transcript"><span>Transcript</span><span class="youtube-transcript-language-chevron" data-video-id="' + videoId + '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button><button class="youtube-transcript-tab" data-tab="chat">Chat</button></div><div class="youtube-transcript-tab-content" data-content="transcript"><div class="youtube-transcript-content"><div class="youtube-transcript-loading">Loading transcript...</div></div></div><div class="youtube-transcript-tab-content" data-content="chat" style="display: none;"><div class="youtube-transcript-chat"><div class="youtube-transcript-chat-messages"></div><div class="youtube-transcript-chat-input-area"><input type="text" class="youtube-transcript-chat-input" placeholder="Type your message..."><button class="youtube-transcript-chat-send">Send</button></div></div></div></div>'
    
    // Fetch transcript from YouTube
    const transcript = await fetchYouTubeTranscript(videoId)
    
    // If transcript fetch failed, show error message
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-tabs"><button class="youtube-transcript-tab active" data-tab="transcript"><span>Transcript</span><span class="youtube-transcript-language-chevron" data-video-id="' + videoId + '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button><button class="youtube-transcript-tab" data-tab="chat">Chat</button></div><div class="youtube-transcript-tab-content" data-content="transcript"><div class="youtube-transcript-content"><div class="youtube-transcript-error">Transcript not available for this video.</div></div></div><div class="youtube-transcript-tab-content" data-content="chat" style="display: none;"><div class="youtube-transcript-chat"><div class="youtube-transcript-chat-messages"></div><div class="youtube-transcript-chat-input-area"><input type="text" class="youtube-transcript-chat-input" placeholder="Type your message..."><button class="youtube-transcript-chat-send">Send</button></div></div></div></div>'
        setupTabSwitching(container)
        setupTranscriptLanguageMenu(container, videoId)
        return
    }
    
    // Store transcript data for this video
    transcriptData.set(videoId, transcript)
    
    // Create transcript HTML with tabs (content will be rendered by renderTranscriptWithTranslation)
    let transcriptHTML = '<div class="youtube-transcript">'
    transcriptHTML += '<div class="youtube-transcript-tabs">'
    transcriptHTML += '<button class="youtube-transcript-tab active" data-tab="transcript"><span>Transcript</span><span class="youtube-transcript-language-chevron" data-video-id="' + videoId + '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>'
    transcriptHTML += '<button class="youtube-transcript-tab" data-tab="chat">Chat</button>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-tab-content" data-content="transcript">'
    transcriptHTML += '<div class="youtube-transcript-content"></div>'
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
    
    // Setup language menu
    setupTranscriptLanguageMenu(container, videoId)
    
    // Render transcript (with translation if available)
    const selectedLanguage = transcriptSelectedLanguages.get(videoId) || null
    renderTranscriptWithTranslation(containerId, videoId, selectedLanguage)
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
        
        // Transcript loading is already started in startLoadingTranscripts()
        // No need to load it here again
        
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
                        
                        // Transcript is already loading in parallel, no need to wait here
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
    
    // Start loading transcripts immediately (doesn't need player, only needs DOM)
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
        startLoadingTranscripts()
        // Initialize YouTube players in parallel
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
