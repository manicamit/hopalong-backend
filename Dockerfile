FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install
RUN npm install -g ts-node

# Copy source code
COPY . .


# Install netcat for db connection checking
RUN apk add --no-cache netcat-openbsd

# Create entrypoint script properly
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'until nc -z postgres 5432; do' >> /app/entrypoint.sh && \
    echo '  echo "Waiting for PostgreSQL to start..."' >> /app/entrypoint.sh && \
    echo '  sleep 1' >> /app/entrypoint.sh && \
    echo 'done' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "PostgreSQL started, running migrations..."' >> /app/entrypoint.sh && \
    echo '# Add migration command here based on your ORM' >> /app/entrypoint.sh && \
    echo '# For example with Prisma: npx prisma migrate deploy' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo 'echo "Starting server..."' >> /app/entrypoint.sh && \
    echo 'exec ts-node src/server.ts' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 2233

CMD ["/app/entrypoint.sh"]
