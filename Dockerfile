FROM node:20-alpine

WORKDIR /app

# Build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build && mkdir -p ../backend/public && cp -r dist/. ../backend/public/

# Install backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install

COPY backend/ ./backend/

EXPOSE 3001

CMD ["node", "backend/src/index.js"]
