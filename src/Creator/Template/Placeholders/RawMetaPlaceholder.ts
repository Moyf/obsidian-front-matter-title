import AbstractPlaceholder from "./AbstractPlaceholder";
import { inject, injectable } from "inversify";
import SI from "../../../../config/inversify.types";
import ExtractorInterface from "@src/Components/Extractor/Interfaces/ExtractorInterface";
import { ObsidianMetaFactory } from "@config/inversify.factory.types";
import { TemplatePlaceholderInterface } from "@src/Creator/Interfaces";

@injectable()
export default class RawMetaPlaceholder extends AbstractPlaceholder {
    private key: string;

    constructor(
        @inject(SI["component:extractor"])
        private extractor: ExtractorInterface,
        @inject(SI["factory:obsidian:meta"])
        private factory: ObsidianMetaFactory
    ) {
        super();
    }

    makeValue(path: string): string {
        return this.extractor.extract(this.key, this.factory(path, "frontmatter"));
    }

    setPlaceholder(placeholder: string): TemplatePlaceholderInterface {
        this.key = placeholder.substring(1); // strip leading "@"
        return super.setPlaceholder(placeholder);
    }
}
