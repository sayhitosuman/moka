import { Client, Databases } from 'node-appwrite';

const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = 'stream';
const API_KEY = 'standard_6742b39abb2fb5fe8019b8fb7c604cde89b566cf1475bd1203ec4881e6a20e41b53364faf4819bcd7d3f1f310d39c40c23a4070e54fa9fe22d3671a1a6ffdbef1322bb76c1c0ac1815fde3d03b3954f3dcde073791d1c1ec571e5deef2704aad8cdc80769fe2183ae090ede0d32fbf772aff58e421751bc2aa74548c91fb0a47';
const DATABASE_ID = 'streamdatabase';

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function fix() {
    try {
        console.log('🔧 Fixing missing attributes...');

        // Appwrite rule: Required attributes cannot have default values during creation via API. 
        // We make them optional if we want defaults, or just leave them required without a default.

        // 1. Notifications - isRead
        await databases.createBooleanAttribute(DATABASE_ID, 'notifications', 'isRead', false, false); // Optional with false default

        // 2. Post Votes - value
        await databases.createIntegerAttribute(DATABASE_ID, 'post_votes', 'value', true); // Required, no default (will be 1 or -1)

        // 3. Space Members - role & status
        await databases.createStringAttribute(DATABASE_ID, 'space_members', 'role', 20, false, 'member');
        await databases.createStringAttribute(DATABASE_ID, 'space_members', 'status', 20, false, 'accepted');

        // 4. Chat Groups - isPublic (from previous run)
        await databases.createBooleanAttribute(DATABASE_ID, 'chat_groups', 'isPublic', false, true);

        console.log('✅ Fixes applied!');
    } catch (e) {
        console.log('ℹ️ Some fixes skipped or failed (likely already exist):', e.message);
    }
}

fix();
