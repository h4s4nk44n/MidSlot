import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
  redact: {
    paths: ["req.headers.authorization", "req.body.password", "req.body.token", "*.token", "*.password"],
    censor: "[REDACTED]",
  },
});

export default logger;
