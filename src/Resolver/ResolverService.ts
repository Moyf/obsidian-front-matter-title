import { ResolverInterface, ResolverServiceInterface } from "@src/Resolver/Interfaces";
import { NullResolverFactory, ResolverTemplateFactory } from "@src/Resolver/ResolverType";
import { inject, injectable, named } from "inversify";
import SI from "../../config/inversify.types";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { SettingsEvent } from "@src/Settings/SettingsType";

@injectable()
export default class ResolverService implements ResolverServiceInterface {
    private resolvers: Map<string, ResolverInterface> = new Map();

    constructor(
        @inject(SI["factory:resolver:resolver"])
        private factory: NullResolverFactory,
        @inject(SI["factory:resolver:template"])
        private templateFactory: ResolverTemplateFactory,
        @inject(SI.logger)
        @named("resolver:service")
        private logger: LoggerInterface,
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<SettingsEvent>
    ) {
        this.dispatcher.addListener({
            name: "settings:changed",
            cb: () => {
                this.resolvers.clear();
                this.logger.log("Resolver instance cache cleared due to settings change");
            },
        });
    }

    create(template: string): ResolverInterface {
        this.logger.log(`Create "${template}" template`);
        return this.getOrCreate(template);
    }

    createNamed(name: string) {
        this.logger.log(`Create named "${name}" template`);
        return this.create(this.templateFactory(name));
    }

    private getOrCreate(template: string): ResolverInterface {
        if (!this.resolvers.has(template)) {
            this.logger.log(`Create resolver for "${template}" template`);
            const resolver = this.factory();
            resolver.setTemplate(template);
            this.resolvers.set(template, resolver);
        }
        return this.resolvers.get(template);
    }
}
