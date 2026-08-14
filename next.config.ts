import type { NextConfig } from "next";

/**
 * W11: /data/*.gz are first-class gzip payloads. The browser gunzips them.
 * Hosts must not advertise Content-Encoding: gzip (that strips the payload
 * before JS runs). Do not enable vinext `precompress` for these files.
 */
const gzipPayloadHeaders = [
  { key: "Content-Type", value: "application/gzip" },
  { key: "Content-Encoding", value: "identity" },
  { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/data/:path*.gz",
        headers: gzipPayloadHeaders,
      },
    ];
  },
};

export default nextConfig;
