chrome.action.onClicked.addListener(async (tab) => {
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["dom-to-image.min.js", "FileSaver.min.js", "worker.js"]
    });
})