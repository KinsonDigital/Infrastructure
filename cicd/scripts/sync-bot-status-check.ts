import { SyncBotStatusCheckRunner } from "./runners/SyncBotStatusCheckRunner.ts";

const runner: SyncBotStatusCheckRunner = new SyncBotStatusCheckRunner(Deno.args);

await runner.run();
