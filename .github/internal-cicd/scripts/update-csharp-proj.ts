import { ReleaseType } from "../../../cicd/core/Enums.ts";
import { CSharpVersionService } from "../../../cicd/core/Services/CSharpVersionService.ts";

const _version = Deno.args[0].trim();
const _token = Deno.args[1].trim();

const service = new CSharpVersionService("KinsonDigital", "Infrastructure", _token);

await service.updateVersion(_version, ReleaseType.preview);

