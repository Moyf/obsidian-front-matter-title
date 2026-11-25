import { browser, expect } from "@wdio/globals";

describe("Front Matter Title — inline title mode changes (#295)", function () {
    it("keeps a single editable title through repeated reading and editing mode changes", async function () {
        await browser.executeObsidian(async ({ app }) => {
            await (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin").getDefer().awaitFeatures();
            await app.workspace.openLinkText("202208251731.md", "", true);
        });
        for (const mode of ["source", "preview", "source", "preview", "source"]) {
            await browser.executeObsidian(async ({ app }, nextMode) => {
                const leaf = app.workspace.getMostRecentLeaf();
                await leaf.setViewState({
                    ...leaf.getViewState(),
                    state: { ...leaf.getViewState().state, mode: nextMode },
                });
            }, mode);
            await browser.waitUntil(
                async () =>
                    browser.execute(() => {
                        const active = document.querySelector(".workspace-leaf.mod-active");
                        const visible = Array.from(active?.querySelectorAll(".inline-title") ?? []).filter(el => {
                            const style = getComputedStyle(el);
                            return (
                                (el as HTMLElement).offsetParent !== null &&
                                style.display !== "none" &&
                                style.visibility !== "hidden"
                            );
                        });
                        return visible.length === 1 && visible[0].textContent === "Hello From Frontmatter";
                    }),
                { timeout: 10000, timeoutMsg: `Duplicate or missing inline title in ${mode} mode` }
            );
        }
        const fakeCount = await browser.execute(
            () => document.querySelectorAll(".workspace-leaf.mod-active .inline-title[ofmt-fake-id]").length
        );
        expect(fakeCount).toBe(1);
        const editing = await browser.execute(() => {
            const active = document.querySelector(".workspace-leaf.mod-active");
            const fake = active.querySelector(".inline-title[ofmt-fake-id]") as HTMLElement;
            const original = active.querySelector(".inline-title[ofmt-original-id]") as HTMLElement;
            fake.click();
            return (
                document.activeElement === original &&
                getComputedStyle(fake).display === "none" &&
                getComputedStyle(original).display !== "none"
            );
        });
        expect(editing).toBe(true);
        await browser.execute(() => (document.activeElement as HTMLElement).blur());
        await browser.waitUntil(
            async () =>
                browser.execute(() => {
                    const active = document.querySelector(".workspace-leaf.mod-active");
                    const visible = Array.from(active.querySelectorAll(".inline-title")).filter(
                        el => (el as HTMLElement).offsetParent !== null && getComputedStyle(el).display !== "none"
                    );
                    return visible.length === 1 && visible[0].textContent === "Hello From Frontmatter";
                }),
            { timeout: 10000, timeoutMsg: "Inline title was not restored after editing" }
        );
    });
});
