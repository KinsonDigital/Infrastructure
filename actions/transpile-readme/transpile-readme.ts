import { existsSync } from "jsr:@std/fs@1.0.19";
import { printAsGitHubError, printAsGitHubNotice } from "../../cicd/core/github.ts";
import { ReadMeTranspilerService } from "../../cicd/core/Services/ReadMeTranspilerService.ts";
import { getEnvVar } from "../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const baseDirPath = getEnvVar("BASE_DIR_PATH", scriptFileName);

const readmeFilePath = `${baseDirPath}/README.md`;

if (!existsSync(readmeFilePath)) {
	const errorMsg = `\nThe given path '${readmeFilePath}' is not a valid file path.\n\t${scriptFileName}`;
	printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const transpiler = new ReadMeTranspilerService();

const transpiledContent = transpiler.transpile(readmeFilePath);

// Overwrite the README.md file with the transpiled content
Deno.writeTextFileSync(readmeFilePath, transpiledContent);

printAsGitHubNotice(`Successfully transpiled the '${readmeFilePath}' file.`);
