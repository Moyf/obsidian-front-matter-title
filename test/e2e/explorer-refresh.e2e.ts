import { browser, expect } from "@wdio/globals";

describe("Front Matter Title — Explorer refresh (#294)", function () {
    const path = "202208251731.md";
    async function waitForTitle() {
        await browser.waitUntil(
            async () =>
                browser.executeObsidian(({ app }, file) => {
                    const view = app.workspace.getLeavesOfType("file-explorer")[0]?.view as any;
                    const item = view?.fileItems?.[file];
                    return item?.selfEl?.isConnected && item.innerEl.textContent === "Hello From Frontmatter";
                }, path),
            { timeout: 10000, timeoutMsg: "Explorer title was not restored after refresh" }
        );
    }

    it("keeps titles when the Explorer view is recreated", async function () {
        await browser.executeObsidian(async ({ app }) => {
            await (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin").getDefer().awaitFeatures();
        });
        await browser.executeObsidianCommand("file-explorer:open");
        await waitForTitle();
        await browser.executeObsidian(async ({ app }) => {
            const leaf = app.workspace.getLeavesOfType("file-explorer")[0];
            await leaf.setViewState({ type: "empty" });
            await leaf.setViewState({ type: "file-explorer" });
            await app.workspace.revealLeaf(leaf);
        });
        await waitForTitle();
        expect(await browser.executeObsidian(({ app }) => app.workspace.getLeavesOfType("file-explorer").length)).toBe(
            1
        );
    });

    it("keeps titles when Explorer rebuilds a file item without a metadata change", async function () {
        const replaced = await browser.executeObsidian(async ({ app }, file) => {
            const view = app.workspace.getLeavesOfType("file-explorer")[0].view as any;
            const previous = view.fileItems[file];
            const note = app.vault.getAbstractFileByPath(file);
            // Exercise native tree removal/recreation without modifying the note.
            await view.onDelete(note);
            await view.onCreate(note);
            return previous !== view.fileItems[file];
        }, path);
        expect(replaced).toBe(true);
        await waitForTitle();
    });
});
