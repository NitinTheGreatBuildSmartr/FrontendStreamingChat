"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmedInput = input.trim();
        if (!trimmedInput || isStreaming) return;

        // Add user message
        const userMessage: Message = { role: "user", content: trimmedInput };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsStreaming(true);

        // Add empty assistant message that will be streamed into
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        try {
            // CRITICAL: Use plain fetch - NOT Axios
            const response = await fetch("http://localhost:8000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: trimmedInput }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // CRITICAL: Get the ReadableStream from response body
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            // Read stream chunk by chunk - NO waiting for full response
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE messages
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || ""; // Keep incomplete message in buffer

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);

                        // Check for terminal signal
                        if (data === "[DONE]") {
                            break;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.text) {
                                // Append text immediately - NO artificial delays
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    const lastMessage = updated[updated.length - 1];
                                    if (lastMessage.role === "assistant") {
                                        lastMessage.content += parsed.text;
                                    }
                                    return updated;
                                });
                            } else if (parsed.error) {
                                console.error("Stream error:", parsed.error);
                            }
                        } catch {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setMessages((prev) => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage.role === "assistant") {
                    lastMessage.content = "Error: Failed to get response. Check console.";
                }
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    }

    return (
        <div className="chat-container">
            <header className="chat-header">
                <h1>Gemini Streaming Chat</h1>

            </header>

            <div className="messages-container">
                {messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.role}`}>
                        <div className="avatar">
                            {msg.role === "user" ? "👤" : "✨"}
                        </div>
                        <div className="bubble">
                            {msg.content}
                            {msg.role === "assistant" && isStreaming && i === messages.length - 1 && (
                                <span className="streaming-cursor" />
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
                <form onSubmit={handleSubmit} className="input-wrapper">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        disabled={isStreaming}
                    />
                    <button type="submit" className="send-button" disabled={isStreaming || !input.trim()}>
                        {isStreaming ? "Streaming..." : "Send"}
                        {!isStreaming && (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                            </svg>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
