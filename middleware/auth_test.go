package middleware

import "testing"

func TestResolveTokenUsingGroupFallsBackToUserGroupWhenTokenGroupEmpty(t *testing.T) {
	resolution := resolveTokenUsingGroup("default", "")
	if !resolution.allowed() {
		t.Fatalf("expected no denial, got %q", resolution.denyMessage)
	}
	if resolution.usingGroup != "default" {
		t.Fatalf("expected default group, got %q", resolution.usingGroup)
	}
}

func TestResolveTokenUsingGroupAllowsAutoTokenGroup(t *testing.T) {
	resolution := resolveTokenUsingGroup("default", "auto")
	if !resolution.allowed() {
		t.Fatalf("expected auto token group to be allowed, got %q", resolution.denyMessage)
	}
	if resolution.usingGroup != "auto" {
		t.Fatalf("expected auto group, got %q", resolution.usingGroup)
	}
}
