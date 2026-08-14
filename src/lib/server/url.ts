// Comparing the resolved origin, rather than enumerating bad prefixes (`//`, `\`, ...), is what
// actually defeats an open redirect: a prefix denylist misses variants like a leading backslash,
// which browsers normalise to `//evil.com` for special schemes even though it "starts with /".
//
// Shared by every route that trusts a caller-supplied redirect target (theme toggle, login) so
// the origin check has exactly one implementation.
export function isSameOrigin(target: string, origin: string): boolean {
	try {
		return new URL(target, origin).origin === origin;
	} catch {
		return false;
	}
}
