chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_ARTICLE_TEXT") {
        try {
            // Prefer article or main content
            const article =
                document.querySelector("article") ||
                document.querySelector("main") ||
                document.body;

            // Remove scripts/styles from clone
            const clone = article.cloneNode(true);
            clone.querySelectorAll("script, style, noscript").forEach(el => el.remove());

            const text = clone.innerText
                .replace(/\s+/g, " ")
                .trim();

            sendResponse({ text });
        } catch (err) {
            console.error("Extraction error:", err);
            sendResponse({ text: null });
        }

        return true;
    }
});
