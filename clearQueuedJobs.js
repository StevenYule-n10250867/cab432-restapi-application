const {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "ap-southeast-2" });
const TABLE_NAME = "JobsTable";

(async () => {
  console.log(`Scanning ${TABLE_NAME} for queued jobs...`);
  const { Items } = await client.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "status = :queued",
      ExpressionAttributeValues: {
        ":queued": { S: "queued" },
      },
    })
  );

  if (!Items || Items.length === 0) {
    console.log("No queued jobs found.");
    return;
  }

  for (const item of Items) {
    const jobId = item.id.S;
    console.log(`Deleting queued job: ${jobId}`);
    await client.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: { id: { S: jobId } },
      })
    );
  }

  console.log("All queued jobs deleted.");
})();
