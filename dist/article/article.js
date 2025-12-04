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
 * Convert YouTube links to embed iframes in HTML content
 * Simple string replacement approach
 */
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
            return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="max-width: 100%; height: auto; aspect-ratio: 16 / 9; display: block; margin: 16px 0;"></iframe>`
        }
        return match
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
})
