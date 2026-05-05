// searchToolData lives in the agents package (Anthropic SDK domain).
// Workers import from here; the thin re-export keeps the cv-apis/ path
// consistent for the spec tests which mock at the module level.
export { searchToolData, type WebSearchResult } from "@agent12/agents";
