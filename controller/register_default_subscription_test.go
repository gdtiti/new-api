package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegisterDefaultSubscriptionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.LogConsumeEnabled = true
	common.EmailVerificationEnabled = false
	common.RegisterEnabled = true
	common.PasswordRegisterEnabled = true
	constant.GenerateDefaultToken = false
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.SubscriptionPlan{}, &model.UserSubscription{}, &model.Log{}, &model.Option{}))
	return db
}

func seedEnabledPlan(t *testing.T, db *gorm.DB) *model.SubscriptionPlan {
	t.Helper()
	plan := &model.SubscriptionPlan{
		Title:         "Starter",
		PriceAmount:   0,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationDay,
		DurationValue: 30,
		Enabled:       true,
		CreatedAt:     time.Now().Unix(),
		UpdatedAt:     time.Now().Unix(),
	}
	require.NoError(t, db.Create(plan).Error)
	model.InvalidateSubscriptionPlanCache(plan.Id)
	return plan
}

func makeRouterWithSession(handler gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	store := cookie.NewStore([]byte("test-secret"))
	r.Use(sessions.Sessions("session", store))
	r.POST("/test", handler)
	r.GET("/test", handler)
	return r
}

func TestRegisterGrantsDefaultSubscription(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)
	plan := seedEnabledPlan(t, db)
	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
	})

	r := makeRouterWithSession(Register)
	body := `{"username":"newuser01","password":"password123"}`
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool `json:"success"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success)

	var user model.User
	require.NoError(t, db.Where("username = ?", "newuser01").First(&user).Error)
	var count int64
	require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND grant_key = ?", user.Id, "register_default").Count(&count).Error)
	assert.EqualValues(t, 1, count)
	var selfSubs []model.SubscriptionSummary
	selfSubs, err := model.GetAllActiveUserSubscriptions(user.Id)
	require.NoError(t, err)
	assert.Len(t, selfSubs, 1)
	assert.Equal(t, plan.Id, selfSubs[0].Subscription.PlanId)
}

func TestWeChatAuthGrantsDefaultSubscriptionForNewUser(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)
	plan := seedEnabledPlan(t, db)
	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	common.WeChatAuthEnabled = true
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
		common.WeChatAuthEnabled = false
		getWeChatIdByCodeFunc = getWeChatIdByCode
	})
	getWeChatIdByCodeFunc = func(code string) (string, error) {
		return "wechat-open-id-1", nil
	}

	r := makeRouterWithSession(WeChatAuth)
	req := httptest.NewRequest(http.MethodGet, "/test?code=fake", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID int `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success)

	var count int64
	require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND grant_key = ?", resp.Data.ID, "register_default").Count(&count).Error)
	assert.EqualValues(t, 1, count)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("id", resp.Data.ID)
	GetSubscriptionSelf(c)
	assert.Equal(t, http.StatusOK, c.Writer.Status())
}

func TestGetSubscriptionSelfIncludesGrantedSubscription(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)
	plan := seedEnabledPlan(t, db)
	user := &model.User{Username: "viewer01", Password: "hashed", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DisplayName: "viewer01"}
	require.NoError(t, db.Create(user).Error)
	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
	})

	status, _, err := model.GrantRegisterDefaultSubscription(user.Id)
	require.NoError(t, err)
	assert.Equal(t, "created", status)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("id", user.Id)
	GetSubscriptionSelf(c)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Subscriptions []struct {
				Subscription struct {
					PlanId   int    `json:"plan_id"`
					GrantKey string `json:"grant_key"`
					Source   string `json:"source"`
					UserId   int    `json:"user_id"`
					Status   string `json:"status"`
				} `json:"subscription"`
			} `json:"subscriptions"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success)
	assert.Len(t, resp.Data.Subscriptions, 1)
	assert.Equal(t, plan.Id, resp.Data.Subscriptions[0].Subscription.PlanId)
	assert.Equal(t, "register_default", resp.Data.Subscriptions[0].Subscription.GrantKey)
	assert.Equal(t, "register_default", resp.Data.Subscriptions[0].Subscription.Source)
	assert.Equal(t, user.Id, resp.Data.Subscriptions[0].Subscription.UserId)
	assert.Equal(t, "active", resp.Data.Subscriptions[0].Subscription.Status)
}
