# CAB432-style: small base, install tools, copy app, expose, run
FROM node:20-alpine

# Install ffmpeg/ffprobe for your transcoding + metadata
RUN apk add --no-cache ffmpeg

# App dir
WORKDIR /app

# Install deps first (cache-friendly)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Ensure runtime dirs exist
RUN mkdir -p uploads src/transcoded data

ENV NODE_ENV=production
EXPOSE 3000

# Start (your entry is app.js at repo root)
CMD ["node", "app.js"]