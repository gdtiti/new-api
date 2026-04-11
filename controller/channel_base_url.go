package controller

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

type ChannelBaseURLManageRequest struct {
	ChannelId                 int     `json:"channel_id"`
	Action                    string  `json:"action"`
	BaseURLId                 *int    `json:"base_url_id,omitempty"`
	Url                       *string `json:"url,omitempty"`
	Enabled                   *bool   `json:"enabled,omitempty"`
	Weight                    *int    `json:"weight,omitempty"`
	SortOrder                 *int    `json:"sort_order,omitempty"`
	AutoDisableEnabled        *bool   `json:"auto_disable_enabled,omitempty"`
	AutoDisableStatusCodes    *string `json:"auto_disable_status_codes,omitempty"`
	AutoDisableErrorThreshold *int    `json:"auto_disable_error_threshold,omitempty"`
	AutoDisableModels         *string `json:"auto_disable_models,omitempty"`
	HealthCheckEnabled        *bool   `json:"health_check_enabled,omitempty"`
	HealthCheckModel          *string `json:"health_check_model,omitempty"`
	HealthCheckEndpointType   *string `json:"health_check_endpoint_type,omitempty"`
}

func applyChannelBaseURLRuntimeConfig(baseURL *model.ChannelBaseURL, req ChannelBaseURLManageRequest) error {
	if baseURL == nil {
		return nil
	}

	if req.AutoDisableEnabled != nil {
		baseURL.AutoDisableEnabled = *req.AutoDisableEnabled
	}
	if req.AutoDisableStatusCodes != nil {
		baseURL.AutoDisableStatusCodes = strings.TrimSpace(*req.AutoDisableStatusCodes)
	}
	if req.AutoDisableErrorThreshold != nil {
		baseURL.AutoDisableErrorThreshold = *req.AutoDisableErrorThreshold
	}
	if req.AutoDisableModels != nil {
		baseURL.AutoDisableModels = strings.TrimSpace(*req.AutoDisableModels)
	}
	if req.HealthCheckEnabled != nil {
		baseURL.HealthCheckEnabled = *req.HealthCheckEnabled
	}
	if req.HealthCheckModel != nil {
		baseURL.HealthCheckModel = strings.TrimSpace(*req.HealthCheckModel)
	}
	if req.HealthCheckEndpointType != nil {
		baseURL.HealthCheckEndpointType = strings.TrimSpace(*req.HealthCheckEndpointType)
	}

	if baseURL.AutoDisableEnabled {
		if baseURL.AutoDisableErrorThreshold <= 0 {
			return errors.New("auto_disable_error_threshold 必须大于 0")
		}
		if baseURL.AutoDisableStatusCodes == "" {
			return errors.New("auto_disable_status_codes 不能为空")
		}
		if _, err := operation_setting.ParseHTTPStatusCodeRanges(baseURL.AutoDisableStatusCodes); err != nil {
			return errors.New("auto_disable_status_codes 格式无效: " + err.Error())
		}
	}
	if baseURL.HealthCheckEnabled && strings.TrimSpace(baseURL.HealthCheckModel) == "" {
		return errors.New("health_check_model 不能为空")
	}
	return nil
}

func ManageChannelBaseURLs(c *gin.Context) {
	req := ChannelBaseURLManageRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.ChannelId <= 0 {
		common.ApiErrorMsg(c, "渠道ID无效")
		return
	}
	action := strings.TrimSpace(req.Action)
	if action == "" {
		common.ApiErrorMsg(c, "action 不能为空")
		return
	}

	channel, err := model.GetChannelById(req.ChannelId, true)
	if err != nil || channel == nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "渠道不存在",
		})
		return
	}
	if err := model.EnsureChannelBaseURLSchema(); err != nil {
		common.ApiError(c, err)
		return
	}

	// Reuse the channel polling lock to prevent concurrent writes (e.g., enable/disable + edit) on the same channel.
	lock := model.GetChannelPollingLock(channel.Id)
	lock.Lock()
	defer lock.Unlock()

	switch action {
	case "list", "get":
		baseURLs, err := model.GetChannelBaseURLs(channel.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"items": baseURLs,
			},
		})
		return

	case "add", "create":
		if req.Url == nil {
			common.ApiErrorMsg(c, "url 不能为空")
			return
		}
		urlStr := strings.TrimSpace(*req.Url)
		if urlStr == "" {
			common.ApiErrorMsg(c, "url 不能为空")
			return
		}
		enabled := true
		if req.Enabled != nil {
			enabled = *req.Enabled
		}
		weight := 1
		if req.Weight != nil {
			weight = *req.Weight
		}
		sortOrder := 0
		if req.SortOrder != nil {
			sortOrder = *req.SortOrder
		}

		baseURL := &model.ChannelBaseURL{
			ChannelId: channel.Id,
			Url:       urlStr,
			Enabled:   enabled,
			Weight:    weight,
			SortOrder: sortOrder,
		}
		if err := applyChannelBaseURLRuntimeConfig(baseURL, req); err != nil {
			common.ApiError(c, err)
			return
		}
		if baseURL.Enabled {
			baseURL.MarkManualEnabled()
		} else {
			baseURL.MarkManualDisabled()
		}
		if err := model.DB.Create(baseURL).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		if enabled {
			baseURL.MarkManualEnabled()
		} else {
			baseURL.MarkManualDisabled()
		}
		if err := model.DB.Save(baseURL).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    baseURL,
		})
		return

	case "update", "edit":
		if req.BaseURLId == nil || *req.BaseURLId <= 0 {
			common.ApiErrorMsg(c, "base_url_id 无效")
			return
		}
		baseURL, found, err := model.GetChannelBaseURLByID(*req.BaseURLId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if !found || baseURL == nil {
			common.ApiErrorMsg(c, "base_url_id 不存在")
			return
		}
		if baseURL.ChannelId != channel.Id {
			common.ApiErrorMsg(c, "base_url_id 不属于该渠道")
			return
		}

		if req.Url != nil {
			baseURL.Url = strings.TrimSpace(*req.Url)
		}
		if req.Weight != nil {
			baseURL.Weight = *req.Weight
		}
		if req.SortOrder != nil {
			baseURL.SortOrder = *req.SortOrder
		}
		if err := applyChannelBaseURLRuntimeConfig(baseURL, req); err != nil {
			common.ApiError(c, err)
			return
		}
		if req.Enabled != nil {
			if *req.Enabled {
				baseURL.MarkManualEnabled()
			} else {
				baseURL.MarkManualDisabled()
			}
		}
		if strings.TrimSpace(baseURL.Url) == "" {
			common.ApiErrorMsg(c, "url 不能为空")
			return
		}

		if err := model.DB.Save(baseURL).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    baseURL,
		})
		return

	case "enable", "disable":
		if req.BaseURLId == nil || *req.BaseURLId <= 0 {
			common.ApiErrorMsg(c, "base_url_id 无效")
			return
		}
		baseURL, found, err := model.GetChannelBaseURLByID(*req.BaseURLId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if !found || baseURL == nil {
			common.ApiErrorMsg(c, "base_url_id 不存在")
			return
		}
		if baseURL.ChannelId != channel.Id {
			common.ApiErrorMsg(c, "base_url_id 不属于该渠道")
			return
		}
		if action == "enable" {
			baseURL.MarkManualEnabled()
		} else {
			baseURL.MarkManualDisabled()
		}
		if err := model.DB.Save(baseURL).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    baseURL,
		})
		return

	case "delete", "remove":
		if req.BaseURLId == nil || *req.BaseURLId <= 0 {
			common.ApiErrorMsg(c, "base_url_id 无效")
			return
		}
		if err := model.DB.Where("id = ? AND channel_id = ?", *req.BaseURLId, channel.Id).Delete(&model.ChannelBaseURL{}).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		model.InitChannelCache()
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "已删除",
		})
		return

	default:
		common.ApiErrorMsg(c, "不支持的 action")
		return
	}
}
