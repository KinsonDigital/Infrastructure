import { Utils } from "../../core/Utils.ts";

/**
 * Provides a base class for processing script arguments and running scripts.
 */
export abstract class ScriptRunner {
	protected readonly args: string[];

	/**
	 * Initializes a new instance of the {@link ScriptRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		this.args = args;
		this.validateArgs(this.args);
	}

	/**
	 * Validates the given {@link args}.
	 * @param args The arguments to process.
	 */
	protected abstract validateArgs(args: string[]): void;

	/**
	 * Runs a script.
	 */
	protected async run(): Promise<void> {
	}

	/**
	 * Validates the given {@link version} and {@link releaseType}.
	 * @param releaseType The type of release to validate.
	 * @param version The version to validate.
	 */
	protected validateVersionAndReleaseType(releaseType: string, version: string): void {
		releaseType = releaseType.trim().toLowerCase();
		version = version.trim().toLowerCase();

		version = version.startsWith("v") ? version : `v${version}`;

		if (releaseType != "production" && releaseType != "preview") {
			Utils.printAsGitHubError(`The release type must be either 'production' or 'preview'.`);
			Deno.exit(1);
		}

		if (releaseType == "production") {
			if (Utils.isNotValidProdVersion(version)) {
				let errorMsg = `The production version '${version}' is not valid.`;
				errorMsg += "\nRequired Syntax: v#.#.#";
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		} else {
			if (Utils.isNotValidPreviewVersion(version)) {
				let errorMsg = `The preview version '${version}' is not valid.`;
				errorMsg += "\nRequired Syntax: v#.#.#-preview.#";
				Utils.printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		}
	}
}
