package service

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRecordChannelBaseURLFailure_DisablesOnlyAfterThreshold(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 21, "")
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:                        2101,
		ChannelId:                 ch.Id,
		Url:                       "https://failure-threshold.example",
		Enabled:                   true,
		Weight:                    1,
		SortOrder:                 0,
		AutoDisableEnabled:        true,
		AutoDisableStatusCodes:    "401,503",
		AutoDisableErrorThreshold: 2,
	})

	require.NoError(t, RecordChannelBaseURLFailure(ch.Id, 2101, "gpt-4o", 401))

	baseURL, found, err := model.GetChannelBaseURLByID(2101)
	require.NoError(t, err)
	require.True(t, found)
	require.NotNil(t, baseURL)
	assert.True(t, baseURL.Enabled)
	assert.Equal(t, 1, baseURL.ConsecutiveFailures)
	assert.Equal(t, 401, baseURL.LastFailureStatusCode)
	assert.Equal(t, "gpt-4o", baseURL.LastFailureModel)
	assert.Equal(t, "", baseURL.DisableSource)

	require.NoError(t, RecordChannelBaseURLFailure(ch.Id, 2101, "gpt-4o", 503))

	baseURL, found, err = model.GetChannelBaseURLByID(2101)
	require.NoError(t, err)
	require.True(t, found)
	require.NotNil(t, baseURL)
	assert.False(t, baseURL.Enabled)
	assert.Equal(t, 2, baseURL.ConsecutiveFailures)
	assert.Equal(t, model.ChannelBaseURLDisableSourceAutoError, baseURL.DisableSource)
	assert.NotZero(t, baseURL.DisabledAt)
	assert.Contains(t, baseURL.DisableReason, "status_code=503")
	assert.Contains(t, baseURL.DisableReason, "threshold=2")
}

func TestRecordChannelBaseURLFailure_NonMatchingFailureResetsCounter(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 22, "")
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:                        2201,
		ChannelId:                 ch.Id,
		Url:                       "https://reset-on-miss.example",
		Enabled:                   true,
		Weight:                    1,
		SortOrder:                 0,
		AutoDisableEnabled:        true,
		AutoDisableStatusCodes:    "401,503",
		AutoDisableErrorThreshold: 3,
		AutoDisableModels:         "gpt-4o",
	})

	require.NoError(t, RecordChannelBaseURLFailure(ch.Id, 2201, "gpt-4o", 401))
	require.NoError(t, RecordChannelBaseURLFailure(ch.Id, 2201, "gpt-4.1", 401))

	baseURL, found, err := model.GetChannelBaseURLByID(2201)
	require.NoError(t, err)
	require.True(t, found)
	require.NotNil(t, baseURL)
	assert.True(t, baseURL.Enabled)
	assert.Zero(t, baseURL.ConsecutiveFailures)
	assert.Equal(t, "gpt-4.1", baseURL.LastFailureModel)
	assert.Equal(t, 401, baseURL.LastFailureStatusCode)
}

func TestRecordChannelBaseURLSuccess_ResetsCounter(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 23, "")
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:                    2301,
		ChannelId:             ch.Id,
		Url:                   "https://success-reset.example",
		Enabled:               true,
		Weight:                1,
		SortOrder:             0,
		ConsecutiveFailures:   2,
		LastFailureModel:      "gpt-4o",
		LastFailureStatusCode: 401,
	})

	require.NoError(t, RecordChannelBaseURLSuccess(ch.Id, 2301))

	baseURL, found, err := model.GetChannelBaseURLByID(2301)
	require.NoError(t, err)
	require.True(t, found)
	require.NotNil(t, baseURL)
	assert.Zero(t, baseURL.ConsecutiveFailures)
	assert.Equal(t, "gpt-4o", baseURL.LastFailureModel)
	assert.Equal(t, 401, baseURL.LastFailureStatusCode)
}

func TestUpdateChannelBaseURLHealthCheckResult_FailureDisablesAndSuccessRestoresAutoDisabled(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 25, "")
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        2501,
		ChannelId: ch.Id,
		Url:       "https://health-toggle.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})

	require.NoError(t, UpdateChannelBaseURLHealthCheckResult(ch.Id, 2501, false, "health check failed"))

	baseURL, found, err := model.GetChannelBaseURLByID(2501)
	require.NoError(t, err)
	require.True(t, found)
	require.NotNil(t, baseURL)
	assert.False(t, baseURL.Enabled)
	assert.Equal(t, model.ChannelBaseURLDisableSourceHealthCheck, baseURL.DisableSource)
	assert.Equal(t, "health check failed", baseURL.DisableReason)
	assert.False(t, baseURL.LastHealthCheckSuccess)
	assert.Equal(t, "health check failed", baseURL.LastHealthCheckMessage)

	require.NoError(t, UpdateChannelBaseURLHealthCheckResult(ch.Id, 2501, true, "ok"))

	baseURL, found, err = model.GetChannelBaseURLByID(2501)
	require.NoError(t, err)
	require.True(t, found)
	require.NotNil(t, baseURL)
	assert.True(t, baseURL.Enabled)
	assert.Equal(t, "", baseURL.DisableSource)
	assert.Equal(t, "", baseURL.DisableReason)
	assert.Zero(t, baseURL.DisabledAt)
	assert.True(t, baseURL.LastHealthCheckSuccess)
	assert.Equal(t, "ok", baseURL.LastHealthCheckMessage)
}

func TestUpdateChannelBaseURLHealthCheckResult_ManualDisableDoesNotAutoRestore(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)
	disableMemoryCacheForTest(t)

	ch := seedChannelForTest(t, 26, "")
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:                     2601,
		ChannelId:              ch.Id,
		Url:                    "https://manual-disabled.example",
		Enabled:                false,
		Weight:                 1,
		SortOrder:              0,
		DisableSource:          model.ChannelBaseURLDisableSourceManual,
		DisabledAt:             456,
		LastHealthCheckMessage: "old",
	})

	require.NoError(t, UpdateChannelBaseURLHealthCheckResult(ch.Id, 2601, true, "recovered"))

	baseURL, found, err := model.GetChannelBaseURLByID(2601)
	require.NoError(t, err)
	require.True(t, found)
	require.NotNil(t, baseURL)
	assert.False(t, baseURL.Enabled)
	assert.Equal(t, model.ChannelBaseURLDisableSourceManual, baseURL.DisableSource)
	assert.Equal(t, int64(456), baseURL.DisabledAt)
	assert.True(t, baseURL.LastHealthCheckSuccess)
	assert.Equal(t, "recovered", baseURL.LastHealthCheckMessage)
}

func TestRecordChannelBaseURLFailure_RefreshesSelectionAfterAutoDisable(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	truncateChannelBaseURLTables(t)

	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})

	ch := seedChannelForTest(t, 24, "")
	ch.Group = "default"
	ch.Models = "gpt-4o"
	require.NoError(t, model.DB.Save(ch).Error)
	require.NoError(t, model.DB.AutoMigrate(&model.Ability{}))
	priority := int64(0)
	require.NoError(t, model.DB.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-4o",
		ChannelId: ch.Id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    1,
	}).Error)
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:                        2401,
		ChannelId:                 ch.Id,
		Url:                       "https://selected-then-disabled.example",
		Enabled:                   true,
		Weight:                    1,
		SortOrder:                 0,
		AutoDisableEnabled:        true,
		AutoDisableStatusCodes:    "401",
		AutoDisableErrorThreshold: 1,
	})
	seedChannelBaseURL(t, &model.ChannelBaseURL{
		Id:        2402,
		ChannelId: ch.Id,
		Url:       "https://still-enabled.example",
		Enabled:   true,
		Weight:    1,
		SortOrder: 0,
	})
	model.InitChannelCache()

	require.NoError(t, RecordChannelBaseURLFailure(ch.Id, 2401, "gpt-4o", 401))

	selected, apiErr := SelectChannelBaseURL(nil, ch, 0)
	require.Nil(t, apiErr)
	assert.Equal(t, 2402, selected.BaseURLID)
	assert.Equal(t, "https://still-enabled.example", selected.URL)
}

func TestChannelBaseURLStateProperty_RandomEventSequence(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	disableMemoryCacheForTest(t)

	type shadowState struct {
		enabled               bool
		disableSource         string
		consecutiveFailures   int
		lastFailureStatusCode int
		lastFailureModel      string
		lastHealthSuccess     bool
		lastHealthMessage     string
	}

	applyManualState := func(t *testing.T, baseURLID int, disable bool) {
		t.Helper()
		baseURL, found, err := model.GetChannelBaseURLByID(baseURLID)
		require.NoError(t, err)
		require.True(t, found)
		require.NotNil(t, baseURL)
		if disable {
			baseURL.MarkManualDisabled()
		} else {
			baseURL.MarkManualEnabled()
		}
		require.NoError(t, model.DB.Save(baseURL).Error)
	}

	for seed := int64(0); seed < 12; seed++ {
		t.Run(fmt.Sprintf("seed_%d", seed), func(t *testing.T) {
			truncateChannelBaseURLTables(t)

			ch := seedChannelForTest(t, 3000+int(seed), "")
			seedChannelBaseURL(t, &model.ChannelBaseURL{
				Id:                        3100 + int(seed),
				ChannelId:                 ch.Id,
				Url:                       fmt.Sprintf("https://property-%d.example", seed),
				Enabled:                   true,
				Weight:                    1,
				SortOrder:                 0,
				AutoDisableEnabled:        true,
				AutoDisableStatusCodes:    "401",
				AutoDisableErrorThreshold: 2,
				AutoDisableModels:         "gpt-4o",
			})

			shadow := shadowState{
				enabled: true,
			}
			random := rand.New(rand.NewSource(seed))
			baseURLID := 3100 + int(seed)

			for step := 0; step < 48; step++ {
				event := random.Intn(7)
				switch event {
				case 0:
					require.NoError(t, RecordChannelBaseURLFailure(ch.Id, baseURLID, "gpt-4o", 401))
					shadow.lastFailureModel = "gpt-4o"
					shadow.lastFailureStatusCode = 401
					shadow.consecutiveFailures++
					if shadow.consecutiveFailures >= 2 {
						shadow.enabled = false
						shadow.disableSource = model.ChannelBaseURLDisableSourceAutoError
					}
				case 1:
					require.NoError(t, RecordChannelBaseURLFailure(ch.Id, baseURLID, "gpt-4.1", 401))
					shadow.lastFailureModel = "gpt-4.1"
					shadow.lastFailureStatusCode = 401
					shadow.consecutiveFailures = 0
				case 2:
					require.NoError(t, RecordChannelBaseURLFailure(ch.Id, baseURLID, "gpt-4o", 503))
					shadow.lastFailureModel = "gpt-4o"
					shadow.lastFailureStatusCode = 503
					shadow.consecutiveFailures = 0
				case 3:
					require.NoError(t, RecordChannelBaseURLSuccess(ch.Id, baseURLID))
					shadow.consecutiveFailures = 0
				case 4:
					applyManualState(t, baseURLID, true)
					shadow.enabled = false
					shadow.disableSource = model.ChannelBaseURLDisableSourceManual
					shadow.consecutiveFailures = 0
				case 5:
					applyManualState(t, baseURLID, false)
					shadow.enabled = true
					shadow.disableSource = ""
					shadow.consecutiveFailures = 0
				case 6:
					success := random.Intn(2) == 0
					message := "hc-fail"
					if success {
						message = "hc-ok"
					}
					require.NoError(t, UpdateChannelBaseURLHealthCheckResult(ch.Id, baseURLID, success, message))
					shadow.lastHealthSuccess = success
					shadow.lastHealthMessage = message
					switch {
					case success && shadow.disableSource == model.ChannelBaseURLDisableSourceManual:
					case success && (shadow.disableSource == model.ChannelBaseURLDisableSourceAutoError || shadow.disableSource == model.ChannelBaseURLDisableSourceHealthCheck):
						shadow.enabled = true
						shadow.disableSource = ""
						shadow.consecutiveFailures = 0
					case !success && shadow.disableSource == model.ChannelBaseURLDisableSourceManual:
					case !success:
						shadow.enabled = false
						shadow.disableSource = model.ChannelBaseURLDisableSourceHealthCheck
						shadow.consecutiveFailures = 0
					}
				}

				baseURL, found, err := model.GetChannelBaseURLByID(baseURLID)
				require.NoError(t, err)
				require.True(t, found)
				require.NotNil(t, baseURL)

				assert.Equal(t, shadow.enabled, baseURL.Enabled, "seed=%d step=%d", seed, step)
				assert.Equal(t, shadow.disableSource, baseURL.DisableSource, "seed=%d step=%d", seed, step)
				assert.Equal(t, shadow.consecutiveFailures, baseURL.ConsecutiveFailures, "seed=%d step=%d", seed, step)
				assert.Equal(t, shadow.lastFailureStatusCode, baseURL.LastFailureStatusCode, "seed=%d step=%d", seed, step)
				assert.Equal(t, shadow.lastFailureModel, baseURL.LastFailureModel, "seed=%d step=%d", seed, step)
				assert.Equal(t, shadow.lastHealthSuccess, baseURL.LastHealthCheckSuccess, "seed=%d step=%d", seed, step)
				assert.Equal(t, shadow.lastHealthMessage, baseURL.LastHealthCheckMessage, "seed=%d step=%d", seed, step)
				assert.GreaterOrEqual(t, baseURL.ConsecutiveFailures, 0, "seed=%d step=%d", seed, step)
				if baseURL.Enabled {
					assert.Equal(t, "", baseURL.DisableSource, "enabled rows must not keep disable_source; seed=%d step=%d", seed, step)
				}
				if shadow.disableSource == model.ChannelBaseURLDisableSourceManual && shadow.lastHealthSuccess {
					assert.False(t, baseURL.Enabled, "manual disable must survive health check success; seed=%d step=%d", seed, step)
				}
			}
		})
	}
}

func TestChannelBaseURLStateProperty_UpdatesDoNotLeakToOtherBaseURLs(t *testing.T) {
	ensureChannelBaseURLSchema(t)
	disableMemoryCacheForTest(t)

	type stableFields struct {
		Enabled                bool
		DisableSource          string
		DisableReason          string
		DisabledAt             int64
		ConsecutiveFailures    int
		LastFailureStatusCode  int
		LastFailureModel       string
		LastFailureAt          int64
		LastHealthCheckAt      int64
		LastHealthCheckSuccess bool
		LastHealthCheckMessage string
	}

	snapshot := func(t *testing.T, baseURLID int) stableFields {
		t.Helper()
		baseURL, found, err := model.GetChannelBaseURLByID(baseURLID)
		require.NoError(t, err)
		require.True(t, found)
		require.NotNil(t, baseURL)
		return stableFields{
			Enabled:                baseURL.Enabled,
			DisableSource:          baseURL.DisableSource,
			DisableReason:          baseURL.DisableReason,
			DisabledAt:             baseURL.DisabledAt,
			ConsecutiveFailures:    baseURL.ConsecutiveFailures,
			LastFailureStatusCode:  baseURL.LastFailureStatusCode,
			LastFailureModel:       baseURL.LastFailureModel,
			LastFailureAt:          baseURL.LastFailureAt,
			LastHealthCheckAt:      baseURL.LastHealthCheckAt,
			LastHealthCheckSuccess: baseURL.LastHealthCheckSuccess,
			LastHealthCheckMessage: baseURL.LastHealthCheckMessage,
		}
	}

	for seed := int64(100); seed < 110; seed++ {
		t.Run(fmt.Sprintf("seed_%d", seed), func(t *testing.T) {
			truncateChannelBaseURLTables(t)

			ch := seedChannelForTest(t, 4000+int(seed), "")
			targetID := 4100 + int(seed)
			otherIDs := []int{4200 + int(seed), 4300 + int(seed), 4400 + int(seed)}

			seedChannelBaseURL(t, &model.ChannelBaseURL{
				Id:                        targetID,
				ChannelId:                 ch.Id,
				Url:                       fmt.Sprintf("https://target-%d.example", seed),
				Enabled:                   true,
				Weight:                    1,
				SortOrder:                 0,
				AutoDisableEnabled:        true,
				AutoDisableStatusCodes:    "401",
				AutoDisableErrorThreshold: 2,
				AutoDisableModels:         "gpt-4o",
			})
			for index, otherID := range otherIDs {
				seedChannelBaseURL(t, &model.ChannelBaseURL{
					Id:                     otherID,
					ChannelId:              ch.Id,
					Url:                    fmt.Sprintf("https://other-%d-%d.example", seed, index),
					Enabled:                true,
					Weight:                 1,
					SortOrder:              index + 1,
					LastHealthCheckMessage: fmt.Sprintf("stable-%d", index),
				})
			}

			baseline := map[int]stableFields{}
			for _, otherID := range otherIDs {
				baseline[otherID] = snapshot(t, otherID)
			}

			random := rand.New(rand.NewSource(seed))
			for step := 0; step < 40; step++ {
				switch random.Intn(4) {
				case 0:
					require.NoError(t, RecordChannelBaseURLFailure(ch.Id, targetID, "gpt-4o", 401))
				case 1:
					require.NoError(t, RecordChannelBaseURLFailure(ch.Id, targetID, "gpt-4.1", 401))
				case 2:
					require.NoError(t, RecordChannelBaseURLSuccess(ch.Id, targetID))
				case 3:
					require.NoError(t, UpdateChannelBaseURLHealthCheckResult(ch.Id, targetID, random.Intn(2) == 0, "property-health"))
				}

				for _, otherID := range otherIDs {
					assert.Equal(t, baseline[otherID], snapshot(t, otherID), "seed=%d step=%d otherID=%d", seed, step, otherID)
				}
			}
		})
	}
}
