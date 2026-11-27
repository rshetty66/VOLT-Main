/** Answer lists shared by the scope (shared/scope.ts) and the goal catalog (shared/goalTypes.ts). */
export const RECOMMEND = "recommend";
export const CLIENT_TYPES: Record<string, string> = { bank: "Bank", insurer: "Insurer", credit_union: "Credit union", pension: "Pension fund", asset_manager: "Asset manager", other_fs: "Other FS", outside_fs: "Outside FS" };
export const BASES: Record<string, string> = { ifrs: "IFRS", us_gaap: "US GAAP", local: "Local or statutory", regulatory: "Regulatory returns", [RECOMMEND]: "Not sure, recommend" };
