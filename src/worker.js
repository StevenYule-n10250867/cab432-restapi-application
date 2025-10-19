const { downloadFile, uploadFile, getDownloadUrl } = require("./utils/s3");
const { updateJob } = require("./utils/dynamodb");
const { ffprobeJson, fileSizeBytes, sha256File } = require("./utils/mediaInfo");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

let instanceId = "unknown-instance";

// Get EC2 instance ID (IMDSv2)
function getInstanceId() {
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
        tokenRes.on("data", (chunk) => (token += chunk));
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
              idRes.on("data", (chunk) => (id += chunk));
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

function runFfmpeg(input, output) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -i "${input}" -vf "scale=1280:720,format=yuv420p" -vcodec libx264 -preset faster -crf 23 "${output}"`;
    console.log(`[${instanceId}] Running ffmpeg...`);
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`[${instanceId}] ffmpeg failed:`, stderr);
        return reject(err);
      }
      console.log(`[${instanceId}] ffmpeg completed`);
      resolve();
    });
  });
}

async function handle(body) {
  const { jobId, filename, bucketName } = body;
  const baseName = path.parse(filename).name;
  const inputPath = `/tmp/${filename}`;
  const outputPath = `/tmp/transcoded-${baseName}.mp4`;

  try {
    await updateJob(jobId, {
      status: "processing",
      startedAt: new Date().toISOString(),
      workerInstance: instanceId,
    });

    console.log(`[${instanceId}] Downloading input from S3...`);
    await downloadFile(`uploads/${filename}`, inputPath, bucketName);
    await runFfmpeg(inputPath, outputPath);

    const s3Key = `transcoded/${path.basename(outputPath)}`;
    const sizeBytes = fileSizeBytes(outputPath);
    const sha256 = await sha256File(outputPath);
    const meta = await ffprobeJson(outputPath).catch(() => null);

    await uploadFile(outputPath, s3Key, bucketName);
    const downloadUrl = await getDownloadUrl(s3Key); // ← restore presigned URL generation

    await updateJob(jobId, {
      status: "done",
      finishedAt: new Date().toISOString(),
      workerInstance: instanceId,
      outputs: [
        {
          type: "mp4",
          s3Uri: `s3://${bucketName}/${s3Key}`,
          downloadUrl,
          sizeBytes,
          sha256,
          meta,
        },
      ],
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
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
}

getInstanceId().then((id) => {
  instanceId = id;
  console.log(`[${instanceId}] Worker ready`);

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("Healthy");
    }

    if (req.method === "POST" && req.url === "/transcode") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const data = JSON.parse(body);
          console.log(`[${instanceId}] Received job ${data.jobId} for ${data.filename}`);
          res.writeHead(200);
          res.end("OK");
          await handle(data);
        } catch (err) {
          console.error(`[${instanceId}] Error parsing request: ${err.message}`);
          res.writeHead(400);
          res.end("Bad Request");
        }
      });
    } else if (req.url === "/" || req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Healthy");
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  server.listen(3000, () => console.log(`[${instanceId}] Listening on port 3000`));
});


