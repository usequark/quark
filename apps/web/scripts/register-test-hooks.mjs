import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
register("./test-alias-loader.mjs", pathToFileURL(`${dir}/`));
