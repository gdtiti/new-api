package middleware

import "testing"

func TestResolveTokenUsingGroupFallsBackToUserGroupWhenTokenGroupEmpty(t *testing.T) {
	group, err := resolveTokenUsingGroup("default", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if group != "default" {
		t.Fatalf("expected default group, got %q", group)
	}
}

func TestResolveTokenUsingGroupAllowsAutoTokenGroup(t *testing.T) {
	group, err := resolveTokenUsingGroup("default", "auto")
	if err != nil {
		t.Fatalf("expected auto token group to be allowed, got %v", err)
	}
	if group != "auto" {
		t.Fatalf("expected auto group, got %q", group)
	}
}
