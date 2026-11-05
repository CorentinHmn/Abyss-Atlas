import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // @atlas/core ships TypeScript sources; Next.js compiles them.
  transpilePackages: ["@atlas/core"],
};

export default withNextIntl(nextConfig);
