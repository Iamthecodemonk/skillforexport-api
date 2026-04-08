FROM node:22-alpine

WORKDIR /usr/src/app

# 1. Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# 2. Copy source code
COPY . .

# 3. Set environment
ENV NODE_ENV=development
EXPOSE 3011

# Start server with nodemon for development
CMD ["npm", "run", "dev"]