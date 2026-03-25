# Build stage — VITE_API_URL is baked in at build time (set via CI --build-arg)
FROM node:20-alpine AS build

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration if you have one, otherwise use default
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 4567

CMD ["nginx", "-g", "daemon off;"]
