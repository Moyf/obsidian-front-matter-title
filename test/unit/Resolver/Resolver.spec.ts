import { mock, mockClear } from "jest-mock-extended";
import FilterInterface from "../../../src/Interfaces/FilterInterface";
import { ResolverEvents } from "@src/Resolver/ResolverType";
import Event from "@src/Components/EventDispatcher/Event";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { Resolver } from "@src/Resolver/Resolver";
import { CreatorInterface } from "@src/Creator/Interfaces";
import { TFile } from "obsidian";
import { ObsidianFileFactory } from "@config/inversify.factory.types";

describe("Resolver Sync Test", () => {
    const path = "/test/path/file.md";
    const title = "resolved_title";

    const filter = mock<FilterInterface>();
    const creator = mock<CreatorInterface>();
    const dispatcher = mock<EventDispatcherInterface<ResolverEvents>>();
    const fileFactory = jest.fn() as jest.MockedFunction<ObsidianFileFactory<TFile | null>>;

    const template = "some.template";
    const resolver = new Resolver([filter], creator, dispatcher, fileFactory);
    resolver.setTemplate(template);

    afterEach(() => {
        mockClear(filter);
        mockClear(creator);
        fileFactory.mockReset();
    });

    describe("Test filters", () => {
        beforeAll(() => {
            creator.create.mockReturnValue(title);
            fileFactory.mockReturnValue({ basename: "other_name" } as TFile);
        });

        test("Should return null because filter will return false", () => {
            filter.check.mockReturnValueOnce(false);
            expect(resolver.resolve(path)).toBeNull();
            expect(filter.check).toHaveBeenNthCalledWith(1, path);
        });
        test("Should return value because filter will return true", () => {
            filter.check.mockReturnValue(true);
            expect(resolver.resolve(path)).toEqual(title);
            expect(filter.check).toHaveBeenNthCalledWith(1, path);
        });

        afterAll(() => {
            filter.check.mockRestore();
            creator.create.mockRestore();
        });
    });

    describe("Test creator", () => {
        beforeAll(() => {
            filter.check.mockReturnValue(true);
            creator.create.mockReturnValue(title);
            fileFactory.mockReturnValue({ basename: "other_name" } as TFile);
        });
        beforeEach(() => dispatcher.dispatch.mockClear());
        test("Case when cache item is not hit", () => {
            expect(resolver.resolve(path)).toEqual(title);
            expect(creator.create).toHaveBeenNthCalledWith(1, path, template);
            expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                "resolver:resolved",
                new Event(expect.objectContaining({ value: title }))
            );
        });

        test("Should return modified value by event", () => {
            dispatcher.dispatch.mockImplementationOnce((name, event) => {
                if (name === "resolver:resolved") {
                    //@ts-expect-error
                    event.get().modify("bar");
                    return;
                }
                throw new Error(`Event ${name} is not expected`);
            });
            expect(resolver.resolve(path)).toEqual("bar");
            expect(creator.create).toHaveBeenNthCalledWith(1, path, template);
            expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
            expect(dispatcher.dispatch).toHaveBeenCalledWith(
                "resolver:resolved",
                new Event(expect.objectContaining({ value: "bar" }))
            );
        });
    });

    describe("Throw exception", () => {
        const consoleError = console.error;
        const error = new Error();
        beforeAll(() => {
            console.error = jest.fn();
            fileFactory.mockReturnValue({ basename: "other_name" } as TFile);
        });
        test("Should not save item to cache", () => {
            creator.create.mockImplementation(() => {
                throw new Error();
            });
            expect(resolver.resolve("/path/to/file_exception.md")).toBeNull();
            expect(creator.create).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledTimes(1);
            expect(console.error).toHaveBeenCalledWith(expect.anything(), error);
        });
        afterAll(() => {
            creator.create.mockClear();
            console.error = consoleError;
        });
    });

    describe("Skip when title equals basename", () => {
        beforeEach(() => {
            filter.check.mockReturnValue(true);
            dispatcher.dispatch.mockClear();
        });

        test("Should return null when title exactly matches basename", () => {
            creator.create.mockReturnValue("BetterLinks");
            fileFactory.mockReturnValue({ basename: "BetterLinks" } as TFile);
            expect(resolver.resolve(path)).toBeNull();
            expect(dispatcher.dispatch).not.toHaveBeenCalled();
        });

        test("Should return null when title matches basename case-insensitively", () => {
            creator.create.mockReturnValue("betterlinks");
            fileFactory.mockReturnValue({ basename: "BetterLinks" } as TFile);
            expect(resolver.resolve(path)).toBeNull();
            expect(dispatcher.dispatch).not.toHaveBeenCalled();
        });

        test("Should return null when title is uppercase and basename is lowercase", () => {
            creator.create.mockReturnValue("BETTERLINKS");
            fileFactory.mockReturnValue({ basename: "betterlinks" } as TFile);
            expect(resolver.resolve(path)).toBeNull();
            expect(dispatcher.dispatch).not.toHaveBeenCalled();
        });

        test("Should return title when title differs from basename", () => {
            creator.create.mockReturnValue("My Custom Title");
            fileFactory.mockReturnValue({ basename: "BetterLinks" } as TFile);
            expect(resolver.resolve(path)).toEqual("My Custom Title");
            expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
        });

        test("Should return null when creator returns null (no skip, dispatch still called)", () => {
            creator.create.mockReturnValue(null);
            fileFactory.mockReturnValue({ basename: "BetterLinks" } as TFile);
            expect(resolver.resolve(path)).toBeNull();
            // creator 返回 null 时，isSameAsBasename 为 false，仍走 dispatch
            expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
        });

        test("Should not skip when fileFactory returns null (file not found)", () => {
            creator.create.mockReturnValue("BetterLinks");
            fileFactory.mockReturnValue(null);
            // fileFactory 返回 null，无法比较，不跳过，正常走 dispatch
            expect(resolver.resolve(path)).toEqual("BetterLinks");
            expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
        });
    });
});
