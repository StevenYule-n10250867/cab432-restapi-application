Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Overview
------------------------------------------------

- **Name:** Steven Yule  
- **Student number:** n10250867  
- **Partner name (if applicable):** N/A  
- **Application name:** Media Transcoder API  
- **Two line description:** This application allows users to upload video files, transcode them into MP4 using ffmpeg, and track job status with reports. It integrates AWS S3 for object storage, DynamoDB for metadata, and Cognito for authentication.  
- **EC2 instance name or ID:** [insert EC2 instance name/ID here]  

------------------------------------------------

### Core - First data persistence service

- **AWS service name:** S3  
- **What data is being stored?:** Raw uploaded video files and transcoded output files.  
- **Why is this service suited to this data?:** S3 is ideal for large binary objects like videos. It provides durable, scalable, and cost-effective storage with easy retrieval.  
- **Why are the other services used not suitable for this data?:** DynamoDB is optimised for structured metadata, not large blobs. EC2 instance storage is ephemeral and not designed for persistence.  
- **Bucket/instance/table name:** n10250867-a2-media-api  
- **Video timestamp:**  
- **Relevant files:**  
  - src/utils/s3.js  
  - src/routes/video.js  

### Core - Second data persistence service

- **AWS service name:** DynamoDB  
- **What data is being stored?:** Metadata about transcoding jobs (job ID, owner, filename, status, timestamps, outputs, errors).  
- **Why is this service suited to this data?:** DynamoDB is highly available and efficient for key-value lookups and storing JSON-like objects, making it perfect for lightweight job tracking.  
- **Why are the other services used not suitable for this data?:** S3 is not efficient for querying structured metadata, and RDS would be overkill for simple job state tracking.  
- **Bucket/instance/table name:** JobsTable  
- **Video timestamp:**  
- **Relevant files:**  
  - src/utils/dynamodb.js  
  - src/store/jobs.js  
  - src/routes/jobs.js  

### Third data service

- **AWS service name:**  
- **What data is being stored?:**  
- **Why is this service suited to this data?:**  
- **Why are the other services used not suitable for this data?:**  
- **Bucket/instance/table name:**  
- **Video timestamp:**  
- **Relevant files:**  

### S3 Pre-signed URLs

- **S3 Bucket names:** n10250867-a2-media-api  
- **Video timestamp:**  
- **Relevant files:**  
  - src/utils/s3.js  
  - src/routes/video.js  

### In-memory cache

- **ElastiCache instance name:**  
- **What data is being cached?:**  
- **Why is this data likely to be accessed frequently?:**  
- **Video timestamp:**  
- **Relevant files:**  

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary transcoding files in `/tmp`.  
- **Why is this data not considered persistent state?:** Temporary files can be recreated by rerunning the job; persistent state is always in S3/DynamoDB.  
- **How does your application ensure data consistency if the app suddenly stops?:** All persistent data is stored in S3 and DynamoDB, so restarting the container/EC2 instance does not cause data loss. Jobs can be retrieved from DynamoDB.  
- **Relevant files:**  
  - src/routes/jobs.js  
  - src/routes/video.js  

### Graceful handling of persistent connections

- **Type of persistent connection and use:** N/A (polling is used instead of persistent connections).  
- **Method for handling lost connections:** N/A.  
- **Relevant files:**  

### Core - Authentication with Cognito

- **User pool name:** ap-southeast-2_pUeRdxIFW  
- **How are authentication tokens handled by the client?:** JWT returned on login and passed via `Authorization: Bearer <token>` header to all protected routes.  
- **Video timestamp:**  
- **Relevant files:**  
  - src/routes/auth.js  
  - src/middleware/authmiddleware.js  

### Cognito multi-factor authentication

- **What factors are used for authentication:** Not implemented  
- **Video timestamp:**  
- **Relevant files:**  

### Cognito federated identities

- **Identity providers used:** Not implemented  
- **Video timestamp:**  
- **Relevant files:**  

### Cognito groups

- **How are groups used to set permissions?:** Admin group users can access admin-only routes (e.g., `/admin/dashboard`). Regular users cannot.  
- **Video timestamp:**  
- **Relevant files:**  
  - src/middleware/authmiddleware.js  
  - app.js  

### Core - DNS with Route53

- **Subdomain:** n10250867.cab432.com → EC2 public DNS  
- **Video timestamp:**  

### Parameter store

- **Parameter names:**
  - /n10250867/AWS_REGION = ap-southeast-2
  - /n10250867/AWS_S3_BUCKET = n10250867-a2-media-api
  - /n10250867/COGNITO_CLIENT_ID = 4rrngtjump7gjqc90lg46m4jnl
  - /n10250867/COGNITO_CLIENT_SECRET = hjk5dngq7uusequ06eic17c55k16uaj711hf0lg9slrrgnnqb9r
  - /n10250867/COGNITO_USER_POOL_ID = ap-southeast-2_pUeRdxIFW
  - /n10250867/JWT_SECRET = supersecret
- **Video timestamp:**
- **Relevant files:**
  - src/config.js
  - app.js


### Secrets manager

- **Secrets names:** Not implemented (falls back to `.env`).  
- **Video timestamp:**  
- **Relevant files:**  

### Infrastructure as code

- **Technology used:** Not implemented (manual EC2 + Docker setup).  
- **Services deployed:**  
- **Video timestamp:**  
- **Relevant files:**  

### Other (with prior approval only)

- **Description:**  
- **Video timestamp:**  
- **Relevant files:**  

### Other (with prior permission only)

- **Description:**  
- **Video timestamp:**  
- **Relevant files:**  
