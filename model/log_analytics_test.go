package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertLogForAnalyticsTest(t *testing.T, log *Log) {
	t.Helper()
	require.NoError(t, LOG_DB.Create(log).Error)
}

func insertChannelForAnalyticsTest(t *testing.T, channel *Channel) {
	t.Helper()
	require.NoError(t, DB.Create(channel).Error)
}

func TestGetLogAnalytics_ModelMetrics(t *testing.T) {
	truncateTables(t)
	initCol()

	insertChannelForAnalyticsTest(t, &Channel{Id: 1, Name: "channel-a"})
	insertChannelForAnalyticsTest(t, &Channel{Id: 2, Name: "channel-b"})

	base := int64(1712800000)
	insertLogForAnalyticsTest(t, &Log{CreatedAt: base, Type: LogTypeConsume, ModelName: "gpt-4o", ChannelId: 1, UseTime: 3, Username: "alice"})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: base + 10, Type: LogTypeConsume, ModelName: "gpt-4o", ChannelId: 1, UseTime: 5, Username: "alice"})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: base + 20, Type: LogTypeError, ModelName: "gpt-4o", ChannelId: 1, UseTime: 7, Username: "alice"})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: base + 30, Type: LogTypeConsume, ModelName: "claude-3-7-sonnet", ChannelId: 2, UseTime: 2, Username: "alice"})

	result, err := GetLogAnalytics(LogAnalyticsFilter{
		StartTimestamp: base - 1,
		EndTimestamp:   base + 40,
		Username:       "alice",
		DefaultTime:    "hour",
	}, LogAnalyticsDimensionModel)
	require.NoError(t, err)

	assert.Equal(t, "model", result.Dimension)
	assert.Len(t, result.Ranking, 2)
	assert.Equal(t, 4, result.Summary.TotalRequests)
	assert.Equal(t, 3, result.Summary.SuccessRequests)
	assert.Equal(t, 1, result.Summary.ErrorRequests)
	assert.InDelta(t, 75.0, result.Summary.SuccessRatePercent, 0.01)
	assert.InDelta(t, 25.0, result.Summary.ErrorRatePercent, 0.01)
	assert.InDelta(t, 4.25, result.Summary.AvgLatencySeconds, 0.01)
	assert.InDelta(t, 7.0, result.Summary.P95LatencySeconds, 0.01)
	assert.NotZero(t, result.Summary.LatencyStddevSeconds)
	assert.Len(t, result.Trend, 1)

	first := result.Ranking[0]
	assert.Equal(t, "gpt-4o", first.Label)
	assert.Equal(t, 3, first.TotalRequests)
	assert.InDelta(t, 66.67, first.SuccessRatePercent, 0.01)
}

func TestGetLogAnalytics_ChannelPeakConcurrency(t *testing.T) {
	truncateTables(t)
	initCol()

	insertChannelForAnalyticsTest(t, &Channel{Id: 10, Name: "primary-channel"})

	insertLogForAnalyticsTest(t, &Log{CreatedAt: 100, Type: LogTypeConsume, ChannelId: 10, UseTime: 5})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: 101, Type: LogTypeConsume, ChannelId: 10, UseTime: 4})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: 102, Type: LogTypeError, ChannelId: 10, UseTime: 3})

	result, err := GetLogAnalytics(LogAnalyticsFilter{
		StartTimestamp: 90,
		EndTimestamp:   110,
		DefaultTime:    "hour",
	}, LogAnalyticsDimensionChannel)
	require.NoError(t, err)

	require.Len(t, result.Ranking, 1)
	assert.Equal(t, "primary-channel", result.Ranking[0].Label)
	assert.Equal(t, 3, result.Ranking[0].PeakEstimatedConcurrency)
	assert.Equal(t, 3, result.Summary.PeakEstimatedConcurrency)
}

func TestGetLogAnalytics_ConservationInvariant(t *testing.T) {
	truncateTables(t)
	initCol()

	insertChannelForAnalyticsTest(t, &Channel{Id: 21, Name: "channel-21"})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: 200, Type: LogTypeConsume, ModelName: "m1", ChannelId: 21, UseTime: 1})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: 201, Type: LogTypeError, ModelName: "m1", ChannelId: 21, UseTime: 2})
	insertLogForAnalyticsTest(t, &Log{CreatedAt: 202, Type: LogTypeConsume, ModelName: "m2", ChannelId: 21, UseTime: 3})

	result, err := GetLogAnalytics(LogAnalyticsFilter{
		StartTimestamp: 190,
		EndTimestamp:   210,
		DefaultTime:    "day",
	}, LogAnalyticsDimensionModel)
	require.NoError(t, err)

	total := 0
	success := 0
	failed := 0
	for _, item := range result.Ranking {
		assert.Equal(t, item.TotalRequests, item.SuccessRequests+item.ErrorRequests)
		total += item.TotalRequests
		success += item.SuccessRequests
		failed += item.ErrorRequests
	}

	assert.Equal(t, total, result.Summary.TotalRequests)
	assert.Equal(t, success, result.Summary.SuccessRequests)
	assert.Equal(t, failed, result.Summary.ErrorRequests)
	assert.Equal(t, result.Summary.TotalRequests, result.Summary.SuccessRequests+result.Summary.ErrorRequests)
}
