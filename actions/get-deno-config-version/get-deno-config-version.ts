import { existsSync, walkSync } from "jsr:@std/fs@1.0.23";
import { extname, resolve } from "jsr:@std/path@1.1.4";
import { getEnvVar } from "../../cicd/core/Utils.ts";
import { printAsGitHubError, printAsGitHubWarning } from "../../cicd/core/github.ts";

const scriptName = new URL(import.meta.url).pathname.split("/").pop();

const configFilePath = getEnvVar("CONFIG_FILE_PATH", scriptName, false);
const trimVersionPrefix = getEnvVar("TRIM_VERSION_PREFIX", scriptName, false).toLowerCase() === "true";
const failIfConfigNotFound = getEnvVar("FAIL_IF_CONFIG_NOT_FOUND", scriptName, false).toLowerCase() === "true";
const githubOutputFilePath = getEnvVar("GITHUB_OUTPUT", scriptName, true);

const setOutput = (version: string) => {
	const sanitized = version.replace(/[\r\n]/g, "");
	Deno.writeTextFileSync(githubOutputFilePath, `\ndeno-config-version=${sanitized}\n`, { append: true });
};

// If a config file path was not provided, search for the a compatible file.
if (configFilePath === "") {
	// Search for the file in the repo
	const configFilePaths = Array.from(walkSync(Deno.cwd(), {
		includeFiles: true,
		includeDirs: false,
		maxDepth: 10,
		skip: [/[/\\](node_modules|\.git|dist|build|out)[/\\]/],
		match: [/[/\\]deno\.jsonc?$/],
	})).filter((entry) => entry.isFile).map((e) => e.path);

	// If no files where found and the action is configured to fail if no config file is found, fail the action.
	if (configFilePaths.length <= 0 && failIfConfigNotFound) {
		printAsGitHubError("No config file found in the repository.");

		Deno.exit(1);
	}

	if (configFilePaths.length >= 1) {
		// Search for a config file that contains the 'version' property.
		const configFilePathWithVersion = configFilePaths.find((entry) => {
			try {
				const fileContent = Deno.readTextFileSync(entry);
				const config = JSON.parse(fileContent);

				return "version" in config;
			} catch {
				return false;
			}
		});

		if (configFilePathWithVersion === undefined) {
			printAsGitHubWarning("Config files found in the repository, but none of them contains a 'version' property.");

			Deno.exit(1);
		}

		const fileContent = Deno.readTextFileSync(configFilePathWithVersion);
		const config = JSON.parse(fileContent);

		if (!isValidConfig(config)) {
			printAsGitHubError(
				`The config file at path: ${configFilePathWithVersion} does not contain a valid 'version' property.`,
			);

			Deno.exit(1);
		}

		let version = config.version as string;

		if (trimVersionPrefix) {
			version = version.startsWith("v") ? version.substring(1) : version;
		}

		setOutput(version);
	} else {
		printAsGitHubWarning(
			`No config file found. Searched for 'deno.json' and 'deno.jsonc' files in the repository starting from path: ${Deno.cwd()}.`,
		);
		setOutput("");
	}
} else {
	// If the config file path is not in the workspace
	const workspaceRoot = Deno.cwd();
	const resolvedPath = resolve(configFilePath);

	if (!resolve(configFilePath).startsWith(`${workspaceRoot}/`) && resolvedPath !== workspaceRoot) {
		printAsGitHubError(`CONFIG_FILE_PATH must be within the workspace: ${configFilePath}`);
		Deno.exit(1);
	}

	// Check if the config file does not exist
	if (!existsSync(configFilePath)) {
		const message = `Config file not found at path: ${configFilePath}`;

		if (failIfConfigNotFound) {
			printAsGitHubError(message);

			Deno.exit(1);
		}

		printAsGitHubWarning(message);
		setOutput("");

		Deno.exit(0);
	}

	// If the file extension is not '.json' or '.jsonc'
	if (![".json", ".jsonc"].includes(extname(configFilePath))) {
		printAsGitHubError("The config file must be a '.json' or '.jsonc' file.");

		Deno.exit(1);
	}

	try {
		const fileContent = Deno.readTextFileSync(configFilePath);
		const config = JSON.parse(fileContent);

		if (!isValidConfig(config)) {
			printAsGitHubError(
				`The config file at path: ${configFilePath} does not contain a valid 'version' property.`,
			);

			Deno.exit(1);
		}

		let version = config.version as string;

		if (trimVersionPrefix) {
			version = version.startsWith("v") ? version.substring(1) : version;
		}

		setOutput(version);
	} catch (error) {
		printAsGitHubError(
			`Error reading or parsing the config file at path: ${configFilePath}. Error: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);

		Deno.exit(1);
	}
}

/**
 * Type guard to check if the config is valid and contains a version property of type string.
 * @param config The config to check.
 * @returns Returns true if the config is valid, false otherwise.
 */
function isValidConfig(config: unknown): config is { version: string } {
	return typeof config === "object" && config !== null && "version" in config && typeof config.version === "string";
}
