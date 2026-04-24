import { ResolverInterface, ResolverServiceInterface } from "@src/Resolver/Interfaces";
import { inject, injectable } from "inversify";
import SI from "../../config/inversify.types";

@injectable()
export default class FeatureService {
    constructor(
        @inject(SI["resolver:service"])
        private service: ResolverServiceInterface
    ) {}

    public createResolver(name: string): ResolverInterface {
        const service = this.service;

        return {
            resolve(path: string): string | null {
                const main = service.createNamed(`${name}:main`);
                const fallback = service.createNamed(`${name}:fallback`);
                return main.resolve(path) ?? fallback.resolve(path);
            },
        };
    }
}
