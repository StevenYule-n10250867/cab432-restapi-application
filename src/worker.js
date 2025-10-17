const { downloadFile, uploadFile, getDownloadUrl } = require("./utils/s3");
const { updateJob } = require("./utils/dynamodb");
const { ffprobeJson, fileSizeBytes, sha256File } = require("./utils/mediaInfo");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

// Health check + HTTP job server
http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/transcode") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const { jobId, filename, bucketName, owner } = JSON.parse(body);
        console.log(`[${instanceId}] Received job ${jobId} for ${filename}`);
        await handle({
          Body: JSON.stringify({ jobId, filename, owner, bucketName })
        });
        res.writeHead(200);
        res.end("OK");
      } catch (err) {
        console.error(`[${instanceId}] Failed to process job:`, err.message);
        res.writeHead(500);
        res.end("Error");
      }
    });
  } else {
    res.writeHead(200);
    res.end("OK");
  }
}).listen(3000, () => {
  console.log(`[${instanceId}] Worker ready on port 3000`);
});

// Fetch instance IDs (for logs)
async function getInstanceId() {
  return new Promise((resolve) => {
    const tokenReq = http.request(
      {
        host: "169.254.169.254",
        path: "/latest/api/token",
        method: "PUT",
        headers: { "X-aws-ec2-metadata-token-ttl-seconds": "60" },
        timeout: 1000,
      },
      (tokenRes) => {
        let token = "";
        tokenRes.on("data", chunk => token += chunk);
        tokenRes.on("end", () => {
          if (!token) return resolve("unknown-instance");
          const idReq = http.request(
            {
              host: "169.254.169.254",
              path: "/latest/meta-data/instance-id",
              method: "GET",
              headers: { "X-aws-ec2-metadata-token": token },
              timeout: 1000,
            },
            (idRes) => {
              let id = "";
              idRes.on("data", chunk => id += chunk);
              idRes.on("end", () => resolve(id.trim() || "unknown-instance"));
            }
          );
          idReq.on("error", () => resolve("unknown-instance"));
          idReq.end();
        });
      }
    );
    tokenReq.on("error", () => resolve("unknown-instance"));
    tokenReq.end();
  });
}

let instanceId = "unknown-instance";
getInstanceId().then((id) => {
  instanceId = id;
  console.log(`[${instanceId}] Worker initialized`);
});

// FFMPEG wrapper
function runFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${input}" -vf "scale=1280:720,format=yuv420p" -vcodec libx264 -preset slower -crf 22 "${output}"`;
    console.log(`[${instanceId}] Running FFmpeg: ${cmd}`);
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${instanceId}] FFmpeg error:`, stderr);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Job handler
async function handle(msg) {
  const body = JSON.parse(msg.Body);
  const { jobId, filename, owner, bucketName } = body;

  try {
    const startedAt = new Date().toISOString();
    await updateJob(jobId, { status: "processing", startedAt, workerInstance: instanceId });

    const localInput = `/tmp/${filename}`;
    const baseName = path.parse(filename).name;
    const outputName = `transcoded-${baseName}.mp4`;
    const localOutput = `/tmp/${outputName}`;

    await downloadFile(`uploads/${filename}`, localInput, bucketName);
    const t0 = Date.now();
    await runFfmpeg(localInput, localOutput);

    const sizeBytes = fileSizeBytes(localOutput);
    const sha256 = await sha256File(localOutput);
    const meta = await ffprobeJson(localOutput).catch(() => null);

    const s3OutputKey = `transcoded/${outputName}`;
    await uploadFile(localOutput, s3OutputKey, bucketName);
    const downloadUrl = await getDownloadUrl(s3OutputKey);
    const t1 = Date.now();

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

    console.log(`[${instanceId}] Job ${jobId} complete`);
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
