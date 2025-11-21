const path				= require('path');
const log				= require('@whi/stdlog')(path.basename( __filename ), {
    level: process.env.LOG_LEVEL || 'fatal',
});

const crypto				= require('crypto');
const expect				= require('chai').expect;
const knex				= require('knex');

const { id,
	access_key }			= require('../collection.json');
const sdk				= require('../../src/index.js');
const { Collection }			= sdk;
sdk.API_BASE_URL			= process.env.MAGICAUTH_API_URL || 'https://dev.magicauth.ca';


const database				= knex({
    client: 'sqlite3',
    connection: {
	filename: path.join( __dirname, "../testing.sqlite" ),
    },
    useNullAsDefault: true,
});
const magicauth				= new Collection( id, access_key.key );

let magic_id, session_id;
const email				= crypto.randomBytes(9).toString("base64") + "@example.com";
const password				= "Passw0rd!";
const ip_address			= "95.107.167.200";
const user_agent			= "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36";


// Sign Up
//   ( email, password, ctx )
//     - create user ( password )			-> magic ID
//     - save user ( email, magic ID )			-> user
//     - Session ( magic ID, password, ctx )		-> session
//     => user
//
// Sign In
//   ( email, password, ctx )
//     - get user by email ( email )			-> user
//     - Session ( user.magicID, password, ctx )	-> session
//     => user
//
// Validate
//   ( session ID, ctx )
//     - get session ( session ID, ctx )		-> magic ID
//     - get user by magic ( magic ID )			-> user
//     => user
//
// Session
//   ( magic ID, password, ctx )
//     - create session ( magic ID, password, ctx )	-> session
//     - set session cookie
//     => session
//
function basic_tests () {
    it("should sign-up", async () => {
	const magicuser			= await magicauth.user( password );
	const user			= {
	    email,
	    "magicauth_id":	magicuser.id,
	};
	const ids			= await database("users").insert( user );
	user.id				= ids[0];
	log.silly("Result: %s", JSON.stringify(user,null,4) );

	expect( user.id				).to.be.a("number");
	expect( user.email			).to.be.a("string");
	expect( user.magicauth_id		).to.be.a("string");
	expect( user.magicauth_id.slice(0,8)	).to.equal("Auth_U1-");

	const session			= await magicauth.session(
	    user.magicauth_id, password, ip_address, user_agent
	);
	log.silly("Result: %s", JSON.stringify(session,null,4) );

	expect( session.id		).to.be.a("string");

	session_id			= session.id;
    });

    it("should validate session", async () => {
	const magicsession		= await magicauth.validate(
	    session_id, ip_address, user_agent
	);
	log.silly("Magic user: %s", JSON.stringify(magicsession,null,4) );

	const users			= await database("users")
	      .where("magicauth_id", magicsession.credential.id );
	const user			= users[0];
	log.silly("Result: %s", JSON.stringify(user,null,4) );

	expect( user.id				).to.be.a("number");
	expect( user.email			).to.be.a("string");
	expect( user.magicauth_id		).to.be.a("string");
	expect( user.magicauth_id.slice(0,8)	).to.equal("Auth_U1-");
    });

    it("should sign-in", async () => {
	const users			= await database("users")
	      .where("email", email );
	const session			= await magicauth.session(
	    users[0].magicauth_id, password, ip_address, user_agent
	);
	log.silly("Result: %s", JSON.stringify(session,null,4) );

	expect( session.id		).to.be.a("string");

	session_id			= session.id;
    });

    it("should validate session", async () => {
	const magicsession		= await magicauth.validate(
	    session_id, ip_address, user_agent
	);

	const users			= await database("users")
	      .where("magicauth_id", magicsession.credential.id );
	const user			= users[0];
	log.silly("Result: %s", JSON.stringify(user,null,4) );

	expect( user.id				).to.be.a("number");
	expect( user.email			).to.be.a("string");
	expect( user.magicauth_id		).to.be.a("string");
	expect( user.magicauth_id.slice(0,8)	).to.equal("Auth_U1-");
    });
}

describe("SDK Integration Tests", () => {
    after("Teardown", async () => {
	log.normal("Destroy database connection...");
	await database.destroy();
    })

    describe("Basic", basic_tests );

});
