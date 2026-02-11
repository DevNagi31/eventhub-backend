-- Simplified schema without PostGIS

DROP TABLE IF EXISTS event_rsvps CASCADE;
DROP TABLE IF EXISTS group_events CASCADE;
DROP TABLE IF EXISTS group_messages CASCADE;
DROP TABLE IF EXISTS group_posts CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS saved_events CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (using lat/lng instead of PostGIS)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    preferences JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) NOT NULL,
    category VARCHAR(100),
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    venue_name VARCHAR(255),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    price DECIMAL(10,2),
    registration_url TEXT,
    source VARCHAR(50) NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Groups table
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) DEFAULT 'sports',
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    city VARCHAR(100),
    cover_image_url TEXT,
    creator_id INT REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    member_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Group Members table
CREATE TABLE group_members (
    group_id INT REFERENCES groups(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- Group Events table
CREATE TABLE group_events (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES groups(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE SET NULL,
    title VARCHAR(500),
    description TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    venue_name VARCHAR(255),
    start_time TIMESTAMP NOT NULL,
    created_by INT REFERENCES users(id),
    is_official BOOLEAN DEFAULT false,
    rsvp_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Event RSVPs table
CREATE TABLE event_rsvps (
    group_event_id INT REFERENCES group_events(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'going',
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_event_id, user_id)
);

-- Saved Events table
CREATE TABLE saved_events (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, event_id)
);

-- Group Posts table
CREATE TABLE group_posts (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES groups(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Group Messages table
CREATE TABLE group_messages (
    id SERIAL PRIMARY KEY,
    group_id INT REFERENCES groups(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_events_external_id ON events(external_id);
CREATE INDEX idx_events_time ON events(start_time);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_groups_category ON groups(category);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_events_group ON group_events(group_id);
CREATE INDEX idx_group_events_time ON group_events(start_time);
