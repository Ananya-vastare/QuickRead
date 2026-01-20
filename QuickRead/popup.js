document.getElementById("summarize").addEventListener("click", async () => {
    const resultDiv = document.getElementById("result");
    resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';

    // Medium-length summary
    const summaryType = "concise";

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
                        "This page blocks automatic text extraction.\nPlease paste the text you want summarized:"
                    );
                    if (!userText || userText.trim().length < 20) {
                        resultDiv.innerText = "No text provided for summarization.";
                        return;
                    }
                    try {
                        const summary = await getGeminiSummary(userText, apiKey, summaryType);
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
                    const summary = await getGeminiSummary(res.text, apiKey, summaryType);
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

async function getGeminiSummary(text, apiKey, summaryType) {
    const maxLength = 100000; // Increase truncation limit
    const truncated = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    // Longer concise summary prompt
    let prompt = "";
    if (summaryType === "concise") {
        prompt = `Provide a detailed but concise summary of the following article in 6-10 sentences, covering all the main points clearly without unnecessary repetition:\n\n${truncated}`;
    }

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 5000, // Increase max tokens for longer summary
                    },
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
