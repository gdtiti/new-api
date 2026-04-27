package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func seedSubscriptionTestUser(t *testing.T, id int, group string) {
	t.Helper()
	user := &User{
		Id:       id,
		Username: fmt.Sprintf("subscription_user_%d", id),
		Group:    group,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
}

func seedSubscriptionPlan(t *testing.T, plan *SubscriptionPlan) {
	t.Helper()
	require.NoError(t, DB.Create(plan).Error)
}

func TestCreateUserSubscriptionFromPlanTx_QueuesSamePlanContinuation(t *testing.T) {
	truncateTables(t)
	seedSubscriptionTestUser(t, 2001, "default")

	plan := &SubscriptionPlan{
		Title:             "续接套餐",
		DurationUnit:      SubscriptionDurationDay,
		DurationValue:     30,
		AllowStacking:     true,
		AllowContinuation: true,
		ActivationMode:    SubscriptionActivationModeConcurrent,
		TotalAmount:       1000,
	}
	seedSubscriptionPlan(t, plan)

	var firstSub *UserSubscription
	var secondSub *UserSubscription
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		firstSub, err = CreateUserSubscriptionFromPlanTx(tx, 2001, plan, "test")
		if err != nil {
			return err
		}
		secondSub, err = CreateUserSubscriptionFromPlanTx(tx, 2001, plan, "test")
		return err
	})
	require.NoError(t, err)
	require.NotNil(t, firstSub)
	require.NotNil(t, secondSub)
	assert.Equal(t, SubscriptionStatusActive, firstSub.Status)
	assert.Equal(t, SubscriptionStatusQueued, secondSub.Status)
	assert.Equal(t, firstSub.EndTime, secondSub.StartTime)
	assert.Equal(t, firstSub.Id, secondSub.PreviousSubscriptionId)
}

func TestCreateUserSubscriptionFromPlanTx_DependentRequiresAnchor(t *testing.T) {
	truncateTables(t)
	seedSubscriptionTestUser(t, 2002, "default")

	plan := &SubscriptionPlan{
		Title:             "附属套餐",
		DurationUnit:      SubscriptionDurationDay,
		DurationValue:     7,
		AllowStacking:     true,
		AllowContinuation: true,
		ActivationMode:    SubscriptionActivationModeDependent,
		TotalAmount:       500,
	}
	seedSubscriptionPlan(t, plan)

	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := CreateUserSubscriptionFromPlanTx(tx, 2002, plan, "test")
		return err
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "需要与其它套餐一起生效")
}

func TestAdminUpdateUserSubscriptionTime_RequeuesAndDowngradesGroup(t *testing.T) {
	truncateTables(t)
	seedSubscriptionTestUser(t, 2003, "default")

	plan := &SubscriptionPlan{
		Title:             "升级套餐",
		DurationUnit:      SubscriptionDurationDay,
		DurationValue:     30,
		AllowStacking:     false,
		AllowContinuation: true,
		ActivationMode:    SubscriptionActivationModeStandalone,
		UpgradeGroup:      "pro",
		TotalAmount:       1000,
	}
	seedSubscriptionPlan(t, plan)

	var sub *UserSubscription
	err := DB.Transaction(func(tx *gorm.DB) error {
		var innerErr error
		sub, innerErr = CreateUserSubscriptionFromPlanTx(tx, 2003, plan, "test")
		return innerErr
	})
	require.NoError(t, err)
	require.NotNil(t, sub)
	assert.Equal(t, SubscriptionStatusActive, sub.Status)

	groupBefore, err := getUserGroupByIdTx(nil, 2003)
	require.NoError(t, err)
	assert.Equal(t, "pro", groupBefore)

	now := GetDBTimestamp()
	msg, err := AdminUpdateUserSubscriptionTime(sub.Id, now+3600, now+7200)
	require.NoError(t, err)
	assert.Contains(t, msg, "将于")

	var reloaded UserSubscription
	require.NoError(t, DB.Where("id = ?", sub.Id).First(&reloaded).Error)
	assert.Equal(t, SubscriptionStatusQueued, reloaded.Status)

	groupAfter, err := getUserGroupByIdTx(nil, 2003)
	require.NoError(t, err)
	assert.Equal(t, "default", groupAfter)
}

func TestSyncOpenUserSubscriptionsWithPlan_AllowsEditedPlanOverlap(t *testing.T) {
	truncateTables(t)
	seedSubscriptionTestUser(t, 2004, "default")

	plan := &SubscriptionPlan{
		Title:             "旧独占套餐",
		DurationUnit:      SubscriptionDurationDay,
		DurationValue:     30,
		AllowStacking:     false,
		AllowContinuation: true,
		ActivationMode:    SubscriptionActivationModeStandalone,
		TotalAmount:       1000,
	}
	seedSubscriptionPlan(t, plan)

	var activeSub *UserSubscription
	err := DB.Transaction(func(tx *gorm.DB) error {
		var innerErr error
		activeSub, innerErr = CreateUserSubscriptionFromPlanTx(tx, 2004, plan, "test")
		return innerErr
	})
	require.NoError(t, err)
	require.NotNil(t, activeSub)

	now := GetDBTimestamp()
	queuedSub := &UserSubscription{
		UserId:                 2004,
		PlanId:                 plan.Id,
		AmountTotal:            plan.TotalAmount,
		AmountUsed:             0,
		DurationUnit:           plan.DurationUnit,
		DurationValue:          plan.DurationValue,
		QuotaResetPeriod:       SubscriptionResetNever,
		AllowStacking:          false,
		AllowContinuation:      true,
		ActivationMode:         SubscriptionActivationModeStandalone,
		PreviousSubscriptionId: activeSub.Id,
		StartTime:              now - 10,
		EndTime:                now + int64(24*time.Hour/time.Second),
		Status:                 SubscriptionStatusQueued,
		Source:                 "test",
	}
	require.NoError(t, DB.Create(queuedSub).Error)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return refreshUserSubscriptionsTx(tx, 2004, now)
	}))
	var blocked UserSubscription
	require.NoError(t, DB.Where("id = ?", queuedSub.Id).First(&blocked).Error)
	assert.Equal(t, SubscriptionStatusQueued, blocked.Status)

	plan.AllowStacking = true
	plan.ActivationMode = SubscriptionActivationModeConcurrent
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		_, err := SyncOpenUserSubscriptionsWithPlanTx(tx, plan, now)
		return err
	}))

	var reloaded UserSubscription
	require.NoError(t, DB.Where("id = ?", queuedSub.Id).First(&reloaded).Error)
	assert.Equal(t, SubscriptionStatusActive, reloaded.Status)
	assert.True(t, reloaded.AllowStacking)
	assert.Equal(t, SubscriptionActivationModeConcurrent, reloaded.ActivationMode)
}

func TestResetDueSubscriptions_UsesEditedPlanQuotaAndResetPeriod(t *testing.T) {
	truncateTables(t)
	seedSubscriptionTestUser(t, 2005, "default")

	plan := &SubscriptionPlan{
		Title:                   "重置套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		AllowStacking:           true,
		AllowContinuation:       true,
		ActivationMode:          SubscriptionActivationModeConcurrent,
		TotalAmount:             1000,
		QuotaResetPeriod:        SubscriptionResetNever,
		QuotaResetCustomSeconds: 0,
	}
	seedSubscriptionPlan(t, plan)

	var sub *UserSubscription
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var innerErr error
		sub, innerErr = CreateUserSubscriptionFromPlanTx(tx, 2005, plan, "test")
		return innerErr
	}))
	require.NotNil(t, sub)

	now := GetDBTimestamp()
	require.NoError(t, DB.Model(plan).Updates(map[string]interface{}{
		"total_amount":               int64(2000),
		"quota_reset_period":         SubscriptionResetCustom,
		"quota_reset_custom_seconds": int64(3600),
	}).Error)
	InvalidateSubscriptionPlanCache(plan.Id)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", sub.Id).Updates(map[string]interface{}{
		"amount_total":               int64(1000),
		"amount_used":                int64(800),
		"quota_reset_period":         SubscriptionResetCustom,
		"quota_reset_custom_seconds": int64(3600),
		"last_reset_time":            now - 7200,
		"next_reset_time":            now - 3600,
	}).Error)

	resetCount, err := ResetDueSubscriptions(10)
	require.NoError(t, err)
	assert.Equal(t, 1, resetCount)

	var reloaded UserSubscription
	require.NoError(t, DB.Where("id = ?", sub.Id).First(&reloaded).Error)
	assert.EqualValues(t, 2000, reloaded.AmountTotal)
	assert.EqualValues(t, 0, reloaded.AmountUsed)
	assert.Greater(t, reloaded.LastResetTime, now-7200)
	assert.Greater(t, reloaded.NextResetTime, now)
}

var _ = gorm.ErrRecordNotFound
