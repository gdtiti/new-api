package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedeemQuotaCode_ReturnsWalletDelta(t *testing.T) {
	truncateTables(t)
	seedQuotaTestUser(t, 3001)

	redemption := &Redemption{
		UserId:      1,
		Key:         "quota-code",
		Status:      common.RedemptionCodeStatusEnabled,
		Name:        "额度兑换码",
		RewardType:  RedemptionRewardTypeQuota,
		Quota:       500,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, redemption.Insert())

	result, err := Redeem("quota-code", 3001)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, RedemptionRewardTypeQuota, result.RewardType)
	assert.Equal(t, 500, result.Quota)
	assert.Equal(t, 500, result.WalletQuotaDelta)

	quota, err := GetUserQuota(3001, true)
	require.NoError(t, err)
	assert.Equal(t, 500, quota)
}

func TestRedeemSubscriptionCode_CreatesSubscription(t *testing.T) {
	truncateTables(t)
	seedSubscriptionTestUser(t, 3002, "default")

	plan := &SubscriptionPlan{
		Title:             "兑换订阅",
		DurationUnit:      SubscriptionDurationDay,
		DurationValue:     3,
		AllowStacking:     true,
		AllowContinuation: true,
		ActivationMode:    SubscriptionActivationModeConcurrent,
		UpgradeGroup:      "pro",
		TotalAmount:       900,
	}
	seedSubscriptionPlan(t, plan)

	redemption := &Redemption{
		UserId:      1,
		Key:         "subscription-code",
		Status:      common.RedemptionCodeStatusEnabled,
		Name:        "订阅兑换码",
		RewardType:  RedemptionRewardTypeSubscription,
		PlanId:      plan.Id,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, redemption.Insert())

	result, err := Redeem("subscription-code", 3002)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, RedemptionRewardTypeSubscription, result.RewardType)
	require.NotNil(t, result.Subscription)
	assert.Equal(t, SubscriptionStatusActive, result.Subscription.Status)
	assert.Equal(t, plan.Id, result.PlanId)

	group, err := getUserGroupByIdTx(nil, 3002)
	require.NoError(t, err)
	assert.Equal(t, "pro", group)
}
