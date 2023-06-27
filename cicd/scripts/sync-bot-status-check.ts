import { Utils } from "../core/Utils.ts";
import { SyncBotStatusCheckRunner } from "./runners/SyncBotStatusCheckRunner.ts";

const scriptName = Utils.getScriptName();

const runner: SyncBotStatusCheckRunner = new SyncBotStatusCheckRunner(Deno.args, scriptName);

await runner.run();

