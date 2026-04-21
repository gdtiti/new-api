package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedQuotaTestUser(t *testing.T, id int) {
	t.Helper()
	user := &User{
		Id:       id,
		Username: fmt.Sprintf("quota_user_%d", id),
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
}

func TestConsumeUserQuota_PrioritizesEarlierExpiry(t *testing.T) {
	truncateTables(t)
	seedQuotaTestUser(t, 1001)

	now := common.GetTimestamp()
	require.NoError(t, GrantUserQuota(1001, 100, now+3600, UserQuotaGrantSourceAdmin, "first"))
	require.NoError(t, GrantUserQuota(1001, 200, now+7200, UserQuotaGrantSourceAdmin, "second"))
	require.NoError(t, GrantUserQuota(1001, 300, 0, UserQuotaGrantSourceAdmin, "permanent"))

	allocations, err := ConsumeUserQuota(1001, 250)
	require.NoError(t, err)
	require.Len(t, allocations, 2)
	assert.Equal(t, 100, allocations[0].Amount)
	assert.Equal(t, 150, allocations[1].Amount)

	var grants []UserQuotaGrant
	require.NoError(t, DB.Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 3)
	assert.Equal(t, 0, grants[0].RemainingAmount)
	assert.Equal(t, UserQuotaGrantStatusExhausted, grants[0].Status)
	assert.Equal(t, 50, grants[1].RemainingAmount)
	assert.Equal(t, UserQuotaGrantStatusActive, grants[1].Status)
	assert.Equal(t, 300, grants[2].RemainingAmount)

	quota, err := GetUserQuota(1001, true)
	require.NoError(t, err)
	assert.Equal(t, 350, quota)
}

func TestRestoreUserQuotaAllocations_RestoresOriginalGrant(t *testing.T) {
	truncateTables(t)
	seedQuotaTestUser(t, 1002)

	now := common.GetTimestamp()
	require.NoError(t, GrantUserQuota(1002, 120, now+3600, UserQuotaGrantSourceAdmin, "expiring"))
	require.NoError(t, GrantUserQuota(1002, 300, 0, UserQuotaGrantSourceAdmin, "permanent"))

	allocations, err := ConsumeUserQuota(1002, 180)
	require.NoError(t, err)
	restored, err := RestoreUserQuotaAllocations(1002, allocations)
	require.NoError(t, err)
	assert.Equal(t, 180, restored)

	var grants []UserQuotaGrant
	require.NoError(t, DB.Order("id asc").Find(&grants).Error)
	require.Len(t, grants, 2)
	assert.Equal(t, 120, grants[0].RemainingAmount)
	assert.Equal(t, 300, grants[1].RemainingAmount)

	quota, err := GetUserQuota(1002, true)
	require.NoError(t, err)
	assert.Equal(t, 420, quota)
}

func TestGetUserQuota_ExpiresGrantAndSyncsAggregate(t *testing.T) {
	truncateTables(t)
	seedQuotaTestUser(t, 1003)

	now := common.GetTimestamp()
	require.NoError(t, GrantUserQuota(1003, 150, now+3600, UserQuotaGrantSourceAdmin, "will-expire"))
	require.NoError(t, GrantUserQuota(1003, 250, 0, UserQuotaGrantSourceAdmin, "stable"))

	var grant UserQuotaGrant
	require.NoError(t, DB.Where("user_id = ? AND expire_at > 0", 1003).First(&grant).Error)
	require.NoError(t, DB.Model(&UserQuotaGrant{}).Where("id = ?", grant.Id).Update("expire_at", now-1).Error)

	quota, err := GetUserQuota(1003, true)
	require.NoError(t, err)
	assert.Equal(t, 250, quota)

	require.NoError(t, DB.First(&grant, grant.Id).Error)
	assert.Equal(t, UserQuotaGrantStatusExpired, grant.Status)
}
