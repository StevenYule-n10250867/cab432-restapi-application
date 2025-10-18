const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');
const https = require('https');

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const s3 = new S3Client({ region: REGION });
const ssm = new SSMClient({ region: REGION });

/**
 * Get the bucket name from env or SSM
 */
async function getBucketName() {
  if (process.env.AWS_S3_BUCKET) return process.env.AWS_S3_BUCKET;
  const cmd = new GetParameterCommand({ Name: '/n10250867/AWS_S3_BUCKET' });
  const res = await ssm.send(cmd);
  return res.Parameter.Value;
}

/**
 * Upload file using AWS SDK (authenticated)
 */
async function uploadFile(localFilePath, key, bucketName) {
  const finalBucket = bucketName || await getBucketName();
  const fileStream = fs.createReadStream(localFilePath);
  await s3.send(new PutObjectCommand({
    Bucket: finalBucket,
    Key: key,
    Body: fileStream
  }));
  return `s3://${finalBucket}/${key}`;
}

/**
 * Download file — use AWS SDK if available, else fallback to public HTTP
 */
async function downloadFile(key, localFilePath, bucketName) {
  const finalBucket = bucketName || await getBucketName();

  // Try SDK first
  try {
    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: finalBucket,
      Key: key
    }));

    const writeStream = fs.createWriteStream(localFilePath);
    return new Promise((resolve, reject) => {
      Body.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });
  } catch (err) {
    console.warn(`[${new Date().toISOString()}] SDK failed for ${key}: ${err.stack}`);

    // fallback to unauthenticated HTTPS
    const url = `https://s3.amazonaws.com/${finalBucket}/${key}`;
    const writeStream = fs.createWriteStream(localFilePath);

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          console.error(`[${new Date().toISOString()}] Public S3 download failed: ${res.statusCode} for ${url}`);
          return reject(new Error(`Public S3 download failed: ${res.statusCode}`));
        }

        res.pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      }).on('error', reject);
    });
  }
}

/**
 * Presigned upload URL
 */
async function getUploadUrl(key, expiresIn = 3600) {
  const bucket = await getBucketName();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Presigned download URL
 */
async function getDownloadUrl(key, expiresIn = 3600) {
  const bucket = await getBucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Download from any HTTPS URL to local file
 */
async function downloadFromUrl(url, localFilePath) {
  const file = fs.createWriteStream(localFilePath);
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", reject);
  });
}

module.exports = {
  uploadFile,
  downloadFile,
  getUploadUrl,
  getDownloadUrl,
  downloadFromUrl
};