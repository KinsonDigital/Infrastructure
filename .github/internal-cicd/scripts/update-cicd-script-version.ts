import { RepoClient } from "jsr:@kinsondigital/kd-clients@1.0.0-preview.15/github";
import getEnvVar from "../../../cicd/core/GetEnvVar.ts";
import { printAsGitHubNotice } from "../../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();
const ownerName = getEnvVar("OWNER_NAME", scriptFileName);
const repoName = getEnvVar("REPO_NAME", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);
const cicdScriptVersionRepoVarName = getEnvVar("CICD_SCRIPTS_VERSION_REPO_VAR_NAME", scriptFileName);
const newVersion = getEnvVar("VERSION", scriptFileName);

try {
	const client = new RepoClient(ownerName, repoName, token);
	const exists = await client.variableExists(cicdScriptVersionRepoVarName);

	if (!exists) {
		console.error(`The repository variable '${cicdScriptVersionRepoVarName}' does not exist.`);
		Deno.exit(1);
	}

	await client.updateVariable(cicdScriptVersionRepoVarName, newVersion);

	printAsGitHubNotice(`Updated the repository variable '${cicdScriptVersionRepoVarName}' value to '${newVersion}'.`);
} catch (error) {
	if (error instanceof Error) {
		console.error(error.message);
	} else {
		console.error("An error occurred.");
		console.error(error);
	}

	Deno.exit(1);
}
