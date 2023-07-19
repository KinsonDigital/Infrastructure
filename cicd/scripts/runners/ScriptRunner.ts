import { Utils } from "../../core/Utils.ts";

/**
 * Provides a base class for processing script arguments and running scripts.
 */
export abstract class ScriptRunner {
	protected readonly args: string[];
	protected readonly fineGrainedTokenPrefix = "github_pat_";
	protected readonly classicTokenPrefix = "ghp_";
	protected readonly token;

	/**
	 * Initializes a new instance of the {@link ScriptRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		// If the args do not contain a github token of any kind, throw and error
		const lastArg = args[args.length - 1];
		const hasFineGrainedToken = lastArg.startsWith(this.fineGrainedTokenPrefix);
		const hasClassicToken = lastArg.startsWith(this.classicTokenPrefix);

		if (hasFineGrainedToken == false && hasClassicToken == false) {
			const errorMsg = "The arguments must contain a GitHub PAT(Personal Access Token) and must be the last argument.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		this.args = args;
		this.token = args[args.length - 1];
	}

	/**
	 * Validates the given {@link args}.
	 * @param args The arguments to process.
	 */
	protected abstract validateArgs(args: string[]): Promise<void>;

	/**
	 * Mutates the given {@link args}.
	 * @param args The arguments to mutate.
	 */
	protected abstract mutateArgs(args: string[]): string[];

	/**
	 * Runs a script.
	 */
	public async run(): Promise<void> {
		await this.validateArgs(this.args);
		this.mutateArgs(this.args);
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
