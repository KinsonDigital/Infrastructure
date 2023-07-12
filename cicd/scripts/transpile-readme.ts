import { Utils } from "../core/Utils.ts";
import { TranspileReadMeRunner } from "./runners/TranspileReadMeRunner.ts";

const scriptName = Utils.getScriptName();

const runner: TranspileReadMeRunner = new TranspileReadMeRunner(Deno.args, scriptName);

await runner.run();
