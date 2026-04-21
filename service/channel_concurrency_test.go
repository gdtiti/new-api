package service

import (
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTryAcquireChannelConcurrencyUnlimited(t *testing.T) {
	resetChannelConcurrencyCounters()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	channel := &model.Channel{Id: 101}

	require.True(t, TryAcquireChannelConcurrency(c, channel))
	assert.Equal(t, 0, common.GetContextKeyInt(c, constant.ContextKeyChannelConcurrencyReserved))
}

func TestTryAcquireChannelConcurrencyRespectLimitAndRelease(t *testing.T) {
	resetChannelConcurrencyCounters()

	limit := 1
	channel := &model.Channel{
		Id:             102,
		MaxConcurrency: &limit,
	}
	firstCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	secondCtx, _ := gin.CreateTestContext(httptest.NewRecorder())

	require.True(t, TryAcquireChannelConcurrency(firstCtx, channel))
	assert.Equal(t, channel.Id, common.GetContextKeyInt(firstCtx, constant.ContextKeyChannelConcurrencyReserved))

	require.False(t, TryAcquireChannelConcurrency(secondCtx, channel))

	ReleaseChannelConcurrencyReservation(firstCtx)
	assert.Equal(t, 0, common.GetContextKeyInt(firstCtx, constant.ContextKeyChannelConcurrencyReserved))

	require.True(t, TryAcquireChannelConcurrency(secondCtx, channel))
	assert.Equal(t, channel.Id, common.GetContextKeyInt(secondCtx, constant.ContextKeyChannelConcurrencyReserved))
}

func TestCacheGetRandomSatisfiedChannelSkipsConcurrencySaturatedChannel(t *testing.T) {
	resetChannelConcurrencyCounters()
	require.NoError(t, model.DB.AutoMigrate(&model.Ability{}))

	model.DB.Exec("DELETE FROM abilities")
	model.DB.Exec("DELETE FROM channels")
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM abilities")
		model.DB.Exec("DELETE FROM channels")
	})

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		model.InitChannelCache()
		resetChannelConcurrencyCounters()
	})
	common.MemoryCacheEnabled = true

	saturated := newConcurrencyTestChannel("saturated", "gpt-4o", 1)
	available := newConcurrencyTestChannel("available", "gpt-4o", 1)
	require.NoError(t, model.DB.Create(saturated).Error)
	require.NoError(t, model.DB.Create(available).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-4o",
		ChannelId: saturated.Id,
		Enabled:   true,
		Priority:  saturated.Priority,
		Weight:    uint(saturated.GetWeight()),
	}).Error)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-4o",
		ChannelId: available.Id,
		Enabled:   true,
		Priority:  available.Priority,
		Weight:    uint(available.GetWeight()),
	}).Error)
	model.InitChannelCache()

	occupiedCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.True(t, TryAcquireChannelConcurrency(occupiedCtx, saturated))

	selectCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	channel, selectGroup, err := CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:        selectCtx,
		TokenGroup: "default",
		ModelName:  "gpt-4o",
		Retry:      common.GetPointer(0),
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, "default", selectGroup)
	assert.Equal(t, available.Id, channel.Id)

	ReleaseChannelConcurrencyReservation(selectCtx)
	ReleaseChannelConcurrencyReservation(occupiedCtx)
}

func resetChannelConcurrencyCounters() {
	channelConcurrencyCounters = sync.Map{}
}

func newConcurrencyTestChannel(name string, modelName string, maxConcurrency int) *model.Channel {
	priority := int64(10)
	weight := uint(1)
	return &model.Channel{
		Name:           name,
		Key:            "test-key",
		Type:           constant.ChannelTypeOpenAI,
		Status:         common.ChannelStatusEnabled,
		Group:          "default",
		Models:         modelName,
		Priority:       &priority,
		Weight:         &weight,
		MaxConcurrency: &maxConcurrency,
	}
}
