import path from 'path';
import { fileURLToPath } from 'url';
import stdlog from '@whi/stdlog';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { Collection, compare } from '../../dist/index.js';
import { config } from '../../dist/index.js';

const __filename = fileURLToPath(import.meta.url);

const log = stdlog(path.basename(__filename), {
    level: process.env.LOG_LEVEL || 'fatal',
});

interface CollectionData {
    id: string;
    access_key: {
        key: string;
    };
}

const collectionData: CollectionData = JSON.parse(
    readFileSync(new URL('../collection.json', import.meta.url), 'utf-8')
);
const { id, access_key } = collectionData;

config.API_BASE_URL = process.env.MAGICAUTH_API_URL || 'https://dev.magicauth.ca';

const magicauth = new Collection(id, access_key.key);

let magic_id: string;
let session_id: string;
const password = 'Passw0rd!';
const ip_address = '95.107.167.200';
const user_agent =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36';

function basic_tests() {
    it('should create a new user', async () => {
        const user = await magicauth.user(password);
        log.silly('Result: %s', JSON.stringify(user, null, 4));

        expect(user.id).toBeTypeOf('string');
        expect(user.id.slice(0, 8)).toBe('Auth_U1-');

        magic_id = user.id;
    });

    it('should create a new session', async () => {
        const session = await magicauth.session(magic_id, password, ip_address, user_agent);
        log.silly('Result: %s', JSON.stringify(session, null, 4));

        expect(session.id).toBeTypeOf('string');

        session_id = session.id;
    });

    it('should validate a session', async () => {
        const session = await magicauth.validate(session_id, ip_address, user_agent);
        log.silly('Result: %s', JSON.stringify(session, null, 4));

        expect(session.id).toBeTypeOf('string');
    });
}

function comparison_tests() {
    const chrome_linux_ua =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36';
    const chrome_windows_ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36';
    const firefox_linux_ua =
        'Mozilla/5.0 (X11; Linux x86_64; rv:75.0) Gecko/20100101 Firefox/75.0';
    const chrome_mac_ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.129 Safari/537.36';

    it('should match identical user agents', () => {
        expect(compare.userAgents(chrome_linux_ua, chrome_linux_ua)).toBe(true);
    });

    it('should reject different browsers', () => {
        expect(compare.userAgents(chrome_linux_ua, firefox_linux_ua)).toBe(false);
    });

    it('should reject different operating systems', () => {
        expect(compare.userAgents(chrome_linux_ua, chrome_windows_ua)).toBe(false);
    });

    it('should reject different CPU architectures', () => {
        expect(compare.userAgents(chrome_linux_ua, chrome_mac_ua)).toBe(false);
    });

    it('should match identical IP addresses', () => {
        expect(compare.ipAddresses('95.107.167.200', '95.107.167.200')).toBe(true);
    });

    it('should reject different IP addresses', () => {
        expect(compare.ipAddresses('95.107.167.200', '8.8.8.8')).toBe(false);
    });

    it('should allow any IP when session IP is private', () => {
        expect(compare.ipAddresses('95.107.167.200', '127.0.0.1')).toBe(true);
        expect(compare.ipAddresses('8.8.8.8', '192.168.1.1')).toBe(true);
        expect(compare.ipAddresses('1.2.3.4', '10.0.0.1')).toBe(true);
    });
}

function collection_create_tests() {
    it('should create a new collection', async () => {
        const collection = await Collection.create();
        log.silly('Collection created: %s', JSON.stringify(collection, null, 4));

        expect(collection.id).toBeTypeOf('string');
        expect(collection.access_key).toBeTypeOf('object');
        expect(collection.access_key.key).toBeTypeOf('string');
    });
}

describe('SDK Unit Tests', () => {
    describe('Basic', basic_tests);
    describe('Comparison Functions', comparison_tests);
    describe('Collection Creation', collection_create_tests);
});
