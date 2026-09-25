// Serialises schema.org data for an inline <script type="application/ld+json">.
//
// JSON.stringify alone is not safe inside HTML: a value such as
// "</script><script>…" closes the tag early. Characters the HTML parser (or old
// JavaScript engines) treat specially are written as JSON unicode escapes, so
// the output is still valid JSON that parses back to the original strings.
// They can only appear inside JSON strings, where \uXXXX escapes are legal.

export type JsonLdData = Record<string, unknown> | Record<string, unknown>[];

const UNSAFE = /[<>&\u2028\u2029]/g;

const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

export function serializeJsonLd(data: JsonLdData): string {
  return JSON.stringify(data).replace(UNSAFE, (char) => ESCAPES[char]);
}

/** Props for the JSON-LD <script> element; shared by the component and its tests. */
export function jsonLdScriptProps(data: JsonLdData) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: serializeJsonLd(data) },
  };
}
