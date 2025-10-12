const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { downloadFile, uploadFile } = require("./utils/s3");
const { updateJob } = require("./utils/dynamodb");
const { ffprobeJson, fileSizeBytes, sha256File } = require("./utils/mediaInfo");
const { loadConfig } = require("./config");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

const REGION = "ap-southeast-2";
const QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n10250867-media-transcode-queue";

const sqs = new SQSClient({ region: REGION });
const ssm = new SSMClient({ region: REGION });

// Helper: load bucket name from Parameter Store
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

  console.log(`Processing job ${jobId} for ${filename}`);

  try {
    // Load configuration (includes S3 bucket name from Parameter Store)
    const config = await loadConfig();
    const bucketName = config.AWS_S3_BUCKET;

    const startedAt = new Date().toISOString();
    await updateJob(jobId, { status: "processing", startedAt });

    const localInput = `/tmp/${filename}`;
    const baseName = path.parse(filename).name;
    const outputName = `transcoded-${baseName}.mp4`;
    const localOutput = `/tmp/${outputName}`;

    // Download input file from S3
    await downloadFile(`uploads/${filename}`, localInput, bucketName);

    // Transcode video
    const t0 = Date.now();
    await runFfmpeg(localInput, localOutput);

    // Collect metadata
    const sizeBytes = fileSizeBytes(localOutput);
    const sha256 = await sha256File(localOutput);
    const meta = await ffprobeJson(localOutput).catch(() => null);

    // Upload result
    const s3OutputKey = `transcoded/${outputName}`;
    await uploadFile(localOutput, s3OutputKey, bucketName);


    // Update DynamoDB
    const elapsedMs = Date.now() - t0;
    await updateJob(jobId, {
      status: "done",
      finishedAt: new Date().toISOString(),
      elapsedMs,
      outputs: [
        {
          type: "mp4",
          s3Uri: `s3://${bucketName}/${s3OutputKey}`,
          sizeBytes,
          sha256,
          meta,
        },
      ],
    });


    console.log(`Job ${jobId} completed successfully`);
  } catch (err) {
    console.error(`Job ${body.jobId} failed:`, err.message);
    await updateJob(body.jobId, {
      status: "failed",
      error: err.message,
      finishedAt: new Date().toISOString(),
    });
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(`/tmp/${filename}`)) fs.unlinkSync(`/tmp/${filename}`);
      if (fs.existsSync(`/tmp/transcoded-${path.parse(filename).name}.mp4`))
        fs.unlinkSync(`/tmp/transcoded-${path.parse(filename).name}.mp4`);
    } catch (_) {}
  }
}

async function poll() {
  console.log("Worker started. Listening for new SQS messages...");
  while (true) {
    try {
      const res = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 20,
        })
      );

      if (res.Messages?.length) {
        const msg = res.Messages[0];
        await handle(msg);
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: msg.ReceiptHandle,
          })
        );
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }
}

poll().catch(console.error);
