import path from 'path';
import { fileURLToPath } from 'url';
import stdlog from '@whi/stdlog';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { Collection } from '../../dist/index.js';
import { config } from '../../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = stdlog(path.basename(__filename), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const collectionData = JSON.parse(
    readFileSync(new URL('../collection.json', import.meta.url), 'utf-8')
);
const { id, access_key } = collectionData;

config.API_BASE_URL = process.env.MAGICAUTH_API_URL || 'https://dev.magicauth.ca';


const magicauth				= new Collection( id, access_key.key);

let magic_id, session_id;
const password				= "Passw0rd!";
const ip_address			= "95.107.167.200";
const user_agent			= "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36";

function basic_tests () {
    it("should create a new user", async () => {
	const user			= await magicauth.user( password );
	log.silly("Result: %s", JSON.stringify(user,null,4) );

	expect( user.id			).to.be.a("string");
	expect( user.id.slice(0,8)	).to.equal("Auth_U1-");

	magic_id			= user.id;
    });

    it("should create a new session", async () => {
	const session			= await magicauth.session(
	    magic_id, password, ip_address, user_agent
	);
	log.silly("Result: %s", JSON.stringify(session,null,4) );

	expect( session.id		).to.be.a("string");

	session_id			= session.id;
    });

    it("should validate a session", async () => {
	const session			= await magicauth.validate(
	    session_id, ip_address, user_agent
	);
	log.silly("Result: %s", JSON.stringify(session,null,4) );

	expect( session.id		).to.be.a("string");
    });
}

describe("SDK Unit Tests", () => {

    describe("Basic", basic_tests );

});
