import { PrepareReleaseRunner } from "./runners/PrepareReleaseRunner.ts";

const prepareReleaseExecutor: PrepareReleaseRunner = new PrepareReleaseRunner(Deno.args);
await prepareReleaseExecutor.run();

export default prepareReleaseExecutor;
