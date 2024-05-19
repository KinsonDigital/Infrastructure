import { AddItemToProjectRunner } from "./runners/AddItemToProjectRunner.ts";

const AddItemToProjectExecutor: AddItemToProjectRunner = new AddItemToProjectRunner(Deno.args);
await AddItemToProjectExecutor.run();

export default AddItemToProjectExecutor;
