// s3.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');

const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const s3 = new S3Client({ region: REGION });
const ssm = new SSMClient({ region: REGION });

// helper to load bucket name from Parameter Store if not in env
async function getBucketName() {
  if (process.env.AWS_S3_BUCKET) return process.env.AWS_S3_BUCKET;
  const cmd = new GetParameterCommand({ Name: '/n10250867/AWS_S3_BUCKET' });
  const res = await ssm.send(cmd);
  return res.Parameter.Value;
}

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

async function downloadFile(key, localFilePath, bucketName) {
  const finalBucket = bucketName || await getBucketName();
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
}

async function getUploadUrl(key, expiresIn = 3600) {
  const bucket = await getBucketName();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, command, { expiresIn });
}

async function getDownloadUrl(key, expiresIn = 3600) {
  const bucket = await getBucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3, command, { expiresIn });
}

module.exports = { uploadFile, downloadFile, getUploadUrl, getDownloadUrl };
