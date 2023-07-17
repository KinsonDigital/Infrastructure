import { SendReleaseTweetRunner } from "./runners/SendReleaseTweetRunner.ts";

const runner = new SendReleaseTweetRunner(Deno.args);
await runner.run();
