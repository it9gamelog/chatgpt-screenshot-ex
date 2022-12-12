(async (options) => {
    let counter = 50000; // prevent dead loop

    let selectedThread = null
    const extractThreadPosFromButton = (button) => {
        const threadText = button.parentNode.querySelector("span").innerText
        var match = threadText.match(/\d+/)
        if (match) {
            return Number(match[0]) - 1
        }
        return 0
    }

    const preserveSelectedThread = (content) => {
        selectedThread = []
        const buttons = content.querySelectorAll('button:not(.rounded-md):not(.p-1)')
        for (let i = 0; i < buttons.length; i += 2) {
            selectedThread.push(extractThreadPosFromButton(buttons[i]))
        }
    }

    const restoreSelectedThread = async (content) => {
        for (let level = 0; level < selectedThread.length; level++) {
            const buttons = content.querySelectorAll('button:not(.rounded-md):not(.p-1)')
            let leftButton = buttons[level * 2]
            let rightButton = buttons[level * 2 + 1]
            while (
                extractThreadPosFromButton(leftButton) > selectedThread[level] &&
                !leftButton.disabled &&
                counter-- > 0
            ) {
                leftButton.click()
                await new Promise(r => window.requestIdleCallback(r));
            }            
            while (
                extractThreadPosFromButton(leftButton) < selectedThread[level] &&
                !rightButton.disabled &&
                counter-- > 0
            ) {
                rightButton.click()
                await new Promise(r => window.requestIdleCallback(r));
            }
        }
    }
    class ConversationNode {
        constructor(node, children, depth, selected) {
            this.node = node
            if (node) {
                this.text = node.innerText.substring(0, 50) // for debug
            }
            this.children = children
            this.depth = depth
            this.selected = selected
        }
    }

    const generateNode = async (line, selected, depth) => {
        let parent = line.parentElement
        let index = [].slice.call(parent.children).indexOf(line) + 1
        let nextLine = parent.querySelector(":nth-child(" + index + ") ~ .border-b");
        if (nextLine) {
            return new ConversationNode(line.cloneNode(true), await explore(nextLine, depth, selected), depth, selected)
        }
        return new ConversationNode(line.cloneNode(true), [], depth, selected)
    }

    // Explore the conversation thread
    const explore = async (line, depth, selected) => {
        if (!line) {
            return []
        }
        if (counter-- < 0) {
            console.error("Dead loop! We shouldn't be here ever.")
            return []
        }
        const buttons = line.querySelectorAll('button:not(.rounded-md):not(.p-1)')
        if (buttons.length && !options?.selectedOnly) {
            let leftButton = buttons[0]
            let rightButton = buttons[1]
            leftButton.closest("div").classList.add("chatgpt-screenshot-ex-button-box")
            let threadCount = 0
            let result = []
            // Go to the left most thread
            for (; !leftButton.disabled && counter-- > 0;) {
                leftButton.click()
                await new Promise(r => window.requestIdleCallback(r));
            }
            // Capturing all node along the way
            result.push(await generateNode(line, selected && selectedThread[depth] == 0, depth + 1))
            for (; !rightButton.disabled && counter-- > 0; threadCount++) {
                rightButton.click()
                await new Promise(r => window.requestIdleCallback(r));
                result.push(await generateNode(line, selected && selectedThread[depth] == threadCount + 1, depth + 1))
            }
            // return result.sort((a, b) => b.selected - a.selected)
            return result
        } else {
            return [await generateNode(line, selected, depth)]
        }
    }

    const colorPalette = ["#cd36b1", "#0091ae", "#b7e21a", "#9a1b99", "#4bfbf0", "#fef910", "#d552ff", "#5aeb90", "#f7d792", "#f07310"]
    const currentPalette = []
    let colorIndex = 0
    const nextColor = () => {
        colorIndex = (colorIndex + 1) % colorPalette.length
        return colorPalette[colorIndex]
    }

    let lastIndicatorBox = null
    let lastIndicator = null

    const regenerateConversationTree = (content, conversation, threadBegin) => {
        let indicatorBox = document.createElement("div")

        if (conversation.node) {
            lastIndicatorBox = indicatorBox
            indicatorBox.classList.add("chatgpt-screenshot-ex-indicator-box")
            if (conversation.selected) {
                indicatorBox.classList.add("chatgpt-screenshot-ex-indicator-box-selected")
            }

            console.log(`${conversation.depth} (${threadBegin}) > ${conversation.text}`)
            conversation.node.classList.add("chatgpt-screenshot-ex-node")

            conversation.node.insertBefore(indicatorBox, conversation.node.firstChild)
            for (color of currentPalette) {
                let indicator = document.createElement("div")
                lastIndicator = indicator
                indicator.style.borderColor = color
                indicator.classList.add("chatgpt-screenshot-ex-indicator")
                indicatorBox.appendChild(indicator)
            }

            if (threadBegin == 1) {
                lastIndicator.classList.add("chatgpt-screenshot-ex-indicator-begin")
            } else if (threadBegin == 2) {
                lastIndicator.classList.add("chatgpt-screenshot-ex-indicator-break")
            }

            content.appendChild(conversation.node)
        }
        threadBegin = 0
        if (conversation.children.length > 1) {
            threadBegin = 1
            console.debug(`begin of ${conversation.depth}`)
            currentPalette.push(nextColor())
        }
        let times = 0;
        for (let children of conversation.children) {
            if (times++ > 0 && conversation.children.length > 1) {
                console.debug(`break of ${conversation.depth}`)
                threadBegin = 2
            }
            regenerateConversationTree(content, children, threadBegin)
        }
        if (conversation.children.length > 1) {
            console.debug(`end of ${conversation.depth}`)
            currentPalette.pop()
            if (lastIndicatorBox) {
                lastIndicatorBox.childNodes[conversation.depth].classList.add("chatgpt-screenshot-ex-indicator-end")
            }
        }
    }

    const addStyle = async (callback) => {
        var styles = `
        /* The thread indicator */
        .chatgpt-screenshot-ex-indicator {
            border-color: red;
            border-left-width: 3px;
            width: 0.8rem;
        }
        .chatgpt-screenshot-ex-indicator-begin {
            border-top-width: 3px;
        }
        .chatgpt-screenshot-ex-indicator-break {
            border-top-width: 6px;
            border-top-style: double;            
        }
        .chatgpt-screenshot-ex-indicator-end {
            border-bottom-width: 3px;
        }
        
        /* Hide the original conversation while exporting */
        .chatgpt-screenshot-ex-background > div {
            display: none;
        }
        .chatgpt-screenshot-ex-background > div.chatgpt-screenshot-ex-node {
            display: grid;
            grid-template: auto / min-content 1fr;            
            gap: 0.5rem;            /* gives some padding for nicer output */
            padding-left: 0.2rem;
            padding-right: 0.5rem;
            border: none;
        }

        /* The thread indicator container */
        div.chatgpt-screenshot-ex-node > div.chatgpt-screenshot-ex-indicator-box {
            grid-column: 1 / span 1;
            display: flex;
            gap: 0.5rem;
        }
        div.chatgpt-screenshot-ex-indicator-box-selected {
            background: #eadc91;
        }
        /* Conversation container */
        div.chatgpt-screenshot-ex-node > div:nth-child(2) {
            grid-column: 2 / span 1;
            margin: inherit;
        }
        /* Hide the thread selection */
        .chatgpt-screenshot-ex-button-box {
            display: none;
        }
        .chatgpt-screenshot-ex-background {
            background: white;      /* instead of being transparent... */
            height: initial;        /* get rid of the bottom margin */
            max-width: 37rem;       /* constrain the width, even on larger screen */
        }
        .chatgpt-screenshot-ex-background div.h-48.flex-shrink-0 {
            display: none;          /* get rid of the bottom margin reserved for the prompt input  */
        }
        .chatgpt-screenshot-ex-background .self-end {
            display: none;          /* remove the thumb-up/down */
        }
        `
        var styleSheet = document.createElement("style")
        styleSheet.innerHTML = styles
        document.head.appendChild(styleSheet)

        try {
            return await callback()
        } finally {
            document.head.removeChild(styleSheet)
        }
    }

    const work = async () => {
        const content = document.querySelector("main div.flex")
        content.classList.add("chatgpt-screenshot-ex-background");

        const firstNode = content.querySelector(".border-b")
        if (!firstNode) {
            return
        }

        /* for safety */
        for (let node of content.querySelectorAll(".chatgpt-screenshot-ex-node")) {
            node.remove()
        }

        preserveSelectedThread(content)

        const rootNodes = await explore(firstNode, 0, true)
        let root = new ConversationNode(null, rootNodes, 0, true)

        regenerateConversationTree(content, root)
        await new Promise(r => window.requestIdleCallback(r));

        const baseName = `chatgpt.${new Date().toISOString()}`
        const blob = await domtoimage.toBlob(content, { filter: (node) => node?.tagName?.toLowerCase() != 'img' })
        window.saveAs(blob, `${baseName}.png`)

        for (let node of content.querySelectorAll(".chatgpt-screenshot-ex-node")) {
            node.remove()
        }

        await restoreSelectedThread(content)
    }

    return addStyle(work)
})({ selectedOnly: true });