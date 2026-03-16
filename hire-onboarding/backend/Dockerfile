FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine

# Install LibreOffice for DOCX->PDF conversion
RUN apk add --no-cache libreoffice

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY templates/ ./templates/

RUN mkdir -p ./output

EXPOSE 4000
CMD ["node", "dist/index.js"]
