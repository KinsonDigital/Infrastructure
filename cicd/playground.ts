import { CSharpVersionService } from "./core/Services/CSharpVersionService.ts";

const _token = Deno.args[0]; // NOTE: This is coming from the launch.config json file as an environment variable
const _rootRepoDirPath = Deno.args[1];


const service = new CSharpVersionService("CASL", _token);

await service.updateVersion("preview", "CASL/CASL.csproj", "v1.2.3-preview.4");
