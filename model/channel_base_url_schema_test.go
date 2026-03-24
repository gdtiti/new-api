package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnsureChannelBaseURLSchemaCreatesMissingTable(t *testing.T) {
	channelBaseURLSchemaEnsureLock.Lock()
	channelBaseURLSchemaEnsuredDB = nil
	channelBaseURLSchemaEnsureLock.Unlock()
	t.Cleanup(func() {
		channelBaseURLSchemaEnsureLock.Lock()
		channelBaseURLSchemaEnsuredDB = nil
		channelBaseURLSchemaEnsureLock.Unlock()
	})

	if DB.Migrator().HasTable(&ChannelBaseURL{}) {
		require.NoError(t, DB.Migrator().DropTable(&ChannelBaseURL{}))
	}
	assert.False(t, DB.Migrator().HasTable(&ChannelBaseURL{}))

	require.NoError(t, EnsureChannelBaseURLSchema())
	assert.True(t, DB.Migrator().HasTable(&ChannelBaseURL{}))

	row := &ChannelBaseURL{
		ChannelId:                 1,
		Url:                       "https://base-url.example",
		Enabled:                   true,
		Weight:                    1,
		SortOrder:                 0,
		AutoDisableEnabled:        true,
		AutoDisableStatusCodes:    "401,503",
		AutoDisableErrorThreshold: 2,
		AutoDisableModels:         "gpt-4o",
		HealthCheckEnabled:        true,
		HealthCheckModel:          "gpt-4o-mini",
		HealthCheckEndpointType:   "chat",
	}
	require.NoError(t, DB.Create(row).Error)
	assert.Positive(t, row.Id)

	var saved ChannelBaseURL
	require.NoError(t, DB.First(&saved, row.Id).Error)
	assert.True(t, saved.AutoDisableEnabled)
	assert.Equal(t, "401,503", saved.AutoDisableStatusCodes)
	assert.Equal(t, 2, saved.AutoDisableErrorThreshold)
	assert.Equal(t, "gpt-4o", saved.AutoDisableModels)
	assert.True(t, saved.HealthCheckEnabled)
	assert.Equal(t, "gpt-4o-mini", saved.HealthCheckModel)
	assert.Equal(t, "chat", saved.HealthCheckEndpointType)
}
