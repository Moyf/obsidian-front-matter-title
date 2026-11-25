import { browser, expect } from "@wdio/globals";

describe("Front Matter Title — missing properties in logical templates (#296)", function () {
    it("uses headings for legacy notes while preserving existing title properties", async function () {
        const notes = [
            { path: "fallback-no-yaml.md", content: "# Legacy heading\n", title: "fallback-no-yaml - Legacy heading" },
            {
                path: "fallback-missing-title.md",
                content: "---\nauthor: Someone\n---\n# Missing property heading\n",
                title: "fallback-missing-title - Missing property heading",
            },
            {
                path: "fallback-empty-title.md",
                content: "---\ntitle:\n---\n# Empty property heading\n",
                title: "fallback-empty-title - Empty property heading",
            },
            {
                path: "fallback-with-title.md",
                content: "---\ntitle: Property title\n---\n# Unused heading\n",
                title: "fallback-with-title - Property title",
            },
        ];
        const originalTemplate = await browser.executeObsidian(async ({ app }, fixtures) => {
            const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
            await plugin.getDefer().awaitFeatures();
            const original = plugin.storage.get("templates").get("common").get("main").value();
            for (const note of fixtures) {
                await app.vault.create(note.path, note.content);
            }
            return original;
        }, notes);

        try {
            await browser.waitUntil(
                async () =>
                    browser.executeObsidian(
                        ({ app }, paths) => paths.every(path => app.metadataCache.getCache(path)?.headings?.length),
                        notes.map(note => note.path)
                    ),
                { timeout: 20000, timeoutMsg: "fixture headings were not indexed" }
            );
            await browser.executeObsidian(({ app }) => {
                const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
                plugin.storage.get("templates").get("common").get("main").set("{{_basename}} - {{title|#heading}}");
            });
            await browser.executeObsidianCommand("file-explorer:open");
            await browser.executeObsidianCommand("obsidian-front-matter-title-plugin:ofmt-features-reload");

            const titles = await browser.waitUntil(
                async () => {
                    const actual: string[] = await browser.execute(
                        paths =>
                            paths.map(
                                path =>
                                    document.querySelector(
                                        `.nav-file-title[data-path="${path}"] .nav-file-title-content`
                                    )?.textContent ?? ""
                            ),
                        notes.map(note => note.path)
                    );
                    return actual.every((title, i) => title === notes[i].title) ? actual : false;
                },
                { timeout: 20000, timeoutMsg: "logical template did not show the expected titles in Explorer" }
            );
            expect(titles).toEqual(notes.map(note => note.title));
        } finally {
            await browser.executeObsidian(({ app }, template) => {
                const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
                plugin.storage.get("templates").get("common").get("main").set(template);
            }, originalTemplate);
            await browser.executeObsidianCommand("obsidian-front-matter-title-plugin:ofmt-features-reload");
            await browser.executeObsidian(
                async ({ app }, paths) => {
                    for (const path of paths) {
                        const file = app.vault.getAbstractFileByPath(path);
                        if (file) await app.vault.delete(file);
                    }
                },
                notes.map(note => note.path)
            );
        }
    });
});
