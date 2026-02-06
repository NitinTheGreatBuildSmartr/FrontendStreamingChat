/** @type {import('next').NextConfig} */
const nextConfig = {
    // CRITICAL: Disable response buffering for streaming
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
};

module.exports = nextConfig;
