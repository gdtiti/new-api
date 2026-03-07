package controller

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
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
	common.OptionMap = make(map[string]string)
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

func performJSONRequest(handler gin.HandlerFunc, method string, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(method, "/test", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	handler(c)
	return w
}

type stubGitHubOAuthProvider struct {
	user *oauth.OAuthUser
}

func (p *stubGitHubOAuthProvider) GetName() string {
	return "GitHub"
}

func (p *stubGitHubOAuthProvider) IsEnabled() bool {
	return true
}

func (p *stubGitHubOAuthProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*oauth.OAuthToken, error) {
	return &oauth.OAuthToken{
		AccessToken: "stub-token",
		TokenType:   "Bearer",
		Scope:       "read:user",
	}, nil
}

func (p *stubGitHubOAuthProvider) GetUserInfo(ctx context.Context, token *oauth.OAuthToken) (*oauth.OAuthUser, error) {
	return p.user, nil
}

func (p *stubGitHubOAuthProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsGitHubIdAlreadyTaken(providerUserID)
}

func (p *stubGitHubOAuthProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.GitHubId = providerUserID
	return user.FillUserByGitHubId()
}

func (p *stubGitHubOAuthProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.GitHubId = providerUserID
}

func (p *stubGitHubOAuthProvider) GetProviderPrefix() string {
	return "github_"
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

func TestUpdateOptionAllowsClearingRegisterDefaultSubscriptionPlanWhenDisabled(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)
	plan := seedEnabledPlan(t, db)
	common.RegisterDefaultSubscriptionEnabled = false
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
	})

	w := performJSONRequest(UpdateOption, http.MethodPut, `{"key":"RegisterDefaultSubscriptionPlanId","value":""}`)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success, resp.Message)
	assert.Equal(t, 0, common.RegisterDefaultSubscriptionPlanId)

	var option model.Option
	require.NoError(t, db.Where("key = ?", "RegisterDefaultSubscriptionPlanId").First(&option).Error)
	assert.Equal(t, "0", option.Value)
}

func TestUpdateOptionRejectsClearingRegisterDefaultSubscriptionPlanWhenEnabled(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)
	plan := seedEnabledPlan(t, db)
	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
	})

	w := performJSONRequest(UpdateOption, http.MethodPut, `{"key":"RegisterDefaultSubscriptionPlanId","value":""}`)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.False(t, resp.Success)
	assert.NotEmpty(t, resp.Message)
	assert.Equal(t, plan.Id, common.RegisterDefaultSubscriptionPlanId)

	var count int64
	require.NoError(t, db.Model(&model.Option{}).Where("key = ?", "RegisterDefaultSubscriptionPlanId").Count(&count).Error)
	assert.EqualValues(t, 0, count)
}

func TestGitHubOAuthGrantsDefaultSubscriptionForNewUser(t *testing.T) {
	db := setupRegisterDefaultSubscriptionTestDB(t)
	plan := seedEnabledPlan(t, db)
	common.RegisterDefaultSubscriptionEnabled = true
	common.RegisterDefaultSubscriptionPlanId = plan.Id
	common.GitHubOAuthEnabled = true

	originalProvider := oauth.GetProvider("github")
	oauth.Register("github", &stubGitHubOAuthProvider{
		user: &oauth.OAuthUser{
			ProviderUserID: "10001",
			Username:       "github_new_user",
			DisplayName:    "GitHub New User",
			Email:          "github-new-user@example.com",
			Extra: map[string]any{
				"legacy_id": "github_new_user",
			},
		},
	})

	t.Cleanup(func() {
		common.RegisterDefaultSubscriptionEnabled = false
		common.RegisterDefaultSubscriptionPlanId = 0
		common.GitHubOAuthEnabled = false
		if originalProvider != nil {
			oauth.Register("github", originalProvider)
			return
		}
		oauth.Unregister("github")
	})

	r := gin.New()
	store := cookie.NewStore([]byte("test-secret"))
	r.Use(sessions.Sessions("session", store))
	r.GET("/session/setup", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("oauth_state", "test-state")
		require.NoError(t, session.Save())
		c.Status(http.StatusOK)
	})
	r.GET("/oauth/:provider", HandleOAuth)

	sessionReq := httptest.NewRequest(http.MethodGet, "/session/setup", nil)
	sessionRecorder := httptest.NewRecorder()
	r.ServeHTTP(sessionRecorder, sessionReq)
	require.Equal(t, http.StatusOK, sessionRecorder.Code)

	req := httptest.NewRequest(http.MethodGet, "/oauth/github?code=fake-code&state=test-state", nil)
	for _, cookie := range sessionRecorder.Result().Cookies() {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Success bool `json:"success"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success)

	var user model.User
	require.NoError(t, db.Where("github_id = ?", "10001").First(&user).Error)
	assert.Equal(t, "10001", user.GitHubId)

	var count int64
	require.NoError(t, db.Model(&model.UserSubscription{}).Where("user_id = ? AND grant_key = ?", user.Id, "register_default").Count(&count).Error)
	assert.EqualValues(t, 1, count)

	subs, err := model.GetAllActiveUserSubscriptions(user.Id)
	require.NoError(t, err)
	require.Len(t, subs, 1)
	assert.Equal(t, plan.Id, subs[0].Subscription.PlanId)
}
