var handler = async (options) => {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true, url: ["https://chat.openai.com/*"] })    
    if (!tab) return
    saveSettings()
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["dom-to-image.min.js", "FileSaver.min.js", "worker.js"]
    });
    options.maximumHeight = Number(document.querySelector("#maximumHeight").value)
    options.preview = document.querySelector("#preview").checked
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (a) => window.chatgptScreenshotEx(a),
        args: [options]
    });
}
document.querySelector("button#only").addEventListener('click', () => handler({ selectedOnly: true, flattern: true }))
document.querySelector("button#full").addEventListener('click', () => handler({ selectedOnly: false, flattern: true }))

var saveSettings = async () => {
    await chrome.storage.local.set({
        maximumHeight: Number(document.querySelector("#maximumHeight").value),
        preview: document.querySelector("#preview").checked
    })
}

var loadSettings = async () => {
    let { maximumHeight, preview } = await chrome.storage.local.get(["maximumHeight", "preview"])
    document.querySelector("#maximumHeight").value = Number(maximumHeight) || 0
    document.querySelector("#preview").checked = preview || false
}

document.querySelector("#maximumHeight").addEventListener('change', () => saveSettings())
document.querySelector("#preview").addEventListener('change', () => saveSettings())

var checkValid = async () => {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true, url: ["https://chat.openai.com/*"] })
    document.querySelector("#validTab").style.display = tab ? 'block' : 'none';
    document.querySelector("#invalidTab").style.display = !tab ? 'block' : 'none';
}
checkValid()
loadSettings()