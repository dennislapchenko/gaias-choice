# ---- Build stage: compile the SPA in an isolated node container ----
# Build context is the REPO ROOT (invoke with `-f frontend/Dockerfile .`) so the
# SPA can pull in root-level content/ at build time. The app lives in frontend/.
FROM node:22-alpine AS build
WORKDIR /app/frontend

# ignore-scripts is enforced via .npmrc as well; --ignore-scripts here is belt-and-suspenders.
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci --ignore-scripts

# content/ sits a level up at /app/content (content.ts globs ../../../content).
COPY content /app/content
COPY frontend /app/frontend
RUN npm run build

# ---- Runtime stage: static files served by nginx on $PORT ----
FROM nginx:1.27-alpine AS runtime

# PORT (default 8080) is envsubst'd into the nginx template at boot; a container
# host can override it. GitHub Pages is the live target — this image is for
# `task run` (local prod check) and any future container deploy.
ENV PORT=8080
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080
# Base image's entrypoint runs envsubst on the template, then starts nginx.
CMD ["nginx", "-g", "daemon off;"]
