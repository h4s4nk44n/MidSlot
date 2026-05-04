import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import logger from "../lib/logger";

const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => (req.headers["x-request-id"] as string) ?? randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (_req, res, err) =>
    `${err.message} — ${res.statusCode}`,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url, id: req.id }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

export default requestLogger;
