(async () => {
    var styles = `
    .chatgpt-screenshot-ex-background {
        background: white;      // instead of being transparent...
        height: initial;        // get rid of the bottom margin
        max-width: 37rem;       // constrain the width, even on larger screen
    }
    .chatgpt-screenshot-ex-background > div {
        padding-left: 0.5rem;   // gives some padding for nicer output
        padding-right: 0.5rem;
    }
    .chatgpt-screenshot-ex-background div.h-48.flex-shrink-0 {
        display: none;          // get rid of the bottom margin
    }
    .chatgpt-screenshot-ex-background .self-end {
        display: none;          // remove the thumb-up/down
    }
    `
    var styleSheet = document.createElement("style")
    styleSheet.innerHTML = styles
    document.head.appendChild(styleSheet)

    const content = document.querySelector("main div.flex")
    content.classList.add("chatgpt-screenshot-ex-background");
    console.log(content)
    try {
        const blob = await domtoimage.toBlob(content, { filter: (node) => node?.tagName?.toLowerCase() != 'img' })
        window.saveAs(blob, `chatgpt.${new Date().toISOString()}.png`)
    } catch (e) {
        console.warn(e)
    } finally {
        document.head.removeChild(styleSheet)
    }
})();