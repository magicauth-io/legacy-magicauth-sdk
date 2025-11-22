import path from 'path';
import { fileURLToPath } from 'url';
import stdlog from '@whi/stdlog';
import crypto from 'crypto';
import { describe, it, expect, afterAll } from 'vitest';
import knex, { Knex } from 'knex';
import { readFileSync } from 'fs';
import { Collection } from '../../dist/index.js';
import { config } from '../../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = stdlog(path.basename(__filename), {
    level: process.env.LOG_LEVEL || 'fatal',
});

interface CollectionData {
    id: string;
    access_key: {
        key: string;
    };
}

interface LocalUser {
    id?: number;
    email: string;
    magicauth_id: string;
}

const collectionData: CollectionData = JSON.parse(
    readFileSync(new URL('../collection.json', import.meta.url), 'utf-8')
);
const { id, access_key } = collectionData;

config.API_BASE_URL = process.env.MAGICAUTH_API_URL || 'https://dev.magicauth.ca';

const database: Knex = knex({
    client: 'sqlite3',
    connection: {
        filename: path.join(__dirname, '../testing.sqlite'),
    },
    useNullAsDefault: true,
});
const magicauth = new Collection(id, access_key.key);

let session_id: string;
const email = crypto.randomBytes(9).toString('base64') + '@example.com';
const password = 'Passw0rd!';
const ip_address = '95.107.167.200';
const user_agent =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36';

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
function basic_tests() {
    it('should sign-up', async () => {
        const magicuser = await magicauth.user(password);
        const user: LocalUser = {
            email,
            magicauth_id: magicuser.id,
        };
        const ids = await database('users').insert(user);
        user.id = ids[0];
        log.silly('Result: %s', JSON.stringify(user, null, 4));

        expect(user.id).toBeTypeOf('number');
        expect(user.email).toBeTypeOf('string');
        expect(user.magicauth_id).toBeTypeOf('string');
        expect(user.magicauth_id.slice(0, 8)).toBe('Auth_U1-');

        const session = await magicauth.session(
            user.magicauth_id,
            password,
            ip_address,
            user_agent
        );
        log.silly('Result: %s', JSON.stringify(session, null, 4));

        expect(session.id).toBeTypeOf('string');

        session_id = session.id;
    });

    it('should validate session', async () => {
        const magicsession = await magicauth.validate(session_id, ip_address, user_agent);
        log.silly('Magic user: %s', JSON.stringify(magicsession, null, 4));

        const users = await database('users').where('magicauth_id', magicsession.credential.id);
        const user = users[0] as LocalUser;
        log.silly('Result: %s', JSON.stringify(user, null, 4));

        expect(user.id).toBeTypeOf('number');
        expect(user.email).toBeTypeOf('string');
        expect(user.magicauth_id).toBeTypeOf('string');
        expect(user.magicauth_id.slice(0, 8)).toBe('Auth_U1-');
    });

    it('should sign-in', async () => {
        const users = await database('users').where('email', email);
        const session = await magicauth.session(
            users[0].magicauth_id,
            password,
            ip_address,
            user_agent
        );
        log.silly('Result: %s', JSON.stringify(session, null, 4));

        expect(session.id).toBeTypeOf('string');

        session_id = session.id;
    });

    it('should validate session', async () => {
        const magicsession = await magicauth.validate(session_id, ip_address, user_agent);

        const users = await database('users').where('magicauth_id', magicsession.credential.id);
        const user = users[0] as LocalUser;
        log.silly('Result: %s', JSON.stringify(user, null, 4));

        expect(user.id).toBeTypeOf('number');
        expect(user.email).toBeTypeOf('string');
        expect(user.magicauth_id).toBeTypeOf('string');
        expect(user.magicauth_id.slice(0, 8)).toBe('Auth_U1-');
    });
}

function password_update_tests() {
    let test_user_id: string;
    const original_password = 'OriginalPass1!';
    const new_password = 'NewPass2!';

    it('should create a test user for password update', async () => {
        const magicuser = await magicauth.user(original_password);
        test_user_id = magicuser.id;

        expect(test_user_id).toBeTypeOf('string');
    });

    it('should update user password', async () => {
        const updated_user = await magicauth.update_password(
            test_user_id,
            original_password,
            new_password
        );
        log.silly('Updated user: %s', JSON.stringify(updated_user, null, 4));

        expect(updated_user.id).toBe(test_user_id);
    });

    it('should create session with new password', async () => {
        const session = await magicauth.session(test_user_id, new_password, ip_address, user_agent);
        log.silly('Session with new password: %s', JSON.stringify(session, null, 4));

        expect(session.id).toBeTypeOf('string');
    });
}

function error_handling_tests() {
    let valid_user_id: string;
    let valid_session_id: string;
    const valid_password = 'ValidPass1!';

    it('should create a test user for error tests', async () => {
        const magicuser = await magicauth.user(valid_password);
        valid_user_id = magicuser.id;

        const session = await magicauth.session(valid_user_id, valid_password, ip_address, user_agent);
        valid_session_id = session.id;

        expect(valid_user_id).toBeTypeOf('string');
        expect(valid_session_id).toBeTypeOf('string');
    });

    it('should throw error on wrong password', async () => {
        await expect(
            magicauth.session(valid_user_id, 'WrongPassword!', ip_address, user_agent)
        ).rejects.toThrow();
    });

    it('should throw error on invalid session ID', async () => {
        await expect(
            magicauth.validate('invalid-session-id', ip_address, user_agent)
        ).rejects.toThrow();
    });

    it('should throw error on wrong current password in update', async () => {
        await expect(
            magicauth.update_password(valid_user_id, 'WrongCurrentPass!', 'NewPass!')
        ).rejects.toThrow();
    });
}

describe('SDK Integration Tests', () => {
    afterAll(async () => {
        log.normal('Destroy database connection...');
        await database.destroy();
    });

    describe('Basic', basic_tests);
    describe('Password Update', password_update_tests);
    describe('Error Handling', error_handling_tests);
});
