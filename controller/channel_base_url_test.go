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

	body := `{"channel_id":1,"action":"add","url":"https://upstream.example","enabled":true,"weight":2,"sort_order":0}`
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
			ID  int    `json:"id"`
			URL string `json:"url"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	assert.True(t, resp.Success)
	assert.Positive(t, resp.Data.ID)
	assert.Equal(t, "https://upstream.example", resp.Data.URL)

	var count int64
	require.NoError(t, db.Model(&model.ChannelBaseURL{}).Where("channel_id = ?", channel.Id).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}
