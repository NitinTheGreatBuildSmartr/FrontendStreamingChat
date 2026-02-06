import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Gemini Streaming Chat",
    description: "Real-time streaming chat with Gemini",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
