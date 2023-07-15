import { Utils } from "../core/Utils.ts";
import { PrepareReleaseRunner } from "./runners/PrepareReleaseRunner.ts";

const scriptName = Utils.getScriptName();

const runner: PrepareReleaseRunner = new PrepareReleaseRunner(Deno.args, scriptName);

await runner.run();
