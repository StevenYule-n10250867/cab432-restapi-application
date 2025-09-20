const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(client);
const tableName = "JobsTable";

async function putJob(job) {
  await ddb.send(new PutCommand({
    TableName: tableName,
    Item: job
  }));
  return job;
}

async function getJob(id) {
  const result = await ddb.send(new GetCommand({
    TableName: tableName,
    Key: { id }   // ✅ correct key name
  }));
  return result.Item;
}

async function updateJob(id, updates) {
  const updateExp = [];
  const expAttrNames = {};
  const expAttrValues = {};

  for (const [k, v] of Object.entries(updates)) {
    updateExp.push(`#${k} = :${k}`);
    expAttrNames[`#${k}`] = k;
    expAttrValues[`:${k}`] = v;
  }

  await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { id },
    UpdateExpression: "SET " + updateExp.join(", "),
    ExpressionAttributeNames: expAttrNames,
    ExpressionAttributeValues: expAttrValues
  }));
}

async function listJobs() {
  const result = await ddb.send(new ScanCommand({ TableName: tableName }));
  return result.Items;
}

module.exports = { putJob, getJob, updateJob, listJobs };
