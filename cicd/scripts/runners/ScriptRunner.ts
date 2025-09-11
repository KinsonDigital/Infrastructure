import { isNotValidPreviewVersion, isNotValidProdVersion, printAsGitHubError } from "../../core/Utils.ts";

/**
 * Provides a base class for processing script arguments and running scripts.
 */
export abstract class ScriptRunner {
	protected readonly fineGrainedTokenPrefix = "github_pat_";
	protected readonly classicTokenPrefix = "ghp_";
	protected readonly token;
	protected args: string[];

	/**
	 * Initializes a new instance of the {@link ScriptRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		// If the args do not contain a github token of any kind, throw and error
		const token = args[args.length - 1];
		const hasFineGrainedToken = token.startsWith(this.fineGrainedTokenPrefix);
		const hasClassicToken = token.startsWith(this.classicTokenPrefix);

		if (hasFineGrainedToken === false && hasClassicToken === false) {
			const errorMsg = "The arguments must contain a GitHub PAT(Personal Access Token) and must be the last argument.";
			printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		this.args = args;
		this.token = token;
	}

	/**
	 * Validates the given {@link args}.
	 * @param args The arguments to process.
	 */
	protected abstract validateArgs(args: string[]): Promise<void>;

	/**
	 * Mutates the given {@link args}.
	 * @param args The arguments to mutate.
	 * @returns The mutated arguments.
	 */
	protected abstract mutateArgs(args: string[]): string[];

	/**
	 * Runs a script.
	 */
	public async run(): Promise<void> {
		this.args = this.mutateArgs(this.args);

		await this.validateArgs(this.args);
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
			printAsGitHubError(`The release type must be either 'production' or 'preview'.`);
			Deno.exit(1);
		}

		if (releaseType === "production") {
			if (isNotValidProdVersion(version)) {
				let errorMsg = `The production version '${version}' is not valid.`;
				errorMsg += "\nRequired Syntax: v#.#.#";
				printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		} else {
			if (isNotValidPreviewVersion(version)) {
				let errorMsg = `The preview version '${version}' is not valid.`;
				errorMsg += "\nRequired Syntax: v#.#.#-preview.#";
				printAsGitHubError(errorMsg);
				Deno.exit(1);
			}
		}
	}
}
