import { getRequestConfig } from "next-intl/server";

// English only at launch; French and German come later (OOS-007). No locale routing yet.
export default getRequestConfig(async () => {
  const locale = "en";
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
