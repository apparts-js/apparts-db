import * as http from "http";

const shouldRun = process.env.DB_ENGINE === "dynamodb";
const runOrSkip = shouldRun ? describe : describe.skip;

const endpointHost = process.env.DYNAMODB_HOST || "localhost";
const endpointPort = Number(process.env.DYNAMODB_PORT) || 8000;

runOrSkip("DynamoDB Local connectivity", () => {
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
        }
      );
      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy(new Error("DynamoDB Local connection timed out"));
      });
      req.end();
    });
  });
});
