import { Directory } from "../../core/Directory.ts";
import { File } from "../../core/File.ts";
import { Path } from "../../core/Path.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";

/**
 * Resolves dotnet csproj files from a relative directory path.
 */
export class ResolveCsProjRunner extends ScriptRunner {
	/**
	 * @inheritdoc
	 */
	public async run(): Promise<void> {
		await super.run();

		const [projName, baseDirPath] = this.args;

		const filteredResults: string[] = Directory.getFiles(baseDirPath, true)
			.filter((f) => {
				const fileName = Path.getFileNameWithoutExtension(f);

				return fileName.endsWith(".csproj") && fileName.includes(projName);
			});

		if (filteredResults.length <= 0) {
			const errorMsg = `No csproj files were found in '${baseDirPath}' for the project '${projName}'.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(300);
		}

		const outputFilePath = Deno.env.get("GITHUB_OUTPUT");

		if (outputFilePath === undefined) {
			const errorMsg = "The GITHUB_OUTPUT environment variable is not set.";
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(400);
		}

		const outputName = "project-file-path";
		const csProjFilePath = filteredResults[0];
		const output = `${outputName}=${csProjFilePath}`;

		File.SaveFile(outputFilePath, output);

		Utils.printAsGitHubNotice(`Set output '${outputName}' set to a value of '${csProjFilePath}'.`);
	}

	/**
	 * @inheritdoc
	 */
	protected validateArgs(args: string[]): Promise<void> {
		if (args.length != 3) {
			let errorMsg = `The cicd script must have at 3 arguments but has ${args.length} arguments(s).`;
			errorMsg += "\nThe 1st arg is required and must be the name of the project.";
			errorMsg += "\nThe 2nd arg is required and must be base directory path to start the search.";
			errorMsg += "\nThe 3th arg is required and must be a valid GitHub PAT (Personal Access Token).";

			Utils.printAsGitHubError(errorMsg);
			Deno.exit(100);
		}

		const [_, baseDirPath] = args;

		if (Directory.DoesNotExist(baseDirPath)) {
			const errorMsg = `The base directory path '${baseDirPath}' does not exist.`;
			Utils.printAsGitHubError(errorMsg);
			Deno.exit(200);
		}

		return Promise.resolve();
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [projName, baseDirPath, token] = args;

		projName = projName.trim();
		baseDirPath = baseDirPath.trim();
		token = token.trim();

		return [projName, baseDirPath, token];
	}
}
