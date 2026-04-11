package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRandomSatisfiedChannelWithFilterFallsBackToNormalizedModel(t *testing.T) {
	channelSyncLock.Lock()
	originalGroup2Model2Channels := group2model2channels
	originalChannelsIDM := channelsIDM
	channelSyncLock.Unlock()

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		channelSyncLock.Lock()
		group2model2channels = originalGroup2Model2Channels
		channelsIDM = originalChannelsIDM
		channelSyncLock.Unlock()
	})

	common.MemoryCacheEnabled = true
	channelSyncLock.Lock()
	group2model2channels = map[string]map[string][]int{
		"default": {
			"gpt-4o-gizmo-preview": {2},
			"gpt-4o-gizmo-*":       {1},
		},
	}
	channelsIDM = map[int]*Channel{
		1: newTestChannel(1, constant.ChannelTypeOpenAI, 10, 1),
		2: newTestChannel(2, constant.ChannelTypeAnthropic, 10, 1),
	}
	channelSyncLock.Unlock()

	channel, err := GetRandomSatisfiedChannelWithFilter("default", "gpt-4o-gizmo-preview", 0, func(channel *Channel) bool {
		return channel != nil && channel.Type == constant.ChannelTypeOpenAI
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 1, channel.Id)
}

func TestGetChannelWithFilterFallsBackToNormalizedModel(t *testing.T) {
	initCol()
	require.NoError(t, DB.AutoMigrate(&Ability{}))
	truncateTables(t)
	t.Cleanup(func() {
		DB.Exec("DELETE FROM abilities")
	})

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})
	common.MemoryCacheEnabled = false

	exactChannel := newTestChannel(0, constant.ChannelTypeAnthropic, 10, 1)
	exactChannel.Key = "test-anthropic"
	exactChannel.Status = common.ChannelStatusEnabled
	exactChannel.Name = "anthropic-exact"
	exactChannel.Group = "default"
	exactChannel.Models = "gpt-4o-gizmo-preview"
	require.NoError(t, DB.Create(exactChannel).Error)

	normalizedChannel := newTestChannel(0, constant.ChannelTypeOpenAI, 10, 1)
	normalizedChannel.Key = "test-openai"
	normalizedChannel.Status = common.ChannelStatusEnabled
	normalizedChannel.Name = "openai-normalized"
	normalizedChannel.Group = "default"
	normalizedChannel.Models = "gpt-4o-gizmo-*"
	require.NoError(t, DB.Create(normalizedChannel).Error)

	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-4o-gizmo-preview",
		ChannelId: exactChannel.Id,
		Enabled:   true,
		Priority:  exactChannel.Priority,
		Weight:    uint(exactChannel.GetWeight()),
	}).Error)
	require.NoError(t, DB.Create(&Ability{
		Group:     "default",
		Model:     "gpt-4o-gizmo-*",
		ChannelId: normalizedChannel.Id,
		Enabled:   true,
		Priority:  normalizedChannel.Priority,
		Weight:    uint(normalizedChannel.GetWeight()),
	}).Error)

	channel, err := GetChannelWithFilter("default", "gpt-4o-gizmo-preview", 0, func(channel *Channel) bool {
		return channel != nil && channel.Type == constant.ChannelTypeOpenAI
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, normalizedChannel.Id, channel.Id)
}

func newTestChannel(id int, channelType int, priority int64, weight uint) *Channel {
	priorityCopy := priority
	weightCopy := weight
	return &Channel{
		Id:       id,
		Type:     channelType,
		Status:   common.ChannelStatusEnabled,
		Priority: &priorityCopy,
		Weight:   &weightCopy,
	}
}
