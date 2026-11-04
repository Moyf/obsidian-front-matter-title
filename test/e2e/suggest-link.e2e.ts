import { browser, expect } from "@wdio/globals";

const PLUGIN = "obsidian-front-matter-title-plugin";
const NOTE = "suggest-link.md";

describe("Front Matter Title — link insertion (#292)", function () {
    before(async function () {
        await browser.executeObsidian(async ({ app }, file) => {
            const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
            await plugin.getDefer().awaitFeatures();
            await app.vault.create(file, "");
            await app.vault.create(
                "suggest-real-alias.md",
                "---\ntitle: Other title\naliases:\n  - Explicit alias\n---\n"
            );
            await app.workspace.openLinkText(file, "", true);
            // Note Link has its own rewriting behavior, independent of Suggest.
            plugin.storage.get("features").get("noteLink").get("enabled").set(false);
        }, NOTE);
    });

    async function configure(insertAlias: boolean) {
        await browser.keys(["Escape"]);
        await browser.executeObsidian(({ app }, enabled) => {
            const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
            plugin.storage.get("features").get("suggest").get("insertAlias").set(enabled);
            const editor = (app.workspace.getMostRecentLeaf().view as any).editor;
            editor.setValue("");
            editor.focus();
        }, insertAlias);
        await browser.executeObsidianCommand(`${PLUGIN}:ofmt-features-reload`);
    }

    async function typeLink(query: string, displayTitle: string) {
        await browser.executeObsidian(({ app }) => (app.workspace.getMostRecentLeaf().view as any).editor.focus());
        await browser.keys([...`[[${query}`]);
        await browser.waitUntil(
            async () =>
                browser.execute(
                    title =>
                        Array.from(document.querySelectorAll(".suggestion-item")).some(el =>
                            el.textContent.includes(title)
                        ),
                    displayTitle
                ),
            { timeout: 10000, timeoutMsg: `Readable suggestion '${displayTitle}' did not appear` }
        );
    }

    async function text(): Promise<string> {
        return browser.executeObsidian(({ app }) => (app.workspace.getMostRecentLeaf().view as any).editor.getValue());
    }

    it("adds the displayed title to a link when the setting is enabled", async function () {
        await configure(true);
        await typeLink("202208251731", "Hello From Frontmatter");
        await browser.keys(["Enter"]);
        expect(await text()).toBe("[[202208251731|Hello From Frontmatter]]");
    });

    it("shows titles but inserts a plain link when selected with the keyboard", async function () {
        await configure(false);
        await typeLink("202208251731", "Hello From Frontmatter");
        await browser.keys(["Enter"]);
        expect(await text()).toBe("[[202208251731]]");
    });

    it("also inserts a plain link when selected with the mouse", async function () {
        await configure(false);
        await typeLink("202208251731", "Hello From Frontmatter");
        await browser.$(".suggestion-item.is-selected").click();
        expect(await text()).toBe("[[202208251731]]");
    });

    it("preserves an explicit native alias chosen by the user", async function () {
        await configure(false);
        await typeLink("Explicit alias", "Explicit alias");
        await browser.keys(["Enter"]);
        expect(await text()).toBe("[[suggest-real-alias|Explicit alias]]");
    });

    it("keeps readable titles in the Quick Switcher when alias insertion is disabled", async function () {
        await configure(false);
        await browser.executeObsidianCommand("switcher:open");
        await browser.$(".prompt-input").click();
        await browser.keys([..."folder/sub"]);
        await browser.waitUntil(
            async () =>
                browser.execute(() =>
                    Array.from(document.querySelectorAll(".suggestion-item")).some(el =>
                        el.textContent.includes("Sub Note Title")
                    )
                ),
            { timeout: 10000, timeoutMsg: "Quick Switcher lost readable titles with alias insertion disabled" }
        );
        await browser.keys(["Escape"]);
        expect(await text()).toBe("");
    });

    it("exposes the setting in Suggest Manage and preserves it when settings close", async function () {
        await configure(true);
        await browser.executeObsidian(({ app }) => {
            (app as any).setting.open();
            (app as any).setting.openTabById("obsidian-front-matter-title-plugin");
        });
        await browser.waitUntil(
            async () =>
                browser.executeObsidian(({ app }) =>
                    Array.from(
                        (app as any).setting.activeTab.containerEl.querySelectorAll(
                            ".setting-item-name"
                        ) as NodeListOf<HTMLElement>
                    ).some(el => el.textContent.trim() === "Suggest")
                ),
            { timeout: 10000, timeoutMsg: "Suggest settings row did not appear" }
        );
        await browser.executeObsidian(({ app, obsidian }) => {
            const container = (app as any).setting.activeTab.containerEl as HTMLElement;
            const row = Array.from(container.querySelectorAll(".setting-item")).find(
                el => el.querySelector(".setting-item-name")?.textContent.trim() === "Suggest"
            );
            const original = obsidian.Modal.prototype.open;
            obsidian.Modal.prototype.open = function () {
                (window as any).__ofmtSuggestModal = this;
                return original.call(this);
            };
            try {
                (row.querySelector("button") as HTMLElement).click();
            } finally {
                obsidian.Modal.prototype.open = original;
            }
        });
        const initiallyEnabled = await browser.execute(() => {
            const modal = (window as any).__ofmtSuggestModal;
            const row = Array.from((modal.contentEl as HTMLElement).querySelectorAll(".setting-item")).find(
                el => el.querySelector(".setting-item-name")?.textContent.trim() === "Add title to inserted links"
            );
            const toggle = row.querySelector(".checkbox-container") as HTMLElement;
            const enabled = toggle.classList.contains("is-enabled");
            toggle.click();
            modal.close();
            delete (window as any).__ofmtSuggestModal;
            return enabled;
        });
        expect(initiallyEnabled).toBe(true);
        await browser.executeObsidian(({ app }) => (app as any).setting.close());
        await browser.waitUntil(
            async () =>
                browser.executeObsidian(async ({ app }) => {
                    const plugin = (app as any).plugins.getPlugin("obsidian-front-matter-title-plugin");
                    const saved = await plugin.loadData();
                    return (
                        saved?.features?.suggest?.insertAlias === false &&
                        plugin.fc.get("suggest")?.config?.insertAlias === false
                    );
                }),
            { timeout: 10000 }
        );
        await browser.executeObsidian(({ app }) => {
            const editor = (app.workspace.getMostRecentLeaf().view as any).editor;
            editor.setValue("");
            editor.focus();
        });
        await typeLink("202208251731", "Hello From Frontmatter");
        await browser.keys(["Enter"]);
        expect(await text()).toBe("[[202208251731]]");
    });
});
