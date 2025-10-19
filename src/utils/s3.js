const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const fs = require("fs");

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const s3 = new S3Client({ region: REGION });
const ssm = new SSMClient({ region: REGION });

/**
 * Get the bucket name from environment variable or SSM.
 */
async function getBucketName() {
  if (process.env.AWS_S3_BUCKET) {
    console.log(`[S3] Using bucket from environment: ${process.env.AWS_S3_BUCKET}`);
    return process.env.AWS_S3_BUCKET;
  }
  console.log("[S3] Fetching bucket name from SSM...");
  const cmd = new GetParameterCommand({ Name: "/n10250867/AWS_S3_BUCKET" });
  const res = await ssm.send(cmd);
  console.log(`[S3] Retrieved bucket name: ${res.Parameter.Value}`);
  return res.Parameter.Value;
}

/**
 * Upload file to S3 using AWS credentials.
 */
async function uploadFile(localFilePath, key, bucketName) {
  const finalBucket = bucketName || (await getBucketName());
  console.log(`[S3] Uploading ${localFilePath} to s3://${finalBucket}/${key}`);
  const fileStream = fs.createReadStream(localFilePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: finalBucket,
      Key: key,
      Body: fileStream,
    })
  );

  console.log(`[S3] Upload complete: s3://${finalBucket}/${key}`);
  return `s3://${finalBucket}/${key}`;
}

/**
 * Download file from S3 using AWS credentials.
 */
async function downloadFile(key, localFilePath, bucketName) {
  const finalBucket = bucketName || (await getBucketName());
  console.log(`[S3] Downloading s3://${finalBucket}/${key} → ${localFilePath}`);

  const { Body } = await s3.send(
    new GetObjectCommand({
      Bucket: finalBucket,
      Key: key,
    })
  );

  const writeStream = fs.createWriteStream(localFilePath);
  return new Promise((resolve, reject) => {
    Body.pipe(writeStream)
      .on("finish", () => {
        console.log(`[S3] Download complete: ${localFilePath}`);
        resolve();
      })
      .on("error", (err) => {
        console.error(`[S3] Download failed: ${err.message}`);
        reject(err);
      });
  });
}

/**
 * Generate a presigned upload URL.
 */
async function getUploadUrl(key, expiresIn = 3600) {
  const bucket = await getBucketName();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3, command, { expiresIn });
  console.log(`[S3] Presigned upload URL generated for ${key}`);
  return url;
}

/**
 * Generate a presigned download URL.
 */
async function getDownloadUrl(key, expiresIn = 3600) {
  const bucket = await getBucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3, command, { expiresIn });
  console.log(`[S3] Presigned download URL generated for ${key}`);
  return url;
}

module.exports = {
  uploadFile,
  downloadFile,
  getUploadUrl,
  getDownloadUrl,
};