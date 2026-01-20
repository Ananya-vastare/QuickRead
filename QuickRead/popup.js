document.getElementById("summarize").addEventListener("click", async () => {
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';

    const summaryType = document.getElementById("summary-type").value;

    // Get API key from storage
    chrome.storage.sync.get(["geminiApiKey"], async (result) => {
        const apiKey = result.geminiApiKey;
        if (!apiKey) {
            resultDiv.innerText = "API key not found. Set it in the extension options.";
            return;
        }

        // Query active tab
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (!tab || !tab.id) {
                resultDiv.innerText = "No active tab found.";
                return;
            }

            // Send message to content script
            chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" }, async (res) => {

                // If page blocks content scripts
                if (chrome.runtime.lastError || !res || !res.text) {
                    const userText = prompt(
                        "This page blocks automatic text extraction.\nPlease paste the text you want to summarize:"
                    );
                    if (!userText || userText.trim().length < 20) {
                        resultDiv.innerText = "No text provided for summarization.";
                        return;
                    }
                    try {
                        const summary = await getGeminiSummary(userText, summaryType, apiKey);
                        resultDiv.innerText = summary;
                    } catch (error) {
                        resultDiv.innerText = "Error generating summary. Try again.";
                    }
                    return;
                }

                if (res.text.length < 50) {
                    resultDiv.innerText = "No readable content found on this page.";
                    return;
                }

                // Normal summarization
                try {
                    const summary = await getGeminiSummary(res.text, summaryType, apiKey);
                    resultDiv.innerText = summary;
                } catch (error) {
                    resultDiv.innerText = "Error generating summary. Try again.";
                }
            });
        });
    });
});

document.getElementById("copy-btn").addEventListener("click", () => {
    const summaryText = document.getElementById("result").innerText;
    if (!summaryText.trim()) return;

    navigator.clipboard.writeText(summaryText)
        .then(() => {
            const btn = document.getElementById("copy-btn");
            const original = btn.innerText;
            btn.innerText = "Copied!";
            setTimeout(() => { btn.innerText = original; }, 2000);
        })
        .catch(err => console.error("Failed to copy text:", err));
});

async function getGeminiSummary(text, summaryType, apiKey) {
    const maxLength = 20000;
    const truncated = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    let prompt;
    switch (summaryType) {
        case "brief":
            prompt = `Provide a brief summary in 2-3 sentences:\n\n${truncated}`;
            break;
        case "detailed":
            prompt = `Provide a detailed summary, covering all key points:\n\n${truncated}`;
            break;
        case "bullets":
            prompt = `Summarize in 5-7 key points. Each line starts with "- ":\n\n${truncated}`;
            break;
        default:
            prompt = `Summarize the following text:\n\n${truncated}`;
    }

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
                }),
            }
        );

        if (!res.ok) {
            let msg = "API request failed";
            try {
                const errData = await res.json();
                msg = errData.error?.message || msg;
            } catch { }
            throw new Error(msg);
        }

        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No summary available.";
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to generate summary. Please try again later.");
    }
}
