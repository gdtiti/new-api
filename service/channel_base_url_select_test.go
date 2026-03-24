package service

import (
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func ensureChannelBaseURLSchema(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.ChannelBaseURL{}))
}

func truncateChannelBaseURLTables(t *testing.T) {
	t.Helper()
	truncate(t)
	t.Cleanup(func() {
		model.DB.Exec("DELETE FROM channel_base_urls")
	})
}

func disableMemoryCacheForTest(t *testing.T) {
	t.Helper()
	original := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = original
	})
}

func seedChannelBaseURL(t *testing.T, baseURL *model.ChannelBaseURL) {
	t.Helper()
	// ChannelBaseURL has gorm default tags on bool/int fields.
	// Use explicit INSERT to ensure zero values (Enabled=false, Weight=0) are persisted as-is.
	require.NoError(t, model.DB.Exec(
		"INSERT INTO channel_base_urls (id, channel_id, url, enabled, weight, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
		baseURL.Id,
		baseURL.ChannelId,
		strings.TrimSpace(baseURL.Url),
		baseURL.Enabled,
		baseURL.Weight,
		baseURL.SortOrder,
	).Error)
}

func seedChannelForTest(t *testing.T, channelID int, baseURL string) *model.Channel {
	t.Helper()
	ch := &model.Channel{
		Id:     channelID,
		Name:   fmt.Sprintf("test_channel_%d", channelID),
		Key:    "sk-test",
		Status: common.ChannelStatusEnabled,
	}
	if baseURL != "" {
		ch.BaseURL = &baseURL
	}
	require.NoError(t, model.DB.Create(ch).Error)
	return ch
}

func buildGinContextWithChannelAffinity(t *testing.T, cacheKey string, ttlSeconds int) *gin.Context {
	t.Helper()
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	setChannelAffinityContext(ctx, channelAffinityMeta{
		CacheKey:   cacheKey,
		TTLSeconds: ttlSeconds,
	})
	return ctx
}

func buildGinJSONContext(t *testing.T, path string, body string) *gin.Context {
	t.Helper()
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	if path == "" {
		path = "/v1/chat/completions"
	}
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	ctx.Request = req
	return ctx
}

func TestSelectChannelBaseURL_LegacyFallback(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	legacyURL := "https://legacy.example"
	ch := seedChannelForTest(t, 1, legacyURL)

	got, apiErr := SelectChannelBaseURL(nil, ch, 0)
	require.Nil(t, apiErr)
	require.True(t, got.Legacy)
	require.Equal(t, legacyURL, got.URL)
	require.Equal(t, 0, got.BaseURLID)
	require.Equal(t, 0, got.BaseURLIndex)
	require.False(t, got.UsedAffinity)
}

func TestSelectChannelBaseURL_AllDisabledNoFallback(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	legacyURL := "https://legacy.example"
	ch := seedChannelForTest(t, 2, legacyURL)

	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        101,
		ChannelId: ch.Id,
		Url:       "https://disabled-1.example",
		Enabled:   false,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        102,
		ChannelId: ch.Id,
		Url:       "https://disabled-2.example",
		Enabled:   false,
		Weight:    1,
		SortOrder: 0,
	})

	got, apiErr := SelectChannelBaseURL(nil, ch, 0)
	require.NotNil(t, apiErr)
	require.Equal(t, types.ErrorCodeChannelNoAvailableBaseURL, apiErr.GetErrorCode())
	require.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	require.Equal(t, "", got.URL)
	require.False(t, got.Legacy)
}

func TestSelectChannelBaseURL_ForcedByID_AllowsDisabledAndReturnsIndex(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 3, "")

	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        100,
		ChannelId: ch.Id,
		Url:       "https://tier0-enabled.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        200,
		ChannelId: ch.Id,
		Url:       "https://tier0-disabled.example",
		Enabled:   false,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        300,
		ChannelId: ch.Id,
		Url:       "https://tier1-enabled.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 1,
	})

	got, apiErr := SelectChannelBaseURL(nil, ch, 200)
	require.Nil(t, apiErr)
	require.Equal(t, "https://tier0-disabled.example", got.URL)
	require.Equal(t, 200, got.BaseURLID)
	require.Equal(t, 2, got.BaseURLIndex)
	require.False(t, got.Legacy)
	require.False(t, got.UsedAffinity)
}

func TestSelectChannelBaseURL_AllEnabledRowsParticipateAcrossSortOrders(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 4, "")

	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        1,
		ChannelId: ch.Id,
		Url:       "https://tier0-a.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        2,
		ChannelId: ch.Id,
		Url:       "https://tier0-b.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        3,
		ChannelId: ch.Id,
		Url:       "https://tier5.example",
		Enabled:   true,
		Weight:    1000,
		SortOrder: 5,
	})

	rand.Seed(7)
	counts := map[int]int{}
	for i := 0; i < 400; i++ {
		got, apiErr := SelectChannelBaseURL(nil, ch, 0)
		require.Nil(t, apiErr)
		counts[got.BaseURLID]++
	}
	require.Greater(t, counts[3], 0, "higher sort_order row should still participate in load balancing")
	require.Greater(t, counts[3], counts[1], "weight should dominate over sort_order")
	require.Greater(t, counts[3], counts[2], "weight should dominate over sort_order")
}

func TestSelectChannelBaseURL_WeightedDistribution_ZeroWeightActsAsOne(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 5, "")

	// weight<=0 should be treated as 1 (to make a row get 0 traffic, disable it).
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        11,
		ChannelId: ch.Id,
		Url:       "https://w0.example",
		Enabled:   true,
		Weight:    0,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        22,
		ChannelId: ch.Id,
		Url:       "https://w3.example",
		Enabled:   true,
		Weight:    3,
		SortOrder: 0,
	})

	rand.Seed(42)
	const draws = 4000
	counts := map[int]int{}
	for i := 0; i < draws; i++ {
		got, apiErr := SelectChannelBaseURL(nil, ch, 0)
		require.Nil(t, apiErr)
		counts[got.BaseURLID]++
	}

	require.Greater(t, counts[11], 0, "weight=0 should still receive traffic (treated as weight=1)")
	require.Greater(t, counts[22], counts[11], "higher weight should be selected more often")
	require.GreaterOrEqual(t, counts[22], counts[11]*2, "weight=3 should be substantially more likely than weight=1")
	require.Equal(t, draws, counts[11]+counts[22])
}

func TestSelectChannelBaseURL_AffinityStrategyA_PreferCachedIDAcrossAllCandidates(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 6, "")

	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        10,
		ChannelId: ch.Id,
		Url:       "https://aff-a.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        20,
		ChannelId: ch.Id,
		Url:       "https://aff-b.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 9,
	})

	cacheKey := fmt.Sprintf("test:aff:%s", strings.ReplaceAll(t.Name(), "/", "_"))
	ctx := buildGinContextWithChannelAffinity(t, cacheKey, 600)

	keySuffix, _, _, ok := buildChannelBaseURLAffinityKeyByChannelAffinityContext(ctx, ch.Id)
	require.True(t, ok)

	cache := getChannelBaseURLAffinityCache()
	require.NoError(t, cache.SetWithTTL(keySuffix, 20, time.Minute))

	rand.Seed(1)
	got, apiErr := SelectChannelBaseURL(ctx, ch, 0)
	require.Nil(t, apiErr)
	require.True(t, got.UsedAffinity)
	require.Equal(t, 20, got.BaseURLID)
	require.Equal(t, "https://aff-b.example", got.URL)
}

func TestSelectChannelBaseURL_GenericAffinityByUserContext_IsStableAndDistributed(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 8, "")

	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        101,
		ChannelId: ch.Id,
		Url:       "https://user-aff-1.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        102,
		ChannelId: ch.Id,
		Url:       "https://user-aff-2.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 5,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        103,
		ChannelId: ch.Id,
		Url:       "https://user-aff-3.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 10,
	})

	ctx1 := buildGinJSONContext(t, "/v1/chat/completions", `{}`)
	common.SetContextKey(ctx1, constant.ContextKeyUserId, 1001)
	got1, apiErr := SelectChannelBaseURL(ctx1, ch, 0)
	require.Nil(t, apiErr)
	require.True(t, got1.UsedAffinity)

	ctx2 := buildGinJSONContext(t, "/v1/chat/completions", `{}`)
	common.SetContextKey(ctx2, constant.ContextKeyUserId, 1001)
	got2, apiErr := SelectChannelBaseURL(ctx2, ch, 0)
	require.Nil(t, apiErr)
	require.True(t, got2.UsedAffinity)
	require.Equal(t, got1.BaseURLID, got2.BaseURLID, "same user should keep base_url affinity before cache is populated")

	selectedByUsers := map[int]struct{}{}
	for userID := 2001; userID < 2021; userID++ {
		ctx := buildGinJSONContext(t, "/v1/chat/completions", `{}`)
		common.SetContextKey(ctx, constant.ContextKeyUserId, userID)
		got, apiErr := SelectChannelBaseURL(ctx, ch, 0)
		require.Nil(t, apiErr)
		require.True(t, got.UsedAffinity)
		selectedByUsers[got.BaseURLID] = struct{}{}
	}
	require.GreaterOrEqual(t, len(selectedByUsers), 2, "different users should be distributed across multiple base_url rows")
}

func TestSelectChannelBaseURL_GenericAffinityByRequestBodyUserField(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 9, "")

	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        201,
		ChannelId: ch.Id,
		Url:       "https://body-aff-1.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        202,
		ChannelId: ch.Id,
		Url:       "https://body-aff-2.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})

	ctx1 := buildGinJSONContext(t, "/v1/chat/completions", `{"user":"alice"}`)
	got1, apiErr := SelectChannelBaseURL(ctx1, ch, 0)
	require.Nil(t, apiErr)
	require.True(t, got1.UsedAffinity)

	ctx2 := buildGinJSONContext(t, "/v1/chat/completions", `{"user":"alice"}`)
	got2, apiErr := SelectChannelBaseURL(ctx2, ch, 0)
	require.Nil(t, apiErr)
	require.True(t, got2.UsedAffinity)
	require.Equal(t, got1.BaseURLID, got2.BaseURLID, "same request user field should map to the same base_url")
}

func TestSelectChannelBaseURL_AffinityStrategyA_FallbackWhenCachedIDUnavailable(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 7, "")

	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        10,
		ChannelId: ch.Id,
		Url:       "https://only-enabled.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        20,
		ChannelId: ch.Id,
		Url:       "https://disabled.example",
		Enabled:   false,
		Weight:    1,
		SortOrder: 0,
	})

	cacheKey := fmt.Sprintf("test:aff:%s", strings.ReplaceAll(t.Name(), "/", "_"))
	ctx := buildGinContextWithChannelAffinity(t, cacheKey, 600)

	keySuffix, _, _, ok := buildChannelBaseURLAffinityKeyByChannelAffinityContext(ctx, ch.Id)
	require.True(t, ok)

	cache := getChannelBaseURLAffinityCache()
	require.NoError(t, cache.SetWithTTL(keySuffix, 20, time.Minute))

	got, apiErr := SelectChannelBaseURL(ctx, ch, 0)
	require.Nil(t, apiErr)
	require.True(t, got.UsedAffinity)
	require.Equal(t, 10, got.BaseURLID)
	require.Equal(t, "https://only-enabled.example", got.URL)
}
