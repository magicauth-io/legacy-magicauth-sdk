# MagicAuth SDK (Legacy)

[![npm version](https://img.shields.io/npm/v/@whi/magicauth-sdk/latest?style=flat-square)](http://npmjs.com/package/@whi/magicauth-sdk)

The JavaScript SDK for integrating MagicAuth authentication services into your application.

## Overview

MagicAuth provides secure authentication with remote credential storage. Your application stores only credential IDs (not passwords) and uses sessions with IP address and User Agent validation for enhanced security.

**Key Features:**
- Remote credential storage - passwords managed by MagicAuth service
- Session-based authentication with context validation
- IP address and User Agent comparison for session security
- Simple integration with existing user systems
- RESTful API client with automatic error handling

## Installation

```bash
npm install @whi/magicauth-sdk
```

## Quick Start

```javascript
import { Collection } from '@whi/magicauth-sdk';

// Initialize with your collection credentials
const magicauth = new Collection(collection_id, access_key);

// Client context (gather from HTTP request)
const ip_address = "95.107.167.200";
const user_agent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...";
```

## Documentation

- **[API Contract](./API_CONTRACT.md)** - Complete API reference with all method signatures, parameters, and return types
- **[Authentication Flows](./AUTHENTICATION_FLOW.md)** - Detailed implementation guides with diagrams for all authentication patterns

## API Overview

### Collection Management

#### Create a New Collection

```javascript
const collection = await Collection.create();
console.log(collection);
// { id: "...", access_key: { key: "..." } }
```

#### Initialize Collection Client

```javascript
const magicauth = new Collection(collection_id, access_key);
```

### User Management

#### Create User (Sign Up)

Creates a new credential in MagicAuth. Store the returned credential ID in your user database.

```javascript
const user = await magicauth.user(password);
console.log(user.id);
// "Auth_U1-ZYkmQi66wrerQ7UgkorBwquhQF0G9EAFzz8="

// Save to your database
await database("users").insert({
  email: "user@example.com",
  magicauth_id: user.id
});
```

#### Update Password

```javascript
const credential = await magicauth.update_password(
  credential_id,
  current_password,
  new_password
);
console.log(credential.id);
// "Auth_U1-ZYkmQi66wrerQ7UgkorBwquhQF0G9EAFzz8="
```

### Session Management

#### Create Session (Sign In)

Creates a new authenticated session with IP and User Agent binding.

```javascript
const session = await magicauth.session(
  credential_id,
  password,
  ip_address,
  user_agent
);
console.log(session.id);
// "5Vx5aVjL8twCcuhnzOfo4bmGTpb-l8UexFXE305ITdQ="

// Set as HTTP-only cookie
response.cookie('session_id', session.id, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
});
```

#### Validate Session

Validates an existing session and returns credential information. Use this to authenticate requests.

```javascript
const session = await magicauth.validate(
  session_id,
  ip_address,
  user_agent
);
console.log(session);
// {
//   id: "5Vx5aVjL8twCcuhnzOfo4bmGTpb-l8UexFXE305ITdQ=",
//   credential: {
//     id: "Auth_U1-ZYkmQi66wrerQ7UgkorBwquhQF0G9EAFzz8="
//   }
// }

// Look up user in your database
const users = await database("users")
  .where("magicauth_id", session.credential.id);
const user = users[0];
```

### Utility Functions

#### Compare User Agents

Compares two User Agent strings to detect browser/device changes.

```javascript
import { compare } from '@whi/magicauth-sdk';

const match = compare.userAgents(
  request_user_agent,
  session_user_agent
);
// Returns: true if CPU architecture, OS, and browser match
```

#### Compare IP Addresses

Compares two IP addresses for session validation. Private IPs always match.

```javascript
import { compare } from '@whi/magicauth-sdk';

const match = compare.ipAddresses(
  request_ip_address,
  session_ip_address
);
// Returns: true if IPs match or session IP is private
```

## Configuration

### Change API Base URL

Useful for development or self-hosted MagicAuth instances.

```javascript
import * as sdk from '@whi/magicauth-sdk';
sdk.API_BASE_URL = 'http://localhost:2884';

// Now create Collection instances
const magicauth = new sdk.Collection(id, key);
```

**Default:** `https://vault.magicauth.ca`

## Complete Examples

### Sign Up Flow

```javascript
import { Collection } from '@whi/magicauth-sdk';

const magicauth = new Collection(collection_id, access_key);

async function signup(email, password, ip_address, user_agent) {
  // 1. Create MagicAuth credential
  const credential = await magicauth.user(password);

  // 2. Save user to your database
  const user = await database("users").insert({
    email: email,
    magicauth_id: credential.id
  });

  // 3. Create initial session
  const session = await magicauth.session(
    credential.id,
    password,
    ip_address,
    user_agent
  );

  // 4. Return session and user
  return { user, session };
}
```

### Sign In Flow

```javascript
import { Collection } from '@whi/magicauth-sdk';

const magicauth = new Collection(collection_id, access_key);

async function signin(email, password, ip_address, user_agent) {
  // 1. Look up user by email
  const users = await database("users").where("email", email);

  if (users.length === 0) {
    throw new Error("Invalid credentials");
  }

  const user = users[0];

  // 2. Create session (validates password)
  const session = await magicauth.session(
    user.magicauth_id,
    password,
    ip_address,
    user_agent
  );

  // 3. Return session and user
  return { user, session };
}
```

### Authentication Middleware

```javascript
async function authenticateRequest(request) {
  // 1. Get session ID from cookie
  const session_id = request.cookies.session_id;

  if (!session_id) {
    throw new Error("Not authenticated");
  }

  // 2. Get client context
  const ip_address = request.ip;
  const user_agent = request.headers['user-agent'];

  // 3. Validate session
  const session = await magicauth.validate(
    session_id,
    ip_address,
    user_agent
  );

  // 4. Look up user
  const users = await database("users")
    .where("magicauth_id", session.credential.id);

  if (users.length === 0) {
    throw new Error("User not found");
  }

  return users[0];
}

// Express.js middleware
app.use(async (req, res, next) => {
  try {
    req.user = await authenticateRequest(req);
    next();
  } catch (error) {
    res.clearCookie('session_id');
    res.status(401).json({ error: "Authentication required" });
  }
});
```

### Change Password

```javascript
async function changePassword(user, current_password, new_password) {
  const credential = await magicauth.update_password(
    user.magicauth_id,
    current_password,
    new_password
  );

  return { success: true };
}
```

### Sign Out

```javascript
function signout(response) {
  // Clear session cookie
  response.clearCookie('session_id');
  return { success: true };
}

// Note: The current SDK does not expose a session deletion API.
// Sessions expire automatically or can be invalidated server-side
// if the MagicAuth API supports it.
```

## Error Handling

All methods throw errors for failed operations. Errors include the HTTP status and message from the API.

```javascript
try {
  const session = await magicauth.session(
    credential_id,
    wrong_password,
    ip_address,
    user_agent
  );
} catch (error) {
  console.error(error.message);
  // "401 Unauthorized: Invalid password"
}
```

**Common Errors:**
- Invalid credentials (wrong password)
- Session expired
- IP address mismatch (session hijacking detected)
- User Agent mismatch (browser/device changed)
- Network/API errors

## Security Considerations

### Session Validation

Sessions are bound to both IP address and User Agent for enhanced security:

- **IP Address:** Must match unless session was created from a private IP
- **User Agent:** CPU architecture, OS, and browser must match (versions may differ)

This prevents session hijacking but allows:
- Browser updates (version changes are OK)
- Development on localhost (private IPs exempt from validation)

### Cookie Security

Always use secure cookie settings:

```javascript
response.cookie('session_id', session.id, {
  httpOnly: true,  // Prevent XSS access
  secure: true,    // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

### Password Storage

**Never store passwords in your database.** MagicAuth manages password hashing remotely. You only store the credential ID (`magicauth_id`).

## Database Schema

Your application needs to store the MagicAuth credential ID:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  magicauth_id TEXT UNIQUE NOT NULL
  -- other fields as needed
);

CREATE INDEX idx_users_magicauth_id ON users(magicauth_id);
```

## Development

### Running Tests

```bash
npm test
```

### Environment Variables

- `LOG_LEVEL` - Set logging level (default: `fatal`, options: `silly`, `debug`, `info`, `warn`, `error`, `fatal`)

```bash
LOG_LEVEL=debug npm test
```

## License

ISC

## Repository

[https://github.com/magicauth-io/legacy-magicauth-sdk](https://github.com/magicauth-io/legacy-magicauth-sdk)

## Author

Matthew Brisebois
