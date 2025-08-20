# Assignment 1 - REST API Project - Response to Criteria

## Overview

- **Name:** Steven Yule
- **Student number:** n10250867
- **Application name:** Media Transcoder API
- **Two line description:** This application allows users to upload video files and transcode them into a different format using ffmpeg. It supports JWT-based authentication, Docker deployment, and concurrent load testing with CloudWatch monitoring.

## Core criteria

### Containerise the app

- **ECR Repository name**: n10250867-cab432-restapi
- **Video timestamp:** 0:15
- **Relevant files:**
    - /Dockerfile
    - /.dockerignore

### Deploy the container

- **EC2 instance ID**: [Insert your EC2 instance ID]
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

- **One line description**: Video transcoding using `ffmpeg` triggered via POST to `/jobs/transcode`.
- **Video timestamp:** 2:00
- **Relevant files:**
    - /video.js

### CPU load testing

- **One line description**: Custom `loadtest.js` script sends repeated POST requests to `/jobs/transcode` using a large file.
- **Video timestamp:** 2:30
- **Relevant files:**
    - /loadtest.js

## Additional criteria

### Extensive REST API features

- **One line description**: Supports file uploads, JWT auth middleware, and OpenAPI docs via Swagger.
- **Video timestamp:** 3:00
- **Relevant files:**
    - /authmiddleware.js
    - /openapi.yaml

### External API(s)

- **One line description**: Not attempted
- **Video timestamp:** mm:ss
- **Relevant files:**
    - N/A

### Additional kinds of data

- **One line description**: Not attempted
- **Video timestamp:** mm:ss
- **Relevant files:**
    - N/A

### Custom processing

- **One line description**: Not attempted
- **Video timestamp:** mm:ss
- **Relevant files:**
    - N/A

### Infrastructure as code

- **One line description**: Not attempted (used manual Docker commands and AWS CLI).
- **Video timestamp:** mm:ss
- **Relevant files:**
    - N/A

### Upon request

- **One line description**: Not attempted
- **Video timestamp:** mm:ss
- **Relevant files:**
    - N/A