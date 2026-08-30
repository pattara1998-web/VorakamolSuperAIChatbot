import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Helper function to get the Graph API endpoint
const GRAPH_API_BASE_URL = 'https://graph.facebook.com/v19.0/';

/**
 * Exchanges a user's short-lived access token for a long-lived token and page access tokens.
 * @param userAccessToken The short-lived token provided by the frontend.
 * @param facebookAppId Your Facebook App ID.
 * @param facebookAppSecret Your Facebook App Secret.
 * @returns A promise that resolves with the page access token and user token.
 */
async function exchangeTokens(userAccessToken: string, facebookAppId: string, facebookAppSecret: string) {
    // 1. Exchange User Token for Long-Lived User Token
    const userTokenExchangeUrl = `${GRAPH_API_BASE_URL}oauth/access_token?  grant_type=fb_exchange_token&client_id=${facebookAppId}&client_secret=${facebookAppSecret}&user_token=${userAccessToken}`;
    
    console.log("Exchanging user token...");
    const userResponse = await axios.get(userTokenExchangeUrl);
    const longLivedUserToken = userResponse.data.access_token;

    // 2. Get all connected Pages using the Long-Lived User Token
    const pagesUrl = `${GRAPH_API_BASE_URL}me/accounts?access_token=${longLivedUserToken}`;
    const pagesResponse = await axios.get(pagesUrl);
    const pages = pagesResponse.data.data;

    if (!pages || pages.length === 0) {
        throw new Error("No Facebook Pages found for this user.");
    }

    const pagePromises = pages.map(async (page: any) => {
        // 3. Exchange Page Access Token (if necessary, though often provided directly)
        // For simplicity, we assume the 'access_token' in the page object is the page token.
        const pageAccessToken = page.access_token;
        
        // 4. Subscribe Webhooks for the page
        await subscribeWebhook(page.id, pageAccessToken);

        return {
            id: page.id,
            name: page.name,
            accessToken: pageAccessToken,
            isActive: true
        };
    });

    const connectedPages = await Promise.all(pagePromises);
    return connectedPages;
}

/**
 * Subscribes the given Page ID to necessary webhooks.
 * @param pageId The ID of the Facebook Page.
 * @param pageAccessToken The access token for the page.
 */
async function subscribeWebhook(pageId: string, pageAccessToken: string): Promise<void> {
    const webhookUrl = process.env.FRONTEND_URL || 'http://localhost:3000/api/webhook'; // Use actual frontend URL
    const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;

    if (!verifyToken) {
        console.warn("FACEBOOK_VERIFY_TOKEN is not set. Skipping webhook subscription.");
        return;
    }

    const subscribeUrl = `${GRAPH_API_BASE_URL}${pageId}/subscribed?access_token=${pageAccessToken}`;
    const payload = new URLSearchParams();
    payload.append('fields', 'field'); // Required field
    payload.append('object', 'page'); // Object type
    payload.append('changes', 'messages,messaging_postbacks'); // Events to subscribe to

    try {
        await axios.post(subscribeUrl, payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${pageAccessToken}`
            }
        });
        console.log(`Successfully subscribed webhook for Page ID: ${pageId}`);
    } catch (error) {
        console.error(`Error subscribing webhook for Page ID ${pageId}:`, error.response?.data || error.message);
        throw new Error(`Failed to subscribe webhook for ${pageId}. Check permissions.`);
    }
}


/**
 * API Endpoint to connect Facebook Pages.
 * Expects userAccessToken in the request body.
 */
export const connectFacebookPages = async (req: Request, res: Response, next: NextFunction) => {
    const { userAccessToken }: { userAccessToken: string } = req.body;

    if (!userAccessToken) {
        return res.status(400).json({ success: false, message: "Missing userAccessToken." });
    }

    try {
        // 1. Exchange tokens and get connected pages
        const connectedPages = await exchangeTokens(
            userAccessToken,
            process.env.FACEBOOK_APP_ID!,
            process.env.FACEBOOK_APP_SECRET!
        );

        // 2. Save/Update pages in the database
        const savedPages = await prisma.facebookPage.createMany({
            data: connectedPages.map(page => ({
                id: page.id,
                name: page.name,
                accessToken: page.accessToken,
                isActive: page.isActive
            })),
            skipDuplicates: true, // Prevent errors if running multiple times
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully connected ${savedPages.count} Facebook Pages.`,
            pages: connectedPages
        });

    } catch (error) {
        console.error("Error connecting Facebook Pages:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during Facebook connection.";
        res.status(500).json({ success: false, message: `Failed to connect Facebook Pages: ${errorMessage}` });
    }
};