import { existsSync } from "jsr:@std/fs@1.0.19";
import { extname } from "jsr:@std/path@1.1.2";
import { getEnvVar } from "../../cicd/core/Utils.ts";
import { isNothing } from "../../cicd/core/guards.ts";
import { printAsGitHubError, printAsGitHubNotice } from "../../cicd/core/github.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const versionFilePath = getEnvVar("VERSION_FILE_PATH", scriptFileName, true);
const jsonPropPath = getEnvVar("JSON_PROP_PATH", scriptFileName, false);

const versionFileExtension = extname(versionFilePath).toLowerCase();

// Check if the extension is a csproj or json file
if (versionFileExtension !== ".csproj" && versionFileExtension !== ".json") {
	const errorMsg =
		`The version file path '${versionFilePath}' is not a valid file type.  Valid file types are '.csproj' and 'json'.`;
	console.error(errorMsg);
	Deno.exit(1);
}

// Check if the file exists
if (!existsSync(versionFilePath)) {
	const errorMsg = `The version file '${versionFilePath}' does not exist.`;
	console.error(errorMsg);
	Deno.exit(1);
}

const githubOutputFilePath = getEnvVar("GITHUB_OUTPUT", scriptFileName, true);

if (!existsSync(githubOutputFilePath)) {
	const errorMsg = `The GitHub output file path '${githubOutputFilePath}' does not exist.`;
	console.error(errorMsg);
	Deno.exit(1);
}

let version: string | undefined;

switch (versionFileExtension) {
	case ".csproj": {
		const csprojFileData = await Deno.readTextFile(versionFilePath);
		const regex = /<Version>(.+)<\/Version>/gm;
		const matches = csprojFileData.match(regex);
		const versions = matches?.map((v) => v.replace("<Version>", "").replace("</Version>", "").trim()) ?? [];

		if (versions.length <= 0) {
			printAsGitHubError(`The <Version> tag was not found in the file '${versionFilePath}'.`);
			Deno.exit(1);
		}

		version = versions[0].trim();

		break;
	}
	case ".json": {
		// If the JSON property path is not provided, then throw an error
		if (isNothing(jsonPropPath)) {
			printAsGitHubError("The JSON_PROP_PATH environment variable must be provided when the version file is a JSON file.");
			Deno.exit(1);
		}

		const jsonData = await Deno.readTextFile(versionFilePath);
		const jsonObj = JSON.parse(jsonData);
		version = getJsonValueByPath(jsonObj, jsonPropPath)?.trim();

		if (isNothing(version)) {
			printAsGitHubError(`The JSON property path '${jsonPropPath}' does not exist in the file '${versionFilePath}'.`);
			Deno.exit(1);
		}
		break;
	}
	default:
		break;
}

if (isNothing(version)) {
	printAsGitHubError(`The version could not be determined from the file '${versionFilePath}'.`);
	Deno.exit(1);
}

// Update the GitHub output file
Deno.writeTextFileSync(githubOutputFilePath, `version=${version}\n`, { append: true });

printAsGitHubNotice(
	`The version '${version}' was retrieved from the file '${versionFilePath}' and set as an output variable with the name 'version'.`,
);

/**
 * Gets the the value of a property using the given {@link path} from the given {@link obj}.
 * @param obj The object to check.
 * @param path The path to the property.
 * @returns The value of the property or undefined if not found.
 */
function getJsonValueByPath(obj: Record<string, unknown>, path: string): string | undefined {
	const result = path.split(".").reduce((current: unknown, key: string) => {
		if (current && typeof current === "object" && current !== null) {
			const currentObj = current as Record<string, unknown>;
			return currentObj[key];
		}

		return undefined;
	}, obj);

	return result as string | undefined;
}
