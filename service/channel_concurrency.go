package service

import (
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var channelConcurrencyCounters sync.Map

func getChannelConcurrencyCounter(channelID int) *atomic.Int64 {
	counter, _ := channelConcurrencyCounters.LoadOrStore(channelID, &atomic.Int64{})
	return counter.(*atomic.Int64)
}

func IsChannelConcurrencyAvailable(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	limit := channel.GetMaxConcurrency()
	if limit <= 0 {
		return true
	}
	current := getChannelConcurrencyCounter(channel.Id).Load()
	return current < int64(limit)
}

func TryAcquireChannelConcurrency(c *gin.Context, channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	limit := channel.GetMaxConcurrency()
	if limit <= 0 {
		return true
	}
	counter := getChannelConcurrencyCounter(channel.Id)
	for {
		current := counter.Load()
		if current >= int64(limit) {
			return false
		}
		if counter.CompareAndSwap(current, current+1) {
			if c != nil {
				common.SetContextKey(c, constant.ContextKeyChannelConcurrencyReserved, channel.Id)
			}
			return true
		}
	}
}

func ReleaseChannelConcurrencyByID(channelID int) {
	if channelID <= 0 {
		return
	}
	counterAny, ok := channelConcurrencyCounters.Load(channelID)
	if !ok {
		return
	}
	counter := counterAny.(*atomic.Int64)
	for {
		current := counter.Load()
		if current <= 0 {
			return
		}
		if counter.CompareAndSwap(current, current-1) {
			return
		}
	}
}

func ReleaseChannelConcurrencyReservation(c *gin.Context) {
	if c == nil {
		return
	}
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelConcurrencyReserved)
	if channelID <= 0 {
		return
	}
	ReleaseChannelConcurrencyByID(channelID)
	common.SetContextKey(c, constant.ContextKeyChannelConcurrencyReserved, 0)
}
