import { SyncPRToIssueRunner } from "./runners/SyncPRToIssueRunner.ts";

const runner = new SyncPRToIssueRunner(Deno.args);
await runner.run();
