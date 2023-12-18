import { RepoClient, walkSync } from "../../../deps.ts";
import { Utils } from "../../core/Utils.ts";
import { ScriptRunner } from "./ScriptRunner.ts";

/**
 * Validates that a dotnet SDK setup for a dotnet project is correct.
 */
export class ValidateSDKSetupRunner extends ScriptRunner {
	private readonly repoClient: RepoClient;

	/**
	 * Initializes a new instance of the {@link ValidateSDKSetupRunner} class.
	 * @param args The arguments to process.
	 */
	constructor(args: string[]) {
		super(args);

		const [repoOwner, repoName] = this.args;

		this.repoClient = new RepoClient(repoOwner, repoName, this.token);
	}

	public async run(): Promise<void> {
		const baseDirPath = Deno.cwd();

		// Find all of the csproj files for inspection
		const entries = walkSync(baseDirPath, {
			includeDirs: false,
			includeFiles: true,
			exts: [".csproj"],
		});

		let dotnetSDKVersion = (await this.repoClient.getVariables())
			.find((repoVar) => repoVar.name === "NET_SDK_VERSION")?.value.trim();

		if (Utils.isNothing(dotnetSDKVersion)) {
			throw new Error("The NET_SDK_VERSION variable is not defined.");
		}

		dotnetSDKVersion = dotnetSDKVersion.startsWith("v") ? dotnetSDKVersion.substring(1) : dotnetSDKVersion;

		if (!Utils.isValidDotnetSDKVersion(dotnetSDKVersion)) {
			Utils.printAsGitHubError(`The NET_SDK_VERSION variable is not a valid dotnet version: ${dotnetSDKVersion}`);
			Deno.exit(1);
		}

		const csProFiles = [...entries].map((entry) => entry.path.replaceAll("\\", "/"))
			.filter((path) => !/(\/bin\/|\/obj\/)/.test(path));

		const filesWithoutTargetFramework: string[] = [];
		const nonMatchingVersions: [string, string][] = [];

		for (const csProjFile of csProFiles) {
			const fileData = Deno.readTextFileSync(csProjFile);

			let targetFrameworkVersion = "";

			// If the target framework XML exists, check the version value.
			if (Utils.targetFrameworkXMLExists(fileData)) {
				try {
					targetFrameworkVersion = Utils.getCSProjTargetFrameworkVersion(fileData).replace("net", "");
				} catch (error) {
					nonMatchingVersions.push([csProjFile, error.message]);
				}

				const versionsMatch = this.versionsMatch(dotnetSDKVersion, targetFrameworkVersion);

				if (versionsMatch) {
					continue;
				}

				const errorMsg = `The target framework version in the csproj file '${csProjFile}' does not match the repo` +
					` variable NET_SDK_VERSION.`;
				nonMatchingVersions.push([csProjFile, errorMsg]);
			} else {
				filesWithoutTargetFramework.push(csProjFile);
			}
		}

		// If there are any issues with any of the files, print them out.
		if (filesWithoutTargetFramework.length > 0 || nonMatchingVersions.length > 0) {
			filesWithoutTargetFramework.forEach((fileWithout) => {
				Utils.printAsGitHubError(`The file '${fileWithout}' does not have a target framework defined.`);
			});

			nonMatchingVersions.forEach((nonMatchingVersion) => {
				const errorMsg = `The file '${nonMatchingVersion[0]}' has a target framework version that does not ` +
					`match the NET_SDK_VERSION variable.\n${nonMatchingVersion[1]}`;
				Utils.printAsGitHubError(errorMsg);
			});

			Deno.exit(1);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected async validateArgs(args: string[]): Promise<void> {
		const [repoOwner, repoName] = args;

		// Validate that the repo exists
		const repoExists = await this.repoClient.exists();

		if (!repoExists) {
			throw new Error(`The repo ${repoOwner}/${repoName} does not exist.`);
		}

		return Promise.resolve();
	}

	/**
	 * @inheritdoc
	 */
	protected mutateArgs(args: string[]): string[] {
		let [repoOwner, repoName] = args;

		repoOwner = repoOwner.trim();
		repoName = repoName.trim();

		return [repoOwner, repoName];
	}

	/**
	 * Gets a value indicating whether or not the {@link repoVarSections} and {@link csprojVersion} versions match.
	 * @param repoVarVersion The version from the repository variable.
	 * @param csprojVersion The version from the csproj file.
	 * @returns True if the versions match, false otherwise.
	 * @remarks This function takes the csproj version as precedence in regards to the major, minor, and patch sections.
	 * If the csproj version does not have a minor or path version, the result will be true as long as the major version
	 * of both values match.
	 */
	private versionsMatch(repoVarVersion: string, csprojVersion: string): boolean {
		repoVarVersion = repoVarVersion.trim().toLowerCase();
		csprojVersion = csprojVersion.trim().toLowerCase();

		const csprojSections = csprojVersion.split(".");
		const repoVarSections = repoVarVersion.split(".");

		if (repoVarSections.length < 3) {
			Utils.printAsGitHubError(`The NET_SDK_VERSION variable does not have a major, minor, and patch section.`);
			Deno.exit(1);
		}

		for (let i = 0; i < csprojSections.length; i++) {
			const targetVersionSection = csprojSections[i];
			const repoVarSection = repoVarSections[i];

			if (targetVersionSection !== repoVarSection) {
				return false;
			}
		}

		return true;
	}
}
