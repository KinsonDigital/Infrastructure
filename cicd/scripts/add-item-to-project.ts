import { AddItemToProjectRunner } from "./runners/AddItemToProjectRunner.ts";

const runner: AddItemToProjectRunner = new AddItemToProjectRunner(Deno.args);
await runner.run();
