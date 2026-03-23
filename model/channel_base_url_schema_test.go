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
		ChannelId: 1,
		Url:       "https://base-url.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	}
	require.NoError(t, DB.Create(row).Error)
	assert.Positive(t, row.Id)
}
