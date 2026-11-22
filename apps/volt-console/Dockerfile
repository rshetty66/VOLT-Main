FROM node:22-slim

WORKDIR /repo/apps/volt-console
COPY apps/volt-console/package*.json ./
RUN npm ci --ignore-scripts

WORKDIR /repo
COPY . .

WORKDIR /repo/apps/volt-console
ENV NODE_ENV=production
EXPOSE 8787
RUN npm run build
CMD ["npm", "start"]
