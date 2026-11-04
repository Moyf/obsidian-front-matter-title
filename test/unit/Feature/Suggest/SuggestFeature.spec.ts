import { mock } from "jest-mock-extended";
import { Chooser, SuggestModalChooserFileItem, TFile } from "obsidian";
import { interfaces } from "inversify";
import SuggestFeature from "@src/Feature/Suggest/SuggestFeature";
import FeatureService from "@src/Feature/FeatureService";
import { ResolverInterface } from "@src/Resolver/Interfaces";
import { Feature } from "@src/Enum";

// Model the native split: renderSuggestion receives each value, while selection
// reads the stored values. Rendering alone must not change what gets selected.
class TestChooser {
    values: SuggestModalChooserFileItem[] = [];
    chooser = { renderSuggestion: jest.fn((_item: SuggestModalChooserFileItem, _el: HTMLElement): void => undefined) };
    setSuggestions(items: SuggestModalChooserFileItem[]) {
        this.values = items;
        this.renderSuggestions();
    }
    renderSuggestions() {
        this.values.forEach(item => this.chooser.renderSuggestion(item, null));
    }
    addSuggestion(item: SuggestModalChooserFileItem) {
        this.chooser.renderSuggestion(item, null);
        this.values.push(item);
    }
}

describe("Suggest link aliases (#292)", () => {
    let feature: SuggestFeature;
    let chooser: TestChooser;
    let resolver: ReturnType<typeof mock<ResolverInterface>>;
    const fileSuggestion = (): SuggestModalChooserFileItem => ({
        type: "file",
        file: Object.assign(new TFile(), { path: "note.md" }),
        downranked: false,
    });
    const create = (insertAlias: boolean) => {
        feature = new SuggestFeature(
            TestChooser as unknown as interfaces.Newable<Chooser>,
            mock<FeatureService>({ createResolver: () => resolver }),
            { enabled: true, insertAlias, templates: { main: "", fallback: "" } }
        );
        feature.enable();
    };

    beforeEach(() => {
        chooser = new TestChooser();
        resolver = mock<ResolverInterface>();
        resolver.resolve.mockReturnValue("Readable title");
    });
    afterEach(() => feature?.disable());

    it("preserves title alias insertion when enabled without mutating the source result", () => {
        create(true);
        const item = fileSuggestion();
        chooser.setSuggestions([item]);

        expect(chooser.values[0]).toMatchObject({ type: "alias", alias: "Readable title", file: item.file });
        expect(item.type).toBe("file");
        expect(item.alias).toBeUndefined();
    });

    it("renders the title but keeps the original result for selection when disabled", () => {
        create(false);
        const item = fileSuggestion();
        chooser.setSuggestions([item]);

        expect(chooser.chooser.renderSuggestion).toHaveBeenCalledWith(
            expect.objectContaining({ type: "alias", alias: "Readable title" }),
            null
        );
        expect(chooser.values[0]).toBe(item);
        expect(item.type).toBe("file");
        expect(item.alias).toBeUndefined();
    });

    it("keeps titles on rerender and on appended suggestions without changing selection", () => {
        create(false);
        const first = fileSuggestion();
        const second = fileSuggestion();
        chooser.setSuggestions([first]);
        chooser.renderSuggestions();
        chooser.addSuggestion(second);

        expect(chooser.chooser.renderSuggestion).toHaveBeenCalledTimes(3);
        expect(chooser.chooser.renderSuggestion.mock.calls.every(([item]) => item.alias === "Readable title")).toBe(
            true
        );
        expect(chooser.values).toEqual([first, second]);
        expect(second.alias).toBeUndefined();
    });

    it.each([true, false])("preserves an explicit native alias (insertAlias=%s)", insertAlias => {
        create(insertAlias);
        const item = { ...fileSuggestion(), type: "alias" as const, alias: "Chosen alias" };
        chooser.setSuggestions([item]);

        expect(chooser.values[0]).toBe(item);
        expect(chooser.chooser.renderSuggestion).toHaveBeenCalledWith(item, null);
        expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it("leaves files without a resolved title unchanged", () => {
        create(false);
        resolver.resolve.mockReturnValue(null);
        const item = fileSuggestion();
        chooser.setSuggestions([item]);

        expect(chooser.chooser.renderSuggestion).toHaveBeenCalledWith(item, null);
        expect(chooser.values[0]).toBe(item);
    });

    it("leaves non-file suggestions unchanged", () => {
        create(false);
        const tag = { type: "tag", tag: "example" } as unknown as SuggestModalChooserFileItem;
        chooser.setSuggestions([tag, null]);

        expect(chooser.values).toEqual([tag, null]);
        expect(resolver.resolve).not.toHaveBeenCalled();
    });

    it("restores the owner's renderer even if rendering throws", () => {
        create(false);
        const original = chooser.chooser.renderSuggestion;
        original.mockImplementation(() => {
            throw new Error("render failed");
        });

        expect(() => chooser.setSuggestions([fileSuggestion()])).toThrow("render failed");
        expect(chooser.chooser.renderSuggestion).toBe(original);
    });

    it("restores native suggestion behavior after disabling", () => {
        create(false);
        chooser.setSuggestions([fileSuggestion()]);
        feature.disable();
        chooser.chooser.renderSuggestion.mockClear();
        const item = fileSuggestion();
        chooser.setSuggestions([item]);

        expect(chooser.chooser.renderSuggestion).toHaveBeenCalledWith(item, null);
        expect(chooser.values[0]).toBe(item);
        expect(feature.getId()).toBe(Feature.Suggest);
    });
});
