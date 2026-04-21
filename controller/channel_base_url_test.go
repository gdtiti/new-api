package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelBaseURLTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false
	common.MemoryCacheEnabled = false

	require.NoError(t, db.AutoMigrate(&model.Channel{}))
	return db
}

func TestManageChannelBaseURLsAutoCreatesMissingTable(t *testing.T) {
	db := setupChannelBaseURLTestDB(t)

	channel := &model.Channel{
		Id:     1,
		Name:   "test-channel",
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, db.Create(channel).Error)
	assert.False(t, db.Migrator().HasTable(&model.ChannelBaseURL{}))

	body := `{"channel_id":1,"action":"add","url":"https://upstream.example","enabled":false,"weight":2,"sort_order":0,"auto_disable_enabled":true,"auto_disable_status_codes":"401,503","auto_disable_error_threshold":2,"auto_disable_models":"gpt-4o,gpt-4.1","health_check_enabled":true,"health_check_model":"gpt-4o-mini","health_check_endpoint_type":"chat"}`
	req := httptest.NewRequest(http.MethodPost, "/channel/base_url/manage", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req

	ManageChannelBaseURLs(ctx)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.True(t, db.Migrator().HasTable(&model.ChannelBaseURL{}))

	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			ID                        int    `json:"id"`
			URL                       string `json:"url"`
			Enabled                   bool   `json:"enabled"`
			DisableSource             string `json:"disable_source"`
			AutoDisableEnabled        bool   `json:"auto_disable_enabled"`
			AutoDisableStatusCodes    string `json:"auto_disable_status_codes"`
			AutoDisableErrorThreshold int    `json:"auto_disable_error_threshold"`
			AutoDisableModels         string `json:"auto_disable_models"`
			HealthCheckEnabled        bool   `json:"health_check_enabled"`
			HealthCheckModel          string `json:"health_check_model"`
			HealthCheckEndpointType   string `json:"health_check_endpoint_type"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.True(t, resp.Success)
	assert.Positive(t, resp.Data.ID)
	assert.Equal(t, "https://upstream.example", resp.Data.URL)
	assert.False(t, resp.Data.Enabled)
	assert.Equal(t, model.ChannelBaseURLDisableSourceManual, resp.Data.DisableSource)
	assert.True(t, resp.Data.AutoDisableEnabled)
	assert.Equal(t, "401,503", resp.Data.AutoDisableStatusCodes)
	assert.Equal(t, 2, resp.Data.AutoDisableErrorThreshold)
	assert.Equal(t, "gpt-4o,gpt-4.1", resp.Data.AutoDisableModels)
	assert.True(t, resp.Data.HealthCheckEnabled)
	assert.Equal(t, "gpt-4o-mini", resp.Data.HealthCheckModel)
	assert.Equal(t, "chat", resp.Data.HealthCheckEndpointType)

	var count int64
	require.NoError(t, db.Model(&model.ChannelBaseURL{}).Where("channel_id = ?", channel.Id).Count(&count).Error)
	assert.EqualValues(t, 1, count)

	var saved model.ChannelBaseURL
	require.NoError(t, db.First(&saved, resp.Data.ID).Error)
	assert.Equal(t, "401,503", saved.AutoDisableStatusCodes)
	assert.Equal(t, 2, saved.AutoDisableErrorThreshold)
	assert.Equal(t, "gpt-4o,gpt-4.1", saved.AutoDisableModels)
	assert.True(t, saved.HealthCheckEnabled)
	assert.Equal(t, "gpt-4o-mini", saved.HealthCheckModel)
	assert.Equal(t, "chat", saved.HealthCheckEndpointType)
	assert.Equal(t, model.ChannelBaseURLDisableSourceManual, saved.DisableSource)
	assert.False(t, saved.Enabled)
}

func TestManageChannelBaseURLsUpdateCanClearAutoDisableStateOnManualEnable(t *testing.T) {
	db := setupChannelBaseURLTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ChannelBaseURL{}))

	channel := &model.Channel{
		Id:     2,
		Name:   "test-channel-2",
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, db.Create(channel).Error)

	baseURL := &model.ChannelBaseURL{
		Id:                        10,
		ChannelId:                 channel.Id,
		Url:                       "https://upstream-2.example",
		Enabled:                   false,
		AutoDisableEnabled:        true,
		AutoDisableStatusCodes:    "401,503",
		AutoDisableErrorThreshold: 3,
		DisableSource:             model.ChannelBaseURLDisableSourceAutoError,
		DisableReason:             "status_code=401",
		DisabledAt:                123,
		ConsecutiveFailures:       3,
	}
	require.NoError(t, db.Create(baseURL).Error)
	baseURL.MarkManualDisabled()
	require.NoError(t, db.Save(baseURL).Error)

	body := `{"channel_id":2,"action":"update","base_url_id":10,"enabled":true,"auto_disable_models":"gpt-4o-mini"}`
	req := httptest.NewRequest(http.MethodPost, "/channel/base_url/manage", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = req

	ManageChannelBaseURLs(ctx)

	require.Equal(t, http.StatusOK, rec.Code)

	var saved model.ChannelBaseURL
	require.NoError(t, db.First(&saved, 10).Error)
	assert.True(t, saved.Enabled)
	assert.Equal(t, "", saved.DisableSource)
	assert.Equal(t, "", saved.DisableReason)
	assert.Zero(t, saved.DisabledAt)
	assert.Zero(t, saved.ConsecutiveFailures)
	assert.Equal(t, "gpt-4o-mini", saved.AutoDisableModels)
}
