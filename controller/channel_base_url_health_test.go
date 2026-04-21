package controller

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunChannelBaseURLHealthChecksOnce_UsesConfiguredRunnerAndRecoversAutoDisabled(t *testing.T) {
	db := setupChannelBaseURLTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ChannelBaseURL{}))

	channel := &model.Channel{
		Id:     11,
		Name:   "health-channel",
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, db.Create(channel).Error)

	baseURL := &model.ChannelBaseURL{
		Id:                      1101,
		ChannelId:               channel.Id,
		Url:                     "https://health.example",
		Enabled:                 false,
		DisableSource:           model.ChannelBaseURLDisableSourceAutoError,
		DisabledAt:              123,
		HealthCheckEnabled:      true,
		HealthCheckModel:        "gpt-4o-mini",
		HealthCheckEndpointType: "chat",
	}
	require.NoError(t, db.Create(baseURL).Error)
	baseURL.Enabled = false
	baseURL.DisableSource = model.ChannelBaseURLDisableSourceAutoError
	baseURL.DisabledAt = 123
	require.NoError(t, db.Save(baseURL).Error)

	var (
		gotChannelID    int
		gotModel        string
		gotEndpointType string
		gotForceBaseURL int
		calls           int
	)
	require.NoError(t, runChannelBaseURLHealthChecksOnce(func(channel *model.Channel, testModel string, endpointType string, isStream bool, forceBaseURLID int) testResult {
		calls++
		gotChannelID = channel.Id
		gotModel = testModel
		gotEndpointType = endpointType
		gotForceBaseURL = forceBaseURLID
		return testResult{}
	}))

	assert.Equal(t, 1, calls)
	assert.Equal(t, channel.Id, gotChannelID)
	assert.Equal(t, "gpt-4o-mini", gotModel)
	assert.Equal(t, "chat", gotEndpointType)
	assert.Equal(t, baseURL.Id, gotForceBaseURL)

	var saved model.ChannelBaseURL
	require.NoError(t, db.First(&saved, baseURL.Id).Error)
	assert.True(t, saved.Enabled)
	assert.Equal(t, "", saved.DisableSource)
	assert.True(t, saved.LastHealthCheckSuccess)
	assert.Equal(t, "ok", saved.LastHealthCheckMessage)
}

func TestRunChannelBaseURLHealthChecksOnce_DoesNotOverrideManualDisable(t *testing.T) {
	db := setupChannelBaseURLTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.ChannelBaseURL{}))

	channel := &model.Channel{
		Id:     12,
		Name:   "manual-disabled-channel",
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, db.Create(channel).Error)

	baseURL := &model.ChannelBaseURL{
		Id:                 1201,
		ChannelId:          channel.Id,
		Url:                "https://manual-disabled.example",
		Enabled:            false,
		DisableSource:      model.ChannelBaseURLDisableSourceManual,
		DisabledAt:         456,
		HealthCheckEnabled: true,
		HealthCheckModel:   "gpt-4o-mini",
	}
	require.NoError(t, db.Create(baseURL).Error)
	baseURL.MarkManualDisabled()
	baseURL.DisabledAt = 456
	require.NoError(t, db.Save(baseURL).Error)

	require.NoError(t, runChannelBaseURLHealthChecksOnce(func(channel *model.Channel, testModel string, endpointType string, isStream bool, forceBaseURLID int) testResult {
		return testResult{localErr: errors.New("health failed")}
	}))

	var saved model.ChannelBaseURL
	require.NoError(t, db.First(&saved, baseURL.Id).Error)
	assert.False(t, saved.Enabled)
	assert.Equal(t, model.ChannelBaseURLDisableSourceManual, saved.DisableSource)
	assert.Equal(t, int64(456), saved.DisabledAt)
	assert.False(t, saved.LastHealthCheckSuccess)
	assert.Equal(t, "health failed", saved.LastHealthCheckMessage)
}
