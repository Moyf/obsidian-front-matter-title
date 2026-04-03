import { ResolverDynamicInterface } from "@src/Resolver/Interfaces";
import { inject, injectable, multiInject } from "inversify";
import SI from "../../config/inversify.types";
import FilterInterface from "../Interfaces/FilterInterface";
import EventDispatcherInterface from "../Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { ResolverEvents } from "./ResolverType";
import Event from "../Components/EventDispatcher/Event";
import { CreatorInterface } from "@src/Creator/Interfaces";
import { ObsidianFileFactory } from "@config/inversify.factory.types";
import { TFile } from "obsidian";

@injectable()
export class Resolver implements ResolverDynamicInterface {
    private template = "";

    constructor(
        @multiInject(SI.filter)
        private filters: FilterInterface[],
        @inject(SI["creator:creator"])
        private creator: CreatorInterface,
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<ResolverEvents>,
        @inject(SI["factory:obsidian:file"])
        private fileFactory: ObsidianFileFactory<TFile | null>
    ) {}

    setTemplate(template: string): void {
        this.template = template;
    }

    resolve(path: string): string | null {
        return this.valid(path) ? this.get(path) : null;
    }

    private get(path: string): string | null {
        try {
            const title = this.creator.create(path, this.template);
            if (this.isSameAsBasename(path, title)) {
                return null;
            }
            return this.dispatch(title, path) ?? null;
        } catch (e) {
            console.error(`Error by path ${path}`, e);
        }

        return null;
    }

    private isSameAsBasename(path: string, title: string | null): boolean {
        if (!title) {
            return false;
        }
        const file = this.fileFactory(path);
        if (!file) {
            return false;
        }
        return file.basename.toLowerCase() === title.toLowerCase();
    }

    private dispatch(title: string | null, path: string): string | null {
        const event = new Event<ResolverEvents["resolver:resolved"]>({
            value: title,
            modify(v: string) {
                this.value = v;
            },
            path: path,
        });
        this.dispatcher.dispatch("resolver:resolved", event);
        return event.get().value ?? null;
    }

    private valid(path: string): boolean {
        for (const filter of this.filters) {
            if (filter.check(path) === false) {
                return false;
            }
        }
        return true;
    }
}
