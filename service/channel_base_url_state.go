package service

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func RecordChannelBaseURLFailure(channelID int, baseURLID int, modelName string, statusCode int) error {
	if channelID <= 0 || baseURLID <= 0 {
		return nil
	}

	lock := model.GetChannelPollingLock(channelID)
	lock.Lock()
	defer lock.Unlock()

	baseURL, found, err := model.GetChannelBaseURLByID(baseURLID)
	if err != nil {
		return err
	}
	if !found || baseURL == nil || baseURL.ChannelId != channelID {
		return nil
	}
	if !baseURL.AutoDisableEnabled {
		return nil
	}

	now := common.GetTimestamp()
	baseURL.LastFailureAt = now
	baseURL.LastFailureStatusCode = statusCode
	baseURL.LastFailureModel = strings.TrimSpace(modelName)

	matched, err := shouldMatchChannelBaseURLAutoDisableRule(baseURL, modelName, statusCode)
	if err != nil {
		return err
	}
	if !matched {
		if baseURL.ConsecutiveFailures == 0 {
			return model.DB.Model(baseURL).Select("updated_at", "last_failure_at", "last_failure_status_code", "last_failure_model").Updates(baseURL).Error
		}
		baseURL.ConsecutiveFailures = 0
		return model.DB.Model(baseURL).Select(
			"updated_at",
			"consecutive_failures",
			"last_failure_at",
			"last_failure_status_code",
			"last_failure_model",
		).Updates(baseURL).Error
	}

	baseURL.ConsecutiveFailures++
	updates := []string{
		"updated_at",
		"consecutive_failures",
		"last_failure_at",
		"last_failure_status_code",
		"last_failure_model",
	}

	cacheShouldRefresh := false
	if baseURL.AutoDisableErrorThreshold > 0 && baseURL.ConsecutiveFailures >= baseURL.AutoDisableErrorThreshold {
		baseURL.Enabled = false
		baseURL.DisableSource = model.ChannelBaseURLDisableSourceAutoError
		baseURL.DisableReason = fmt.Sprintf(
			"status_code=%d model=%s consecutive_failures=%d threshold=%d",
			statusCode,
			strings.TrimSpace(modelName),
			baseURL.ConsecutiveFailures,
			baseURL.AutoDisableErrorThreshold,
		)
		baseURL.DisabledAt = now
		updates = append(updates, "enabled", "disable_source", "disable_reason", "disabled_at")
		cacheShouldRefresh = true
	}

	if err := model.DB.Model(baseURL).Select(updates).Updates(baseURL).Error; err != nil {
		return err
	}
	if cacheShouldRefresh {
		model.InitChannelCache()
	}
	return nil
}

func RecordChannelBaseURLSuccess(channelID int, baseURLID int) error {
	if channelID <= 0 || baseURLID <= 0 {
		return nil
	}

	lock := model.GetChannelPollingLock(channelID)
	lock.Lock()
	defer lock.Unlock()

	baseURL, found, err := model.GetChannelBaseURLByID(baseURLID)
	if err != nil {
		return err
	}
	if !found || baseURL == nil || baseURL.ChannelId != channelID {
		return nil
	}
	if baseURL.ConsecutiveFailures == 0 {
		return nil
	}

	baseURL.ConsecutiveFailures = 0
	return model.DB.Model(baseURL).Select("updated_at", "consecutive_failures").Updates(baseURL).Error
}

func UpdateChannelBaseURLHealthCheckResult(channelID int, baseURLID int, success bool, message string) error {
	if channelID <= 0 || baseURLID <= 0 {
		return nil
	}

	lock := model.GetChannelPollingLock(channelID)
	lock.Lock()
	defer lock.Unlock()

	baseURL, found, err := model.GetChannelBaseURLByID(baseURLID)
	if err != nil {
		return err
	}
	if !found || baseURL == nil || baseURL.ChannelId != channelID {
		return nil
	}

	now := common.GetTimestamp()
	baseURL.LastHealthCheckAt = now
	baseURL.LastHealthCheckSuccess = success
	baseURL.LastHealthCheckMessage = strings.TrimSpace(message)

	updates := []string{
		"updated_at",
		"last_health_check_at",
		"last_health_check_success",
		"last_health_check_message",
	}
	cacheShouldRefresh := false

	switch {
	case success && baseURL.DisableSource == model.ChannelBaseURLDisableSourceManual:
		// Manual disable remains authoritative; only refresh the health check observation.
	case success && isSystemDisabledChannelBaseURL(baseURL):
		baseURL.Enabled = true
		baseURL.ClearDisableState()
		baseURL.ResetFailureState()
		updates = append(updates, "enabled", "disable_source", "disable_reason", "disabled_at", "consecutive_failures")
		cacheShouldRefresh = true
	case !success && baseURL.DisableSource == model.ChannelBaseURLDisableSourceManual:
		// Preserve manual disable source while still recording the failed health check.
	case !success:
		baseURL.Enabled = false
		baseURL.DisableSource = model.ChannelBaseURLDisableSourceHealthCheck
		baseURL.DisableReason = strings.TrimSpace(message)
		baseURL.DisabledAt = now
		baseURL.ResetFailureState()
		updates = append(updates, "enabled", "disable_source", "disable_reason", "disabled_at", "consecutive_failures")
		cacheShouldRefresh = true
	}

	if err := model.DB.Model(baseURL).Select(updates).Updates(baseURL).Error; err != nil {
		return err
	}
	if cacheShouldRefresh {
		model.InitChannelCache()
	}
	return nil
}

func shouldMatchChannelBaseURLAutoDisableRule(baseURL *model.ChannelBaseURL, modelName string, statusCode int) (bool, error) {
	if baseURL == nil || !baseURL.AutoDisableEnabled {
		return false, nil
	}
	statusRules, err := operation_setting.ParseHTTPStatusCodeRanges(baseURL.AutoDisableStatusCodes)
	if err != nil {
		return false, err
	}
	if !matchStatusCodeRanges(statusRules, statusCode) {
		return false, nil
	}
	return matchChannelBaseURLModels(baseURL.AutoDisableModels, modelName), nil
}

func matchChannelBaseURLModels(rule string, modelName string) bool {
	rule = strings.TrimSpace(rule)
	if rule == "" {
		return true
	}
	modelName = strings.TrimSpace(modelName)
	for _, item := range strings.Split(rule, ",") {
		if strings.TrimSpace(item) == modelName {
			return true
		}
	}
	return false
}

func matchStatusCodeRanges(ranges []operation_setting.StatusCodeRange, statusCode int) bool {
	if len(ranges) == 0 {
		return false
	}
	for _, r := range ranges {
		if statusCode < r.Start {
			return false
		}
		if statusCode <= r.End {
			return true
		}
	}
	return false
}

func isSystemDisabledChannelBaseURL(baseURL *model.ChannelBaseURL) bool {
	if baseURL == nil {
		return false
	}
	switch baseURL.DisableSource {
	case model.ChannelBaseURLDisableSourceAutoError, model.ChannelBaseURLDisableSourceHealthCheck:
		return true
	default:
		return false
	}
}
