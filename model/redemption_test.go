package model

import (
	"strconv"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedeemQuotaSingleUse(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)

	require.NoError(t, db.AutoMigrate(&User{}, &Redemption{}, &RedemptionUsage{}, &Log{}))

	user := &User{Username: "quota_user", Password: "hashedpass", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "quota", AffCode: "aq01"}
	require.NoError(t, db.Create(user).Error)

	redemption := &Redemption{
		UserId:         user.Id,
		Key:            "quota-single-use",
		Status:         common.RedemptionCodeStatusEnabled,
		Name:           "quota",
		Quota:          1200,
		GrantType:      common.RedemptionGrantTypeQuota,
		MaxRedeemCount: 1,
		CreatedTime:    time.Now().Unix(),
	}
	require.NoError(t, db.Create(redemption).Error)

	result, err := Redeem(redemption.Key, user.Id)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, common.RedemptionGrantTypeQuota, result.GrantType)
	assert.Equal(t, 1200, result.Quota)
	assert.Equal(t, 1, result.RedeemedCount)

	var refreshedUser User
	require.NoError(t, db.Select("quota").Where("id = ?", user.Id).First(&refreshedUser).Error)
	assert.Equal(t, 1200, refreshedUser.Quota)

	var refreshedRedemption Redemption
	require.NoError(t, db.Where("id = ?", redemption.Id).First(&refreshedRedemption).Error)
	assert.Equal(t, 1, refreshedRedemption.RedeemedCount)
	assert.Equal(t, common.RedemptionCodeStatusUsed, refreshedRedemption.Status)
}

func TestRedeemSubscriptionGrant(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)

	require.NoError(t, db.AutoMigrate(&User{}, &Redemption{}, &RedemptionUsage{}, &SubscriptionPlan{}, &UserSubscription{}, &Log{}))

	user := &User{Username: "sub_user", Password: "hashedpass", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "sub", AffCode: "as01"}
	require.NoError(t, db.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "Starter",
		PriceAmount:   0,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationDay,
		DurationValue: 30,
		Enabled:       true,
		CreatedAt:     time.Now().Unix(),
		UpdatedAt:     time.Now().Unix(),
	}
	require.NoError(t, db.Create(plan).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	redemption := &Redemption{
		UserId:             user.Id,
		Key:                "sub-grant",
		Status:             common.RedemptionCodeStatusEnabled,
		Name:               "sub",
		GrantType:          common.RedemptionGrantTypeSubscription,
		SubscriptionPlanId: plan.Id,
		MaxRedeemCount:     2,
		CreatedTime:        time.Now().Unix(),
	}
	require.NoError(t, db.Create(redemption).Error)

	result, err := Redeem(redemption.Key, user.Id)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, common.RedemptionGrantTypeSubscription, result.GrantType)
	assert.Equal(t, plan.Id, result.SubscriptionPlanId)
	assert.Equal(t, plan.Title, result.SubscriptionPlanTitle)
	assert.NotZero(t, result.GrantedSubscriptionId)

	var usage RedemptionUsage
	require.NoError(t, db.Where("redemption_id = ? AND user_id = ?", redemption.Id, user.Id).First(&usage).Error)
	assert.Equal(t, plan.Id, usage.SubscriptionPlanId)
	assert.Equal(t, result.GrantedSubscriptionId, usage.GrantedSubscriptionId)

	var sub UserSubscription
	require.NoError(t, db.Where("id = ?", result.GrantedSubscriptionId).First(&sub).Error)
	assert.Equal(t, plan.Id, sub.PlanId)
	assert.Equal(t, "redemption", sub.Source)
	assert.Equal(t, "redemption:"+strconv.Itoa(redemption.Id)+":user:"+strconv.Itoa(user.Id), sub.GrantKey)
}

func TestRedeemRespectsMaxCountAndRejectsDuplicateUser(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)

	require.NoError(t, db.AutoMigrate(&User{}, &Redemption{}, &RedemptionUsage{}, &Log{}))

	user1 := &User{Username: "dup_user_1", Password: "hashedpass", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "dup1", AffCode: "ad01"}
	user2 := &User{Username: "dup_user_2", Password: "hashedpass", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "dup2", AffCode: "ad02"}
	user3 := &User{Username: "dup_user_3", Password: "hashedpass", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "dup3", AffCode: "ad03"}
	require.NoError(t, db.Create(user1).Error)
	require.NoError(t, db.Create(user2).Error)
	require.NoError(t, db.Create(user3).Error)

	redemption := &Redemption{
		UserId:         user1.Id,
		Key:            "quota-multi",
		Status:         common.RedemptionCodeStatusEnabled,
		Name:           "quota_multi",
		Quota:          600,
		GrantType:      common.RedemptionGrantTypeQuota,
		MaxRedeemCount: 2,
		CreatedTime:    time.Now().Unix(),
	}
	require.NoError(t, db.Create(redemption).Error)

	_, err := Redeem(redemption.Key, user1.Id)
	require.NoError(t, err)

	_, err = Redeem(redemption.Key, user1.Id)
	require.Error(t, err)
	assert.EqualError(t, err, "你已兑换过该兑换码")

	_, err = Redeem(redemption.Key, user2.Id)
	require.NoError(t, err)

	_, err = Redeem(redemption.Key, user3.Id)
	require.Error(t, err)
	assert.EqualError(t, err, "该兑换码已达最大兑换次数")

	var refreshedRedemption Redemption
	require.NoError(t, db.Where("id = ?", redemption.Id).First(&refreshedRedemption).Error)
	assert.Equal(t, 2, refreshedRedemption.RedeemedCount)
	assert.Equal(t, common.RedemptionCodeStatusUsed, refreshedRedemption.Status)
}
