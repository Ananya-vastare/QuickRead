document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("apiKey");
    const saveBtn = document.getElementById("saveBtn");
    const status = document.getElementById("status");

    // Load saved key
    chrome.storage.sync.get(["geminiApiKey"], (result) => {
        if (result.geminiApiKey) {
            input.value = result.geminiApiKey;
        }
    });

    // Save key
    saveBtn.addEventListener("click", () => {
        const key = input.value.trim();

        if (!key) {
            alert("Please enter an API key");
            return;
        }

        chrome.storage.sync.set({ geminiApiKey: key }, () => {
            status.textContent = "Saved successfully ✓";
            status.style.display = "block";

            // Close after short delay
            setTimeout(() => {
                window.close();
            }, 300);
        });
    });
});
