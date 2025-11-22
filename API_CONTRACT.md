[← Back to README](./README.md)

# MagicAuth SDK API Contract

This document defines the complete API contract for the MagicAuth SDK. This contract should be preserved during any refactoring or rewriting efforts.

## Overview

The SDK is a client library for the MagicAuth authentication service. It provides password-based authentication with remote credential storage, with optional IP address and User Agent validation for enhanced security.

**Base URL:** `https://vault.magicauth.ca` (configurable via `API_BASE_URL` export)

---

## Exports

The module exports the following:

```javascript
import {
  API_BASE_URL,
  Collection,
  User,
  Session,
  compare
} from '@whi/magicauth-sdk';
```

---

## Class: Collection

The main class for interacting with a MagicAuth collection.

### Static Methods

#### `Collection.create()`

Creates a new collection in the MagicAuth service.

**Parameters:** None

**Returns:** `Promise<object>`
- Returns the raw response from `POST /collections`

**HTTP Request:**
- Method: `POST`
- Endpoint: `/collections`
- Headers: `Content-Type: application/json`
- Auth: None (anonymous request)

**Example:**
```javascript
import { Collection } from '@whi/magicauth-sdk';

const collection = await Collection.create();
```

---

### Constructor

#### `new Collection(collection_id, access_key, bindings?)`

**Parameters:**
- `collection_id` (string): The collection identifier
- `access_key` (string): The authentication access key
- `bindings` (any, optional): Additional bindings (currently unused in implementation)

**Returns:** Collection instance

**Side Effects:**
- Creates an HTTP client with:
  - Base URL: `API_BASE_URL`
  - Headers:
    - `Content-Type: application/json`
    - `Authorization: Authentic ${access_key}`

**Example:**
```javascript
import { Collection } from '@whi/magicauth-sdk';

const magicauth = new Collection(collection_id, access_key);
```

---

### Instance Methods

#### `user(password)`

Creates a new user credential with the given password.

**Parameters:**
- `password` (string): The password for the new credential

**Returns:** `Promise<User>`
- User instance with an `id` property
- The `id` is a string starting with `"Auth_U1-"`

**HTTP Request:**
- Method: `POST`
- Endpoint: `/collections/${collection_id}/credentials`
- Body: `{ password }`

**Error Handling:**
- Throws Error if response contains `status` or `error` properties
- Error format: `"${status} ${error}: ${message}"`

**Example:**
```javascript
import { Collection } from '@whi/magicauth-sdk';

const magicauth = new Collection(collection_id, access_key);
const user = await magicauth.user("Passw0rd!");
// user.id => "Auth_U1-ZYkmQi66wrerQ7UgkorBwquhQF0G9EAFzz8="
```

---

#### `update_password(credential_id, current_password, password)`

Updates the password for an existing credential.

**Parameters:**
- `credential_id` (string): The credential ID (e.g., "Auth_U1-...")
- `current_password` (string): The current password
- `password` (string): The new password

**Returns:** `Promise<User>`
- User instance with updated credential information

**HTTP Request:**
- Method: `PUT`
- Endpoint: `/credentials/${credential_id}`
- Body: `{ current_password, password }`

**Error Handling:**
- Throws Error if response contains `status` or `error` properties
- Error format: `"${status} ${error}: ${message}"`

**Example:**
```javascript
import { Collection } from '@whi/magicauth-sdk';

const magicauth = new Collection(collection_id, access_key);
const updatedUser = await magicauth.update_password(
  credential_id,
  "OldPassw0rd!",
  "NewPassw0rd!"
);
```

---

#### `session(credential_id, password, ip_address, user_agent)`

Creates a new session for a credential with context validation.

**Parameters:**
- `credential_id` (string): The credential ID
- `password` (string): The credential password
- `ip_address` (string): Client IP address for session binding
- `user_agent` (string): Client User Agent string for session binding

**Returns:** `Promise<Session>`
- Session instance with an `id` property (base64 string)

**HTTP Request:**
- Method: `POST`
- Endpoint: `/credentials/${credential_id}/sessions`
- Body: `{ password, ip_address, user_agent }`

**Error Handling:**
- Throws Error if response contains `status` or `error` properties
- Error format: `"${status} ${error}: ${message}"`

**Example:**
```javascript
import { Collection } from '@whi/magicauth-sdk';

const magicauth = new Collection(collection_id, access_key);
const session = await magicauth.session(
  credential_id,
  "Passw0rd!",
  "95.107.167.200",
  "Mozilla/5.0 (X11; Linux x86_64)..."
);
// session.id => "5Vx5aVjL8twCcuhnzOfo4bmGTpb-l8UexFXE305ITdQ="
```

---

#### `validate(id, ip_address, user_agent)`

Validates an existing session with context verification.

**Parameters:**
- `id` (string): The session ID
- `ip_address` (string): Current client IP address
- `user_agent` (string): Current client User Agent string

**Returns:** `Promise<Session>`
- Session instance with:
  - `id` (string): The session ID
  - `credential` (object): Contains credential information
    - `id` (string): The credential ID

**HTTP Request:**
- Method: `GET`
- Endpoint: `/sessions/${id}`
- Query/Body: `{ ip_address, user_agent }`

**Error Handling:**
- Throws Error if response contains `status` or `error` properties
- Throws if session expired, IP/UA mismatch, or session not found
- Error format: `"${status} ${error}: ${message}"`

**Example:**
```javascript
import { Collection } from '@whi/magicauth-sdk';

const magicauth = new Collection(collection_id, access_key);
const session = await magicauth.validate(
  session_id,
  "95.107.167.200",
  "Mozilla/5.0 (X11; Linux x86_64)..."
);
// session.id => "5Vx5aVjL8twCcuhnzOfo4bmGTpb-l8UexFXE305ITdQ="
// session.credential.id => "Auth_U1-ZYkmQi66wrerQ7UgkorBwquhQF0G9EAFzz8="
```

---

## Class: User

Simple data container for user/credential information.

**Constructor:** `new User(data)`
- Copies all properties from `data` object onto the instance

**Properties:**
- `id` (string): Credential ID (format: `"Auth_U1-${base64}"`)
- May contain additional properties depending on API response

---

## Class: Session

Simple data container for session information.

**Constructor:** `new Session(data)`
- Copies all properties from `data` object onto the instance

**Properties:**
- `id` (string): Session ID (base64 string)
- `credential` (object, when from `validate()`): Contains credential info
  - `id` (string): The credential ID
- May contain additional properties depending on API response

---

## Utility Object: compare

Provides utility functions for comparing client context information.

### `compare.userAgents(request_user_agent, session_user_agent)`

Compares two User Agent strings to determine if they represent the same client.

**Parameters:**
- `request_user_agent` (string): The current request's User Agent
- `session_user_agent` (string): The User Agent stored in the session

**Returns:** `boolean`
- `true` if the User Agents match
- `false` if there are differences

**Comparison Logic:**
Uses `ua-parser-js` to parse both User Agent strings and compares:
1. CPU architecture (`cpu.architecture`)
2. OS name (`os.name`)
3. Browser name (`browser.name`)

All three must match for the function to return `true`.

**Example:**
```javascript
import { compare } from '@whi/magicauth-sdk';

const ua1 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...";
const ua2 = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36...";
const match = compare.userAgents(ua1, ua2); // => true or false
```

---

### `compare.ipAddresses(request_ip_address, session_ip_address)`

Compares two IP addresses to determine if they represent the same client location.

**Parameters:**
- `request_ip_address` (string): The current request's IP address
- `session_ip_address` (string): The IP address stored in the session

**Returns:** `boolean`
- `true` if the IPs match or if session IP is private
- `false` if there are differences

**Comparison Logic:**
1. If `session_ip_address` is a private IP → always returns `true`
2. Otherwise, uses `ip.isEqual()` to compare addresses

This allows sessions created on private networks to be used from any IP.

**Example:**
```javascript
import { compare } from '@whi/magicauth-sdk';

const ip1 = "95.107.167.200";
const ip2 = "95.107.167.200";
const match = compare.ipAddresses(ip1, ip2); // => true

const privateIP = "192.168.1.1";
const publicIP = "95.107.167.200";
const match2 = compare.ipAddresses(publicIP, privateIP); // => true (private)
```

---

## Error Handling

All API methods (`user`, `update_password`, `session`, `validate`) follow the same error handling pattern:

**Error Detection:**
- Response is checked for `status` or `error` properties
- If either exists, an error is thrown

**Error Format:**
```javascript
throw new Error(`${response.status} ${response.error}: ${response.message}`);
```

**Common Error Scenarios:**
- Invalid credentials
- Expired sessions
- IP/User Agent mismatch
- Missing or invalid collection/access key
- Network errors

---

## Configuration

### `API_BASE_URL`

The base URL can be changed by modifying the exported `API_BASE_URL` property:

```javascript
import * as sdk from '@whi/magicauth-sdk';
sdk.API_BASE_URL = 'http://localhost:2884';

// Now create Collection instances
const magicauth = new sdk.Collection(id, key);
```

**Default Value:** `"https://vault.magicauth.ca"`

**Timing:** Must be set before creating Collection instances

---

## Dependencies

The SDK relies on the following external libraries:

- `@whi/http` (^0.2.1): HTTP client
- `@whi/stdlog` (^0.3.0): Logging
- `ip` (^1.1.5): IP address comparison
- `ua-parser-js` (^0.7.21): User Agent parsing
