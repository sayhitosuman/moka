import { Client, Databases } from 'node-appwrite';

// --- CONFIGURATION ---
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const PROJECT_ID = 'stream';
const API_KEY = 'standard_6742b39abb2fb5fe8019b8fb7c604cde89b566cf1475bd1203ec4881e6a20e41b53364faf4819bcd7d3f1f310d39c40c23a4070e54fa9fe22d3671a1a6ffdbef1322bb76c1c0ac1815fde3d03b3954f3dcde073791d1c1ec571e5deef2704aad8cdc80769fe2183ae090ede0d32fbf772aff58e421751bc2aa74548c91fb0a47'; // Replace with your API Key
const DATABASE_ID = 'streamdatabase';

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

async function createCollectionSafe(id, name, permissions = ['create("any")', 'read("any")', 'update("any")', 'delete("any")']) {
    try {
        await databases.createCollection(DATABASE_ID, id, name, permissions);
        console.log(`✅ Collection "${name}" created.`);
        return true;
    } catch (e) {
        if (e.message.includes('already exists')) {
            console.log(`ℹ️ Collection "${name}" already exists, skipping creation.`);
            return false;
        }
        throw e;
    }
}

async function createAttrSafe(colId, attrId, type, size, required, defaultVal = null, array = false) {
    try {
        if (type === 'string') await databases.createStringAttribute(DATABASE_ID, colId, attrId, size, required, defaultVal, array);
        else if (type === 'integer') await databases.createIntegerAttribute(DATABASE_ID, colId, attrId, required, defaultVal, array);
        else if (type === 'boolean') await databases.createBooleanAttribute(DATABASE_ID, colId, attrId, required, defaultVal, array);
        else if (type === 'datetime') await databases.createDatetimeAttribute(DATABASE_ID, colId, attrId, required, defaultVal, array);
        console.log(`  └ Attributes "${attrId}" added.`);
    } catch (e) {
        if (e.message.includes('already exists')) return;
        console.error(`  ❌ Error adding "${attrId}":`, e.message);
    }
}

async function setup() {
    try {
        console.log('🚀 Starting Full Appwrite Database Setup...');

        // 1. CHAT GROUPS
        if (await createCollectionSafe('chat_groups', 'Chat Groups')) {
            await createAttrSafe('chat_groups', 'name', 'string', 128, true);
            await createAttrSafe('chat_groups', 'description', 'string', 500, false);
            await createAttrSafe('chat_groups', 'createdBy', 'string', 36, true);
            await createAttrSafe('chat_groups', 'avatarUrl', 'string', 512, false);
            await createAttrSafe('chat_groups', 'isPublic', 'boolean', null, true, true);
            await createAttrSafe('chat_groups', 'memberCount', 'integer', null, false, 0);
            await createAttrSafe('chat_groups', 'createdAt', 'datetime', null, true);
        }

        // 2. CHAT GROUP MEMBERS
        if (await createCollectionSafe('chat_group_members', 'Chat Group Members')) {
            await createAttrSafe('chat_group_members', 'groupId', 'string', 36, true);
            await createAttrSafe('chat_group_members', 'userId', 'string', 36, true);
            await createAttrSafe('chat_group_members', 'joinedAt', 'datetime', null, true);
        }

        // 3. FOLLOWS
        if (await createCollectionSafe('follows', 'Follows')) {
            await createAttrSafe('follows', 'followerId', 'string', 36, true);
            await createAttrSafe('follows', 'targetId', 'string', 36, true); // User or Page
            await createAttrSafe('follows', 'createdAt', 'datetime', null, true);
        }

        // 4. FRIENDSHIPS
        if (await createCollectionSafe('friendships', 'Friendships')) {
            await createAttrSafe('friendships', 'user1Id', 'string', 36, true);
            await createAttrSafe('friendships', 'user2Id', 'string', 36, true);
            await createAttrSafe('friendships', 'status', 'string', 32, true); // pending, friends
            await createAttrSafe('friendships', 'initiatedBy', 'string', 36, true);
            await createAttrSafe('friendships', 'createdAt', 'datetime', null, true);
        }

        // 5. NOTIFICATIONS
        if (await createCollectionSafe('notifications', 'Notifications')) {
            await createAttrSafe('notifications', 'userId', 'string', 36, true);
            await createAttrSafe('notifications', 'type', 'string', 32, true);
            await createAttrSafe('notifications', 'fromId', 'string', 36, true);
            await createAttrSafe('notifications', 'fromName', 'string', 128, false);
            await createAttrSafe('notifications', 'fromPhoto', 'string', 512, false);
            await createAttrSafe('notifications', 'data', 'string', 2000, false); // JSON string
            await createAttrSafe('notifications', 'isRead', 'boolean', null, true, false);
            await createAttrSafe('notifications', 'createdAt', 'datetime', null, true);
        }

        // 6. POST VOTES
        if (await createCollectionSafe('post_votes', 'Post Votes')) {
            await createAttrSafe('post_votes', 'postId', 'string', 36, true);
            await createAttrSafe('post_votes', 'userId', 'string', 36, true);
            await createAttrSafe('post_votes', 'value', 'integer', null, true); // 1 or -1
        }

        // 7. SPACE MEMBERS
        if (await createCollectionSafe('space_members', 'Space Members')) {
            await createAttrSafe('space_members', 'spaceId', 'string', 36, true);
            await createAttrSafe('space_members', 'userId', 'string', 36, true);
            await createAttrSafe('space_members', 'role', 'string', 20, true, 'member');
            await createAttrSafe('space_members', 'status', 'string', 20, true, 'accepted');
            await createAttrSafe('space_members', 'joinedAt', 'datetime', null, true);
        }

        console.log('✅ Full Database Schema Setup Complete!');
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

setup();
