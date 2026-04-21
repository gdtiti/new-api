package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id           int            `json:"id"`
	UserId       int            `json:"user_id"`
	Key          string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status       int            `json:"status" gorm:"default:1"`
	Name         string         `json:"name" gorm:"index"`
	RewardType   string         `json:"reward_type" gorm:"type:varchar(32);not null;default:'quota'"`
	Quota        int            `json:"quota" gorm:"default:100"`
	PlanId       int            `json:"plan_id" gorm:"default:0;index"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime int64          `json:"redeemed_time" gorm:"bigint"`
	Count        int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId   int            `json:"used_user_id"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	ExpiredTime  int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

const (
	RedemptionRewardTypeQuota        = "quota"
	RedemptionRewardTypeSubscription = "subscription"
)

type RedeemResult struct {
	RewardType       string            `json:"reward_type"`
	Quota            int               `json:"quota"`
	PlanId           int               `json:"plan_id,omitempty"`
	Subscription     *UserSubscription `json:"subscription,omitempty"`
	DisplayMessage   string            `json:"display_message,omitempty"`
	WalletQuotaDelta int               `json:"wallet_quota_delta,omitempty"`
}

func NormalizeRedemptionRewardType(rewardType string) string {
	switch strings.TrimSpace(rewardType) {
	case RedemptionRewardTypeSubscription:
		return RedemptionRewardTypeSubscription
	default:
		return RedemptionRewardTypeQuota
	}
}

func GetAllRedemptions(startIdx int, num int) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 获取总数
	err = tx.Model(&Redemption{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
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

	// Build query based on keyword type
	query := tx.Model(&Redemption{})

	// Only try to convert to ID if the string represents a valid integer
	if id, err := strconv.Atoi(keyword); err == nil {
		query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("name LIKE ?", keyword+"%")
	}

	// Get total count
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated data
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
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
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func Redeem(key string, userId int) (*RedeemResult, error) {
	if key == "" {
		return nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return nil, errors.New("无效的 user id")
	}
	redemption := &Redemption{}
	result := &RedeemResult{}

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err := DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", key).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		redemption.RewardType = NormalizeRedemptionRewardType(redemption.RewardType)
		switch redemption.RewardType {
		case RedemptionRewardTypeSubscription:
			plan, err := getSubscriptionPlanByIdTx(tx, redemption.PlanId)
			if err != nil {
				return err
			}
			sub, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "redemption")
			if err != nil {
				return err
			}
			result.RewardType = RedemptionRewardTypeSubscription
			result.PlanId = redemption.PlanId
			result.Subscription = sub
			if sub != nil && sub.Status == SubscriptionStatusQueued {
				result.DisplayMessage = fmt.Sprintf("订阅兑换成功，将于 %s 生效", time.Unix(sub.StartTime, 0).Format("2006-01-02 15:04:05"))
			} else {
				result.DisplayMessage = "订阅兑换成功"
			}
		default:
			quota, _, err := grantUserQuotaTx(tx, userId, redemption.Quota, 0, UserQuotaGrantSourceRedemption, fmt.Sprintf("redemption:%d", redemption.Id))
			if err != nil {
				return err
			}
			result.RewardType = RedemptionRewardTypeQuota
			result.Quota = redemption.Quota
			result.WalletQuotaDelta = redemption.Quota
			result.DisplayMessage = fmt.Sprintf("成功兑换额度 %s", logger.LogQuota(redemption.Quota))
			_ = quota
		}
		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return nil, ErrRedeemFailed
	}
	if result.RewardType == RedemptionRewardTypeSubscription {
		RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码开通订阅，兑换码ID %d，套餐ID %d", redemption.Id, redemption.PlanId))
		return result, nil
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	return result, nil
}

func (redemption *Redemption) Insert() error {
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	var err error
	err = DB.Model(redemption).Select("name", "status", "reward_type", "quota", "plan_id", "redeemed_time", "expired_time").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}
