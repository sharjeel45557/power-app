import { loadConfig } from "@power-app/core";
import { buildApp } from "./app.js";

const config = loadConfig();
const { app, close } = await buildApp(config);

try {
  await app.listen({ host: "0.0.0.0", port: config.port });
  app.log.info(
    `power-app listening on :${config.port} (auth=${config.authMode}, env=${config.env})`,
  );
} catch (err) {
  app.log.error(err, "failed to start");
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    app.log.info(`received ${signal}, shutting down`);
    close()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}
