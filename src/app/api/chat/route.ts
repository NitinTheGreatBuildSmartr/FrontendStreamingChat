import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "edge"; // CRITICAL: Use edge runtime for true streaming

export async function POST(request: Request) {
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
        return new Response("Missing message", { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return new Response("GEMINI_API_KEY not configured", { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Create encoder for text chunks
    const encoder = new TextEncoder();

    // Create ReadableStream that forwards Gemini chunks immediately
    const stream = new ReadableStream({
        async start(controller) {
            try {
                // CRITICAL: Use streaming API - NOT generateContent()
                const result = await model.generateContentStream(message);

                // Forward each chunk as it arrives - NO buffering
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    if (text) {
                        // Send SSE-formatted data
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                    }
                }

                // Terminal signal
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
                controller.close();
            }
        },
        cancel() {
            // Client disconnected - Gemini stream will be garbage collected
            console.log("Client disconnected, stream cancelled");
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no", // Disable nginx buffering
        },
    });
}
