import { jsonLdScriptProps, type JsonLdData } from "@/lib/jsonLd";

/** Structured data for search engines (schema.org). User text is escaped in serializeJsonLd. */
export function JsonLd({ data }: { data: JsonLdData }) {
  return <script {...jsonLdScriptProps(data)} />;
}
