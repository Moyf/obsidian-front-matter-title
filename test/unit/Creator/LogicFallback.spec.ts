import Container from "@config/inversify.config";
import SI from "@config/inversify.types";
import { CreatorInterface } from "@src/Creator/Interfaces";

describe("Logical fallback through the real template and extractor pipeline (#296)", () => {
    let creator: CreatorInterface;
    let metadata: Record<string, any>;

    beforeAll(() => {
        Container.bind(SI["factory:obsidian:meta"]).toConstantValue((_path: string, type: string) => metadata[type]);
        Container.bind(SI["factory:obsidian:file"]).toConstantValue(() => ({ basename: "legacy" }));
        creator = Container.get<CreatorInterface>(SI["creator:creator"]);
    });

    beforeEach(() => {
        metadata = { headings: [{ level: 1, heading: "Old heading" }] };
    });

    test.each([
        ["no YAML", undefined],
        ["no title property", { author: "Someone" }],
        ["a null title", { title: null }],
        ["an empty title", { title: "" }],
    ])("uses the heading in a composite template with %s", (_description, frontmatter) => {
        metadata.frontmatter = frontmatter;
        expect(creator.create("legacy.md", "{{_basename}} - {{title|#heading}}")).toBe("legacy - Old heading");
    });

    test("keeps the title when it exists", () => {
        metadata.frontmatter = { title: "Property title" };
        expect(creator.create("legacy.md", "{{_basename}} - {{title|#heading}}")).toBe("legacy - Property title");
    });

    test("skips multiple missing alternatives and supports heading levels", () => {
        metadata.frontmatter = { book: {} };
        expect(creator.create("legacy.md", "title|book.title|#h1")).toBe("Old heading");
    });

    test("returns null when all alternatives are unavailable", () => {
        metadata.headings = [];
        expect(creator.create("legacy.md", "title|subtitle|#heading")).toBeNull();
    });

    test("still returns null for a missing key without alternatives", () => {
        expect(creator.create("legacy.md", "title")).toBeNull();
    });
});
