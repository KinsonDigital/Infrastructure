import { PrepareReleaseRunner } from "./runners/PrepareReleaseRunner.ts";

const runner: PrepareReleaseRunner = new PrepareReleaseRunner(Deno.args);
await runner.run();
