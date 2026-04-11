package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func GetChannelLogAnalytics(c *gin.Context) {
	filter, ok := parseLogAnalyticsFilter(c)
	if !ok {
		return
	}
	result, err := model.GetLogAnalytics(filter, model.LogAnalyticsDimensionChannel)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func GetModelLogAnalytics(c *gin.Context) {
	filter, ok := parseLogAnalyticsFilter(c)
	if !ok {
		return
	}
	result, err := model.GetLogAnalytics(filter, model.LogAnalyticsDimensionModel)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

func parseLogAnalyticsFilter(c *gin.Context) (model.LogAnalyticsFilter, bool) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if startTimestamp != 0 && endTimestamp != 0 && endTimestamp < startTimestamp {
		common.ApiErrorMsg(c, "结束时间不能早于起始时间")
		return model.LogAnalyticsFilter{}, false
	}
	return model.LogAnalyticsFilter{
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		Username:       c.Query("username"),
		DefaultTime:    c.DefaultQuery("default_time", "day"),
	}, true
}
