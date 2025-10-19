const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const { downloadFile, uploadFile, getDownloadUrl } = require("./utils/s3");
const { updateJob } = require("./utils/dynamodb");
const { ffprobeJson, fileSizeBytes, sha256File } = require("./utils/mediaInfo");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const QUEUE_URL = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/n10250867-media-transcode-queue";
const REGION = "ap-southeast-2";
let instanceId = "unknown-instance";

// Get EC2 instance ID
async function getInstanceId() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "169.254.169.254",
        path: "/latest/meta-data/instance-id",
        method: "GET",
        timeout: 1000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data.trim() || "unknown-instance"));
      }
    );
    req.on("error", () => resolve("unknown-instance"));
    req.end();
  });
}

// Handle video transcoding
function runFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${input}" -vf "scale=1280:720,format=yuv420p" -vcodec libx264 -preset faster -crf 23 "${output}"`;
    console.log(`[${instanceId}] Running ffmpeg...`);
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${instanceId}] ffmpeg error:`, stderr);
        return reject(err);
      }
      console.log(`[${instanceId}] ffmpeg complete`);
      resolve();
    });
  });
}

// Process a single job
async function processJob(job) {
  const { jobId, filename, bucketName } = job;
  const baseName = path.parse(filename).name;
  const inputPath = `/tmp/${filename}`;
  const outputPath = `/tmp/transcoded-${baseName}.mp4`;

  try {
    await updateJob(jobId, {
      status: "processing",
      startedAt: new Date().toISOString(),
      workerInstance: instanceId,
    });

    await downloadFile(`uploads/${filename}`, inputPath, bucketName);
    await runFfmpeg(inputPath, outputPath);

    const s3Key = `transcoded/${path.basename(outputPath)}`;
    const sizeBytes = fileSizeBytes(outputPath);
    const sha256 = await sha256File(outputPath);
    const meta = await ffprobeJson(outputPath).catch(() => null);
    const downloadUrl = await getDownloadUrl(s3Key);

    await uploadFile(outputPath, s3Key, bucketName);

    await updateJob(jobId, {
      status: "done",
      finishedAt: new Date().toISOString(),
      workerInstance: instanceId,
      outputs: [{
        type: "mp4",
        s3Uri: `s3://${bucketName}/${s3Key}`,
        downloadUrl,
        sizeBytes,
        sha256,
        meta
      }]
    });

    console.log(`[${instanceId}] Job ${jobId} done`);
  } catch (err) {
    console.error(`[${instanceId}] Job ${jobId} failed:`, err.message);
    await updateJob(jobId, {
      status: "failed",
      error: err.message,
      workerInstance: instanceId,
    });
  } finally {
    try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch {}
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
  }
}

// Poll SQS for messages
async function pollSQS() {
  const sqs = new SQSClient({ region: REGION });

  while (true) {
    try {
      const response = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
      }));

      const messages = response.Messages || [];

      if (messages.length === 0) {
        console.log(`[${instanceId}] No messages received`);
      }

      for (const msg of messages) {
        console.log(`[${instanceId}] Raw SQS Message:`, msg.Body);

        let body;
        try {
          body = JSON.parse(msg.Body);
        } catch (err) {
          console.error(`[${instanceId}] Failed to parse message body:`, err.message);
          continue; // skip this message
        }

        console.log(`[${instanceId}] Parsed job ID:`, body.jobId);
        console.log(`[${instanceId}] Full parsed job:`, body);

        await processJob(body);

        await sqs.send(new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: msg.ReceiptHandle,
        }));

        console.log(`[${instanceId}] Deleted message from queue`);
      }
    } catch (err) {
      console.error(`[${instanceId}] SQS polling error:`, err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}


// Start basic HTTP server for health checks
function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("Healthy");
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  server.listen(3000, () => {
    console.log(`[${instanceId}] Health check server running on port 3000`);
  });
}

// Init worker
getInstanceId().then((id) => {
  instanceId = id;
  console.log(`[${instanceId}] Worker started — polling SQS and ready for health checks`);
  startHealthServer();
  pollSQS();
});
