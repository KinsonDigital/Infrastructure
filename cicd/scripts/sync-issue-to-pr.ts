import { SyncIssueToPRRunner } from "./runners/SyncIssueToPRRunner.ts";

const runner = new SyncIssueToPRRunner(Deno.args);
await runner.run();
