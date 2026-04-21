package middleware

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

func TestResolveTokenUsingGroupWithRecheckAllowsAfterDBRecheck(t *testing.T) {
	configureTokenGroupTestSettings(t,
		map[string]string{"default": "默认分组", "vip": "vip分组"},
		map[string]float64{"default": 1, "vip": 1, "pro": 1},
	)

	recheckCalls := 0
	resolution, rechecked, err := resolveTokenUsingGroupWithRecheck("svip", "pro", func() (string, string, error) {
		recheckCalls++
		return "pro", "pro", nil
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if !rechecked {
		t.Fatal("expected recheck to run")
	}
	if recheckCalls != 1 {
		t.Fatalf("expected recheck to run once, got %d", recheckCalls)
	}
	if !resolution.allowed() {
		t.Fatalf("expected resolution to allow access, got deny=%s", resolution.denyMessage)
	}
	if resolution.usingGroup != "pro" {
		t.Fatalf("expected using group pro, got %s", resolution.usingGroup)
	}
}

func TestResolveTokenUsingGroupWithRecheckKeepsRealDeny(t *testing.T) {
	configureTokenGroupTestSettings(t,
		map[string]string{"default": "默认分组", "vip": "vip分组"},
		map[string]float64{"default": 1, "vip": 1, "pro": 1},
	)

	recheckCalls := 0
	resolution, rechecked, err := resolveTokenUsingGroupWithRecheck("svip", "pro", func() (string, string, error) {
		recheckCalls++
		return "svip", "pro", nil
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if !rechecked {
		t.Fatal("expected recheck to run")
	}
	if recheckCalls != 1 {
		t.Fatalf("expected recheck to run once, got %d", recheckCalls)
	}
	if resolution.allowed() {
		t.Fatal("expected resolution to deny access")
	}
	if resolution.denyReason != tokenGroupDeniedReasonForbidden {
		t.Fatalf("expected forbidden deny reason, got %s", resolution.denyReason)
	}
}

func TestResolveTokenUsingGroupWithRecheckPreservesFastPath(t *testing.T) {
	configureTokenGroupTestSettings(t,
		map[string]string{"default": "默认分组", "vip": "vip分组"},
		map[string]float64{"default": 1, "vip": 1, "pro": 1},
	)

	recheckCalls := 0
	resolution, rechecked, err := resolveTokenUsingGroupWithRecheck("pro", "pro", func() (string, string, error) {
		recheckCalls++
		return "ignored", "ignored", nil
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if rechecked {
		t.Fatal("expected fast path without recheck")
	}
	if recheckCalls != 0 {
		t.Fatalf("expected no recheck calls, got %d", recheckCalls)
	}
	if !resolution.allowed() {
		t.Fatalf("expected resolution to allow access, got deny=%s", resolution.denyMessage)
	}
}

func TestResolveTokenUsingGroupWithRecheckSkipsAutoGroup(t *testing.T) {
	configureTokenGroupTestSettings(t,
		map[string]string{"default": "默认分组", "vip": "vip分组"},
		map[string]float64{"default": 1, "vip": 1, "auto": 1},
	)

	recheckCalls := 0
	resolution, rechecked, err := resolveTokenUsingGroupWithRecheck("svip", "auto", func() (string, string, error) {
		recheckCalls++
		return "pro", "pro", nil
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if rechecked {
		t.Fatal("expected auto group to skip recheck")
	}
	if recheckCalls != 0 {
		t.Fatalf("expected no recheck calls, got %d", recheckCalls)
	}
	if resolution.allowed() {
		t.Fatal("expected auto group to preserve current deny result in this helper")
	}
	if resolution.denyReason != tokenGroupDeniedReasonForbidden {
		t.Fatalf("expected forbidden deny reason, got %s", resolution.denyReason)
	}
}

func TestResolveTokenUsingGroupWithRecheckReturnsRecheckError(t *testing.T) {
	configureTokenGroupTestSettings(t,
		map[string]string{"default": "默认分组", "vip": "vip分组"},
		map[string]float64{"default": 1, "vip": 1, "pro": 1},
	)

	wantErr := errors.New("db down")
	_, rechecked, err := resolveTokenUsingGroupWithRecheck("svip", "pro", func() (string, string, error) {
		return "", "", wantErr
	})
	if !rechecked {
		t.Fatal("expected recheck to run")
	}
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected %v, got %v", wantErr, err)
	}
}

func configureTokenGroupTestSettings(t *testing.T, usableGroups map[string]string, groupRatios map[string]float64) {
	t.Helper()

	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()

	t.Cleanup(func() {
		if err := setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups); err != nil {
			t.Fatalf("restore usable groups failed: %v", err)
		}
		if err := ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios); err != nil {
			t.Fatalf("restore group ratios failed: %v", err)
		}
	})

	usableGroupsJSON := mustJSONString(t, usableGroups)
	if err := setting.UpdateUserUsableGroupsByJSONString(usableGroupsJSON); err != nil {
		t.Fatalf("update usable groups failed: %v", err)
	}
	groupRatiosJSON := mustJSONString(t, groupRatios)
	if err := ratio_setting.UpdateGroupRatioByJSONString(groupRatiosJSON); err != nil {
		t.Fatalf("update group ratios failed: %v", err)
	}
}

func mustJSONString(t *testing.T, value any) string {
	t.Helper()

	data, err := common.Marshal(value)
	if err != nil {
		t.Fatalf("marshal test value failed: %v", err)
	}
	return string(data)
}
