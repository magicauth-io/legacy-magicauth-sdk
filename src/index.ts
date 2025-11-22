import * as path from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error - No types available for @whi/stdlog
import stdlog from '@whi/stdlog';
// @ts-expect-error - No types available for ip
import * as ip from 'ip';
import UserAgentParser from 'ua-parser-js';
// @ts-expect-error - No types available for @whi/http
import { client as http_client } from '@whi/http';

const __filename = fileURLToPath(import.meta.url);

const log = stdlog(path.basename(__filename), {
    level: process.env.LOG_LEVEL || 'fatal',
});

interface ApiResponse {
    status?: number;
    error?: string;
    message?: string;
    [key: string]: unknown;
}

interface HttpClient {
    post(endpoint: string, data?: Record<string, unknown>): Promise<ApiResponse>;
    put(endpoint: string, data?: Record<string, unknown>): Promise<ApiResponse>;
    get(endpoint: string, params?: Record<string, unknown>): Promise<ApiResponse>;
}

interface CollectionResponse {
    id: string;
    access_key: {
        id: string;
        key: string;
        created: string;
    };
    created: string;
    rate_limiting: {
        credentials_created: number;
        credentials_updated: number;
        sessions_created: number;
    };
}

/**
 * Check API response for error status and throw if present
 * @param response - API response object
 * @throws {Error} If response contains status or error properties
 */
function error_check(response: ApiResponse): void {
    if (response.status || response.error) {
        throw new Error(`${response.status} ${response.error}: ${response.message}`);
    }
}

/**
 * Collection class for interacting with MagicAuth service
 * Represents a collection of credentials in the MagicAuth system
 */
export class Collection {
    collection_id: string;
    access_key: string;
    bindings?: unknown;
    api: HttpClient;

    /**
     * Create a new collection in the MagicAuth service
     * @returns Collection details including id and access_key
     */
    static async create(): Promise<CollectionResponse> {
        const anonymous = http_client.create(config.API_BASE_URL, {
            headers: {
                'Content-Type': 'application/json',
            },
        }) as HttpClient;
        return (await anonymous.post('/collections')) as unknown as CollectionResponse;
    }

    /**
     * Initialize a Collection client
     * @param collection_id - The collection identifier
     * @param access_key - Authentication access key
     * @param bindings - Optional bindings (currently unused)
     */
    constructor(collection_id: string, access_key: string, bindings?: unknown) {
        this.collection_id = collection_id;
        this.access_key = access_key;
        this.bindings = bindings;

        this.api = http_client.create(config.API_BASE_URL, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Authentic ${access_key}`,
            },
        }) as HttpClient;
    }

    /**
     * Create a new user credential
     * @param password - Password for the new credential
     * @returns User object with credential id (format: "Auth_U1-...")
     */
    async user(password: string): Promise<User> {
        const user = await this.api.post(`/collections/${this.collection_id}/credentials`, {
            password: password,
        });
        log.debug('POST credentials response: %s', user);
        error_check(user);
        return new User(user);
    }

    /**
     * Update password for an existing credential
     * @param credential_id - The credential ID to update
     * @param current_password - Current password for verification
     * @param password - New password
     * @returns Updated user object
     */
    async update_password(
        credential_id: string,
        current_password: string,
        password: string
    ): Promise<User> {
        const credential = await this.api.put(`/credentials/${credential_id}`, {
            current_password,
            password,
        });
        log.debug('PUT credentials response: %s', credential);
        error_check(credential);
        return new User(credential);
    }

    /**
     * Create a new session for a credential
     * Session is bound to the provided IP address and User Agent for security
     * @param credential_id - The credential ID
     * @param password - Credential password
     * @param ip_address - Client IP address for session binding
     * @param user_agent - Client User Agent for session binding
     * @returns Session object with session id
     */
    async session(
        credential_id: string,
        password: string,
        ip_address: string,
        user_agent: string
    ): Promise<Session> {
        const session = await this.api.post(`/credentials/${credential_id}/sessions`, {
            password,
            ip_address,
            user_agent,
        });
        log.debug('POST sessions response: %s', session);
        error_check(session);
        return new Session(session);
    }

    /**
     * Validate an existing session
     * Verifies session is still valid and matches IP/User Agent context
     * @param id - Session ID
     * @param ip_address - Current client IP address
     * @param user_agent - Current client User Agent
     * @returns Session object including credential information
     * @throws {Error} If session expired, not found, or context doesn't match
     */
    async validate(id: string, ip_address: string, user_agent: string): Promise<Session> {
        const session = await this.api.get(`/sessions/${id}`, {
            ip_address,
            user_agent,
        });
        log.debug('GET session response: %s', session);
        error_check(session);
        return new Session(session);
    }
}

/**
 * User data container
 * Simple wrapper that copies all properties from API response
 */
export class User {
    id?: string;
    [key: string]: unknown;

    /**
     * @param data - User data from API (typically includes 'id' field)
     */
    constructor(data: Record<string, unknown>) {
        Object.entries(data).forEach(([k, v]) => {
            this[k] = v;
        });
    }
}

/**
 * Session data container
 * Simple wrapper that copies all properties from API response
 */
export class Session {
    id?: string;
    credential?: {
        id: string;
    };
    [key: string]: unknown;

    /**
     * @param data - Session data from API (includes 'id' and optionally 'credential')
     */
    constructor(data: Record<string, unknown>) {
        Object.entries(data).forEach(([k, v]) => {
            this[k] = v;
        });
    }
}

/**
 * Utility functions for comparing client context
 * Used for session security validation
 */
export const compare = {
    /**
     * Compare two User Agent strings for session validation
     * Compares CPU architecture, OS name, and browser name (not versions)
     * This allows browser updates while detecting device/browser changes
     * @param request_user_agent - Current request User Agent
     * @param session_user_agent - User Agent stored in session
     * @returns true if User Agents match on key attributes
     */
    userAgents(request_user_agent: string, session_user_agent: string): boolean {
        const request_ua = new UserAgentParser(request_user_agent).getResult();
        const session_ua = new UserAgentParser(session_user_agent).getResult();

        log.debug(
            'Comparing user agents\n    %s\n    %s\n    %20.20s = %s\n    %20.20s = %s\n    %20.20s = %s',
            request_user_agent,
            session_user_agent,
            request_ua.cpu.architecture,
            session_ua.cpu.architecture,
            request_ua.os.name,
            session_ua.os.name,
            request_ua.browser.name,
            session_ua.browser.name
        );

        if (
            request_ua.cpu.architecture !== session_ua.cpu.architecture ||
            request_ua.os.name !== session_ua.os.name ||
            request_ua.browser.name !== session_ua.browser.name
        ) {
            return false;
        }
        return true;
    },

    /**
     * Compare two IP addresses for session validation
     * IMPORTANT: Always returns true if session IP is private (for localhost dev)
     * @param request_ip_address - Current request IP address
     * @param session_ip_address - IP address stored in session
     * @returns true if IPs match or session IP is private
     */
    ipAddresses(request_ip_address: string, session_ip_address: string): boolean {
        log.debug('Comparing user IPs\n    %20.20s = %s', request_ip_address, session_ip_address);
        return (
            ip.isPrivate(session_ip_address) || ip.isEqual(request_ip_address, session_ip_address)
        );
    },
};

// Mutable config object to allow API_BASE_URL to be changed (for testing)
export const config = {
    API_BASE_URL: 'https://vault.magicauth.ca',
};

// Re-export for convenience
export const API_BASE_URL = config.API_BASE_URL;
