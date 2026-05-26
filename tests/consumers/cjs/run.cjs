const {
  BotNotFoundError,
  LIBRARY_NAME,
  createRuntimeManager,
} = require("telegram-adapter-kit");

if (LIBRARY_NAME !== "telegram-adapter-kit") {
  throw new Error(`unexpected LIBRARY_NAME: ${LIBRARY_NAME}`);
}

if (typeof createRuntimeManager !== "function") {
  throw new Error("createRuntimeManager is not a function");
}

if (typeof BotNotFoundError !== "function") {
  throw new Error("BotNotFoundError is not exported");
}

console.log("consumer-cjs: ok");
