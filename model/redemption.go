package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

// ErrRedeemFailed is returned when redemption fails due to internal error.
var ErrRedeemFailed = errors.New("redeem.failed")

type redeemBusinessError struct {
	message string
}

func (e *redeemBusinessError) Error() string {
	return e.message
}

func newRedeemBusinessError(message string) error {
	return &redeemBusinessError{message: message}
}

func isRedeemBusinessError(err error) bool {
	if err == nil {
		return false
	}
	var businessErr *redeemBusinessError
	return errors.As(err, &businessErr)
}

type Redemption struct {
	Id                    int            `json:"id"`
	UserId                int            `json:"user_id"`
	Key                   string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status                int            `json:"status" gorm:"default:1"`
	Name                  string         `json:"name" gorm:"index"`
	Quota                 int            `json:"quota" gorm:"default:100"`
	GrantType             string         `json:"grant_type" gorm:"type:varchar(32);default:'quota';index"`
	SubscriptionPlanId    int            `json:"subscription_plan_id" gorm:"type:int;default:0;index"`
	SubscriptionPlanTitle string         `json:"subscription_plan_title,omitempty" gorm:"-:all"`
	MaxRedeemCount        int            `json:"max_redeem_count" gorm:"type:int;default:1"`
	RedeemedCount         int            `json:"redeemed_count" gorm:"type:int;default:0"`
	CreatedTime           int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime          int64          `json:"redeemed_time" gorm:"bigint"`
	Count                 int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId            int            `json:"used_user_id"`
	DeletedAt             gorm.DeletedAt `gorm:"index"`
	ExpiredTime           int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

type RedemptionUsage struct {
	Id                    int    `json:"id"`
	RedemptionId          int    `json:"redemption_id" gorm:"index;uniqueIndex:idx_redemption_user_usage,priority:1"`
	UserId                int    `json:"user_id" gorm:"index;uniqueIndex:idx_redemption_user_usage,priority:2"`
	GrantType             string `json:"grant_type" gorm:"type:varchar(32);default:'quota';index"`
	QuotaDelta            int    `json:"quota_delta" gorm:"type:int;default:0"`
	SubscriptionPlanId    int    `json:"subscription_plan_id" gorm:"type:int;default:0;index"`
	GrantedSubscriptionId int    `json:"granted_subscription_id" gorm:"type:int;default:0;index"`
	RedeemedTime          int64  `json:"redeemed_time" gorm:"bigint;index"`
}

type RedeemResult struct {
	RedemptionId          int    `json:"redemption_id"`
	GrantType             string `json:"grant_type"`
	Quota                 int    `json:"quota"`
	SubscriptionPlanId    int    `json:"subscription_plan_id"`
	SubscriptionPlanTitle string `json:"subscription_plan_title,omitempty"`
	GrantedSubscriptionId int    `json:"granted_subscription_id"`
	RedeemedCount         int    `json:"redeemed_count"`
	MaxRedeemCount        int    `json:"max_redeem_count"`
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err = tx.Model(&Redemption{}).Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = hydrateRedemptionPlanTitles(redemptions); err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return redemptions, total, nil
}

func SearchRedemptions(keyword string, startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&Redemption{})
	if id, convErr := strconv.Atoi(keyword); convErr == nil {
		query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("name LIKE ?", keyword+"%")
	}

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = hydrateRedemptionPlanTitles(redemptions); err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return redemptions, total, nil
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	if err := DB.First(&redemption, "id = ?", id).Error; err != nil {
		return nil, err
	}
	if err := hydrateRedemptionPlanTitle(&redemption); err != nil {
		return nil, err
	}
	return &redemption, nil
}

func Redeem(key string, userId int) (*RedeemResult, error) {
	if key == "" {
		return nil, newRedeemBusinessError("未提供兑换码")
	}
	if userId == 0 {
		return nil, newRedeemBusinessError("无效的用户 ID")
	}

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}

	redemption := &Redemption{}
	result := &RedeemResult{}
	upgradeGroup := ""

	common.RandomSleep()
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return newRedeemBusinessError("无效的兑换码")
			}
			return err
		}

		grantType := normalizeRedemptionGrantType(redemption.GrantType)
		maxRedeemCount := normalizeMaxRedeemCount(redemption.MaxRedeemCount)
		now := common.GetTimestamp()

		if redemption.Status == common.RedemptionCodeStatusDisabled {
			return newRedeemBusinessError("该兑换码已被禁用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < now {
			return newRedeemBusinessError("该兑换码已过期")
		}
		if redemption.RedeemedCount >= maxRedeemCount {
			return newRedeemBusinessError("该兑换码已达最大兑换次数")
		}

		var usageCount int64
		if err := tx.Model(&RedemptionUsage{}).
			Where("redemption_id = ? AND user_id = ?", redemption.Id, userId).
			Count(&usageCount).Error; err != nil {
			return err
		}
		if usageCount > 0 || (redemption.UsedUserId == userId && redemption.RedeemedCount <= 1) {
			return newRedeemBusinessError("你已兑换过该兑换码")
		}

		usage := &RedemptionUsage{
			RedemptionId: redemption.Id,
			UserId:       userId,
			GrantType:    grantType,
			RedeemedTime: now,
		}
		result.RedemptionId = redemption.Id
		result.GrantType = grantType
		result.MaxRedeemCount = maxRedeemCount

		switch grantType {
		case common.RedemptionGrantTypeQuota:
			if redemption.Quota <= 0 {
				return newRedeemBusinessError("兑换码额度无效")
			}
			if err := tx.Model(&User{}).
				Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error; err != nil {
				return err
			}
			usage.QuotaDelta = redemption.Quota
			result.Quota = redemption.Quota
		case common.RedemptionGrantTypeSubscription:
			if redemption.SubscriptionPlanId <= 0 {
				return newRedeemBusinessError("兑换码对应的订阅套餐不存在")
			}
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.SubscriptionPlanId)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return newRedeemBusinessError("兑换码对应的订阅套餐不存在")
				}
				return err
			}
			if !plan.Enabled {
				return newRedeemBusinessError("兑换码对应的订阅套餐已禁用")
			}
			subscription, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if err != nil {
				if strings.Contains(err.Error(), "购买上限") {
					return newRedeemBusinessError(err.Error())
				}
				return err
			}
			grantKey := fmt.Sprintf("redemption:%d:user:%d", redemption.Id, userId)
			if err := tx.Model(subscription).Update("grant_key", grantKey).Error; err != nil {
				if isDuplicateConstraintError(err) {
					return newRedeemBusinessError("你已兑换过该兑换码")
				}
				return err
			}
			usage.SubscriptionPlanId = plan.Id
			usage.GrantedSubscriptionId = subscription.Id
			result.SubscriptionPlanId = plan.Id
			result.SubscriptionPlanTitle = plan.Title
			result.GrantedSubscriptionId = subscription.Id
			upgradeGroup = strings.TrimSpace(plan.UpgradeGroup)
		default:
			return newRedeemBusinessError("兑换码发放类型无效")
		}

		if err := tx.Create(usage).Error; err != nil {
			if isDuplicateConstraintError(err) {
				return newRedeemBusinessError("你已兑换过该兑换码")
			}
			return err
		}

		redemption.GrantType = grantType
		redemption.MaxRedeemCount = maxRedeemCount
		redemption.RedeemedCount++
		redemption.RedeemedTime = now
		redemption.UsedUserId = userId
		if redemption.RedeemedCount >= maxRedeemCount {
			redemption.Status = common.RedemptionCodeStatusUsed
		} else {
			redemption.Status = common.RedemptionCodeStatusEnabled
		}
		if err := tx.Model(redemption).
			Select("grant_type", "max_redeem_count", "redeemed_count", "redeemed_time", "status", "used_user_id").
			Updates(redemption).Error; err != nil {
			return err
		}

		result.RedeemedCount = redemption.RedeemedCount
		return nil
	})
	if err != nil {
		if isRedeemBusinessError(err) {
			return nil, err
		}
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}

	if result.GrantType == common.RedemptionGrantTypeQuota {
		if user, userErr := GetUserById(userId, false); userErr == nil {
			if cacheErr := updateUserCache(*user); cacheErr != nil {
				common.SysLog("failed to update user cache after redeem: " + cacheErr.Error())
			}
		}
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(result.Quota), redemption.Id))
		return result, nil
	}

	if upgradeGroup != "" {
		_ = UpdateUserGroupCache(userId, upgradeGroup)
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码开通订阅套餐 %s，兑换码ID %d", result.SubscriptionPlanTitle, redemption.Id))
	return result, nil
}

func (redemption *Redemption) Insert() error {
	return DB.Create(redemption).Error
}

func (redemption *Redemption) SelectUpdate() error {
	return DB.Model(redemption).
		Select("grant_type", "subscription_plan_id", "max_redeem_count", "redeemed_count", "redeemed_time", "status", "used_user_id").
		Updates(redemption).Error
}

// Update Make sure your redemption fields are completed, because this will update zero values only for selected columns.
func (redemption *Redemption) Update() error {
	return DB.Model(redemption).
		Select("name", "status", "quota", "grant_type", "subscription_plan_id", "max_redeem_count", "redeemed_count", "redeemed_time", "expired_time").
		Updates(redemption).Error
}

func (redemption *Redemption) Delete() error {
	return DB.Delete(redemption).Error
}

func DeleteRedemptionById(id int) error {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	if err := DB.Where(redemption).First(&redemption).Error; err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where(
		"status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)",
		[]int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled},
		common.RedemptionCodeStatusEnabled,
		now,
	).Delete(&Redemption{})
	return result.RowsAffected, result.Error
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

func normalizeMaxRedeemCount(maxRedeemCount int) int {
	if maxRedeemCount <= 0 {
		return 1
	}
	return maxRedeemCount
}

func hydrateRedemptionPlanTitle(redemption *Redemption) error {
	if redemption == nil {
		return nil
	}
	return hydrateRedemptionPlanTitles([]*Redemption{redemption})
}

func hydrateRedemptionPlanTitles(redemptions []*Redemption) error {
	if len(redemptions) == 0 {
		return nil
	}

	planIDs := make([]int, 0, len(redemptions))
	seen := make(map[int]struct{}, len(redemptions))
	for _, redemption := range redemptions {
		if redemption == nil {
			continue
		}
		if normalizeRedemptionGrantType(redemption.GrantType) != common.RedemptionGrantTypeSubscription {
			continue
		}
		if redemption.SubscriptionPlanId <= 0 {
			continue
		}
		if _, ok := seen[redemption.SubscriptionPlanId]; ok {
			continue
		}
		seen[redemption.SubscriptionPlanId] = struct{}{}
		planIDs = append(planIDs, redemption.SubscriptionPlanId)
	}
	if len(planIDs) == 0 {
		return nil
	}

	type planInfo struct {
		Id    int
		Title string
	}
	var plans []planInfo
	if err := DB.Model(&SubscriptionPlan{}).
		Select("id", "title").
		Where("id IN ?", planIDs).
		Find(&plans).Error; err != nil {
		return err
	}
	titleMap := make(map[int]string, len(plans))
	for _, plan := range plans {
		titleMap[plan.Id] = plan.Title
	}
	for _, redemption := range redemptions {
		if redemption == nil || redemption.SubscriptionPlanId <= 0 {
			continue
		}
		redemption.SubscriptionPlanTitle = titleMap[redemption.SubscriptionPlanId]
	}
	return nil
}

func isDuplicateConstraintError(err error) bool {
	if err == nil {
		return false
	}
	lowerErr := strings.ToLower(err.Error())
	return strings.Contains(lowerErr, "unique") || strings.Contains(lowerErr, "duplicate")
}
