## Step-by-Step Implementation Plan

### `/home/sysnix/hopalong-backend/chatplan.md`

````markdown
# Chat Integration Plan with Centrifugo for Route-Matched Users

## 1. Project Setup

### Dependencies to Install

```bash
npm install centrifuge centrifuge-js @types/centrifuge @types/ws socket.io socket.io-client uuid
```
````

### Environment Variables

```
CENTRIFUGO_API_KEY=<your_centrifugo_api_key>
CENTRIFUGO_URL=ws://localhost:8000/connection/websocket
CENTRIFUGO_HTTP_URL=http://localhost:8000/api
```

## 2. Centrifugo Setup

### Installation & Configuration

- Install Centrifugo (Docker or direct installation)
- Create a configuration file `config.json`:

```json
{
  "token_hmac_secret_key": "your-secret-key",
  "api_key": "your-api-key",
  "allow_subscribe_for_client": true,
  "allow_publish_for_client": false
}
```

- Run Centrifugo with: `centrifugo --config=config.json`

## 3. Database Schema Updates

### New Tables

1. Create a `chat_room` table to store chat rooms for matched routes
2. Create a `message` table to store chat messages
3. Generate migrations using `npx prisma migrate dev --name chat-setup`

## 4. Backend Implementation

### Utility Files

1. Create Centrifugo client utility
2. Create authentication middleware for chat
3. Create JWT token generator for Centrifugo

### Controllers

1. Create chat controller to:
   - Create chat rooms when routes are matched
   - Handle message sending
   - Retrieve message history
   - Handle user presence

### Routes

1. Add chat API routes

## 5. Message Flow

1. **Route Match Event**:

   - When routes match, create a chat room
   - Add matched users to the room
   - Generate tokens for these users

2. **Connection Process**:

   - Client connects to Centrifugo with JWT
   - Client subscribes to their user-specific channel
   - Client subscribes to matched route channel

3. **Message Publishing**:
   - Backend publishes messages to Centrifugo
   - Centrifugo broadcasts to subscribed users
   - Messages are stored in database

## 6. Implementation Timeline

1. **Week 1**: Setup and database schema

   - Install dependencies
   - Configure Centrifugo
   - Create database migrations

2. **Week 2**: Core functionality

   - Implement authentication
   - Create chat rooms on route match
   - Basic message sending/receiving

3. **Week 3**: Advanced features and testing
   - Message history
   - Error handling
   - Stress testing

## 7. Security Considerations

1. JWT authentication for all connections
2. Input validation for all messages
3. Rate limiting to prevent abuse
4. Proper error handling to prevent information leakage

## 8. Testing Strategy

1. Unit tests for individual components
2. Integration tests for the chat system
3. Stress tests to ensure scalability
4. Security testing for authentication
