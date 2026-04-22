const { serialize, deserialize } = require("node:v8");

if (typeof global.structuredClone === "undefined") {
  global.structuredClone = (value) => deserialize(serialize(value));
}
