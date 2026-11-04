import { browser, expect } from "@wdio/globals";

describe("Front Matter Title — Canvas file cards", function () {
    it("shows file titles after opening a canvas and reloading features", async function () {
        await browser.executeObsidian(async ({ app }) => {
            const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
            await plugin.getDefer().awaitFeatures();
            await app.workspace.openLinkText("board.canvas", "", true);
        });

        const waitForTitle = async () => {
            await browser.waitUntil(
                async () =>
                    browser.executeObsidian(({ app }) => {
                        const view = app.workspace.getLeavesOfType("canvas")[0]?.view as any;
                        const node = view?.canvas?.nodes?.get("node-zettel");
                        return node?.placeholderEl?.textContent === "Hello From Frontmatter";
                    }),
                { timeout: 20000, timeoutMsg: "Canvas card did not show the frontmatter title" }
            );
        };

        await waitForTitle();
        await browser.executeObsidian(({ app }) => {
            const view = app.workspace.getLeavesOfType("canvas")[0].view as any;
            view.canvas.nodes.get("node-zettel").placeholderEl.setText("Waiting for reload");
        });
        await browser.executeObsidianCommand("obsidian-front-matter-title-plugin:ofmt-features-reload");
        await waitForTitle();
        const enabled = await browser.executeObsidian(({ app }) => {
            const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
            return plugin.getDefer().getApi().getEnabledFeatures().includes("canvas");
        });
        expect(enabled).toBe(true);
    });
});
