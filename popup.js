var handler = async (options) => {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true, url: ["https://chat.openai.com/*"] })
    if (!tab) return
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["dom-to-image.min.js", "FileSaver.min.js", "worker.js"]
    });
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (a) => window.chatgptScreenshotEx(a),
        args: [options]
    });
}

document.querySelector("button#only").addEventListener('click', () => handler({ selectedOnly: true, flattern: true }))
document.querySelector("button#full").addEventListener('click', () => handler({ selectedOnly: false, flattern: true }))
var checkValid = async () => {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true, url: ["https://chat.openai.com/*"] })
    document.querySelector("#validTab").style.display = tab ? 'block' : 'none';
    document.querySelector("#invalidTab").style.display = !tab ? 'block' : 'none';
}
checkValid()