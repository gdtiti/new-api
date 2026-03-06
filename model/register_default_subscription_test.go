package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestGrantRegisterDefaultSubscription(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false

	require.NoError(t, db.AutoMigrate(&User{}, &SubscriptionPlan{}, &UserSubscription{}, &Log{}))

	user := &User{Username: "u1", Password: "hashed", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "u1"}
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

	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
	})

	granted, msg, err := GrantRegisterDefaultSubscription(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "created", granted)
	assert.Empty(t, msg)

	var count int64
	require.NoError(t, db.Model(&UserSubscription{}).Where("user_id = ? AND grant_key = ?", user.Id, "register_default").Count(&count).Error)
	assert.EqualValues(t, 1, count)

	granted, msg, err = GrantRegisterDefaultSubscription(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "already_exists", granted)
	assert.Empty(t, msg)
	require.NoError(t, db.Model(&UserSubscription{}).Where("user_id = ? AND grant_key = ?", user.Id, "register_default").Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestGrantRegisterDefaultSubscriptionDisabledPlan(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false

	require.NoError(t, db.AutoMigrate(&User{}, &SubscriptionPlan{}, &UserSubscription{}, &Log{}))

	user := &User{Username: "u2", Password: "hashed", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "u2"}
	require.NoError(t, db.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "Disabled",
		PriceAmount:   0,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationDay,
		DurationValue: 30,
		Enabled:       true,
		CreatedAt:     time.Now().Unix(),
		UpdatedAt:     time.Now().Unix(),
	}
	require.NoError(t, db.Create(plan).Error)
	require.NoError(t, db.Model(&SubscriptionPlan{}).Where("id = ?", plan.Id).Update("enabled", false).Error)
	InvalidateSubscriptionPlanCache(plan.Id)

	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
	})

	granted, _, err := GrantRegisterDefaultSubscription(user.Id)
	assert.Error(t, err)
	assert.Equal(t, "failed", granted)
}

func TestFinalizeOAuthUserCreationGrantsDefaultSubscription(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false

	require.NoError(t, db.AutoMigrate(&User{}, &SubscriptionPlan{}, &UserSubscription{}, &Log{}))

	user := &User{Username: "oauth_u1", Password: "hashed", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "oauth_u1"}
	require.NoError(t, db.Create(user).Error)

	plan := &SubscriptionPlan{
		Title:         "OAuth Starter",
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

	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
	})

	user.FinalizeOAuthUserCreation(0)

	var count int64
	require.NoError(t, db.Model(&UserSubscription{}).Where("user_id = ? AND grant_key = ?", user.Id, "register_default").Count(&count).Error)
	assert.EqualValues(t, 1, count)
}
