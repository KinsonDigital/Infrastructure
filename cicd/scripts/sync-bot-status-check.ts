import { SyncBotStatusCheckRunner } from "./runners/SyncBotStatusCheckRunner.ts";

const syncBotStatusCheckExecutor: SyncBotStatusCheckRunner = new SyncBotStatusCheckRunner(Deno.args);
await syncBotStatusCheckExecutor.run();

export default syncBotStatusCheckExecutor;
