import { Utils } from "../core/Utils.ts";
import { SyncStatusCheckRunner } from "./runners/SyncStatusCheckRunner.ts";

const scriptName = Utils.getScriptName();

const runner: SyncStatusCheckRunner = new SyncStatusCheckRunner(Deno.args, scriptName);

await runner.run();

