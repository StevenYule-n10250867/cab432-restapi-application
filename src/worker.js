const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { execSync } = require("child_process");
const fs = require("fs");

const REGION = "ap-southeast-2";
const QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n10250867-media-transcode-queue";

const sqs = new SQSClient({ region: REGION });

async function handle(msg) {
  const body = JSON.parse(msg.Body);
  console.log(`Processing job ${body.jobId} for file ${body.filename}`);
  try {
    execSync("sleep 5"); // fake transcoding delay
    console.log(`Job ${body.jobId} complete`);
  } catch (err) {
    console.error(err);
  }
}

async function poll() {
  while (true) {
    try {
      const res = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
        })
      );

      if (res.Messages && res.Messages.length > 0) {
        const m = res.Messages[0];
        await handle(m);

        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: m.ReceiptHandle,
          })
        );
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }
}

poll().catch(console.error);
