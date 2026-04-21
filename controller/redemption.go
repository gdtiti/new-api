package controller

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllRedemptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.GetAllRedemptions(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
}

func SearchRedemptions(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	redemptions, total, err := model.SearchRedemptions(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
}

func GetRedemption(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    redemption,
	})
}

func AddRedemption(c *gin.Context) {
	redemption := model.Redemption{}
	if err := c.ShouldBindJSON(&redemption); err != nil {
		common.ApiError(c, err)
		return
	}
	if !validateRedemptionPayload(c, &redemption, true, 0) {
		return
	}

	var keys []string
	for i := 0; i < redemption.Count; i++ {
		key := common.GetUUID()
		cleanRedemption := model.Redemption{
			UserId:             c.GetInt("id"),
			Name:               strings.TrimSpace(redemption.Name),
			Key:                key,
			Status:             common.RedemptionCodeStatusEnabled,
			Quota:              redemption.Quota,
			GrantType:          normalizeRedemptionGrantType(redemption.GrantType),
			SubscriptionPlanId: redemption.SubscriptionPlanId,
			MaxRedeemCount:     redemption.MaxRedeemCount,
			CreatedTime:        common.GetTimestamp(),
			ExpiredTime:        redemption.ExpiredTime,
		}
		if err := cleanRedemption.Insert(); err != nil {
			common.SysError("failed to insert redemption: " + err.Error())
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": i18n.T(c, i18n.MsgRedemptionCreateFailed),
				"data":    keys,
			})
			return
		}
		keys = append(keys, key)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
}

func DeleteRedemption(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := model.DeleteRedemptionById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func UpdateRedemption(c *gin.Context) {
	statusOnly := c.Query("status_only")
	redemption := model.Redemption{}
	if err := c.ShouldBindJSON(&redemption); err != nil {
		common.ApiError(c, err)
		return
	}
	cleanRedemption, err := model.GetRedemptionById(redemption.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly == "" {
		if !validateRedemptionPayload(c, &redemption, false, cleanRedemption.RedeemedCount) {
			return
		}
		cleanRedemption.Name = strings.TrimSpace(redemption.Name)
		cleanRedemption.Quota = redemption.Quota
		cleanRedemption.GrantType = normalizeRedemptionGrantType(redemption.GrantType)
		cleanRedemption.SubscriptionPlanId = redemption.SubscriptionPlanId
		cleanRedemption.MaxRedeemCount = redemption.MaxRedeemCount
		cleanRedemption.ExpiredTime = redemption.ExpiredTime
		if cleanRedemption.Status != common.RedemptionCodeStatusDisabled {
			if cleanRedemption.RedeemedCount >= cleanRedemption.MaxRedeemCount {
				cleanRedemption.Status = common.RedemptionCodeStatusUsed
			} else {
				cleanRedemption.Status = common.RedemptionCodeStatusEnabled
			}
		}
	}
	if statusOnly != "" {
		cleanRedemption.Status = redemption.Status
	}
	if err := cleanRedemption.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	updatedRedemption, err := model.GetRedemptionById(cleanRedemption.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    updatedRedemption,
	})
}

func DeleteInvalidRedemption(c *gin.Context) {
	rows, err := model.DeleteInvalidRedemptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

func validateExpiredTime(c *gin.Context, expired int64) (bool, string) {
	if expired != 0 && expired < common.GetTimestamp() {
		return false, i18n.T(c, i18n.MsgRedemptionExpireTimeInvalid)
	}
	return true, ""
}

func validateRedemptionPayload(c *gin.Context, redemption *model.Redemption, isCreate bool, redeemedCount int) bool {
	if redemption == nil {
		common.ApiErrorMsg(c, "参数错误")
		return false
	}
	redemption.Name = strings.TrimSpace(redemption.Name)
	if utf8.RuneCountInString(redemption.Name) == 0 || utf8.RuneCountInString(redemption.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgRedemptionNameLength)
		return false
	}
	if isCreate {
		if redemption.Count <= 0 {
			common.ApiErrorI18n(c, i18n.MsgRedemptionCountPositive)
			return false
		}
		if redemption.Count > 100 {
			common.ApiErrorI18n(c, i18n.MsgRedemptionCountMax)
			return false
		}
	}
	if valid, msg := validateExpiredTime(c, redemption.ExpiredTime); !valid {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return false
	}

	grantType := normalizeRedemptionGrantType(redemption.GrantType)
	if grantType != common.RedemptionGrantTypeQuota && grantType != common.RedemptionGrantTypeSubscription {
		common.ApiErrorMsg(c, "兑换码类型无效")
		return false
	}
	redemption.GrantType = grantType

	if redemption.MaxRedeemCount <= 0 {
		redemption.MaxRedeemCount = 1
	}
	if redemption.MaxRedeemCount < redeemedCount {
		common.ApiErrorMsg(c, "最大兑换次数不能小于已兑换次数")
		return false
	}

	switch grantType {
	case common.RedemptionGrantTypeQuota:
		redemption.SubscriptionPlanId = 0
		if redemption.Quota <= 0 {
			common.ApiErrorMsg(c, "额度必须大于 0")
			return false
		}
	case common.RedemptionGrantTypeSubscription:
		redemption.Quota = 0
		if redemption.SubscriptionPlanId <= 0 {
			common.ApiErrorMsg(c, "请选择订阅套餐")
			return false
		}
		plan, err := model.GetSubscriptionPlanById(redemption.SubscriptionPlanId)
		if err != nil {
			common.ApiErrorMsg(c, "订阅套餐不存在")
			return false
		}
		if !plan.Enabled {
			common.ApiErrorMsg(c, "订阅套餐未启用")
			return false
		}
	}

	return true
}

func normalizeRedemptionGrantType(grantType string) string {
	switch strings.TrimSpace(grantType) {
	case "", common.RedemptionGrantTypeQuota:
		return common.RedemptionGrantTypeQuota
	case common.RedemptionGrantTypeSubscription:
		return common.RedemptionGrantTypeSubscription
	default:
		return strings.TrimSpace(grantType)
	}
}
