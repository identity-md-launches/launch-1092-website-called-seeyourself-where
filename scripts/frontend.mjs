import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Optional external dependency directory keeps managed workspaces free of node_modules.
const dependencyRoot = process.env.SEEYOURSELF_DEPS || process.cwd();
const require = createRequire(resolve(dependencyRoot, "package.json"));
const command = process.argv[2];
if (command === "typecheck") {
  const ts = require("typescript");
  const input = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  if (input.error)
    throw Error(ts.flattenDiagnosticMessageText(input.error.messageText, "\n"));
  const config = ts.parseJsonConfigFileContent(
    input.config,
    ts.sys,
    process.cwd(),
  );
  if (process.env.SEEYOURSELF_DEPS) {
    config.options.baseUrl = process.cwd();
    config.options.typeRoots = [resolve(dependencyRoot, "node_modules/@types")];
    config.options.paths = {
      react: [resolve(dependencyRoot, "node_modules/@types/react/index.d.ts")],
      "react/*": [resolve(dependencyRoot, "node_modules/@types/react/*")],
      "react-dom/*": [
        resolve(dependencyRoot, "node_modules/@types/react-dom/*"),
      ],
      "lucide-react": [
        resolve(
          dependencyRoot,
          "node_modules/lucide-react/dist/lucide-react.d.ts",
        ),
      ],
    };
  }
  const program = ts.createProgram(config.fileNames, config.options);
  const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
  if (diagnostics.length) {
    console.error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getCanonicalFileName: (p) => p,
        getNewLine: () => "\n",
      }),
    );
    process.exitCode = 1;
  } else console.log("Typecheck passed.");
} else {
  const vite = await import(pathToFileURL(require.resolve("vite")).href);
  const config = {
    configFile: false,
    base: "./",
    resolve: {
      alias: process.env.SEEYOURSELF_DEPS
        ? ["react", "react-dom", "lucide-react"].map((name) => ({
            find: new RegExp(`^${name}(/.*)?$`),
            replacement: resolve(dependencyRoot, `node_modules/${name}`) + "$1",
          }))
        : [],
    },
    build: { target: "es2022", sourcemap: false },
    server: { host: "127.0.0.1" },
    preview: { host: "127.0.0.1", port: 4173 },
  };
  if (command === "build") await vite.build(config);
  else if (command === "preview") (await vite.preview(config)).printUrls();
  else {
    const server = await vite.createServer(config);
    await server.listen();
    server.printUrls();
  }
}
