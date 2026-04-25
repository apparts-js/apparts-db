import * as http from "http";

const endpointHost = process.env.DYNAMODB_TEST_CONFIG
  ? (JSON.parse(
      Buffer.from(process.env.DYNAMODB_TEST_CONFIG, "base64").toString("utf-8"),
    ).endpoint?.replace(/^https?:\/\//, "") ?? "localhost")
  : process.env.DYNAMODB_HOST || "localhost";

const endpointPort = process.env.DYNAMODB_TEST_CONFIG
  ? (JSON.parse(
      Buffer.from(process.env.DYNAMODB_TEST_CONFIG, "base64").toString("utf-8"),
    )
      .endpoint?.split(":")
      ?.pop() ?? 8000)
  : Number(process.env.DYNAMODB_PORT) || 8000;

describe("DynamoDB Local connectivity", () => {
  test("reaches the DynamoDB Local endpoint", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          host: endpointHost,
          port: endpointPort,
          method: "GET",
          path: "/",
        },
        (res) => {
          if (res.statusCode !== undefined) {
            res.resume();
            resolve();
          } else {
            reject(new Error("No status code received from DynamoDB Local"));
          }
        },
      );
      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy(new Error("DynamoDB Local connection timed out"));
      });
      req.end();
    });
  });
});
