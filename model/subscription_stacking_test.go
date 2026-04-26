package model

import (
	"fmt"
	"testing"

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

var _ = gorm.ErrRecordNotFound
