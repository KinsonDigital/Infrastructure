
/**
 * DESCRIPTION:
 * Validate that the environment variables exist for the 'validate-release.yml' workflow.
 */

const varNames = [
  "DENO_VERSION",
  "ORGANIZATION_NAME",
  "NET_SDK_VERSION",
];

const denoVersion = (Deno.env.get(varNames[0]) ?? "").trim();
const orgName = (Deno.env.get(varNames[1]) ?? "").trim();
const netSDKVersion = (Deno.env.get(varNames[2]) ?? "").trim();

const errorMsgExtra = "The following environment variables are required for the 'Validate Release' workflow."
	+ varNames.map((name) => `\n\t- ${name}`).join("");

let missingVar = false;

if (denoVersion === "") {
	console.log("::error::Missing required environment variable: DENO_VERSION");
}

if (orgName === "") {
	console.log("::error::Missing required environment variable: ORGANIZATION_NAME");
}

if (netSDKVersion === "") {
	console.log("::error::Missing required environment variable: NET_SDK_VERSION");
}

missingVar = denoVersion === "" || orgName === "" || netSDKVersion === "";

if (missingVar) {
	console.log(`::error::${errorMsgExtra}`);
	Deno.exit(1);
}
