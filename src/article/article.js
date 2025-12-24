function get(name) {
    if (name = (new RegExp('[?&]' + encodeURIComponent(name) + '=([^&]*)')).exec(location.search))
        return decodeURIComponent(name[1]);
}

// Load i18n texts from URL parameter
let i18nTexts = {}
try {
    const i18nParam = get("i18n")
    if (i18nParam && i18nParam.trim() !== '') {
        i18nTexts = JSON.parse(i18nParam)
    }
} catch (e) {
    console.error('Failed to parse i18n texts:', e)
    // Continue with empty i18nTexts, fallback will be used
    i18nTexts = {}
}

// Helper function to get i18n text with fallback
function i18n(key, fallback) {
    try {
        const keys = key.split('.')
        let value = i18nTexts
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k]
            } else {
                return String(fallback || key)
            }
        }
        return String(value || fallback || key)
    } catch (e) {
        console.error('Error in i18n function:', e, 'key:', key)
        return String(fallback || key)
    }
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
const lastScrollTarget = new Map() // Track last scroll target for each transcript to detect rapid changes
const transcriptSummaries = new Map() // Store generated summaries: Map<videoId, string>
const transcriptQuotes = new Map() // Store extracted quotes: Map<videoId, Array<{quote: string, timestamp: string, speaker?: string}>>
const transcriptChatMessages = new Map() // Store chat messages: Map<videoId, Array<{role: 'user' | 'assistant', content: string, timestamps?: string[]}>>

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
    
    // Check if translation config is available (使用Chat API配置)
    if (typeof window === 'undefined' || !window.settings) {
        console.error('Translation config not available')
        return
    }
    
    const apiEndpoint = window.settings.getAIChatApiEndpoint()
    const apiKey = window.settings.getAIChatApiKey()
    const model = window.settings.getAIModel()
    
    if (!apiEndpoint || !apiKey || !model) {
        if (window.utils && window.utils.showMessageBox) {
            const openConfig = await window.utils.showMessageBox(
                i18n('transcript.translationConfigIncomplete', 'Translation Config Incomplete'),
                i18n('transcript.translationConfigIncompleteMessage', 'Please configure Chat API settings first.'),
                i18n('transcript.openConfig', 'Open Config'),
                i18n('transcript.cancel', 'Cancel'),
                false,
                'warning'
            )
            if (openConfig && window.utils && window.utils.openAIConfig) {
                await window.utils.openAIConfig()
            }
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
        loadingDiv.textContent = i18n('transcript.translating', 'Translating transcript...')
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
            const errorText = i18n('transcript.translationFailed', 'Translation failed: {error}')
            errorDiv.textContent = errorText.replace('{error}', errorMessage)
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
    
    // Setup selection actions for explain feature
    setupSelectionActions(containerId, videoId)
}

/**
 * Setup selection actions for explain feature
 */
function setupSelectionActions(containerId, videoId) {
    const container = document.getElementById(containerId)
    if (!container) return
    
    const transcriptContent = container.querySelector('.youtube-transcript-content')
    if (!transcriptContent) return
    
    let currentSelectionButtons = null
    
    const clearSelection = () => {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
            sel.removeAllRanges()
        }
        if (currentSelectionButtons) {
            currentSelectionButtons.remove()
            currentSelectionButtons = null
        }
    }
    
    const handleSelectionChange = () => {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
            clearSelection()
            return
        }
        
        const range = sel.getRangeAt(0)
        const commonAncestor = range.commonAncestorContainer instanceof Element
            ? range.commonAncestorContainer
            : range.commonAncestorContainer?.parentElement ?? null
        
        // Check if selection is within transcript content
        if (!commonAncestor || (!transcriptContent.contains(commonAncestor) && commonAncestor !== transcriptContent)) {
            clearSelection()
            return
        }
        
        const text = sel.toString().trim()
        if (!text) {
            clearSelection()
            return
        }
        
        const rect = range.getBoundingClientRect()
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            clearSelection()
            return
        }
        
        // Show action buttons
        showSelectionActionButtons(rect, text, videoId, containerId)
    }
    
    // Listen for selection events
    const handleMouseUp = () => {
        requestAnimationFrame(handleSelectionChange)
    }
    
    const handleKeyUp = (event) => {
        if (event.key === 'Shift' || event.key === 'Meta' || event.key === 'Control') return
        requestAnimationFrame(handleSelectionChange)
    }
    
    const handleScroll = () => {
        if (currentSelectionButtons) {
            clearSelection()
        }
    }
    
    // Add event listeners
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('touchend', handleMouseUp)
    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('mousedown', clearSelection)
    
    // Store cleanup function
    transcriptContent._selectionCleanup = () => {
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('keyup', handleKeyUp)
        document.removeEventListener('touchend', handleMouseUp)
        document.removeEventListener('scroll', handleScroll, true)
        document.removeEventListener('mousedown', clearSelection)
        clearSelection()
    }
}

/**
 * Show selection action buttons (Explain button)
 */
function showSelectionActionButtons(rect, selectedText, videoId, containerId) {
    // Remove existing buttons
    const existing = document.querySelector('.youtube-transcript-selection-actions')
    if (existing) {
        existing.remove()
    }
    
    // Create buttons container
    const buttonsContainer = document.createElement('div')
    buttonsContainer.className = 'youtube-transcript-selection-actions'
    buttonsContainer.setAttribute('data-video-id', videoId)
    
    // Create Explain button
    const explainButton = document.createElement('button')
    explainButton.className = 'youtube-transcript-selection-explain'
    explainButton.textContent = i18n('transcript.explain', 'Explain')
    explainButton.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        handleExplainSelection(selectedText, videoId, containerId)
        buttonsContainer.remove()
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
            sel.removeAllRanges()
        }
    })
    
    buttonsContainer.appendChild(explainButton)
    document.body.appendChild(buttonsContainer)
    
    // Position the buttons
    const top = rect.top + window.scrollY - 48
    const left = rect.left + window.scrollX + rect.width / 2
    
    buttonsContainer.style.top = `${Math.max(top, 12)}px`
    buttonsContainer.style.left = `${left}px`
    buttonsContainer.style.transform = 'translateX(-50%)'
    
    // Prevent clicks on buttons from clearing selection
    buttonsContainer.addEventListener('mousedown', (e) => {
        e.stopPropagation()
    })
}

/**
 * Handle explain selection - switch to chat tab and send message
 */
function handleExplainSelection(selectedText, videoId, containerId) {
    if (!selectedText || !selectedText.trim()) return
    
    // Find the container
    const container = document.getElementById(containerId)
    if (!container) return
    
    // Switch to chat tab
    const chatTab = container.querySelector('.youtube-transcript-tab[data-tab="chat"]')
    if (chatTab) {
        chatTab.click()
    }
    
    // Wait a bit for chat tab to initialize, then trigger explain event
    // Use a longer delay to ensure setupChatTab has completed
    setTimeout(() => {
        const prompt = `Explain "${selectedText.trim()}"`
        window.dispatchEvent(new CustomEvent('tldw-explain-selection', {
            detail: { text: prompt, videoId: videoId }
        }))
    }, 300)
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
        left: `${rect.left}px`,
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
    const showOriginalItem = createMenuItem(i18n('transcript.showOriginal', 'Show original transcript'), null, !selectedLanguage, () => {
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
            
            // Setup summary tab if switching to summary
            if (targetTab === 'summary') {
                // Extract videoId from container id
                // Container id format: youtube-transcript-{index}
                const containerId = container.id
                const match = containerId.match(/youtube-transcript-(\d+)/)
                if (match) {
                    const playerIndex = parseInt(match[1])
                    const playerId = `youtube-player-${playerIndex}`
                    const videoId = youtubePlayers.get(playerId)
                    if (videoId) {
                        setupSummaryTab(container, videoId)
                    }
                }
            }
            
            // Setup quotes tab if switching to quotes
            if (targetTab === 'quotes') {
                // Extract videoId from container id
                const containerId = container.id
                const match = containerId.match(/youtube-transcript-(\d+)/)
                if (match) {
                    const playerIndex = parseInt(match[1])
                    const playerId = `youtube-player-${playerIndex}`
                    const videoId = youtubePlayers.get(playerId)
                    if (videoId) {
                        setupQuotesTab(container, videoId)
                    }
                }
            }
            
            // Setup chat tab if switching to chat
            if (targetTab === 'chat') {
                // Extract videoId from container id
                const containerId = container.id
                const match = containerId.match(/youtube-transcript-(\d+)/)
                if (match) {
                    const playerIndex = parseInt(match[1])
                    const playerId = `youtube-player-${playerIndex}`
                    const videoId = youtubePlayers.get(playerId)
                    if (videoId) {
                        setupChatTab(container, videoId)
                    }
                }
            }
        })
    })
}

/**
 * Convert Markdown to HTML (simple implementation)
 */
function markdownToHtml(markdown) {
    if (!markdown || !markdown.trim()) {
        return ''
    }
    
    let html = markdown
    
    // Escape HTML first
    function escapeHtml(text) {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }
    
    // Code blocks (process first to avoid conflicts)
    const codeBlocks = []
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
        codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`)
        return placeholder
    })
    
    // Inline code
    const inlineCodes = []
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodes.length}__`
        inlineCodes.push(`<code>${escapeHtml(code)}</code>`)
        return placeholder
    })
    
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
    
    // Italic
    html = html.replace(/\b\*([^*\s][^*]*?[^*\s])\*\b/g, '<em>$1</em>')
    html = html.replace(/\b_([^_\s][^_]*?[^_\s])_\b/g, '<em>$1</em>')
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    
    // Lists
    const lines = html.split('\n')
    const processedLines = []
    let inList = false
    let listItems = []
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        
        const unorderedMatch = trimmed.match(/^[\*\-] (.+)$/)
        const orderedMatch = trimmed.match(/^\d+\. (.+)$/)
        
        if (unorderedMatch || orderedMatch) {
            if (!inList) {
                inList = true
                listItems = []
            }
            const content = unorderedMatch ? unorderedMatch[1] : orderedMatch[1]
            listItems.push(`<li>${content}</li>`)
        } else {
            if (inList) {
                processedLines.push(`<ul>${listItems.join('')}</ul>`)
                inList = false
                listItems = []
            }
            
            if (!trimmed) {
                processedLines.push('')
            } else if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
                processedLines.push(trimmed)
            } else if (trimmed.startsWith('__CODE_BLOCK_') || trimmed.startsWith('__INLINE_CODE_')) {
                processedLines.push(trimmed)
            } else {
                processedLines.push(`<p>${trimmed}</p>`)
            }
        }
    }
    
    if (inList && listItems.length > 0) {
        processedLines.push(`<ul>${listItems.join('')}</ul>`)
    }
    
    html = processedLines.join('\n')
    
    // Restore code blocks and inline code
    codeBlocks.forEach((code, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, code)
    })
    inlineCodes.forEach((code, index) => {
        html = html.replace(`__INLINE_CODE_${index}__`, code)
    })
    
    return html
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (typeof text !== 'string') {
        return ''
    }
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

/**
 * Parse timestamp string (MM:SS or HH:MM:SS) to seconds
 */
function parseTimestamp(timestamp) {
    const parts = timestamp.split(':').map(p => parseInt(p, 10))
    if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return null
}

/**
 * Format seconds to timestamp string (MM:SS or HH:MM:SS)
 */
function formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    const pad = (n) => n.toString().padStart(2, '0')
    
    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    }
    return `${pad(minutes)}:${pad(secs)}`
}

/**
 * Get YouTube player instance for a video
 */
function getPlayerInstance(videoId) {
    // Try to get from cache first
    let playerInstance = playerInstances.get(videoId)
    if (playerInstance) {
        return playerInstance
    }
    
    // Search for player in DOM
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
    
    return playerInstance
}

/**
 * Handle timestamp click - seek to time in video
 */
function handleTimestampClick(videoId, timestamp) {
    const seconds = parseTimestamp(timestamp)
    if (seconds === null) {
        console.error('Invalid timestamp:', timestamp)
        return
    }
    
    const playerInstance = getPlayerInstance(videoId)
    if (playerInstance && typeof playerInstance.seekTo === 'function') {
        try {
            playerInstance.seekTo(seconds, true)
            if (typeof playerInstance.playVideo === 'function') {
                playerInstance.playVideo()
            }
        } catch (err) {
            console.error('Error seeking to time:', seconds, err)
        }
    } else {
        console.warn('Player instance not available for video:', videoId)
    }
}

/**
 * Get summary section titles based on locale
 */
function getSummaryTitles(locale) {
    // Default to English
    const defaultTitles = {
        overview: 'Overview',
        takeaways: 'Key Takeaways'
    }
    
    // Language mappings
    const titleMappings = {
        'zh-CN': {
            overview: '摘要速览',
            takeaways: '重点提要'
        },
        'zh-TW': {
            overview: '摘要速覽',
            takeaways: '重點提要'
        },
        'ja': {
            overview: '概要',
            takeaways: '重要なポイント'
        },
        'fr-FR': {
            overview: 'Aperçu',
            takeaways: 'Points clés'
        },
        'fr': {
            overview: 'Aperçu',
            takeaways: 'Points clés'
        },
        'de': {
            overview: 'Übersicht',
            takeaways: 'Wichtige Punkte'
        },
        'es': {
            overview: 'Resumen',
            takeaways: 'Puntos clave'
        },
        'it': {
            overview: 'Panoramica',
            takeaways: 'Punti chiave'
        },
        'pt-BR': {
            overview: 'Visão geral',
            takeaways: 'Principais pontos'
        },
        'pt-PT': {
            overview: 'Visão geral',
            takeaways: 'Principais pontos'
        },
        'pt': {
            overview: 'Visão geral',
            takeaways: 'Principais pontos'
        },
        'ru': {
            overview: 'Обзор',
            takeaways: 'Ключевые моменты'
        },
        'ko': {
            overview: '개요',
            takeaways: '핵심 요점'
        },
        'nl': {
            overview: 'Overzicht',
            takeaways: 'Belangrijke punten'
        },
        'sv': {
            overview: 'Översikt',
            takeaways: 'Viktiga punkter'
        },
        'tr': {
            overview: 'Genel Bakış',
            takeaways: 'Önemli Noktalar'
        },
        'uk': {
            overview: 'Огляд',
            takeaways: 'Ключові моменти'
        },
        'cs': {
            overview: 'Přehled',
            takeaways: 'Klíčové body'
        },
        'fi-FI': {
            overview: 'Yleiskatsaus',
            takeaways: 'Tärkeät kohdat'
        },
        'fi': {
            overview: 'Yleiskatsaus',
            takeaways: 'Tärkeät kohdat'
        }
    }
    
    if (!locale) {
        return defaultTitles
    }
    
    // Try full locale first
    if (titleMappings[locale]) {
        return titleMappings[locale]
    }
    
    // Try language code only
    const langCode = locale.split('-')[0]
    if (titleMappings[langCode]) {
        return titleMappings[langCode]
    }
    
    return defaultTitles
}

/**
 * Render summary as HTML (overview + takeaways)
 */
function renderSummaryTakeaways(summary, videoId) {
    // Handle both old format (array) and new format (object with overview and takeaways)
    let overview = ''
    let takeaways = []
    
    if (summary && typeof summary === 'object') {
        if (Array.isArray(summary)) {
            // Old format: just array of takeaways
            takeaways = summary
        } else if (summary.overview && summary.takeaways) {
            // New format: object with overview and takeaways
            overview = summary.overview
            takeaways = Array.isArray(summary.takeaways) ? summary.takeaways : []
        } else {
            return '<div class="youtube-transcript-summary-text">No summary available.</div>'
        }
    } else {
        return '<div class="youtube-transcript-summary-text">No summary available.</div>'
    }
    
    if (!takeaways || takeaways.length === 0) {
        return '<div class="youtube-transcript-summary-text">No takeaways available.</div>'
    }
    
    // Get locale from URL parameter
    const locale = get('l') || 'en-US'
    const titles = getSummaryTitles(locale)
    
    let html = '<div class="youtube-transcript-summary-text">'
    
    // Render overview section
    if (overview) {
        html += '<div class="youtube-transcript-summary-overview">'
        html += `<h3 class="youtube-transcript-summary-overview-title">${escapeHtml(titles.overview)}</h3>`
        html += `<p class="youtube-transcript-summary-overview-content">${escapeHtml(overview)}</p>`
        html += '</div>'
    }
    
    // Render takeaways section
    html += '<div class="youtube-transcript-summary-takeaways">'
    html += `<h3 class="youtube-transcript-summary-takeaways-title">${escapeHtml(titles.takeaways)}</h3>`
    html += '<div class="youtube-transcript-summary-takeaways-content">'
    
    // Play icon SVG for timestamp buttons
    const playIconSvg = '<svg class="youtube-transcript-summary-timestamp-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 2.5L9.5 6L2.5 9.5V2.5Z" fill="currentColor"/></svg>'
    
    takeaways.forEach((takeaway, index) => {
        html += '<div class="youtube-transcript-summary-takeaway-item">'
        html += `<strong class="youtube-transcript-summary-label">${escapeHtml(takeaway.label)}</strong>`
        html += `<span class="youtube-transcript-summary-insight">${escapeHtml(takeaway.insight)}</span>`
        
        // Show timestamps if available (backward compatible: old takeaways may not have timestamps)
        if (takeaway.timestamps && Array.isArray(takeaway.timestamps) && takeaway.timestamps.length > 0) {
            html += '<div class="youtube-transcript-summary-timestamps">'
            takeaway.timestamps.forEach((timestamp) => {
                if (timestamp && typeof timestamp === 'string' && timestamp.trim()) {
                    html += `<button class="youtube-transcript-summary-timestamp" data-video-id="${videoId}" data-timestamp="${escapeHtml(timestamp.trim())}" type="button">`
                    html += playIconSvg
                    html += `<span>${escapeHtml(timestamp.trim())}</span>`
                    html += '</button>'
                }
            })
            html += '</div>'
        }
        
        html += '</div>'
    })
    
    html += '</div>'
    html += '</div>'
    html += '</div>'
    
    return html
}

/**
 * Setup timestamp click handlers for summary
 */
function setupSummaryTimestampHandlers(container, videoId) {
    const timestampButtons = container.querySelectorAll('.youtube-transcript-summary-timestamp')
    timestampButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            const timestamp = button.getAttribute('data-timestamp')
            const buttonVideoId = button.getAttribute('data-video-id')
            if (timestamp && buttonVideoId === videoId) {
                handleTimestampClick(videoId, timestamp)
            }
        })
    })
}

/**
 * Generate summary for video transcript
 */
async function generateSummary(videoId) {
    // Check if summary already exists
    if (transcriptSummaries.has(videoId)) {
        return transcriptSummaries.get(videoId)
    }
    
    // Get transcript data
    const transcript = transcriptData.get(videoId)
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        throw new Error('Transcript not available')
    }
    
    // Check if utils bridge is available
    if (typeof window === 'undefined' || !window.utils || !window.utils.generateTranscriptSummary) {
        throw new Error('Utils bridge not available')
    }
    
    // Extract article snippet
    const snippet = extractArticleSnippet()
    
    // Pass transcript segments and snippet
    try {
        const summary = await window.utils.generateTranscriptSummary(transcript, snippet)
        
        if (!summary || !summary.overview || !summary.takeaways || !Array.isArray(summary.takeaways) || summary.takeaways.length === 0) {
            throw new Error('Empty summary received from API')
        }
        
        // Cache the summary
        transcriptSummaries.set(videoId, summary)
        
        return summary
    } catch (error) {
        // Handle configuration incomplete error
        if (error.message && error.message.includes('配置不完整')) {
            if (window.utils && window.utils.showMessageBox) {
                const openConfig = await window.utils.showMessageBox(
                    i18n('transcript.translationConfigIncomplete', 'Translation Config Incomplete'),
                    i18n('transcript.translationConfigIncompleteMessage', 'Please configure Chat API settings first.'),
                    i18n('transcript.openConfig', 'Open Config'),
                    i18n('transcript.cancel', 'Cancel'),
                    false,
                    'warning'
                )
                if (openConfig && window.utils.openAIConfig) {
                    await window.utils.openAIConfig()
                }
            }
        }
        throw error
    }
}

/**
 * Get interpretation label based on locale
 */
function getInterpretationLabel(locale) {
    // Use i18n if available
    const i18nLabel = i18n('transcript.interpretation', null)
    if (i18nLabel && i18nLabel !== 'transcript.interpretation') {
        return i18nLabel
    }
    
    if (!locale) {
        return 'Interpretation: '
    }
    
    // Try full locale first
    const localeMappings = {
        'zh-CN': '解读：',
        'zh-TW': '解讀：',
        'zh': '解读：',
        'ja': '解釈：',
        'fr-FR': 'Interprétation : ',
        'fr': 'Interprétation : ',
        'de': 'Interpretation: ',
        'es': 'Interpretación: ',
        'it': 'Interpretazione: ',
        'pt-BR': 'Interpretação: ',
        'pt-PT': 'Interpretação: ',
        'pt': 'Interpretação: ',
        'ru': 'Интерпретация: ',
        'ko': '해석: ',
        'nl': 'Interpretatie: ',
        'sv': 'Tolkning: ',
        'tr': 'Yorum: ',
        'uk': 'Інтерпретація: ',
        'cs': 'Interpretace: ',
        'fi-FI': 'Tulkinta: ',
        'fi': 'Tulkinta: '
    }
    
    if (localeMappings[locale]) {
        return localeMappings[locale]
    }
    
    // Try language code only
    const langCode = locale.split('-')[0]
    if (localeMappings[langCode]) {
        return localeMappings[langCode]
    }
    
    // Default to English
    return 'Interpretation: '
}

/**
 * Render quotes as HTML
 */
function renderQuotes(quotes, videoId) {
    if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
        return '<div class="youtube-transcript-quotes-text">' + i18n('transcript.noQuotesAvailable', 'No quotes available.') + '</div>'
    }
    
    // Get locale from URL parameter
    const locale = get('l') || 'en-US'
    const interpretationLabel = getInterpretationLabel(locale)
    
    // Play icon SVG (matching TLDW style)
    const playIconSvg = '<svg class="youtube-transcript-quote-timestamp-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 2.5L9.5 6L2.5 9.5V2.5Z" fill="currentColor"/></svg>'
    
    let html = '<div class="youtube-transcript-quotes-text">'
    html += '<ul class="youtube-transcript-quotes-list">'
    
    quotes.forEach((quoteItem, index) => {
        html += '<li class="youtube-transcript-quote-item">'
        
        // Show speaker if available
        if (quoteItem.speaker && quoteItem.speaker.trim()) {
            html += `<div class="youtube-transcript-quote-speaker">${escapeHtml(quoteItem.speaker)}</div>`
        }
        
        html += `<blockquote class="youtube-transcript-quote-text">"${escapeHtml(quoteItem.quote)}"</blockquote>`
        
        // Show interpretation if available
        if (quoteItem.interpretation && quoteItem.interpretation.trim()) {
            html += `<div class="youtube-transcript-quote-interpretation"><span class="youtube-transcript-quote-interpretation-label">${escapeHtml(interpretationLabel)}</span>${escapeHtml(quoteItem.interpretation)}</div>`
        }
        
        // Show timestamp button
        if (quoteItem.timestamp) {
            html += '<div class="youtube-transcript-quote-timestamp-wrapper">'
            html += `<button class="youtube-transcript-quote-timestamp" data-video-id="${videoId}" data-timestamp="${quoteItem.timestamp}" type="button">`
            html += playIconSvg
            html += `<span>${escapeHtml(quoteItem.timestamp)}</span>`
            html += '</button>'
            html += '</div>'
        }
        
        html += '</li>'
    })
    
    html += '</ul>'
    html += '</div>'
    
    return html
}

/**
 * Setup timestamp click handlers for quotes
 */
function setupQuotesTimestampHandlers(container, videoId) {
    const timestampButtons = container.querySelectorAll('.youtube-transcript-quote-timestamp')
    timestampButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            const timestamp = button.getAttribute('data-timestamp')
            const buttonVideoId = button.getAttribute('data-video-id')
            if (timestamp && buttonVideoId === videoId) {
                handleTimestampClick(videoId, timestamp)
            }
        })
    })
}

/**
 * Extract snippet from article content
 */
function extractArticleSnippet() {
    try {
        // Try to get article content from URL parameter
        const articleContent = get("a")
        if (articleContent) {
            // Decode the article content
            const decodedContent = decodeURIComponent(articleContent)
            // Remove HTML tags and get text
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = decodedContent
            const textContent = tempDiv.textContent || tempDiv.innerText || ''
            // Get first 500 characters as snippet
            return textContent.trim().substring(0, 500)
        }
        
        // Fallback: try to get from DOM
        const mainElement = document.getElementById('main')
        if (mainElement) {
            const articleElement = mainElement.querySelector('article')
            if (articleElement) {
                const textContent = articleElement.textContent || articleElement.innerText || ''
                return textContent.trim().substring(0, 500)
            }
        }
    } catch (error) {
        console.warn('Failed to extract article snippet:', error)
    }
    return undefined
}

/**
 * Extract quotes for video transcript
 */
async function generateQuotes(videoId) {
    // Check if quotes already exists
    if (transcriptQuotes.has(videoId)) {
        return transcriptQuotes.get(videoId)
    }
    
    // Get transcript data
    const transcript = transcriptData.get(videoId)
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        throw new Error('Transcript not available')
    }
    
    // Check if utils bridge is available
    if (typeof window === 'undefined' || !window.utils || !window.utils.generateJuiciestQuotes) {
        throw new Error('Utils bridge not available')
    }
    
    // Extract article snippet
    const snippet = extractArticleSnippet()
    
    // Pass transcript segments and snippet
    try {
        const quotes = await window.utils.generateJuiciestQuotes(transcript, snippet)
        
        if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
            throw new Error('Empty quotes received from API')
        }
        
        // Cache the quotes
        transcriptQuotes.set(videoId, quotes)
        
        return quotes
    } catch (error) {
        // Handle configuration incomplete error
        if (error.message && error.message.includes('配置不完整')) {
            if (window.utils && window.utils.showMessageBox) {
                const openConfig = await window.utils.showMessageBox(
                    i18n('transcript.translationConfigIncomplete', 'Translation Config Incomplete'),
                    i18n('transcript.translationConfigIncompleteMessage', 'Please configure Chat API settings first.'),
                    i18n('transcript.openConfig', 'Open Config'),
                    i18n('transcript.cancel', 'Cancel'),
                    false,
                    'warning'
                )
                if (openConfig && window.utils.openAIConfig) {
                    await window.utils.openAIConfig()
                }
            }
        }
        throw error
    }
}

/**
 * Setup quotes tab functionality
 */
async function setupQuotesTab(container, videoId) {
    const quotesContent = container.querySelector('.youtube-transcript-quotes-content')
    if (!quotesContent) return
    
    // Check Chat API configuration (same as chat tab)
    if (typeof window === 'undefined' || !window.settings) {
        const configIncomplete = i18n('transcript.chat.configIncomplete', 'AI Model Not Configured')
        quotesContent.innerHTML = '<div class="youtube-transcript-quotes-error">' + configIncomplete + '</div>'
        return
    }
    
    const apiEndpoint = window.settings.getAIChatApiEndpoint()
    const apiKey = window.settings.getAIChatApiKey()
    const model = window.settings.getAIModel()
    
    if (!apiEndpoint || !apiKey || !model) {
        // Show config incomplete message (same as chat tab)
        const configIncomplete = i18n('transcript.chat.configIncomplete', 'AI Model Not Configured')
        const configIncompleteMessage = i18n('transcript.chat.configIncompleteMessage', 'Please configure Chat API settings first.')
        const openConfig = i18n('transcript.openConfig', 'Open Config')
        
        quotesContent.innerHTML = `
            <div class="youtube-transcript-quotes-config-incomplete">
                <div class="youtube-transcript-quotes-config-message">
                    <div class="youtube-transcript-quotes-config-title">${configIncomplete}</div>
                    <div class="youtube-transcript-quotes-config-desc">${configIncompleteMessage}</div>
                </div>
                <button type="button" class="youtube-transcript-quotes-config-button">${openConfig}</button>
            </div>
        `
        
        // Setup open config button
        const configButton = quotesContent.querySelector('.youtube-transcript-quotes-config-button')
        if (configButton && window.utils && window.utils.openAIConfig) {
            configButton.addEventListener('click', async (e) => {
                e.preventDefault()
                e.stopPropagation()
                await window.utils.openAIConfig()
            })
        }
        return
    }
    
    // Check if quotes already exists
    const existingQuotes = transcriptQuotes.get(videoId)
    
    if (existingQuotes) {
        // Display existing quotes
        const htmlQuotes = renderQuotes(existingQuotes, videoId)
        quotesContent.innerHTML = htmlQuotes
        setupQuotesTimestampHandlers(quotesContent, videoId)
    } else {
        // Show Extract button
        quotesContent.innerHTML = `
            <div class="youtube-transcript-quotes-empty">
                <button class="youtube-transcript-quotes-generate">${i18n('transcript.extractQuotes', 'Extract Quotes')}</button>
            </div>
        `
        
        // Setup Extract button click handler
        const generateButton = quotesContent.querySelector('.youtube-transcript-quotes-generate')
        if (generateButton) {
            generateButton.addEventListener('click', async () => {
                // Disable button and show loading
                generateButton.disabled = true
                generateButton.textContent = i18n('transcript.extracting', 'Extracting...')
                quotesContent.innerHTML = '<div class="youtube-transcript-quotes-loading">' + i18n('transcript.extractingQuotes', 'Extracting quotes...') + '</div>'
                
                try {
                    const quotes = await generateQuotes(videoId)
                    // Display quotes
                    const htmlQuotes = renderQuotes(quotes, videoId)
                    quotesContent.innerHTML = htmlQuotes
                    setupQuotesTimestampHandlers(quotesContent, videoId)
                } catch (error) {
                    console.error('Error extracting quotes:', error)
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    const failedMessage = i18n('transcript.failedToExtractQuotes', 'Failed to extract quotes: {error}')
                    quotesContent.innerHTML = `
                        <div class="youtube-transcript-quotes-error">
                            <div>${failedMessage.replace('{error}', errorMessage)}</div>
                            <button class="youtube-transcript-quotes-retry">${i18n('transcript.retry', 'Retry')}</button>
                        </div>
                    `
                    
                    // Setup retry button
                    const retryButton = quotesContent.querySelector('.youtube-transcript-quotes-retry')
                    if (retryButton) {
                        retryButton.addEventListener('click', () => {
                            setupQuotesTab(container, videoId)
                        })
                    }
                }
            })
        }
    }
}

/**
 * Setup summary tab functionality
 */
async function setupSummaryTab(container, videoId) {
    const summaryContent = container.querySelector('.youtube-transcript-summary-content')
    if (!summaryContent) return
    
    // Check Chat API configuration (same as chat tab)
    if (typeof window === 'undefined' || !window.settings) {
        const configIncomplete = i18n('transcript.chat.configIncomplete', 'AI Model Not Configured')
        summaryContent.innerHTML = '<div class="youtube-transcript-summary-error">' + configIncomplete + '</div>'
        return
    }
    
    const apiEndpoint = window.settings.getAIChatApiEndpoint()
    const apiKey = window.settings.getAIChatApiKey()
    const model = window.settings.getAIModel()
    
    if (!apiEndpoint || !apiKey || !model) {
        // Show config incomplete message (same as chat tab)
        const configIncomplete = i18n('transcript.chat.configIncomplete', 'AI Model Not Configured')
        const configIncompleteMessage = i18n('transcript.chat.configIncompleteMessage', 'Please configure Chat API settings first.')
        const openConfig = i18n('transcript.openConfig', 'Open Config')
        
        summaryContent.innerHTML = `
            <div class="youtube-transcript-summary-config-incomplete">
                <div class="youtube-transcript-summary-config-message">
                    <div class="youtube-transcript-summary-config-title">${configIncomplete}</div>
                    <div class="youtube-transcript-summary-config-desc">${configIncompleteMessage}</div>
                </div>
                <button type="button" class="youtube-transcript-summary-config-button">${openConfig}</button>
            </div>
        `
        
        // Setup open config button
        const configButton = summaryContent.querySelector('.youtube-transcript-summary-config-button')
        if (configButton && window.utils && window.utils.openAIConfig) {
            configButton.addEventListener('click', async (e) => {
                e.preventDefault()
                e.stopPropagation()
                await window.utils.openAIConfig()
            })
        }
        return
    }
    
    // Check if summary already exists
    const existingSummary = transcriptSummaries.get(videoId)
    
    if (existingSummary) {
        // Display existing summary (render as structured takeaways)
        const htmlSummary = renderSummaryTakeaways(existingSummary, videoId)
        summaryContent.innerHTML = htmlSummary
        setupSummaryTimestampHandlers(summaryContent, videoId)
    } else {
        // Show Generate button
        summaryContent.innerHTML = `
            <div class="youtube-transcript-summary-empty">
                <button class="youtube-transcript-summary-generate">${i18n('transcript.generateSummary', 'Generate Summary')}</button>
            </div>
        `
        
        // Setup Generate button click handler
        const generateButton = summaryContent.querySelector('.youtube-transcript-summary-generate')
        if (generateButton) {
            generateButton.addEventListener('click', async () => {
                // Disable button and show loading
                generateButton.disabled = true
                generateButton.textContent = i18n('transcript.generating', 'Generating...')
                summaryContent.innerHTML = '<div class="youtube-transcript-summary-loading">' + i18n('transcript.generatingSummary', 'Generating summary...') + '</div>'
                
                try {
                    const takeaways = await generateSummary(videoId)
                    // Display summary (render as structured takeaways)
                    const htmlSummary = renderSummaryTakeaways(takeaways, videoId)
                    summaryContent.innerHTML = htmlSummary
                    setupSummaryTimestampHandlers(summaryContent, videoId)
                } catch (error) {
                    console.error('Error generating summary:', error)
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    const failedMessage = i18n('transcript.failedToGenerateSummary', 'Failed to generate summary: {error}')
                    summaryContent.innerHTML = `
                        <div class="youtube-transcript-summary-error">
                            <div>${failedMessage.replace('{error}', errorMessage)}</div>
                            <button class="youtube-transcript-summary-retry">${i18n('transcript.retry', 'Retry')}</button>
                        </div>
                    `
                    
                    // Setup retry button
                    const retryButton = summaryContent.querySelector('.youtube-transcript-summary-retry')
                    if (retryButton) {
                        retryButton.addEventListener('click', () => {
                            setupSummaryTab(container, videoId)
                        })
                    }
                }
            })
        }
    }
}

/**
 * Parse timestamp from string (MM:SS or HH:MM:SS)
 */
function parseTimestampToSeconds(timestamp) {
    const parts = timestamp.split(':').map(p => parseInt(p, 10))
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return null
}

/**
 * Format timestamp from seconds to MM:SS or HH:MM:SS
 */
function formatTimestampFromSeconds(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * Render timestamp buttons in text
 */
function renderTimestampButtons(text, timestamps, videoId) {
    if (!timestamps || timestamps.length === 0) {
        return text
    }
    
    // Replace timestamp patterns [MM:SS] or [HH:MM:SS] with clickable buttons
    const timestampPattern = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g
    let result = text
    const matches = []
    
    let match
    while ((match = timestampPattern.exec(text)) !== null) {
        matches.push({
            index: match.index,
            length: match[0].length,
            timestamp: match[1],
            fullMatch: match[0]
        })
    }
    
    // Replace from end to start to preserve indices
    for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i]
        const seconds = parseTimestampToSeconds(m.timestamp)
        if (seconds !== null) {
            const buttonHtml = `<button class="youtube-transcript-chat-timestamp" data-timestamp="${m.timestamp}" data-seconds="${seconds}" data-video-id="${videoId}">
                <svg class="youtube-transcript-chat-timestamp-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 2.5L9 6L3 9.5V2.5Z" fill="currentColor"/>
                </svg>
                <span>${m.timestamp}</span>
            </button>`
            result = result.substring(0, m.index) + buttonHtml + result.substring(m.index + m.length)
        }
    }
    
    return result
}

/**
 * Setup chat tab functionality
 */
async function setupChatTab(container, videoId) {
    const chatContainer = container.querySelector('.youtube-transcript-chat')
    if (!chatContainer) return
    
    // Check if chat already initialized
    if (chatContainer.querySelector('.youtube-transcript-chat-content')) {
        return
    }
    
    // Check Chat API configuration
    if (typeof window === 'undefined' || !window.settings) {
        chatContainer.innerHTML = '<div class="youtube-transcript-chat-error">' + i18n('transcript.chat.configIncomplete', 'AI Model Not Configured') + '</div>'
        return
    }
    
    const apiEndpoint = window.settings.getAIChatApiEndpoint()
    const apiKey = window.settings.getAIChatApiKey()
    const model = window.settings.getAIModel()
    
    if (!apiEndpoint || !apiKey || !model) {
        // Show config incomplete message
        const configIncomplete = i18n('transcript.chat.configIncomplete', 'AI Model Not Configured')
        const configIncompleteMessage = i18n('transcript.chat.configIncompleteMessage', 'Please configure Chat API settings first.')
        const openConfig = i18n('transcript.openConfig', 'Open Config')
        const cancel = i18n('transcript.cancel', 'Cancel')
        
        chatContainer.innerHTML = `
            <div class="youtube-transcript-chat-content">
                <div class="youtube-transcript-chat-config-incomplete">
                    <div class="youtube-transcript-chat-config-message">
                        <div class="youtube-transcript-chat-config-title">${configIncomplete}</div>
                        <div class="youtube-transcript-chat-config-desc">${configIncompleteMessage}</div>
                    </div>
                    <button type="button" class="youtube-transcript-chat-config-button">${openConfig}</button>
                </div>
            </div>
        `
        
        // Setup open config button
        const configButton = chatContainer.querySelector('.youtube-transcript-chat-config-button')
        if (configButton && window.utils && window.utils.openAIConfig) {
            configButton.addEventListener('click', async (e) => {
                e.preventDefault()
                e.stopPropagation()
                await window.utils.openAIConfig()
            })
        }
        return
    }
    
    // Get transcript data
    const transcript = transcriptData.get(videoId)
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        const transcriptNotAvailableText = i18n('transcript.chat.transcriptNotAvailable', 'Transcript not available')
        chatContainer.innerHTML = '<div class="youtube-transcript-chat-error">' + transcriptNotAvailableText + '</div>'
        return
    }
    
    // Get or initialize chat messages
    if (!transcriptChatMessages.has(videoId)) {
        transcriptChatMessages.set(videoId, [])
    }
    const messages = transcriptChatMessages.get(videoId)
    
    // Create chat UI
    const placeholder = i18n('transcript.chat.placeholder', 'Ask about the video...')
    const sendText = i18n('transcript.chat.send', 'Send')
    const loadingText = i18n('transcript.chat.loading', 'Thinking...')
    
    chatContainer.innerHTML = `
        <div class="youtube-transcript-chat-content">
            <div class="youtube-transcript-chat-messages"></div>
            <form class="youtube-transcript-chat-input-container" onsubmit="return false;" autocomplete="off" novalidate>
                <div class="youtube-transcript-chat-input-wrapper">
                    <textarea class="youtube-transcript-chat-input" placeholder="${placeholder}" rows="2" autocomplete="off" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
                    <button type="button" class="youtube-transcript-chat-send">
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.5 0.5L6.5 7.5M13.5 0.5L9.5 13.5L6.5 7.5M13.5 0.5L0.5 4.5L6.5 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    `
    
    const messagesContainer = chatContainer.querySelector('.youtube-transcript-chat-messages')
    const inputElement = chatContainer.querySelector('.youtube-transcript-chat-input')
    const sendButton = chatContainer.querySelector('.youtube-transcript-chat-send')
    const inputContainer = chatContainer.querySelector('.youtube-transcript-chat-input-container')
    const inputWrapper = chatContainer.querySelector('.youtube-transcript-chat-input-wrapper')
    
    // Prevent form submission and all form-related events
    if (inputContainer) {
        // Use capture phase and immediate stop to prevent any form submission
        const preventFormSubmit = (e) => {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
            return false
        }
        
        inputContainer.addEventListener('submit', preventFormSubmit, true)
        inputContainer.addEventListener('reset', preventFormSubmit, true)
        
        // Also prevent at the form level
        inputContainer.setAttribute('onsubmit', 'return false;')
        inputContainer.setAttribute('onreset', 'return false;')
        
        // Prevent any other form events
        inputContainer.addEventListener('formdata', (e) => {
            e.preventDefault()
            e.stopPropagation()
        }, true)
    }
    
    // Also prevent any click events on the wrapper that might bubble up
    if (inputWrapper) {
        inputWrapper.addEventListener('click', (e) => {
            e.stopPropagation()
        })
        
        inputWrapper.addEventListener('mousedown', (e) => {
            e.stopPropagation()
        })
        
        inputWrapper.addEventListener('mouseup', (e) => {
            e.stopPropagation()
        })
    }
    
    // Prevent any global event handlers from interfering
    // Wrap the entire chat container to prevent event bubbling
    if (chatContainer) {
        const stopAllEvents = (e) => {
            // Only stop events that originate from within the chat container
            if (e.target && chatContainer.contains(e.target)) {
                // Don't stop propagation for events we need (like clicks on buttons)
                if (e.target.closest('.youtube-transcript-chat-send')) {
                    return
                }
                // For input-related events, always stop
                if (e.type === 'submit' || e.type === 'reset' || 
                    (e.type === 'keydown' && e.key === 'Enter' && !e.shiftKey)) {
                    e.stopPropagation()
                    e.stopImmediatePropagation()
                }
            }
        }
        
        // Only prevent form-related events at the container level
        chatContainer.addEventListener('submit', stopAllEvents, true)
        chatContainer.addEventListener('reset', stopAllEvents, true)
    }
    
    // Add a global event listener at document level to catch any events that might bubble up
    // This is a last resort to prevent page refresh
    const globalEventBlocker = (e) => {
        // Check if the event originated from the chat input
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-chat-input')) {
            // For form submission, always prevent
            if (e.type === 'submit') {
                e.preventDefault()
                e.stopPropagation()
                e.stopImmediatePropagation()
            }
            // Don't block keydown events here - let the input element handle them
            // This allows the sendMessage function to be called properly
        }
    }
    
    // Only add submit blocker to document
    document.addEventListener('submit', globalEventBlocker, true)
    
    // Store the blocker function so we can remove it later if needed
    chatContainer._globalEventBlocker = globalEventBlocker
    
    // Render existing messages
    function renderMessages() {
        if (!messagesContainer) return
        
        messagesContainer.innerHTML = ''
        messages.forEach((msg, index) => {
            const messageDiv = document.createElement('div')
            messageDiv.className = `youtube-transcript-chat-message youtube-transcript-chat-message-${msg.role}`
            
            if (msg.role === 'user') {
                messageDiv.innerHTML = `<div class="youtube-transcript-chat-message-content">${escapeHtml(msg.content)}</div>`
            } else {
                // Render assistant message with timestamp buttons
                const contentWithTimestamps = renderTimestampButtons(msg.content, msg.timestamps || [], videoId)
                messageDiv.innerHTML = `<div class="youtube-transcript-chat-message-content">${contentWithTimestamps}</div>`
            }
            
            messagesContainer.appendChild(messageDiv)
        })
        
        // Setup timestamp button handlers
        const timestampButtons = messagesContainer.querySelectorAll('.youtube-transcript-chat-timestamp')
        timestampButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                const timestamp = button.getAttribute('data-timestamp')
                const buttonVideoId = button.getAttribute('data-video-id')
                if (timestamp && buttonVideoId === videoId) {
                    handleTimestampClick(videoId, timestamp)
                }
            })
        })
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight
    }
    
    // Send message function
    async function sendMessage() {
        if (!inputElement || !sendButton) return
        
        const messageText = inputElement.value.trim()
        if (!messageText) return
        
        // Check config again before sending
        const currentApiEndpoint = window.settings.getAIChatApiEndpoint()
        const currentApiKey = window.settings.getAIChatApiKey()
        const currentModel = window.settings.getAIModel()
        
        if (!currentApiEndpoint || !currentApiKey || !currentModel) {
            if (window.utils && window.utils.showMessageBox) {
                const openConfig = await window.utils.showMessageBox(
                    i18n('transcript.chat.configIncomplete', 'AI Model Not Configured'),
                    i18n('transcript.chat.configIncompleteMessage', 'Please configure Chat API settings first.'),
                    i18n('transcript.openConfig', 'Open Config'),
                    i18n('transcript.cancel', 'Cancel'),
                    false,
                    'warning'
                )
                if (openConfig && window.utils.openAIConfig) {
                    await window.utils.openAIConfig()
                }
            }
            return
        }
        
        // Add user message
        messages.push({ role: 'user', content: messageText })
        inputElement.value = ''
        inputElement.disabled = true
        sendButton.disabled = true
        
        // Render user message first
        renderMessages()
        
        // Show loading state
        const loadingDiv = document.createElement('div')
        loadingDiv.className = 'youtube-transcript-chat-message youtube-transcript-chat-message-assistant youtube-transcript-chat-message-loading'
        loadingDiv.innerHTML = `<div class="youtube-transcript-chat-message-content">${loadingText}</div>`
        if (messagesContainer) {
            messagesContainer.appendChild(loadingDiv)
            messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
        
        try {
            // Prepare chat history (last 10 messages for context)
            const chatHistory = messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }))
            
            // Call IPC handler
            if (!window.utils || !window.utils.chatWithTranscript) {
                const apiNotAvailableText = i18n('transcript.chat.apiNotAvailable', 'Chat API not available')
                throw new Error(apiNotAvailableText)
            }
            
            const response = await window.utils.chatWithTranscript(messageText, transcript, chatHistory)
            
            // Remove loading message
            const loadingMsg = messagesContainer.querySelector('.youtube-transcript-chat-message-loading')
            if (loadingMsg) {
                loadingMsg.remove()
            }
            
            // Add assistant message
            messages.push({
                role: 'assistant',
                content: response.content,
                timestamps: response.timestamps || []
            })
            
            renderMessages()
        } catch (error) {
            console.error('Error sending chat message:', error)
            
            // Remove loading message
            const loadingMsg = messagesContainer.querySelector('.youtube-transcript-chat-message-loading')
            if (loadingMsg) {
                loadingMsg.remove()
            }
            
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorText = i18n('transcript.chat.error', 'Failed to get response')
            
            // Add error message
            messages.push({
                role: 'assistant',
                content: `${errorText}: ${errorMessage}`,
                timestamps: []
            })
            
            renderMessages()
        } finally {
            inputElement.disabled = false
            sendButton.disabled = false
            inputElement.focus()
        }
    }
    
    // Setup send button
    if (sendButton) {
        sendButton.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            sendMessage()
        })
    }
    
    // Track composition state for IME (Input Method Editor)
    let isComposing = false
    
    // Setup Enter key (Shift+Enter for new line)
    if (inputElement) {
        // Handle IME composition events (for Chinese/Japanese/Korean input)
        inputElement.addEventListener('compositionstart', (e) => {
            isComposing = true
            inputElement.setAttribute('data-composing', 'true')
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        inputElement.addEventListener('compositionupdate', (e) => {
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        inputElement.addEventListener('compositionend', (e) => {
            isComposing = false
            inputElement.removeAttribute('data-composing')
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        // Prevent any default behavior that might cause page refresh
        inputElement.addEventListener('keydown', (e) => {
            // Don't handle Enter during composition
            if (isComposing && e.key === 'Enter') {
                return
            }
            
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.stopPropagation()
                e.stopImmediatePropagation()
                // Call sendMessage asynchronously to avoid blocking
                setTimeout(() => {
                    sendMessage()
                }, 0)
                return false
            }
            
            // Prevent other keys that might trigger navigation
            if (e.key === 'Escape' || (e.ctrlKey && e.key === 'Enter')) {
                e.stopPropagation()
            }
        }, false) // Don't use capture phase, use bubble phase so it runs after composition events
        
        // Also prevent form submission on keypress
        inputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
                e.preventDefault()
                e.stopPropagation()
                e.stopImmediatePropagation()
                return false
            }
        }, false) // Use bubble phase
        
        // Prevent any input events that might trigger navigation
        inputElement.addEventListener('input', (e) => {
            e.stopPropagation()
        })
        
        // Prevent beforeinput events
        inputElement.addEventListener('beforeinput', (e) => {
            e.stopPropagation()
        })
        
        // Prevent focus events from triggering anything
        inputElement.addEventListener('focus', (e) => {
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        inputElement.addEventListener('blur', (e) => {
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        // Prevent paste events that might trigger issues
        inputElement.addEventListener('paste', (e) => {
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        // Prevent cut/copy events
        inputElement.addEventListener('cut', (e) => {
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        inputElement.addEventListener('copy', (e) => {
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        // Prevent contextmenu events
        inputElement.addEventListener('contextmenu', (e) => {
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
        
        // Prevent selectstart events
        inputElement.addEventListener('selectstart', (e) => {
            // Allow text selection, but stop propagation
            e.stopPropagation()
        }, true)
        
        // Add a data attribute to mark this as a chat input
        inputElement.setAttribute('data-chat-input', 'true')
        
        // Prevent any default form behaviors
        inputElement.addEventListener('invalid', (e) => {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
        }, true)
    }
    
    // Render initial messages
    renderMessages()
    
    // Listen for explain selection events
    const handleExplainEvent = (event) => {
        const customEvent = event
        const detail = customEvent.detail
        if (!detail || !detail.text || !detail.videoId || detail.videoId !== videoId) {
            return
        }
        
        // Ensure input element is available and send the message
        if (inputElement && typeof sendMessage === 'function') {
            inputElement.value = detail.text
            // Use setTimeout to ensure the value is set before sending
            setTimeout(() => {
                sendMessage()
            }, 50)
        }
    }
    
    window.addEventListener('tldw-explain-selection', handleExplainEvent)
    
    // Store cleanup function
    chatContainer._explainCleanup = () => {
        window.removeEventListener('tldw-explain-selection', handleExplainEvent)
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
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
    const previousCurrentSegment = container.querySelector('.youtube-transcript-segment.current')
    segments.forEach(seg => seg.classList.remove('current'))
    
    // Add current class to the active segment and scroll
    if (currentSegment) {
        // Check if this is a new segment (different from previous)
        const isNewSegment = previousCurrentSegment !== currentSegment
        
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
        // Force a reflow to ensure accurate measurements after class change
        void currentSegment.offsetHeight
        
        const currentScrollTop = transcriptContent.scrollTop
        
        // Use offsetTop for more reliable position calculation
        // Calculate element's position relative to transcriptContent
        let elementTopInContent = 0
        let element = currentSegment
        while (element && element !== transcriptContent) {
            elementTopInContent += element.offsetTop
            element = element.offsetParent
        }
        
        // If offsetTop calculation failed, fallback to getBoundingClientRect
        if (elementTopInContent === 0 || element !== transcriptContent) {
            const elementRect = currentSegment.getBoundingClientRect()
            const viewportRect = transcriptContent.getBoundingClientRect()
            elementTopInContent = elementRect.top - viewportRect.top + currentScrollTop
        }
        
        // Calculate target scroll position (accounting for padding)
        const padding = 12 // padding of .youtube-transcript-content
        const targetScrollTop = elementTopInContent - padding
        
        // Always scroll when segment becomes current, especially if it's a new segment
        // Use very small tolerance to ensure immediate response
        const tolerance = 0.1
        const scrollDistance = Math.abs(currentScrollTop - targetScrollTop)
        const needsScroll = scrollDistance > tolerance || isNewSegment
        
        // Always scroll when it's a new segment or when position doesn't match
        if (needsScroll) {
            // Check if this is a rapid segment change
            const lastTarget = lastScrollTarget.get(transcriptId)
            const targetChanged = lastTarget === undefined || Math.abs(lastTarget - targetScrollTop) > 10 || isNewSegment
            
            // If target changed or it's a new segment, cancel any ongoing scroll immediately
            if (targetChanged && lastTarget !== undefined) {
                // Cancel ongoing smooth scroll
                transcriptContent.scrollTop = currentScrollTop
            }
            
            // Update last scroll target
            lastScrollTarget.set(transcriptId, targetScrollTop)
            
            // Immediately start smooth scroll
            transcriptContent.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
            })
        } else {
            // Update last target even if no scroll needed
            lastScrollTarget.set(transcriptId, targetScrollTop)
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
    
    // Get i18n texts once at the start of the function
    const transcriptTab = i18n('transcript.tab.transcript', 'Transcript')
    const aiSummaryTab = i18n('transcript.tab.aiSummary', 'AI Summary')
    const quotesTab = i18n('transcript.tab.quotes', 'Quotes')
    const chatTab = i18n('transcript.tab.chat', 'Chat')
    const loadingText = i18n('transcript.loading', 'Loading transcript...')
    const notAvailableText = i18n('transcript.notAvailable', 'Transcript not available for this video.')
    const reloadText = i18n('transcript.reload', 'Reload')
    
    // Show loading state with tabs
    container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-tabs"><button class="youtube-transcript-tab active" data-tab="transcript"><span>' + transcriptTab + '</span><span class="youtube-transcript-language-chevron" data-video-id="' + videoId + '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button><button class="youtube-transcript-tab" data-tab="summary">' + aiSummaryTab + '</button><button class="youtube-transcript-tab" data-tab="quotes">' + quotesTab + '</button><button class="youtube-transcript-tab" data-tab="chat">' + chatTab + '</button></div><div class="youtube-transcript-tab-content" data-content="transcript"><div class="youtube-transcript-content"><div class="youtube-transcript-loading">' + loadingText + '</div></div></div><div class="youtube-transcript-tab-content" data-content="summary" style="display: none;"><div class="youtube-transcript-summary"><div class="youtube-transcript-summary-content"></div></div></div><div class="youtube-transcript-tab-content" data-content="quotes" style="display: none;"><div class="youtube-transcript-quotes"><div class="youtube-transcript-quotes-content"></div></div></div><div class="youtube-transcript-tab-content" data-content="chat" style="display: none;"><div class="youtube-transcript-chat"></div></div></div>'
    
    // Fetch transcript from YouTube
    const transcript = await fetchYouTubeTranscript(videoId)
    
    // If transcript fetch failed, show error message
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
        container.innerHTML = '<div class="youtube-transcript"><div class="youtube-transcript-tabs"><button class="youtube-transcript-tab active" data-tab="transcript"><span>' + transcriptTab + '</span><span class="youtube-transcript-language-chevron" data-video-id="' + videoId + '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button><button class="youtube-transcript-tab" data-tab="summary">' + aiSummaryTab + '</button><button class="youtube-transcript-tab" data-tab="quotes">' + quotesTab + '</button><button class="youtube-transcript-tab" data-tab="chat">' + chatTab + '</button></div><div class="youtube-transcript-tab-content" data-content="transcript"><div class="youtube-transcript-content"><div class="youtube-transcript-error"><div>' + notAvailableText + '</div><button class="youtube-transcript-reload">' + reloadText + '</button></div></div></div><div class="youtube-transcript-tab-content" data-content="summary" style="display: none;"><div class="youtube-transcript-summary"><div class="youtube-transcript-summary-content"></div></div></div><div class="youtube-transcript-tab-content" data-content="quotes" style="display: none;"><div class="youtube-transcript-quotes"><div class="youtube-transcript-quotes-content"></div></div></div><div class="youtube-transcript-tab-content" data-content="chat" style="display: none;"><div class="youtube-transcript-chat"></div></div></div>'
        setupTabSwitching(container)
        setupTranscriptLanguageMenu(container, videoId)
        
        // Setup reload button
        const transcriptContent = container.querySelector('.youtube-transcript-content')
        if (transcriptContent) {
            const reloadButton = transcriptContent.querySelector('.youtube-transcript-reload')
            if (reloadButton) {
                reloadButton.addEventListener('click', () => {
                    renderTranscript(containerId, videoId)
                })
            }
        }
        
        return
    }
    
    // Store transcript data for this video
    transcriptData.set(videoId, transcript)
    
    // Create transcript HTML with tabs (content will be rendered by renderTranscriptWithTranslation)
    let transcriptHTML = '<div class="youtube-transcript">'
    transcriptHTML += '<div class="youtube-transcript-tabs">'
    transcriptHTML += '<button class="youtube-transcript-tab active" data-tab="transcript"><span>' + transcriptTab + '</span><span class="youtube-transcript-language-chevron" data-video-id="' + videoId + '"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>'
    transcriptHTML += '<button class="youtube-transcript-tab" data-tab="summary">' + aiSummaryTab + '</button>'
    transcriptHTML += '<button class="youtube-transcript-tab" data-tab="quotes">' + quotesTab + '</button>'
    transcriptHTML += '<button class="youtube-transcript-tab" data-tab="chat">' + chatTab + '</button>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-tab-content" data-content="transcript">'
    transcriptHTML += '<div class="youtube-transcript-content"></div>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-tab-content" data-content="summary" style="display: none;">'
    transcriptHTML += '<div class="youtube-transcript-summary">'
    transcriptHTML += '<div class="youtube-transcript-summary-content"></div>'
    transcriptHTML += '</div>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-tab-content" data-content="quotes" style="display: none;">'
    transcriptHTML += '<div class="youtube-transcript-quotes">'
    transcriptHTML += '<div class="youtube-transcript-quotes-content"></div>'
    transcriptHTML += '</div>'
    transcriptHTML += '</div>'
    transcriptHTML += '<div class="youtube-transcript-tab-content" data-content="chat" style="display: none;">'
    transcriptHTML += '<div class="youtube-transcript-chat"></div>'
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
if (!url) {
    console.error('Article URL parameter "u" is missing')
    const main = document.getElementById("main")
    if (main) {
        main.innerHTML = '<div style="padding: 20px; text-align: center;">Error: Article URL is missing</div>'
        main.classList.add("show")
    }
} else {
    getArticle(url).then(article => {
        // Reset YouTube player counter for new article
        youtubePlayerCounter = 0
        youtubePlayers.clear()
        
        // Convert YouTube links to embeds before inserting
        if (article) {
            article = convertYouTubeLinks(article)
        }
        
        const hParam = get("h")
        if (!hParam) {
            console.error('Article HTML parameter "h" is missing')
            const main = document.getElementById("main")
            if (main) {
                main.innerHTML = '<div style="padding: 20px; text-align: center;">Error: Article HTML is missing</div>'
                main.classList.add("show")
            }
            return
        }
        
        let domParser = new DOMParser()
        let dom = domParser.parseFromString(hParam, "text/html")
        const articleElement = dom.getElementsByTagName("article")[0]
        if (!articleElement) {
            console.error('Article element not found in HTML')
            const main = document.getElementById("main")
            if (main) {
                main.innerHTML = '<div style="padding: 20px; text-align: center;">Error: Article structure is invalid</div>'
                main.classList.add("show")
            }
            return
        }
        articleElement.innerHTML = article
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
        if (!main) {
            console.error('Main element not found')
            return
        }
        main.innerHTML = dom.body.innerHTML
        main.classList.add("show")
        
        // Start loading transcripts immediately (doesn't need player, only needs DOM)
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
            startLoadingTranscripts()
            // Initialize YouTube players in parallel
            initializeYouTubePlayers()
        }, 0)
    }).catch(error => {
        console.error('Error loading article:', error)
        const main = document.getElementById("main")
        if (main) {
            main.innerHTML = '<div style="padding: 20px; text-align: center;">Error loading article: ' + String(error) + '</div>'
            main.classList.add("show")
        }
    })
}

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

