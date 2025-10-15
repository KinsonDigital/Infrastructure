import { printAsGitHubError, setGitHubOutput } from "../../cicd/core/github.ts";
import getJsrPkgMetaData from "../../cicd/core/jsr.ts";
import { getEnvVar } from "../../cicd/core/Utils.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const outputName = "package-exists";
const scope = getEnvVar("SCOPE", scriptFileName).toUpperCase();
const pkgName = getEnvVar("PKG_NAME", scriptFileName);
let version = getEnvVar("VERSION", scriptFileName);
const failIfExists = getEnvVar("FAIL_IF_EXISTS", scriptFileName).toLowerCase() === "true";

// JSR package versions do not start with the letter 'v'
version = version.startsWith("v") ? version.substring(1) : version;

const versions = await getJsrPkgMetaData(scope, pkgName);
const pkgExists = versions.includes(version);

setGitHubOutput(outputName, pkgExists.toString());

if (failIfExists && versions.includes(version)) {
	printAsGitHubError(`The version '${version}' already exists for the package '@${scope}/${pkgName}'.`);
	Deno.exit(1);
}
