import { GitHubLogType } from "../../core/Enums.ts";
import { File } from "../../core/File.ts";
import { CSharpVersionService } from "../../core/Services/CSharpVersionService.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";

/**
 * Updates the versions in a csharp project file.
 */
export class UpdateCSharpProjRunner extends ScriptRunner {
	/**
	 * Initializes a new instance of the {@link UpdateCSharpProjRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		super(args);
	}

	/**
	 * Runs the update csharp project file script.
	 */
	// deno-lint-ignore require-await
	public async run(): Promise<void> {
		const service = new CSharpVersionService();

		const [filePath, version] = this.args;

		service.updateVersion(filePath, version);
	}

	/**
	 * @inheritdoc
	 */
	// deno-lint-ignore require-await
	protected async validateArgs(args: string[]): Promise<void> {
		if (args.length != 3) {
			const argDescriptions = [
				`The cicd script must have 3 arguments.`,
				"Required and must be a valid fully qualified path to a csharp project file.",
				"Required and must be a valid preview or production version number.",
				"Required and must be a valid GitHub repository name.",
			];

			Utils.printAsNumberedList(" Arg: ", argDescriptions, GitHubLogType.error);
			Deno.exit(1);
		}

		let [projFilePath] = args;

		projFilePath = Utils.normalizePath(projFilePath);

		if (File.DoesNotExist(projFilePath)) {
			Utils.printAsGitHubError(`The file '${projFilePath}' does not exist.`);
			Deno.exit(1);
		}		
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [projFilePath, version] = args;

		projFilePath = projFilePath.trim();
		projFilePath = Utils.normalizePath(projFilePath);

		version = version.trim().toLowerCase();
		version = version.startsWith("v") ? version.slice(1) : version;

		return [projFilePath, version];
	}
}
