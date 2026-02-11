# EventHub Backend

Event discovery platform with sports/esports aggregation, AI chatbot, and group features.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Redis (optional, for caching)

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Set up PostgreSQL:**
```bash
# Create database
createdb eventhub

# Enable PostGIS
psql eventhub -c "CREATE EXTENSION postgis;"
```

3. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Run database migrations:**
```bash
npm run db:setup
```

5. **Start the server:**
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Events
- `GET /api/events/search` - Search events by location
- `GET /api/events/:id` - Get event details
- `POST /api/events/refresh` - Refresh events from APIs

### Groups
- `POST /api/groups` - Create group
- `GET /api/groups/search` - Search groups
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/join` - Join group
- `POST /api/groups/:id/leave` - Leave group
- `GET /api/groups/:id/members` - Get group members

### Group Events
- `GET /api/group-events/group/:groupId` - Get group events
- `POST /api/group-events/attach` - Attach official event
- `POST /api/group-events/create` - Create custom event
- `POST /api/group-events/:eventId/rsvp` - RSVP to event

### Chat
- `POST /api/chat/message` - Send message to AI chatbot

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/preferences` - Update preferences
- `PUT /api/users/location` - Update location

## Getting API Keys

### SeatGeek
1. Go to https://seatgeek.com/
2. Sign up for developer account
3. Get client ID and secret

### PandaScore
1. Go to https://pandascore.co/
2. Sign up for API access
3. Get API key

### Anthropic (Claude)
1. Go to https://console.anthropic.com/
2. Create account
3. Get API key

## Environment Variables

See `.env.example` for all required variables.

## WebSocket Events

### Group Chat
- `join-group` - Join a group chat room
- `leave-group` - Leave a group chat room
- `group-message` - Send message to group
- `new-message` - Receive new message

## Database Schema

See `src/config/schema.sql` for complete schema.

## Development
```bash
# Run with auto-reload
npm run dev

# Reset database
npm run db:setup
```

## Project Structure
```
src/
├── config/          # Database, Redis, schema
├── routes/          # API endpoints
├── services/        # Business logic
├── middleware/      # Auth, permissions
├── utils/           # Helper functions
└── server.js        # Main entry point
```

## License

MIT
