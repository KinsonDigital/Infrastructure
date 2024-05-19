import { SyncPRToIssueRunner } from "./runners/SyncPRToIssueRunner.ts";

const syncPrToIssueExecutor = new SyncPRToIssueRunner(Deno.args);
await syncPrToIssueExecutor.run();

export default syncPrToIssueExecutor;
