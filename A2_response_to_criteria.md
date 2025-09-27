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

### Core - First data persistence service (IMPLEMENTED)

- **AWS service name:** S3  
- **What data is being stored?:** Raw uploaded video files and transcoded output files.  
- **Why is this service suited to this data?:** S3 is ideal for large binary objects like videos. It provides durable, scalable, and cost-effective storage with easy retrieval.  
- **Why are the other services used not suitable for this data?:** DynamoDB is optimised for structured metadata, not large blobs. EC2 instance storage is ephemeral and not designed for persistence.  
- **Bucket/instance/table name:** n10250867-a2-media-api  
- **Video timestamp:**  0:12 - 0:40
- **Relevant files:**  
  - src/utils/s3.js
    - uploadFile (lines 7-15)
    - getUploadURL / getDownloadURL (lines 27-36) 
  - src/routes/video.js
    - /video/upoad route (lines 18-34)
    - /video/upload-url (lines 45-55)

### Core - Second data persistence service (IMPLEMENTED)

- **AWS service name:** DynamoDB  
- **What data is being stored?:** Metadata about transcoding jobs (job ID, owner, filename, status, timestamps, outputs, errors).  
- **Why is this service suited to this data?:** DynamoDB is highly available and efficient for key-value lookups and storing JSON-like objects, making it perfect for lightweight job tracking.  
- **Why are the other services used not suitable for this data?:** S3 is not efficient for querying structured metadata, and RDS would be overkill for simple job state tracking.  
- **Bucket/instance/table name:** JobsTable  
- **Video timestamp:**  6:13 - 6:57
- **Relevant files:**  
  - src/utils/dynamodb.js
    - putJob (lines 7–14)
    - getJob (lines 16–21)
    - updateJob (lines 23–41) 
  - src/routes/jobs.js
    - /jobs/transcode route storing jobs (lines 19–95)
 
### Third data service (NOT IMPLEMENTED)

- **AWS service name:**  [eg. RDS]
- **What data is being stored?:** [eg video metadata]
- **Why is this service suited to this data?:** [eg. ]
- **Why is are the other services used not suitable for this data?:** [eg. Advanced video search requires complex querries which are not available on S3 and inefficient on DynamoDB]
- **Bucket/instance/table name:**
- **Video timestamp:**
- **Relevant files:**

### S3 Pre-signed URLs (IMPLEMENTED)

- **S3 Bucket names:** n10250867-a2-media-api  
- **Video timestamp:**  5:50 - 6:12
- **Relevant files:**  
  - src/utils/s3.js
    - getUploadUrl, getDownloadUrl (lines 27–36) 
  - src/routes/video.js
    - /video/upload-url (lines 45–55)
    - /video/download-url (lines 59–69)
  -  src/routes/jobs.js
    -  playback/download (lines 197–203)

### In-memory cache (NOT IMPLEMENTED)

- **ElastiCache instance name:**  
- **What data is being cached?:**  
- **Why is this data likely to be accessed frequently?:**  
- **Video timestamp:**  
- **Relevant files:**  

### Core - Statelessness (IMPLEMENTED)

- **What data is stored within your application that is not stored in cloud data services?:** Temporary files in `/tmp` during transcoding before being uploaded to S3.  
- **Why is this data not considered persistent state?:** These files are intermediate and can be recreated by re-running the job. All true persistent data is stored in S3 and DynamoDB.  
- **How does your application ensure data consistency if the app suddenly stops?:** Videos and job metadata are fully persisted in S3 and DynamoDB. If the EC2/container is restarted, previously uploaded videos and job records are still available, and the application continues to operate correctly. In-progress jobs may need to be resubmitted, but the persistent state remains consistent and intact.  
- **Relevant files:**  
  - src/routes/jobs.js  
  - src/routes/video.js  
  - src/utils/s3.js  
  - src/utils/dynamodb.js  

### Graceful handling of persistent connections (NOT IMPLEMENTED)

- **Type of persistent connection and use:** N/A (polling is used instead of persistent connections).  
- **Method for handling lost connections:** N/A.  
- **Relevant files:**  

### Core - Authentication with Cognito (IMPLEMENTED)

- **User pool name:** ap-southeast-2_pUeRdxIFW (App Client ID: 4rrngtjump7gjqc90lg46m4jnl)  
- **How are authentication tokens handled by the client?:** Users register and confirm via Cognito. On login, Cognito issues a JWT which the client includes in the `Authorization: Bearer <token>` header. The `authMiddleware` validates these tokens against Cognito’s JWKs, ensuring secure access to protected routes such as `/jobs`.  
- **Video timestamp:**  0:42 - 2:45
- **Relevant files:**  
  - src/routes/auth.js
    - Register /auth/register (lines 17–34)
    - Confirm /auth/confirm (lines 38–51)
    - Login /auth/login (lines 55–71)   
  - src/middleware/authmiddleware.js
    -   JWT validation against Cognito JWKs (lines 17–40)

### Cognito multi-factor authentication (NOT IMPLEMENTED)

- **What factors are used for authentication:** Not implemented  
- **Video timestamp:**  
- **Relevant files:**  

### Cognito federated identities (NOT IMPLEMENTED)

- **Identity providers used:** Not implemented  
- **Video timestamp:**  
- **Relevant files:**  

### Cognito groups (IMPLEMENTED)

- **How are groups used to set permissions?:** Admin group users can access admin-only routes (e.g., `/admin/dashboard`). Regular users cannot.  
- **Video timestamp:**  2:47 - 3:19
- **Relevant files:**  
  - src/middleware/authmiddleware.js  (lines 42-51)
  - app.js  (lines 36-44)

### Core - DNS with Route53 (IMPLEMENTED)

- **Subdomain:** n10250867.cab432.com  
- **Video timestamp:** 0:00 - 0:34

### Parameter store (IMPLEMENTED)

- **Parameter names:**
  - /n10250867/AWS_REGION = ap-southeast-2
  - /n10250867/AWS_S3_BUCKET = n10250867-a2-media-api
  - /n10250867/COGNITO_CLIENT_ID = 4rrngtjump7gjqc90lg46m4jnl
  - /n10250867/COGNITO_CLIENT_SECRET = hjk5dngq7uusequ06eic17c55k16uaj711hf0lg9slrrgnnqb9r
  - /n10250867/COGNITO_USER_POOL_ID = ap-southeast-2_pUeRdxIFW
  - /n10250867/JWT_SECRET = supersecret
- **Video timestamp:** 6:57 - 7:22
- **Relevant files:**
  - src/config.js
    - getParam (lines 7–16)
    - loadConfig (lines 36–67)
  - app.js
    - loadConfig (lines 7–10)


### Secrets Manager (IMPLEMENTED)

- **Secrets names:** /n10250867/JWT_SECRET  
- **Video timestamp:**  7:22 - 7:41
- **Relevant files:**
  - app.js (lines 27–33)
  - src/config.js
    - getSecret (lines 18–25)
    - loadConfig (lines 36–67)
  - src/routes/auth.js (lines 55–71)

### Infrastructure as code (NOT IMPLEMENTED)

- **Technology used:** Not implemented (manual EC2 + Docker setup).  
- **Services deployed:**  
- **Video timestamp:**  
- **Relevant files:**  

### Other (with prior approval only) (NOT IMPLEMENTED)

- **Description:**  
- **Video timestamp:**  
- **Relevant files:**  

### Other (with prior permission only) (NOT IMPLEMENTED)

- **Description:**  
- **Video timestamp:**  
- **Relevant files:**  
