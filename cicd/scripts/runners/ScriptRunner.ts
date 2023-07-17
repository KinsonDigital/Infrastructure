import { Utils } from "../../core/Utils.ts";

/**
 * Provides a base class for processing script arguments and running scripts.
 */
export abstract class ScriptRunner {
	protected readonly args: string[];
	protected readonly fineGrainedTokenPrefix = "github_pat_";
	protected readonly classicTokenPrefix = "ghp_"

	/**
	 * Initializes a new instance of the {@link ScriptRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		this.validateArgs(args);
		this.args = this.mutateArgs(args);

		// If the args do not contain a github token of any kind, throw and error
		const lastArg = this.args[this.args.length - 1];
		const hasFineGrainedToken = lastArg.startsWith(this.fineGrainedTokenPrefix);
		const hasClassicToken = lastArg.startsWith(this.classicTokenPrefix);

		if (hasFineGrainedToken == false && hasClassicToken == false) {
			const errorMsg = "The arguments must contain a GitHub PAT(Personal Access Token) and must be the last argument.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(1);
		}

		const token = args[args.length - 1];
		this.repoClient = new RepoClient(token);
		this.orgClient = new OrgClient(token);
	}

	/**
	 * Validates the given {@link args}.
	 * @param args The arguments to process.
	 */
	protected abstract validateArgs(args: string[]): void;

	/**
	 * Mutates the given {@link args}.
	 * @param args The arguments to mutate.
	 */
	protected abstract mutateArgs(args: string[]): string[];

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
