import { existsSync } from "jsr:@std/fs@^1.0.4";
import { Utils } from "../core/Utils.ts";
import { ReadMeTranspilerService } from "../core/Services/ReadMeTranspilerService.ts";
import getEnvVar from "../core/GetEnvVar.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const baseDirPath = getEnvVar("BASE_DIR_PATH", scriptFileName);

const readmeFilePath = `${baseDirPath}/README.md`;

if (!existsSync(readmeFilePath)) {
	const errorMsg = `\nThe given path '${readmeFilePath}' is not a valid file path.\n\t${scriptFileName}`;
	Utils.printAsGitHubError(errorMsg);
	Deno.exit(1);
}

const transpiler = new ReadMeTranspilerService();

transpiler.transpile(baseDirPath);

Utils.printAsGitHubNotice("Successfully transpiled the README.md file.");
