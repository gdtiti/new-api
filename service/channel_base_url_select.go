package service

import (
	"fmt"
	"hash/fnv"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
)

const (
	ginKeyChannelBaseURLAffinityCacheKey   = "channel_base_url_affinity_cache_key"
	ginKeyChannelBaseURLAffinityTTLSeconds = "channel_base_url_affinity_ttl_seconds"

	channelBaseURLAffinityCacheNamespace = "new-api:channel_base_url_affinity:v1"
)

var (
	channelBaseURLAffinityCacheOnce sync.Once
	channelBaseURLAffinityCache     *cachex.HybridCache[int]
)

type SelectedChannelBaseURL struct {
	URL          string
	BaseURLID    int
	BaseURLIndex int // 1-based index in the sorted full list (including disabled rows)
	Legacy       bool
	UsedAffinity bool
}

type baseURLCandidate struct {
	baseURL         *model.ChannelBaseURL
	baseURLIndex    int
	effectiveWeight int
}

type channelBaseURLAffinityKey struct {
	cacheKeySuffix string
	cacheKeyFull   string
	stableKey      string
	ttlSeconds     int
}

func getChannelBaseURLAffinityCache() *cachex.HybridCache[int] {
	channelBaseURLAffinityCacheOnce.Do(func() {
		// Reuse channel affinity settings for sizing/TTL to keep operational expectations consistent.
		capacity := 100_000
		defaultTTLSeconds := 3600
		if setting := operation_setting.GetChannelAffinitySetting(); setting != nil {
			if setting.MaxEntries > 0 {
				capacity = setting.MaxEntries
			}
			if setting.DefaultTTLSeconds > 0 {
				defaultTTLSeconds = setting.DefaultTTLSeconds
			}
		}

		channelBaseURLAffinityCache = cachex.NewHybridCache[int](cachex.HybridCacheConfig[int]{
			Namespace: cachex.Namespace(channelBaseURLAffinityCacheNamespace),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.IntCodec{},
			Memory: func() *hot.HotCache[string, int] {
				return hot.NewHotCache[string, int](hot.LRU, capacity).
					WithTTL(time.Duration(defaultTTLSeconds) * time.Second).
					WithJanitor().
					Build()
			},
		})
	})
	return channelBaseURLAffinityCache
}

func setChannelBaseURLAffinityContext(c *gin.Context, cacheKeySuffix string, ttlSeconds int) {
	if c == nil {
		return
	}
	cacheKeySuffix = strings.TrimSpace(cacheKeySuffix)
	if cacheKeySuffix == "" {
		return
	}
	c.Set(ginKeyChannelBaseURLAffinityCacheKey, cacheKeySuffix)
	c.Set(ginKeyChannelBaseURLAffinityTTLSeconds, ttlSeconds)
}

func getChannelBaseURLAffinityContext(c *gin.Context) (string, int, bool) {
	if c == nil {
		return "", 0, false
	}
	keyAny, ok := c.Get(ginKeyChannelBaseURLAffinityCacheKey)
	if !ok {
		return "", 0, false
	}
	key, ok := keyAny.(string)
	if !ok || strings.TrimSpace(key) == "" {
		return "", 0, false
	}
	ttlAny, ok := c.Get(ginKeyChannelBaseURLAffinityTTLSeconds)
	if !ok {
		return key, 0, true
	}
	ttlSeconds, _ := ttlAny.(int)
	return key, ttlSeconds, true
}

func buildChannelBaseURLAffinityKeyByChannelAffinityContext(c *gin.Context, channelID int) (keySuffix string, keyFull string, ttlSeconds int, ok bool) {
	if c == nil || channelID <= 0 {
		return "", "", 0, false
	}

	affKeyFull, ttlSeconds, ok := getChannelAffinityContext(c)
	if !ok || strings.TrimSpace(affKeyFull) == "" {
		return "", "", 0, false
	}

	// Derive the stable suffix part from "new-api:channel_affinity:v1:<suffix>".
	suffix := affKeyFull
	prefix := channelAffinityCacheNamespace + ":"
	if strings.HasPrefix(affKeyFull, prefix) {
		suffix = strings.TrimPrefix(affKeyFull, prefix)
	}

	keySuffix = strings.TrimLeft(suffix, ":") + ":ch:" + strconv.Itoa(channelID)
	keyFull = channelBaseURLAffinityCacheNamespace + ":" + keySuffix
	return keySuffix, keyFull, ttlSeconds, true
}

func buildChannelBaseURLAffinitySourceKey(src operation_setting.ChannelAffinityKeySource) string {
	switch src.Type {
	case "context_int", "context_string":
		return src.Type + ":" + strings.TrimSpace(src.Key)
	case "gjson":
		return src.Type + ":" + strings.TrimSpace(src.Path)
	default:
		return strings.TrimSpace(src.Type)
	}
}

func buildChannelBaseURLAffinityKeyByFallbackContext(c *gin.Context, channelID int) (channelBaseURLAffinityKey, bool) {
	if c == nil || channelID <= 0 {
		return channelBaseURLAffinityKey{}, false
	}

	ttlSeconds := 3600
	if setting := operation_setting.GetChannelAffinitySetting(); setting != nil && setting.DefaultTTLSeconds > 0 {
		ttlSeconds = setting.DefaultTTLSeconds
	}

	sources := []operation_setting.ChannelAffinityKeySource{
		{Type: "context_int", Key: string(constant.ContextKeyUserId)},
		{Type: "context_int", Key: string(constant.ContextKeyTokenId)},
		{Type: "gjson", Path: "user"},
		{Type: "gjson", Path: "metadata.user_id"},
		{Type: "gjson", Path: "prompt_cache_key"},
	}

	for _, src := range sources {
		value := extractChannelAffinityValue(c, src)
		if value == "" {
			continue
		}
		sourceKey := buildChannelBaseURLAffinitySourceKey(src)
		stableKey := sourceKey + ":" + value + ":ch:" + strconv.Itoa(channelID)
		keySuffix := "fallback:" + stableKey
		return channelBaseURLAffinityKey{
			cacheKeySuffix: keySuffix,
			cacheKeyFull:   channelBaseURLAffinityCacheNamespace + ":" + keySuffix,
			stableKey:      stableKey,
			ttlSeconds:     ttlSeconds,
		}, true
	}

	return channelBaseURLAffinityKey{}, false
}

func buildChannelBaseURLAffinityKey(c *gin.Context, channelID int) (channelBaseURLAffinityKey, bool) {
	if keySuffix, keyFull, ttlSeconds, ok := buildChannelBaseURLAffinityKeyByChannelAffinityContext(c, channelID); ok {
		return channelBaseURLAffinityKey{
			cacheKeySuffix: keySuffix,
			cacheKeyFull:   keyFull,
			stableKey:      keySuffix,
			ttlSeconds:     ttlSeconds,
		}, true
	}
	return buildChannelBaseURLAffinityKeyByFallbackContext(c, channelID)
}

func SelectChannelBaseURL(c *gin.Context, channel *model.Channel, forceBaseURLID int) (SelectedChannelBaseURL, *types.NewAPIError) {
	if channel == nil {
		return SelectedChannelBaseURL{}, types.NewError(fmt.Errorf("channel is nil"), types.ErrorCodeGetChannelFailed)
	}

	baseURLs, err := model.CacheGetChannelBaseURLs(channel.Id)
	if err != nil {
		return SelectedChannelBaseURL{}, types.NewError(err, types.ErrorCodeQueryDataError)
	}

	// Legacy mode: no rows => fall back to the channel's existing base_url / defaults.
	if len(baseURLs) == 0 {
		return SelectedChannelBaseURL{
			URL:    channel.GetBaseURL(),
			Legacy: true,
		}, nil
	}

	// Forced selection (mostly for channel tests / admin tools): select by id from the full list.
	// Note: forced selection ignores Enabled so that operators can test a disabled URL before re-enabling it.
	if forceBaseURLID > 0 {
		for i, b := range baseURLs {
			if b == nil || b.Id != forceBaseURLID {
				continue
			}
			url := strings.TrimSpace(b.Url)
			if url == "" {
				return SelectedChannelBaseURL{}, types.NewErrorWithStatusCode(
					fmt.Errorf("base_url_id=%d url 为空", forceBaseURLID),
					types.ErrorCodeInvalidRequest,
					http.StatusBadRequest,
					types.ErrOptionWithSkipRetry(),
				)
			}
			return SelectedChannelBaseURL{
				URL:          url,
				BaseURLID:    b.Id,
				BaseURLIndex: i + 1,
				Legacy:       false,
				UsedAffinity: false,
			}, nil
		}
		return SelectedChannelBaseURL{}, types.NewErrorWithStatusCode(
			fmt.Errorf("base_url_id=%d 不存在", forceBaseURLID),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	candidates := make([]baseURLCandidate, 0, len(baseURLs))
	for i, b := range baseURLs {
		if b == nil {
			continue
		}
		if !b.Enabled {
			continue
		}
		url := strings.TrimSpace(b.Url)
		if url == "" {
			continue
		}
		weight := b.Weight
		// Locked semantics: weight<=0 acts as 1; to get 0 traffic, disable the row.
		if weight <= 0 {
			weight = 1
		}
		candidates = append(candidates, baseURLCandidate{
			baseURL:         b,
			baseURLIndex:    i + 1,
			effectiveWeight: weight,
		})
	}

	// Hard rule: If the channel has base_url rows but all are disabled, we must NOT fall back.
	if len(candidates) == 0 {
		return SelectedChannelBaseURL{}, types.NewErrorWithStatusCode(
			fmt.Errorf("渠道 %d base_url 列表存在但没有可用项（可能全部 disabled）", channel.Id),
			types.ErrorCodeChannelNoAvailableBaseURL,
			http.StatusServiceUnavailable,
		)
	}

	// URL-level affinity: prefer an existing stable base_url mapping under the same affinity key.
	// Key dimension: channel affinity key (or fallback user key) + channel_id.
	if affinityKey, ok := buildChannelBaseURLAffinityKey(c, channel.Id); ok {
		setChannelBaseURLAffinityContext(c, affinityKey.cacheKeySuffix, affinityKey.ttlSeconds)

		cache := getChannelBaseURLAffinityCache()
		cachedID, found, cacheErr := cache.Get(affinityKey.cacheKeySuffix)
		if cacheErr != nil {
			common.SysError(fmt.Sprintf("channel base_url affinity cache get failed: key=%s, err=%v", affinityKey.cacheKeyFull, cacheErr))
		} else if found && cachedID > 0 {
			for _, cand := range candidates {
				if cand.baseURL != nil && cand.baseURL.Id == cachedID {
					return SelectedChannelBaseURL{
						URL:          strings.TrimSpace(cand.baseURL.Url),
						BaseURLID:    cand.baseURL.Id,
						BaseURLIndex: cand.baseURLIndex,
						Legacy:       false,
						UsedAffinity: true,
					}, nil
				}
			}
		}

		if selected, ok := selectWeightedBaseURLCandidateByStableKey(candidates, affinityKey.stableKey); ok {
			return SelectedChannelBaseURL{
				URL:          strings.TrimSpace(selected.baseURL.Url),
				BaseURLID:    selected.baseURL.Id,
				BaseURLIndex: selected.baseURLIndex,
				Legacy:       false,
				UsedAffinity: true,
			}, nil
		}
	}

	// Weighted load balance across all enabled rows.
	selected, ok := selectWeightedBaseURLCandidate(candidates)
	if !ok {
		return SelectedChannelBaseURL{}, types.NewErrorWithStatusCode(
			fmt.Errorf("渠道 %d base_url 选择失败（候选为空）", channel.Id),
			types.ErrorCodeChannelNoAvailableBaseURL,
			http.StatusServiceUnavailable,
		)
	}

	return SelectedChannelBaseURL{
		URL:          strings.TrimSpace(selected.baseURL.Url),
		BaseURLID:    selected.baseURL.Id,
		BaseURLIndex: selected.baseURLIndex,
		Legacy:       false,
		UsedAffinity: false,
	}, nil
}

func selectWeightedBaseURLCandidateByStableKey(candidates []baseURLCandidate, stableKey string) (baseURLCandidate, bool) {
	if len(candidates) == 0 || strings.TrimSpace(stableKey) == "" {
		return baseURLCandidate{}, false
	}

	if len(candidates) == 1 {
		if candidates[0].baseURL == nil {
			return baseURLCandidate{}, false
		}
		return candidates[0], true
	}

	sumWeight := 0
	for _, cand := range candidates {
		if cand.baseURL == nil {
			continue
		}
		w := cand.effectiveWeight
		if w <= 0 {
			w = 1
		}
		sumWeight += w
	}
	if sumWeight <= 0 {
		idx := int(stableHashUint64(stableKey) % uint64(len(candidates)))
		return candidates[idx], candidates[idx].baseURL != nil
	}

	r := int(stableHashUint64(stableKey) % uint64(sumWeight))
	for _, cand := range candidates {
		if cand.baseURL == nil {
			continue
		}
		w := cand.effectiveWeight
		if w <= 0 {
			w = 1
		}
		r -= w
		if r < 0 {
			return cand, true
		}
	}

	last := candidates[len(candidates)-1]
	return last, last.baseURL != nil
}

func stableHashUint64(s string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(s))
	return h.Sum64()
}

func selectWeightedBaseURLCandidate(candidates []baseURLCandidate) (baseURLCandidate, bool) {
	if len(candidates) == 0 {
		return baseURLCandidate{}, false
	}
	if len(candidates) == 1 {
		if candidates[0].baseURL == nil {
			return baseURLCandidate{}, false
		}
		return candidates[0], true
	}

	sumWeight := 0
	for _, cand := range candidates {
		if cand.baseURL == nil {
			continue
		}
		w := cand.effectiveWeight
		if w <= 0 {
			w = 1
		}
		sumWeight += w
	}
	if sumWeight <= 0 {
		// Fallback to uniform distribution
		idx := rand.Intn(len(candidates))
		return candidates[idx], candidates[idx].baseURL != nil
	}

	r := rand.Intn(sumWeight)
	for _, cand := range candidates {
		if cand.baseURL == nil {
			continue
		}
		w := cand.effectiveWeight
		if w <= 0 {
			w = 1
		}
		r -= w
		if r < 0 {
			return cand, true
		}
	}
	// Best-effort fallback
	last := candidates[len(candidates)-1]
	return last, last.baseURL != nil
}

func RecordChannelBaseURLAffinity(c *gin.Context) {
	if c == nil {
		return
	}

	// Reuse the switch to keep behavior consistent with channel affinity.
	setting := operation_setting.GetChannelAffinitySetting()
	if setting == nil || !setting.Enabled {
		return
	}

	cacheKeySuffix, ttlSeconds, ok := getChannelBaseURLAffinityContext(c)
	if !ok {
		return
	}

	baseURLID := common.GetContextKeyInt(c, constant.ContextKeyChannelBaseUrlId)
	if baseURLID <= 0 {
		return
	}

	if ttlSeconds <= 0 {
		ttlSeconds = setting.DefaultTTLSeconds
	}
	if ttlSeconds <= 0 {
		ttlSeconds = 3600
	}

	cache := getChannelBaseURLAffinityCache()
	if err := cache.SetWithTTL(cacheKeySuffix, baseURLID, time.Duration(ttlSeconds)*time.Second); err != nil {
		common.SysError(fmt.Sprintf("channel base_url affinity cache set failed: key=%s, err=%v", cache.FullKey(cacheKeySuffix), err))
	}
}
