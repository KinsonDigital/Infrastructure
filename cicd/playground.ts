const _ownerName = (Deno.env.get("OWNER_NAME") ?? "").trim();
const _repoName = (Deno.env.get("REPO_NAME") ?? "").trim();
const _token = (Deno.env.get("ROOT_REPO_DIR_PATH") ?? "").trim();
const _rootRepoDirPath = (Deno.env.get("GITHUB_TOKEN") ?? "").trim();
import denoConfig from "../deno.json" with { type: "json" };

denoConfig.version = "v11.22.33";

Deno.writeTextFileSync("./deno.json", `${JSON.stringify(denoConfig, null, 4)}\n`);


debugger;
