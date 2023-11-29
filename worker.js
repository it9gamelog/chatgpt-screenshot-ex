window.chatgptScreenshotEx = async (options) => {
    // Select the main content area
    const ContentSelector = 'main div[role=presentation] div.flex'        
    // Select all thread selection left/right buttons and only those buttons within the Content
    // Such as those in "< 1/2 >"
    //   .rounded-md and .p-1 excludes copy, like, edit, regenerate buttons
    //   .btn excludes the link sharing buttons on top right
    const ThreadButtonsSelector = 'button:not(.rounded-md):not(.p-1):not(.btn)'
    // Select all conversation lines within the Content
    const ConversationNodeSelector = '.text-token-text-primary'

    let counter = 50000; // prevent dead loop

    const nextTick = () => new Promise(r => window.requestIdleCallback(r));

    let selectedThread = null
    const extractThreadPosFromButton = (button) => {
        const threadText = button.parentNode.querySelector("span").innerText
        var match = threadText.match(/\d+/)
        if (match) {
            return Number(match[0]) - 1
        }
        return 0
    }

    // Chats could have different branches, and we are building a tree of the whole conversation
    // preserveSelectedThread preserve the current selected path
    const preserveSelectedThread = (content) => {
        selectedThread = []
        const buttons = content.querySelectorAll(ThreadButtonsSelector)
        for (let i = 0; i < buttons.length; i += 2) {
            selectedThread.push(extractThreadPosFromButton(buttons[i]))
        }
    }

    // restoreSelectedThread restore the captured, preserved selected path
    //   by visiting all the thread selection buttons, and clicking left/right accordingly
    const restoreSelectedThread = async (content) => {
        for (let level = 0; level < selectedThread.length; level++) {
            const buttons = content.querySelectorAll(ThreadButtonsSelector)
            let leftButton = buttons[level * 2]
            let rightButton = buttons[level * 2 + 1]
            while (
                extractThreadPosFromButton(leftButton) > selectedThread[level] &&
                !leftButton.disabled &&
                counter-- > 0
            ) {
                leftButton.click()
                await nextTick()
            }
            while (
                extractThreadPosFromButton(leftButton) < selectedThread[level] &&
                !rightButton.disabled &&
                counter-- > 0
            ) {
                rightButton.click()
                await nextTick()
            }
        }
    }
    class ConversationNode {
        constructor(node, children, depth, selected) {
            this.node = node
            if (node) {
                this.text = node.innerText.substring(0, 50) // for debug
                node.addEventListener('click', (e) => {
                    node.classList.toggle('skip-capture')
                })
            }
            this.children = children
            this.depth = depth
            this.selected = selected
        }
    }

    // generateNode is to generate ConversationNode from the conversation in recursive manner
    const generateNode = async (line, selected, depth) => {
        let parent = line.parentElement
        let index = [].slice.call(parent.children).indexOf(line) + 1
        let nextLine = parent.querySelector(":nth-child(" + index + ") ~ " + ConversationNodeSelector);
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

        const buttons = line.querySelectorAll(ThreadButtonsSelector)
        if (!buttons.length || options?.selectedOnly) {
            return [await generateNode(line, selected, depth)]
        }

        let leftButton = buttons[0]
        let rightButton = buttons[1]
        leftButton.closest("div").classList.add("chatgpt-screenshot-ex-button-box")
        let threadCount = 0
        let result = []
        // Go to the left most thread
        for (; !leftButton.disabled && counter-- > 0;) {
            leftButton.click()
            await nextTick()
        }
        // Capturing all node along the way
        result.push(await generateNode(line, selected && selectedThread[depth] == 0, depth + 1))
        for (; !rightButton.disabled && counter-- > 0; threadCount++) {
            rightButton.click()
            await nextTick()
            result.push(await generateNode(line, selected && selectedThread[depth] == threadCount + 1, depth + 1))
        }
        if (options?.flattern) {
            return result.sort((a, b) => b.selected - a.selected)
        } else {
            return result
        }
    }

    const colorPalette = ["#cd36b1", "#0091ae", "#b7e21a", "#9a1b99", "#4bfbf0", "#fef910", "#d552ff", "#5aeb90", "#f7d792", "#f07310"]
    const currentPalette = []
    let colorIndex = 0
    const nextColor = () => {
        colorIndex = (colorIndex + 1) % colorPalette.length
        return colorPalette[colorIndex]
    }
    const prevColor = () => {
        colorIndex = (colorIndex + colorPalette.length - 1) % colorPalette.length
    }

    let lastIndicatorBox = null
    let lastIndicator = null
    const regenerateTree = (content, conversation, threadBegin) => {
        let indicatorBox = document.createElement("div")

        if (conversation.node) {
            lastIndicatorBox = indicatorBox
            indicatorBox.classList.add("chatgpt-screenshot-ex-indicator-box")
            if (conversation.selected) {
                indicatorBox.classList.add("chatgpt-screenshot-ex-indicator-box-selected")
            }
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

            console.log(`${conversation.depth} (${threadBegin}) > ${conversation.text}`)
            conversation.node.classList.add("chatgpt-screenshot-ex-node")
            content.appendChild(conversation.node)
        }
        threadBegin = 0
        if (conversation.children.length > 1) {
            threadBegin = 1
            console.debug(`begin of ${conversation.depth}`)
            currentPalette.push(nextColor())
        }
        let times = 0;
        for (let child of conversation.children) {
            if (times++ > 0 && conversation.children.length > 1) {
                console.debug(`break of ${conversation.depth}`)
                threadBegin = 2
            }
            regenerateTree(content, child, threadBegin)
        }
        if (conversation.children.length > 1) {
            console.debug(`end of ${conversation.depth}`)
            currentPalette.pop()
            if (lastIndicatorBox) {
                lastIndicatorBox.childNodes[conversation.depth].classList.add("chatgpt-screenshot-ex-indicator-end")
            }
        }
    }

    const walkDive = Symbol('Dive')
    const walkDiveOnly = Symbol('DiveOnly')
    const walkSurfaceOnly = Symbol('SurfaceOnly')
    let xDepth = 0
    const regenerateFlattern = (content, conversation, begin, walk) => {
        if (conversation.node && walk != walkDiveOnly) {
            let indicatorBox = document.createElement("div")
            lastIndicatorBox = indicatorBox
            indicatorBox.classList.add("chatgpt-screenshot-ex-indicator-box")
            if (conversation.selected) {
                indicatorBox.classList.add("chatgpt-screenshot-ex-indicator-box-selected")
            }
            conversation.node.insertBefore(indicatorBox, conversation.node.firstChild)
            for (color of currentPalette) {
                let indicator = document.createElement("div")
                lastIndicator = indicator
                indicator.style.borderColor = color
                indicator.classList.add("chatgpt-screenshot-ex-indicator")
                indicatorBox.appendChild(indicator)
            }
            if (begin) {
                lastIndicator.classList.add("chatgpt-screenshot-ex-indicator-begin")
            }

            console.log(`${xDepth} > ${conversation.text}`)
            content.appendChild(conversation.node)
            conversation.node.classList.add("chatgpt-screenshot-ex-node")
        }

        if (walk == walkSurfaceOnly) return

        for (let child of conversation.children) {
            if (child.selected) continue
            if (child.depth != conversation.depth) {
                currentPalette.push(nextColor())
                xDepth++
            }
            regenerateFlattern(content, child, child.depth != conversation.depth, walkDive)
            if (child.depth != conversation.depth) {
                lastIndicatorBox.childNodes[--xDepth].classList.add("chatgpt-screenshot-ex-indicator-end")
                currentPalette.pop()
                prevColor()
            }
        }

        if (conversation.children.length > 0 && conversation.children[0].selected) {
            regenerateFlattern(content, conversation.children[0], false, walkDive)
        }
    }

    const addStyle = () => {
        var styles = `
        #chatgpt-screenshot-ex-edit-buttons {
            display: flex;
            position: fixed;
            top: 0.5rem;
            right: 1rem;
            z-index: 1000;
            gap: 1rem;
        }

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
        div.chatgpt-screenshot-ex-node {
            display: grid;
            grid-template: auto / min-content 1fr;            
            gap: 0.5rem;            /* gives some padding for nicer output */
            padding-left: 0.2rem;
            padding-right: 0.5rem;
            border: none;
        }        
        div.chatgpt-screenshot-ex-node.hidden {
            display: none;
        }
        
        div.chatgpt-screenshot-ex-node:hover, div.chatgpt-screenshot-ex-node.skip-capture {
            background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAAPdJREFUOI2Vk8FOwkAURc+bKulsUP/EREm6xhASPwUjH8PCfyESt3YhSf8EYTPFOH0upBLbzlDeZlbnTN59ueLsk4LmqUum6GJHn5H5sLR+CZIZ0BwkK61fIvPhOTBoblKXTGvJ3urb9np20wcWZL0f6KNBF7taouhd+pW8dkoacDnwk6vPl40BOCkJwACiqvFfthc+BLcFLQlFJfotKvddcLfgKFmBjABEKMrLatyEAUww8d9w/j1d0xYcVxgJUgAfCreh65gAfAisGqfOPMRObMLwIbATJzZR+C+KsESU5zgcXdFPxNnZe12MXo1sluksuLEOSPYDLkDokX7h5yoAAAAASUVORK5CYII=');
            cursor: pointer;
        }

        div.chatgpt-screenshot-ex-node.skip-capture {
            filter: grayscale(0.7);
        }

        div.chatgpt-screenshot-ex-node.skip-capture:hover {
            filter: grayscale(0.25);
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

        /* Remove prompt bar while previewing */
        div.absolute.bottom-0 {
            display: none;
        }
        `
        var styleSheet = document.createElement("style")
        styleSheet.dataset.tag = "chatgpt-screenshot-ex"
        styleSheet.innerHTML = styles
        document.head.appendChild(styleSheet)
    }

    let screenshotCount = 0
    const makeScreenshot = async (root) => {
        const baseName = `chatgpt.${new Date().toISOString()}`
        screenshotCount++
        const blob = await domtoimage.toBlob(root, { filter: (node) => node?.tagName?.toLowerCase() != 'img', copyDefaultStyles: false })
        window.saveAs(blob, `${baseName}.${(screenshotCount + '').padStart(3, '0')}.png`)
    }

    const workCapture = async (content) => {
        for (let node of content.querySelectorAll(".skip-capture")) {
            node.remove()
        }

        let nodes = content.querySelectorAll(".chatgpt-screenshot-ex-node")
        if (options.maximumHeight) {
            for (let node of nodes) {
                node.classList.add('hidden')
            }
            for (let i = 0, j = 0; j < nodes.length; j++) {
                nodes[j].classList.remove('hidden')
                await nextTick()
                if (j > i && content.offsetHeight > options.maximumHeight) {
                    nodes[j].classList.add('hidden')
                    await nextTick()
                    j--
                    await makeScreenshot(content)
                    for (; i <= j; i++) {
                        nodes[i].classList.add('hidden')
                    }
                }
            }
        }
        await makeScreenshot(content)

        for (let node of content.querySelectorAll(".chatgpt-screenshot-ex-node")) {
            node.remove()
        }

        await restoreSelectedThread(content)
    }

    const workConstruct = async (content) => {
        content.classList.add("chatgpt-screenshot-ex-background");

        const firstNode = content.querySelector(ConversationNodeSelector)
        if (!firstNode) {
            return
        }

        preserveSelectedThread(content)

        // Capture the conversation into ConversationNode, our own data format
        const rootNodes = await explore(firstNode, 0, true)
        let root = new ConversationNode(null, rootNodes, 0, true)

        // Recreate a new presentation DOM from the ConversationNode, and apply our style
        if (options?.flattern) {
            regenerateFlattern(content, root, false, walkDiveOnly)
        } else {
            regenerateTree(content, root)
        }
    }

    const cleanup = () => {
        // Style, and Preview Button
        for (let node of document.querySelectorAll('*[data-tag="chatgpt-screenshot-ex"]')) {
            node.remove()
        }
        for (let node of document.querySelectorAll(".chatgpt-screenshot-ex-node")) {
            node.remove()
        }
    }

    const insertEditButtons = (content) => {
        let area = document.createElement("div")
        area.dataset.tag = "chatgpt-screenshot-ex"
        area.id = "chatgpt-screenshot-ex-edit-buttons"
        area.classList.add("flex")
        content.append(area)

        {
            let button = document.createElement("button")
            button.classList.add("btn", "flex", "gap-2", "justify-center", "btn-neutral", "text-red-500")
            button.innerHTML = `Cancel`
            button.addEventListener('click', async () => {
                cleanup()
            })
            area.append(button)
        }
        {
            let button = document.createElement("button")
            button.classList.add("btn", "flex", "gap-2", "justify-center", "btn-neutral")
            button.innerHTML = `Reverse Selections`
            button.addEventListener('click', async () => {
                for (let node of document.querySelectorAll(".chatgpt-screenshot-ex-node")) {
                    node.classList.toggle('skip-capture')
                }
            })
            area.append(button)
        }
        {
            let button = document.createElement("button")
            button.classList.add("btn", "flex", "gap-2", "justify-center", "btn-primary")
            button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            Take screenshot`
            button.addEventListener('click', async () => {
                try {
                    await workCapture(content)
                } catch (e) {
                    console.error(e)
                    throw (e)
                } finally {
                    cleanup()
                }
            })
            area.append(button)
        }
    }

    return await (async () => {
        const content = document.querySelector(ContentSelector)
        try {
            cleanup()
            addStyle()
            await workConstruct(content)
            if (options.preview) {
                insertEditButtons(content)
            } else {
                await workCapture(content)
                cleanup()
            }
        } catch (e) {
            console.error(e)
            cleanup()
            throw (e)
        }
    })()
}