import { ReleaseType } from "../../../cicd/core/Enums.ts";
import getEnvVar from "../../../cicd/core/GetEnvVar.ts";
import { CSharpVersionService } from "../../../cicd/core/Services/CSharpVersionService.ts";

const scriptFileName = new URL(import.meta.url).pathname.split("/").pop();

const version = getEnvVar("VERSION", scriptFileName);
const token = getEnvVar("GITHUB_TOKEN", scriptFileName);

const service = new CSharpVersionService("KinsonDigital", "Infrastructure", token);

await service.updateVersion(version, ReleaseType.preview);
