package model

import (
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type LogAnalyticsDimension string

const (
	LogAnalyticsDimensionChannel LogAnalyticsDimension = "channel"
	LogAnalyticsDimensionModel   LogAnalyticsDimension = "model"
)

type LogAnalyticsFilter struct {
	StartTimestamp int64  `json:"start_timestamp"`
	EndTimestamp   int64  `json:"end_timestamp"`
	Username       string `json:"username"`
	DefaultTime    string `json:"default_time"`
}

type LogAnalyticsSummary struct {
	Dimension                string  `json:"dimension"`
	EntityCount              int     `json:"entity_count"`
	TotalRequests            int     `json:"total_requests"`
	SuccessRequests          int     `json:"success_requests"`
	ErrorRequests            int     `json:"error_requests"`
	SuccessRatePercent       float64 `json:"success_rate_percent"`
	ErrorRatePercent         float64 `json:"error_rate_percent"`
	AvgLatencySeconds        float64 `json:"avg_latency_seconds"`
	P95LatencySeconds        float64 `json:"p95_latency_seconds"`
	LatencyStddevSeconds     float64 `json:"latency_stddev_seconds"`
	PeakEstimatedConcurrency int     `json:"peak_estimated_concurrency"`
	VolatilityPercent        float64 `json:"volatility_percent"`
	StabilityRiskPercent     float64 `json:"stability_risk_percent"`
	StabilityScore           float64 `json:"stability_score"`
}

type LogAnalyticsTrendPoint struct {
	BucketStart              int64   `json:"bucket_start"`
	BucketLabel              string  `json:"bucket_label"`
	TotalRequests            int     `json:"total_requests"`
	SuccessRequests          int     `json:"success_requests"`
	ErrorRequests            int     `json:"error_requests"`
	SuccessRatePercent       float64 `json:"success_rate_percent"`
	ErrorRatePercent         float64 `json:"error_rate_percent"`
	AvgLatencySeconds        float64 `json:"avg_latency_seconds"`
	P95LatencySeconds        float64 `json:"p95_latency_seconds"`
	LatencyStddevSeconds     float64 `json:"latency_stddev_seconds"`
	PeakEstimatedConcurrency int     `json:"peak_estimated_concurrency"`
	VolatilityPercent        float64 `json:"volatility_percent"`
	StabilityRiskPercent     float64 `json:"stability_risk_percent"`
	StabilityScore           float64 `json:"stability_score"`
}

type LogAnalyticsRankingItem struct {
	Key                      string  `json:"key"`
	Label                    string  `json:"label"`
	ChannelID                int     `json:"channel_id,omitempty"`
	TotalRequests            int     `json:"total_requests"`
	SuccessRequests          int     `json:"success_requests"`
	ErrorRequests            int     `json:"error_requests"`
	SuccessRatePercent       float64 `json:"success_rate_percent"`
	ErrorRatePercent         float64 `json:"error_rate_percent"`
	AvgLatencySeconds        float64 `json:"avg_latency_seconds"`
	P95LatencySeconds        float64 `json:"p95_latency_seconds"`
	LatencyStddevSeconds     float64 `json:"latency_stddev_seconds"`
	PeakEstimatedConcurrency int     `json:"peak_estimated_concurrency"`
	VolatilityPercent        float64 `json:"volatility_percent"`
	StabilityRiskPercent     float64 `json:"stability_risk_percent"`
	StabilityScore           float64 `json:"stability_score"`
}

type LogAnalyticsResult struct {
	Dimension string                    `json:"dimension"`
	Filter    LogAnalyticsFilter        `json:"filter"`
	Summary   LogAnalyticsSummary       `json:"summary"`
	Trend     []LogAnalyticsTrendPoint  `json:"trend"`
	Ranking   []LogAnalyticsRankingItem `json:"ranking"`
}

type analyticsLogRow struct {
	CreatedAt int64
	Type      int
	ChannelID int
	ModelName string
	UseTime   int
}

type analyticsAccumulator struct {
	total      int
	success    int
	failed     int
	latencies  []float64
	latencySum float64
	sumSquares float64
	events     map[int64]int
}

type analyticsMetrics struct {
	TotalRequests            int
	SuccessRequests          int
	ErrorRequests            int
	SuccessRatePercent       float64
	ErrorRatePercent         float64
	AvgLatencySeconds        float64
	P95LatencySeconds        float64
	LatencyStddevSeconds     float64
	PeakEstimatedConcurrency int
	VolatilityPercent        float64
	StabilityRiskPercent     float64
	StabilityScore           float64
}

func GetLogAnalytics(filter LogAnalyticsFilter, dimension LogAnalyticsDimension) (*LogAnalyticsResult, error) {
	if dimension != LogAnalyticsDimensionChannel && dimension != LogAnalyticsDimensionModel {
		return nil, errors.New("unsupported analytics dimension")
	}

	bucketSize := normalizeAnalyticsBucketSize(filter.DefaultTime)
	rows, err := loadAnalyticsRows(filter)
	if err != nil {
		return nil, err
	}

	result := buildLogAnalyticsResult(rows, filter, dimension, bucketSize)
	return &result, nil
}

func loadAnalyticsRows(filter LogAnalyticsFilter) ([]analyticsLogRow, error) {
	query := LOG_DB.Model(&Log{}).
		Select("created_at, type, channel_id, model_name, use_time").
		Where("type IN ?", []int{LogTypeConsume, LogTypeError})

	if filter.StartTimestamp != 0 {
		query = query.Where("created_at >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp != 0 {
		query = query.Where("created_at <= ?", filter.EndTimestamp)
	}
	if filter.Username != "" {
		query = query.Where("username = ?", filter.Username)
	}

	rows := make([]analyticsLogRow, 0, 256)
	err := query.Order("created_at asc").Find(&rows).Error
	if err != nil {
		common.SysError("failed to load analytics rows: " + err.Error())
		return nil, errors.New("查询分析数据失败")
	}
	return rows, nil
}

func buildLogAnalyticsResult(rows []analyticsLogRow, filter LogAnalyticsFilter, dimension LogAnalyticsDimension, bucketSize int64) LogAnalyticsResult {
	totalAcc := newAnalyticsAccumulator()
	perEntity := make(map[string]*analyticsAccumulator)
	perBucket := make(map[int64]*analyticsAccumulator)
	channelIDs := make(map[int]struct{})

	for _, row := range rows {
		totalAcc.add(row)

		entityKey, channelID := resolveAnalyticsKey(row, dimension)
		acc, ok := perEntity[entityKey]
		if !ok {
			acc = newAnalyticsAccumulator()
			perEntity[entityKey] = acc
		}
		acc.add(row)
		if dimension == LogAnalyticsDimensionChannel && channelID != 0 {
			channelIDs[channelID] = struct{}{}
		}

		bucketStart := alignAnalyticsBucket(row.CreatedAt, bucketSize)
		bucketAcc, ok := perBucket[bucketStart]
		if !ok {
			bucketAcc = newAnalyticsAccumulator()
			perBucket[bucketStart] = bucketAcc
		}
		bucketAcc.add(row)

	}

	channelNames := loadAnalyticsChannelNames(channelIDs)
	ranking := make([]LogAnalyticsRankingItem, 0, len(perEntity))
	for key, acc := range perEntity {
		label, channelID := resolveAnalyticsLabel(key, dimension, channelNames)
		metrics := acc.metrics()
		ranking = append(ranking, LogAnalyticsRankingItem{
			Key:                      key,
			Label:                    label,
			ChannelID:                channelID,
			TotalRequests:            metrics.TotalRequests,
			SuccessRequests:          metrics.SuccessRequests,
			ErrorRequests:            metrics.ErrorRequests,
			SuccessRatePercent:       metrics.SuccessRatePercent,
			ErrorRatePercent:         metrics.ErrorRatePercent,
			AvgLatencySeconds:        metrics.AvgLatencySeconds,
			P95LatencySeconds:        metrics.P95LatencySeconds,
			LatencyStddevSeconds:     metrics.LatencyStddevSeconds,
			PeakEstimatedConcurrency: metrics.PeakEstimatedConcurrency,
			VolatilityPercent:        metrics.VolatilityPercent,
			StabilityRiskPercent:     metrics.StabilityRiskPercent,
			StabilityScore:           metrics.StabilityScore,
		})
	}

	sort.Slice(ranking, func(i, j int) bool {
		if ranking[i].TotalRequests != ranking[j].TotalRequests {
			return ranking[i].TotalRequests > ranking[j].TotalRequests
		}
		if ranking[i].SuccessRatePercent != ranking[j].SuccessRatePercent {
			return ranking[i].SuccessRatePercent > ranking[j].SuccessRatePercent
		}
		return ranking[i].Label < ranking[j].Label
	})

	trendKeys := make([]int64, 0, len(perBucket))
	for bucketStart := range perBucket {
		trendKeys = append(trendKeys, bucketStart)
	}
	sort.Slice(trendKeys, func(i, j int) bool { return trendKeys[i] < trendKeys[j] })

	trend := make([]LogAnalyticsTrendPoint, 0, len(trendKeys))
	for _, bucketStart := range trendKeys {
		metrics := perBucket[bucketStart].metrics()
		trend = append(trend, LogAnalyticsTrendPoint{
			BucketStart:              bucketStart,
			BucketLabel:              formatAnalyticsBucket(bucketStart, bucketSize),
			TotalRequests:            metrics.TotalRequests,
			SuccessRequests:          metrics.SuccessRequests,
			ErrorRequests:            metrics.ErrorRequests,
			SuccessRatePercent:       metrics.SuccessRatePercent,
			ErrorRatePercent:         metrics.ErrorRatePercent,
			AvgLatencySeconds:        metrics.AvgLatencySeconds,
			P95LatencySeconds:        metrics.P95LatencySeconds,
			LatencyStddevSeconds:     metrics.LatencyStddevSeconds,
			PeakEstimatedConcurrency: metrics.PeakEstimatedConcurrency,
			VolatilityPercent:        metrics.VolatilityPercent,
			StabilityRiskPercent:     metrics.StabilityRiskPercent,
			StabilityScore:           metrics.StabilityScore,
		})
	}

	totalMetrics := totalAcc.metrics()
	return LogAnalyticsResult{
		Dimension: string(dimension),
		Filter: LogAnalyticsFilter{
			StartTimestamp: filter.StartTimestamp,
			EndTimestamp:   filter.EndTimestamp,
			Username:       filter.Username,
			DefaultTime:    normalizeAnalyticsDefaultTime(filter.DefaultTime),
		},
		Summary: LogAnalyticsSummary{
			Dimension:                string(dimension),
			EntityCount:              len(ranking),
			TotalRequests:            totalMetrics.TotalRequests,
			SuccessRequests:          totalMetrics.SuccessRequests,
			ErrorRequests:            totalMetrics.ErrorRequests,
			SuccessRatePercent:       totalMetrics.SuccessRatePercent,
			ErrorRatePercent:         totalMetrics.ErrorRatePercent,
			AvgLatencySeconds:        totalMetrics.AvgLatencySeconds,
			P95LatencySeconds:        totalMetrics.P95LatencySeconds,
			LatencyStddevSeconds:     totalMetrics.LatencyStddevSeconds,
			PeakEstimatedConcurrency: totalMetrics.PeakEstimatedConcurrency,
			VolatilityPercent:        totalMetrics.VolatilityPercent,
			StabilityRiskPercent:     totalMetrics.StabilityRiskPercent,
			StabilityScore:           totalMetrics.StabilityScore,
		},
		Trend:   trend,
		Ranking: ranking,
	}
}

func newAnalyticsAccumulator() *analyticsAccumulator {
	return &analyticsAccumulator{
		latencies: make([]float64, 0, 16),
		events:    make(map[int64]int),
	}
}

func (a *analyticsAccumulator) add(row analyticsLogRow) {
	if row.Type != LogTypeConsume && row.Type != LogTypeError {
		return
	}

	latency := math.Max(float64(row.UseTime), 0)
	a.total++
	if row.Type == LogTypeConsume {
		a.success++
	} else {
		a.failed++
	}
	a.latencySum += latency
	a.sumSquares += latency * latency
	a.latencies = append(a.latencies, latency)

	start := row.CreatedAt - int64(maxInt(row.UseTime, 0))
	if start < 0 {
		start = 0
	}
	a.events[start]++
	a.events[row.CreatedAt+1]--
}

func (a *analyticsAccumulator) metrics() analyticsMetrics {
	metrics := analyticsMetrics{
		TotalRequests:   a.total,
		SuccessRequests: a.success,
		ErrorRequests:   a.failed,
	}
	if a.total == 0 {
		return metrics
	}

	metrics.SuccessRatePercent = roundTo2(float64(a.success) / float64(a.total) * 100)
	metrics.ErrorRatePercent = roundTo2(float64(a.failed) / float64(a.total) * 100)
	metrics.AvgLatencySeconds = roundTo2(a.latencySum / float64(a.total))
	metrics.P95LatencySeconds = roundTo2(percentile95(a.latencies))
	metrics.LatencyStddevSeconds = roundTo2(stddev(a.latencySum, a.sumSquares, a.total))
	metrics.PeakEstimatedConcurrency = peakConcurrency(a.events)

	if metrics.P95LatencySeconds > 0 {
		metrics.VolatilityPercent = roundTo2(minFloat(100, metrics.LatencyStddevSeconds/metrics.P95LatencySeconds*100))
	}
	metrics.StabilityRiskPercent = roundTo2(minFloat(100, metrics.ErrorRatePercent+metrics.VolatilityPercent))
	metrics.StabilityScore = roundTo2(maxFloat(0, 100-metrics.StabilityRiskPercent))
	return metrics
}

func resolveAnalyticsKey(row analyticsLogRow, dimension LogAnalyticsDimension) (string, int) {
	switch dimension {
	case LogAnalyticsDimensionChannel:
		if row.ChannelID == 0 {
			return "channel:0", 0
		}
		return "channel:" + strconv.Itoa(row.ChannelID), row.ChannelID
	default:
		modelName := strings.TrimSpace(row.ModelName)
		if modelName == "" {
			modelName = "__empty_model__"
		}
		return modelName, 0
	}
}

func resolveAnalyticsLabel(key string, dimension LogAnalyticsDimension, channelNames map[int]string) (string, int) {
	if dimension == LogAnalyticsDimensionModel {
		if key == "__empty_model__" {
			return "", 0
		}
		return key, 0
	}

	channelID := 0
	if strings.HasPrefix(key, "channel:") {
		channelID = common.String2Int(strings.TrimPrefix(key, "channel:"))
	}
	if channelID == 0 {
		return "", 0
	}
	return channelNames[channelID], channelID
}

func loadAnalyticsChannelNames(channelIDs map[int]struct{}) map[int]string {
	if len(channelIDs) == 0 {
		return map[int]string{}
	}
	ids := make([]int, 0, len(channelIDs))
	for id := range channelIDs {
		ids = append(ids, id)
	}
	var channels []struct {
		ID   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Table("channels").Select("id, name").Where("id IN ?", ids).Find(&channels).Error; err != nil {
		common.SysError("failed to load channel names for analytics: " + err.Error())
		return map[int]string{}
	}
	result := make(map[int]string, len(channels))
	for _, channel := range channels {
		result[channel.ID] = channel.Name
	}
	return result
}

func normalizeAnalyticsDefaultTime(defaultTime string) string {
	switch defaultTime {
	case "hour", "week":
		return defaultTime
	default:
		return "day"
	}
}

func normalizeAnalyticsBucketSize(defaultTime string) int64 {
	switch normalizeAnalyticsDefaultTime(defaultTime) {
	case "hour":
		return 3600
	case "week":
		return 7 * 24 * 3600
	default:
		return 24 * 3600
	}
}

func alignAnalyticsBucket(timestamp int64, bucketSize int64) int64 {
	if bucketSize <= 0 {
		return timestamp
	}
	return timestamp - (timestamp % bucketSize)
}

func formatAnalyticsBucket(bucketStart int64, bucketSize int64) string {
	bucketTime := time.Unix(bucketStart, 0)
	switch bucketSize {
	case 3600:
		return bucketTime.Format("2006-01-02 15:00")
	default:
		return bucketTime.Format("2006-01-02")
	}
}

func percentile95(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := append([]float64(nil), values...)
	sort.Float64s(sorted)
	index := int(math.Ceil(float64(len(sorted))*0.95)) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return sorted[index]
}

func stddev(sum float64, sumSquares float64, count int) float64 {
	if count == 0 {
		return 0
	}
	mean := sum / float64(count)
	variance := (sumSquares / float64(count)) - (mean * mean)
	if variance < 0 {
		return 0
	}
	return math.Sqrt(variance)
}

func peakConcurrency(events map[int64]int) int {
	if len(events) == 0 {
		return 0
	}
	points := make([]int64, 0, len(events))
	for ts := range events {
		points = append(points, ts)
	}
	sort.Slice(points, func(i, j int) bool { return points[i] < points[j] })

	current := 0
	peak := 0
	for _, point := range points {
		current += events[point]
		if current > peak {
			peak = current
		}
	}
	return peak
}

func roundTo2(value float64) float64 {
	return math.Round(value*100) / 100
}

func minFloat(a float64, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func maxFloat(a float64, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
