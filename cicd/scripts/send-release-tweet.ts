import { SendReleaseTweetRunner } from "./runners/SendReleaseTweetRunner.ts";

const sendReleaseTweetExecutor = new SendReleaseTweetRunner(Deno.args);
await sendReleaseTweetExecutor.run();

export default sendReleaseTweetExecutor;
