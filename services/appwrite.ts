import { Client, Account, Databases, ID } from "appwrite";

const client = new Client()
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("stream");

const account = new Account(client);
const databases = new Databases(client);

// Ping server to verify setup
client.ping().then(() => {
    console.log("Appwrite setup verified - Ping success!");
}).catch((err) => {
    console.error("Appwrite ping failed:", err);
});

export const DATABASE_ID = "streamdatabase";

export { client, account, databases, ID };
