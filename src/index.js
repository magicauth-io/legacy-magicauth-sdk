const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const ip				= require('ip');
const UserAgent				= require('ua-parser-js');
const http_client			= require('@whi/http').client;

/**
 * Check API response for error status and throw if present
 * @param {object} response - API response object
 * @throws {Error} If response contains status or error properties
 */
function error_check ( response ) {
    if ( response.status || response.error )
	throw new Error(`${response.status} ${response.error}: ${response.message}`);
}

/**
 * Collection class for interacting with MagicAuth service
 * Represents a collection of credentials in the MagicAuth system
 */
class Collection {

    /**
     * Create a new collection in the MagicAuth service
     * @returns {Promise<object>} Collection details including id and access_key
     */
    static async create () {
	const anonymous				= http_client.create( public_vars.API_BASE_URL, {
	    headers: {
		"Content-Type": "application/json",
	    },
	});
	return await anonymous.post("/collections");
    }

    /**
     * Initialize a Collection client
     * @param {string} collection_id - The collection identifier
     * @param {string} access_key - Authentication access key
     * @param {*} bindings - Optional bindings (currently unused)
     */
    constructor ( collection_id, access_key, bindings ) {
	this.collection_id		= collection_id;
	this.access_key			= access_key;
	this.bindings			= bindings;

	this.api			= http_client.create( public_vars.API_BASE_URL, {
	    headers: {
		"Content-Type": "application/json",
		"Authorization": `Authentic ${access_key}`,
	    },
	});
    }

    /**
     * Create a new user credential
     * @param {string} password - Password for the new credential
     * @returns {Promise<User>} User object with credential id (format: "Auth_U1-...")
     */
    async user ( password ) {
	const user			= await this.api.post(`/collections/${this.collection_id}/credentials`, {
	    "password":		password,
	});
	log.debug("POST credentials response: %s", user );
	error_check( user );
	return new User( user );
    }

    /**
     * Update password for an existing credential
     * @param {string} credential_id - The credential ID to update
     * @param {string} current_password - Current password for verification
     * @param {string} password - New password
     * @returns {Promise<User>} Updated user object
     */
    async update_password ( credential_id, current_password, password ) {
	const credential		= await this.api.put(`/credentials/${credential_id}`, {
	    current_password,
	    password,
	});
	log.debug("PUT credentials response: %s", credential );
	error_check( credential );
	return new User( credential );
    }

    /**
     * Create a new session for a credential
     * Session is bound to the provided IP address and User Agent for security
     * @param {string} credential_id - The credential ID
     * @param {string} password - Credential password
     * @param {string} ip_address - Client IP address for session binding
     * @param {string} user_agent - Client User Agent for session binding
     * @returns {Promise<Session>} Session object with session id
     */
    async session ( credential_id, password, ip_address, user_agent ) {
	const session			= await this.api.post(`/credentials/${credential_id}/sessions`, {
	    password,
	    ip_address,
	    user_agent,
	});
	log.debug("POST sessions response: %s", session );
	error_check( session );
	return new Session( session );
    }

    /**
     * Validate an existing session
     * Verifies session is still valid and matches IP/User Agent context
     * @param {string} id - Session ID
     * @param {string} ip_address - Current client IP address
     * @param {string} user_agent - Current client User Agent
     * @returns {Promise<Session>} Session object including credential information
     * @throws {Error} If session expired, not found, or context doesn't match
     */
    async validate ( id, ip_address, user_agent ) {
	const session			= await this.api.get(`/sessions/${id}`, {
	    ip_address,
	    user_agent,
	});
	log.debug("GET session response: %s", session );
	error_check( session );
	return new Session( session );
    }
}

/**
 * User data container
 * Simple wrapper that copies all properties from API response
 */
class User {
    /**
     * @param {object} data - User data from API (typically includes 'id' field)
     */
    constructor ( data ) {
	Object.entries( data ).map( ([k,v]) => {
	    this[k]			= v;
	});
    }
}

/**
 * Session data container
 * Simple wrapper that copies all properties from API response
 */
class Session {
    /**
     * @param {object} data - Session data from API (includes 'id' and optionally 'credential')
     */
    constructor ( data ) {
	Object.entries( data ).map( ([k,v]) => {
	    this[k]			= v;
	});
    }
}

/**
 * Utility functions for comparing client context
 * Used for session security validation
 */
const compare = {
    /**
     * Compare two User Agent strings for session validation
     * Compares CPU architecture, OS name, and browser name (not versions)
     * This allows browser updates while detecting device/browser changes
     * @param {string} request_user_agent - Current request User Agent
     * @param {string} session_user_agent - User Agent stored in session
     * @returns {boolean} true if User Agents match on key attributes
     */
    userAgents ( request_user_agent, session_user_agent ) {
	const request_ua		= (new UserAgent( request_user_agent )).getResult();
	const session_ua		= (new UserAgent( session_user_agent )).getResult();

	log.debug("Comparing user agents\n    %s\n    %s\n    %20.20s = %s\n    %20.20s = %s\n    %20.20s = %s",
		  request_user_agent,
		  session_user_agent,
		  request_ua.cpu.architecture, session_ua.cpu.architecture,
		  request_ua.os.name, session_ua.os.name,
		  request_ua.browser.name, session_ua.browser.name );
	if ( request_ua.cpu.architecture	!== session_ua.cpu.architecture
	     || request_ua.os.name		!== session_ua.os.name
	     || request_ua.browser.name	!== session_ua.browser.name
	   ) {
	    return false;
	}
	return true;
    },

    /**
     * Compare two IP addresses for session validation
     * IMPORTANT: Always returns true if session IP is private (for localhost dev)
     * @param {string} request_ip_address - Current request IP address
     * @param {string} session_ip_address - IP address stored in session
     * @returns {boolean} true if IPs match or session IP is private
     */
    ipAddresses ( request_ip_address, session_ip_address ) {
	log.debug("Comparing user IPs\n    %20.20s = %s",
		  request_ip_address, session_ip_address );
	return (ip.isPrivate( session_ip_address ) || ip.isEqual( request_ip_address, session_ip_address ));
    },
};


const public_vars = {
    "API_BASE_URL": "https://vault.magicauth.ca",
    Collection,
    User,
    Session,
    compare
};

module.exports				= public_vars;
