# ---- Build stage: compile the SPA in an isolated node container ----
FROM node:22-alpine AS build
WORKDIR /app

# ignore-scripts is enforced via .npmrc as well; --ignore-scripts here is belt-and-suspenders.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# ---- Runtime stage: static files served by nginx on Cloud Run's $PORT ----
FROM nginx:1.27-alpine AS runtime

# Cloud Run injects PORT (default 8080); the nginx image envsubst's this template at boot.
ENV PORT=8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
# Base image's entrypoint runs envsubst on the template, then starts nginx.
CMD ["nginx", "-g", "daemon off;"]
