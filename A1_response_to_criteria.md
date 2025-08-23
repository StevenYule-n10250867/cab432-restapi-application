
# Assignment 1 - REST API Project - Response to Criteria

## Environment Configuration

### .env Parameters

The following parameters are defined in the `.env` file used by the application:

```env
JWT_SECRET=supersecret
PORT=3000
ALLOW_PUBLIC_REPORTS=true
```

(ALLOW_PUBLIC_REPORTS was added for the purpose of the demonstration. When set to true, it removes authentication from the /jobs/{id}/report route, allowing access to the web report via the local web browser. This would typically be disabled when in production)

---

## Overview

- **Name:** Steven Yule  
- **Student number:** n10250867  
- **Application name:** Media Transcoder API  
- **Two line description:** This application allows users to upload video files and transcode them into a different format using ffmpeg. It supports JWT-based authentication, Docker deployment, and concurrent load testing with CloudWatch monitoring.

---

## Core criteria

### Containerise the app

- **ECR Repository name**: n10250867-cab432-restapi  
- **Video timestamp:** 0:15  
- **Relevant files:**
  - /Dockerfile  
  - /.dockerignore  

### Deploy the container

- **ECR Image:**  
  `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n10250867-my-repo:latest`

- **Deployment steps on EC2:**

```bash
# 1. Login as ubuntu user
sudo -iu ubuntu 

# 2. Navigate to project directory
cd CAB432-RestAPI-Application-EC2

# 3. Install Docker if not already
sudo apt update && sudo apt install -y docker.io

# 4. Login to ECR
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com

# 5. Pull image
docker pull 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n10250867-my-repo:latest

# 6. Run container (with volume mounts for persistence)
docker rm -f cab432-api
docker run -d --name cab432-api \
  -p 3000:3000 \
  -e JWT_SECRET='change-me' \
  -e ALLOW_PUBLIC_REPORTS='true' \
  -v "$PWD/uploads:/app/uploads" \
  -v "$PWD/src/transcoded:/app/src/transcoded" \
  -v "$PWD/data:/app/data" \
  901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n10250867-my-repo:latest
```

- **Verification:**  
  Visit `http://<EC2_PUBLIC_DNS>:3000/health` → should return `{"status":"ok"}`.  

- **Video timestamp:** 0:30  

### User login

- **One line description:** JWT-based login using hardcoded credentials (admin/adminpass). Token is required for protected routes.  
- **Video timestamp:** 0:45  
- **Relevant files:**
  - /auth.js  
  - /authmiddleware.js  

### REST API

- **One line description:** REST API provides endpoints for auth, video uploads, transcoding, job tracking and status reporting.  
- **Video timestamp:** 1:00  
- **Relevant files:**
  - /app.js  
  - /video.js  
  - /jobs.js  
  - /openapi.yaml  

### Two kinds of data

#### First kind
- **One line description:** Uploaded video files for transcoding.  
- **Type:** Unstructured  
- **Rationale:** Binary video files are stored on disk in `/uploads` and `/src/transcoded`, and not in the database.  
- **Video timestamp:** 1:20  
- **Relevant files:**
  - /uploads/  
  - /src/transcoded/  
  - /video.js  

#### Second kind
- **One line description:** JSON metadata for jobs, including status, filename, and output path.  
- **Type:** Structured  
- **Rationale:** Used to track job state and return meaningful progress updates to clients.  
- **Video timestamp:** 1:40  
- **Relevant files:**
  - /jobs.js  

### CPU intensive task

- **One line description:** Video transcoding using `ffmpeg` triggered via POST to `/jobs/transcode`.  
- **Video timestamp:** 2:00  
- **Relevant files:**
  - /video.js  

### CPU load testing

- **One line description:** Custom `loadtest.js` script sends repeated POST requests to `/jobs/transcode` using a large file.  
- **Video timestamp:** 2:30  
- **Relevant files:**
  - /loadtest.js  

---

## Additional criteria (selected)

### Extended REST API features

- **One line description:** JWT-protected endpoints, RESTful design, OpenAPI schema, proper status codes and methods.  
- **Video timestamp:** 3:00  
- **Relevant files:**
  - /authmiddleware.js  
  - /openapi.yaml  
  - /app.js  

### Additional types of data

- **One line description:** Original video uploads, transcoded outputs, job metadata (structured and unstructured).  
- **Video timestamp:** 3:20  
- **Relevant files:**
  - /uploads/  
  - /src/transcoded/  
  - /jobs.js  

### Custom processing

- **One line description:** Transcoding logic is controlled through custom-built Node.js orchestration using `ffmpeg` with configurable load test triggers.  
- **Video timestamp:** 3:40  
- **Relevant files:**
  - /video.js  
  - /loadtest.js  

### Web client

- **One line description:** Swagger UI client enables all major endpoint interactions via browser.  
- **Video timestamp:** 4:00  
- **Relevant files:**
  - /app.js  
  - /openapi.yaml  
  - /routes/jobs.js

---

## Not Attempted

### External APIs

- **One line description:** Not attempted  
- **Video timestamp:** mm:ss  
- **Relevant files:** N/A  

### Infrastructure as code

- **One line description:** Not attempted (manual Docker & AWS CLI used)  
- **Video timestamp:** mm:ss  
- **Relevant files:** N/A  

### Upon request

- **One line description:** Not attempted  
- **Video timestamp:** mm:ss  
- **Relevant files:** N/A  
