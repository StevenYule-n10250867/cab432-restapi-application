// s3.js
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function uploadFile(localFilePath, key) {
  const fileStream = fs.createReadStream(localFilePath);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: fileStream
  }));
  return `s3://${process.env.AWS_S3_BUCKET}/${key}`;
}

async function downloadFile(key, localFilePath) {
  const { Body } = await s3.send(new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key
  }));
  const writeStream = fs.createWriteStream(localFilePath);
  return new Promise((resolve, reject) => {
    Body.pipe(writeStream)
      .on('finish', resolve)
      .on('error', reject);
  });
}

// pre-signed URL helpers
async function getUploadUrl(key, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn });
}

async function getDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn });
}

module.exports = { uploadFile, downloadFile, getUploadUrl, getDownloadUrl };
