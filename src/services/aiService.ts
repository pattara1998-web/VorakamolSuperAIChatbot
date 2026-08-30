import { PrismaClient, Product } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

/**
 * Fetches product context for a given Facebook Page ID.
 * @param pageId The ID of the Facebook Page.
 * @returns A promise that resolves with an array of Product objects.
 */
async function getProductContext(pageId: string): Promise<Product[]> {
    console.log(`Fetching product context for Page ID: ${pageId}...`);
    try {
        const products = await prisma.product.findMany({
            where: {
                pageId: pageId,
            },
            select: {
                name: true,
                description: true,
                price: true,
            },
            orderBy: {
                name: 'asc',
            }
        });
        return products;
    } catch (error) {
        console.error("Error fetching product context:", error);
        throw new Error("Failed to retrieve product context from the database.");
    }
}

/**
 * Generates a bot reply using the Gemini API, incorporating product context.
 * @param pageId The ID of the Facebook Page.
 * @param customerMessage The message received from the customer.
 * @returns A promise that resolves with the generated bot reply text.
 */
export async function generateBotReply(pageId: string, customerMessage: string): Promise<string> {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }

    // 1. Fetch Product Context
    const products = await getProductContext(pageId);

    // 2. Build Context String
    let contextString = "";
    if (products.length > 0) {
        contextString = "--- Product Catalog Context ---\n";
        products.forEach((product, index) => {
            contextString += `[${index + 1}] Name: ${product.name}\n`;
            contextString += `    Description: ${product.description || 'No description available.'}\n`;
            contextString += `    Price: ${product.price.toFixed(2)} THB\n`;
        });
        contextString += "------------------------------\n";
    } else {
        contextString = "--- Product Catalog Context ---\nNo product context available for this page.\n------------------------------\n";
    }

    // 3. Construct the Prompt
    const systemInstruction = "You are a friendly and professional customer service chatbot for a retail business. Your goal is to answer customer questions accurately, using the provided Product Catalog Context. If the question relates to a product, use the context. If the question is general, answer politely. Keep the tone helpful and concise. Always respond in Thai.";
    
    const userPrompt = `
    [CONTEXT]:
    ${contextString}

    [CUSTOMER QUESTION]:
    ${customerMessage}

    Based on the context and the question, please provide a helpful and complete reply.
    `;

    console.log("Sending request to Gemini API...");

    // 4. Call Gemini API (Using a placeholder structure for demonstration)
    const geminiUrl = `https://api.gemini.google.com/v1/models/gemini-pro:generateContent?key=${geminiApiKey}`;
    
    try {
        const response = await axios.post(geminiUrl, {
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: {
                systemInstruction: systemInstruction
            }
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Assuming the response structure contains the generated text
        const reply = response.data.candidates[0].content.parts[0].text;
        return reply;

    } catch (error) {
        console.error("Error calling Gemini API:", error.response?.data || error.message);
        throw new Error("Failed to generate bot reply. Please check GEMINI_API_KEY and API connectivity.");
    }
}