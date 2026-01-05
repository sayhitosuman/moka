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

async function setup() {
    try {
        console.log('🚀 Starting Appwrite Database Setup...');

        // 1. Create Profiles Collection
        console.log('Creating Profiles collection...');
        await databases.createCollection(DATABASE_ID, 'profiles', 'Profiles', [
            'create("any")', 'read("any")', 'update("any")', 'delete("any")'
        ]);
        await databases.createStringAttribute(DATABASE_ID, 'profiles', 'uid', 36, true);
        await databases.createStringAttribute(DATABASE_ID, 'profiles', 'displayName', 128, true);
        await databases.createStringAttribute(DATABASE_ID, 'profiles', 'fullName', 128, false);
        await databases.createStringAttribute(DATABASE_ID, 'profiles', 'photoURL', 512, false);
        await databases.createStringAttribute(DATABASE_ID, 'profiles', 'bannerURL', 512, false);
        await databases.createStringAttribute(DATABASE_ID, 'profiles', 'bio', 500, false);
        await databases.createBooleanAttribute(DATABASE_ID, 'profiles', 'isAnonymous', true);
        await databases.createIntegerAttribute(DATABASE_ID, 'profiles', 'followersCount', false, 0);
        await databases.createIntegerAttribute(DATABASE_ID, 'profiles', 'followingCount', false, 0);
        await databases.createIntegerAttribute(DATABASE_ID, 'profiles', 'friendCount', false, 0);

        // 2. Create Posts Collection
        console.log('Creating Posts collection...');
        await databases.createCollection(DATABASE_ID, 'posts', 'Posts', [
            'create("any")', 'read("any")', 'update("any")', 'delete("any")'
        ]);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'type', 32, true);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'postId', 36, true);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'parentId', 36, false);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'title', 255, false);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'text', 5000, true);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'authorId', 36, true);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'authorName', 128, true);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'authorPhoto', 512, false);
        await databases.createIntegerAttribute(DATABASE_ID, 'posts', 'likes', false, 0);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'mediaUrl', 512, false);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'mediaType', 20, false);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'spaceId', 36, false);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'spaceHandle', 128, false);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'location', 128, false);
        await databases.createStringAttribute(DATABASE_ID, 'posts', 'tags', 128, false, null, true); // array
        await databases.createDatetimeAttribute(DATABASE_ID, 'posts', 'createdAt', true);

        // 3. Create Spaces Collection
        console.log('Creating Spaces collection...');
        await databases.createCollection(DATABASE_ID, 'spaces', 'Spaces', [
            'create("any")', 'read("any")', 'update("any")', 'delete("any")'
        ]);
        await databases.createStringAttribute(DATABASE_ID, 'spaces', 'name', 128, true);
        await databases.createStringAttribute(DATABASE_ID, 'spaces', 'handle', 128, true);
        await databases.createStringAttribute(DATABASE_ID, 'spaces', 'description', 500, false);
        await databases.createStringAttribute(DATABASE_ID, 'spaces', 'type', 32, true);
        await databases.createStringAttribute(DATABASE_ID, 'spaces', 'ownerId', 36, true);
        await databases.createStringAttribute(DATABASE_ID, 'spaces', 'avatarURL', 512, false);
        await databases.createStringAttribute(DATABASE_ID, 'spaces', 'bannerURL', 512, false);
        await databases.createIntegerAttribute(DATABASE_ID, 'spaces', 'memberCount', false, 0);
        await databases.createIntegerAttribute(DATABASE_ID, 'spaces', 'followerCount', false, 0);
        await databases.createBooleanAttribute(DATABASE_ID, 'spaces', 'isPrivate', true);

        // 4. Create Messages Collection
        console.log('Creating Messages collection...');
        await databases.createCollection(DATABASE_ID, 'messages', 'Messages', [
            'create("any")', 'read("any")', 'update("any")', 'delete("any")'
        ]);
        await databases.createStringAttribute(DATABASE_ID, 'messages', 'senderId', 36, true);
        await databases.createStringAttribute(DATABASE_ID, 'messages', 'senderName', 128, false);
        await databases.createStringAttribute(DATABASE_ID, 'messages', 'senderPhoto', 512, false);
        await databases.createStringAttribute(DATABASE_ID, 'messages', 'receiverId', 36, false);
        await databases.createStringAttribute(DATABASE_ID, 'messages', 'groupId', 36, false);
        await databases.createStringAttribute(DATABASE_ID, 'messages', 'text', 2000, true);
        await databases.createBooleanAttribute(DATABASE_ID, 'messages', 'isRead', true);
        await databases.createDatetimeAttribute(DATABASE_ID, 'messages', 'createdAt', true);

        console.log('✅ Database Setup Complete!');
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

setup();
