const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { downloadFile, uploadFile } = require("./utils/s3");
const { updateJob } = require("./utils/dynamodb");
const { ffprobeJson, fileSizeBytes, sha256File } = require("./utils/mediaInfo");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("http");

// Fetch instance ID for logging
async function getInstanceId() {
  return new Promise((resolve) => {
    https
      .get("http://169.254.169.254/latest/meta-data/instance-id", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data.trim() || "unknown-instance"));
      })
      .on("error", () => resolve("unknown-instance"));
  });
}

let instanceId = "unknown-instance";
getInstanceId().then((id) => {
  instanceId = id;
  console.log(`[${instanceId}] Worker initialized`);
});

const REGION = "ap-southeast-2";
const sqs = new SQSClient({ region: REGION });
const ssm = new SSMClient({ region: REGION });

// --- helpers to get parameters from SSM ---
async function getQueueUrl() {
  const cmd = new GetParameterCommand({ Name: "/n10250867/SQS_QUEUE_URL" });
  const res = await ssm.send(cmd);
  return res.Parameter.Value;
}

async function getBucketName() {
  const cmd = new GetParameterCommand({ Name: "/n10250867/AWS_S3_BUCKET" });
  const res = await ssm.send(cmd);
  return res.Parameter.Value;
}

// --- ffmpeg helper ---
function runFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${input}" -vcodec libx264 -preset veryfast "${output}"`;
    exec(cmd, (err) => (err ? reject(err) : resolve()));
  });
}

async function handle(msg) {
  const body = JSON.parse(msg.Body);
  const { jobId, filename, owner } = body;

  console.log(`[${instanceId}] Processing job ${jobId} for ${filename}`);

  try {
    const bucketName = await getBucketName();
    const startedAt = new Date().toISOString();
    await updateJob(jobId, { status: "processing", startedAt, workerInstance: instanceId });

    const localInput = `/tmp/${filename}`;
    const baseName = path.parse(filename).name;
    const outputName = `transcoded-${baseName}.mp4`;
    const localOutput = `/tmp/${outputName}`;

    // Download input from S3
    await downloadFile(`uploads/${filename}`, localInput, bucketName);

    // Transcode
    const t0 = Date.now();
    await runFfmpeg(localInput, localOutput);

    // Metadata
    const sizeBytes = fileSizeBytes(localOutput);
    const sha256 = await sha256File(localOutput);
    const meta = await ffprobeJson(localOutput).catch(() => null);

    // Upload output
    const s3OutputKey = `transcoded/${outputName}`;
    await uploadFile(localOutput, s3OutputKey, bucketName);

    const t1 = Date.now();

    // generate presigned download URL
    const { getDownloadUrl } = require("./utils/s3");
    const downloadUrl = await getDownloadUrl(s3OutputKey);

    await updateJob(jobId, {
      status: "done",
      finishedAt: new Date().toISOString(),
      elapsedMs: t1 - t0,
      workerInstance: instanceId,
      outputs: [
        {
          type: "mp4",
          s3Uri: `s3://${bucketName}/${s3OutputKey}`,
          downloadUrl,
          sizeBytes,
          sha256,
          meta,
        },
      ],
    });

    console.log(`[${instanceId}] Job ${jobId} completed successfully`);
  } catch (err) {
    console.error(`[${instanceId}] Job ${body.jobId} failed:`, err.message);
    await updateJob(body.jobId, {
      status: "failed",
      error: err.message,
      finishedAt: new Date().toISOString(),
      workerInstance: instanceId,
    });
  } finally {
    try {
      if (fs.existsSync(`/tmp/${filename}`)) fs.unlinkSync(`/tmp/${filename}`);
      if (fs.existsSync(`/tmp/transcoded-${path.parse(filename).name}.mp4`))
        fs.unlinkSync(`/tmp/transcoded-${path.parse(filename).name}.mp4`);
    } catch (_) {}
  }
}

async function poll() {
  const queueUrl = await getQueueUrl();
  console.log(`[${instanceId}] Worker started. Listening for new SQS messages on ${queueUrl}...`);

  while (true) {
    try {
      const res = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
        })
      );

      if (res.Messages?.length) {
        const msg = res.Messages[0];
        await handle(msg);
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: msg.ReceiptHandle,
          })
        );
      }
    } catch (err) {
      console.error(`[${instanceId}] Polling error:`, err);
    }
  }
}

poll().catch((err) => console.error(`[${instanceId}] Worker crashed:`, err));