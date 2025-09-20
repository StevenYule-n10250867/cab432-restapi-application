# CAB432-style: small base, install tools, copy app, expose, run
FROM node:20

# Install ffmpeg/ffprobe for transcoding + metadata
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set app directory
WORKDIR /app

# Install dependencies first (cache-friendly)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Ensure runtime dirs exist
RUN mkdir -p uploads src/transcoded data

ENV NODE_ENV=production
EXPOSE 3000

# Start app
CMD ["node", "app.js"]
